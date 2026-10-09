use crate::{
    engine::{ChatRequest, Engine, Flow},
    error::{AppError, AppResult},
    model::*,
    platform::Platform,
    prompt::{self, AnswerParser, ParseEvent, RetrievedPassage},
    store::{NewPassage, Store},
};
use std::sync::{
    Arc, OnceLock,
    atomic::{AtomicU32, Ordering},
};
use std::time::Instant;
use tauri::Emitter;

pub struct TurnControl {
    current: AtomicU32,
}
impl TurnControl {
    pub fn new() -> Self {
        Self {
            current: AtomicU32::new(0),
        }
    }
    pub fn begin(&self) -> TurnId {
        TurnId(self.current.fetch_add(1, Ordering::SeqCst).wrapping_add(1))
    }
    pub fn cancel(&self) {
        self.current.fetch_add(1, Ordering::SeqCst);
    }
    pub fn is_current(&self, id: TurnId) -> bool {
        self.current.load(Ordering::SeqCst) == id.0
    }
}

impl Default for TurnControl {
    fn default() -> Self {
        Self::new()
    }
}

pub struct AppState {
    pub store: Arc<Store>,
    pub engine: Arc<OnceLock<Engine>>,
    pub platform: Arc<dyn Platform>,
    pub turns: Arc<TurnControl>,
}

pub fn run_turn(
    app: tauri::AppHandle,
    state: Arc<AppState>,
    request: AskRequest,
) -> AppResult<TurnId> {
    let id = state.turns.begin();
    if let Some(engine) = state.engine.get()
        && let Some(s) = &engine.speaker
    {
        s.stop();
    }
    let tid = id;
    std::thread::spawn(move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            run(&app, &state, tid, request)
        }));
        match result {
            Ok(Ok(())) => {}
            Ok(Err(_e)) if !state.turns.is_current(tid) => {
                if let Some(s) = state
                    .engine
                    .get()
                    .and_then(|engine| engine.speaker.as_ref())
                {
                    s.stop();
                }
                emit(&app, TurnEvent::Cancelled { turn_id: tid });
            }
            Ok(Err(e)) => emit(
                &app,
                TurnEvent::Failed {
                    turn_id: tid,
                    message: e.message,
                },
            ),
            Err(_) if !state.turns.is_current(tid) => {
                if let Some(s) = state
                    .engine
                    .get()
                    .and_then(|engine| engine.speaker.as_ref())
                {
                    s.stop();
                }
                emit(&app, TurnEvent::Cancelled { turn_id: tid });
            }
            Err(_) => emit(
                &app,
                TurnEvent::Failed {
                    turn_id: tid,
                    message: "turn processing failed unexpectedly".into(),
                },
            ),
        }
    });
    Ok(id)
}
fn emit(app: &tauri::AppHandle, event: TurnEvent) {
    if let Err(e) = app.emit(crate::EVENT_TURN, event) {
        tracing::warn!("could not emit turn event: {e}");
    }
}
fn run(app: &tauri::AppHandle, state: &AppState, id: TurnId, request: AskRequest) -> AppResult<()> {
    let started = Instant::now();
    let check = || state.turns.is_current(id);
    if !check() {
        if let Some(s) = state
            .engine
            .get()
            .and_then(|engine| engine.speaker.as_ref())
        {
            s.stop();
        }
        emit(app, TurnEvent::Cancelled { turn_id: id });
        return Ok(());
    }
    let engine = state.engine.wait();
    let agent = match request.agent_id {
        Some(a) => state.store.agent_get(a)?,
        None => state
            .store
            .active_agent()?
            .ok_or_else(|| AppError::invalid("no agent — pick a template first"))?,
    };
    let mut transcribe_ms = None;
    let question = match request.input {
        AskInput::Text { text } => {
            let text = text.trim().to_owned();
            if text.is_empty() {
                return Err(AppError::invalid("question must not be empty"));
            }
            text
        }
        AskInput::Voice => {
            emit(
                app,
                TurnEvent::Phase {
                    turn_id: id,
                    phase: TurnPhase::Transcribing,
                },
            );
            let t = Instant::now();
            let mic = engine
                .microphone
                .as_ref()
                .ok_or_else(|| AppError::unavailable("microphone is not available"))?;
            let pcm = mic.stop().map_err(AppError::from)?;
            let trans = engine
                .transcriber
                .as_ref()
                .ok_or_else(|| AppError::unavailable("speech-to-text is not available"))?;
            let text = trans
                .transcribe(&pcm, agent.draft.language)
                .map_err(AppError::from)?;
            transcribe_ms = Some(ms(t));
            text.trim().to_owned()
        }
    };
    if question.is_empty() {
        return Err(AppError::invalid("transcribed question is empty"));
    }
    emit(
        app,
        TurnEvent::Question {
            turn_id: id,
            text: question.clone(),
        },
    );
    emit(
        app,
        TurnEvent::Phase {
            turn_id: id,
            phase: TurnPhase::Thinking,
        },
    );
    let mut screen_ms = None;
    let snapshot = if request.screen_help {
        let t = Instant::now();
        let s = state
            .platform
            .snapshot(crate::platform::MAX_SNAPSHOT_ELEMENTS)
            .map_err(AppError::from)?;
        screen_ms = Some(ms(t));
        Some(s)
    } else {
        None
    };
    let mut retrieval_ms = 0;
    let mut hits = Vec::new();
    if !agent.draft.knowledge_base_ids.is_empty() {
        let t = Instant::now();
        let embed = engine
            .embedder
            .as_ref()
            .ok_or_else(|| AppError::unavailable("embedding model is not available"))?;
        let q = embed.embed_query(&question).map_err(AppError::from)?;
        hits = state.store.search(&agent.draft.knowledge_base_ids, &q, 5)?;
        retrieval_ms = ms(t);
    }
    let passages: Vec<_> = hits
        .iter()
        .map(|h| RetrievedPassage {
            document_name: &h.document_name,
            location: &h.location,
            text: &h.text,
        })
        .collect();
    let prompt = prompt::build(&prompt::PromptInput {
        agent: &agent.draft,
        question: &question,
        snapshot: snapshot.as_ref(),
        passages: &passages,
    });
    let ids = snapshot
        .as_ref()
        .map(|s| s.elements.iter().map(|e| e.id.clone()).collect::<Vec<_>>())
        .unwrap_or_default();
    let mut target = None;
    let mut sent_target = false;
    let mut answering = false;
    let monitors = snapshot.as_ref().map(|_| crate::pointer::monitors(app));
    let mut on_event = |event| match event {
        ParseEvent::Target(element_id) => {
            let position = element_id
                .as_ref()
                .and_then(|eid| snapshot.as_ref()?.elements.iter().find(|e| &e.id == eid))
                .and_then(|element| crate::pointer::locate(element, monitors.as_deref()?));
            target = position.clone();
            emit(
                app,
                TurnEvent::Target {
                    turn_id: id,
                    target: position,
                },
            );
            sent_target = true;
        }
        ParseEvent::Sentence(sentence) => {
            if !sent_target {
                emit(
                    app,
                    TurnEvent::Target {
                        turn_id: id,
                        target: None,
                    },
                );
                sent_target = true;
            }
            if !answering {
                emit(
                    app,
                    TurnEvent::Phase {
                        turn_id: id,
                        phase: TurnPhase::Answering,
                    },
                );
                answering = true;
            }
            emit(
                app,
                TurnEvent::Sentence {
                    turn_id: id,
                    text: sentence.clone(),
                },
            );
            if let Some(speaker) = &engine.speaker
                && let Err(e) = speaker.speak(
                    &sentence,
                    agent.draft.voice_id.as_deref(),
                    agent.draft.language,
                    agent.draft.speech_rate,
                )
            {
                tracing::warn!("speech failed: {e}");
            }
        }
    };
    let mut parser = AnswerParser::new(ids, u32::try_from(hits.len()).unwrap_or(u32::MAX));
    let chat = engine
        .chat
        .as_ref()
        .ok_or_else(|| AppError::unavailable("chat model is not available"))?;
    let stats = chat
        .generate(
            &ChatRequest {
                system: &prompt.system,
                user: &prompt.user,
                max_tokens: prompt.max_tokens,
            },
            &mut |piece| {
                if !check() {
                    return Flow::Stop;
                }
                for event in parser.push(piece) {
                    on_event(event);
                }
                Flow::Continue
            },
        )
        .map_err(AppError::from)?;
    if !check() {
        if let Some(s) = &engine.speaker {
            s.stop();
        }
        emit(app, TurnEvent::Cancelled { turn_id: id });
        return Ok(());
    }
    let (events, parsed) = parser.finish();
    for event in events {
        on_event(event);
    }
    drop(on_event);
    if !sent_target {
        emit(
            app,
            TurnEvent::Target {
                turn_id: id,
                target: None,
            },
        );
    }
    let answer_text = parsed.text;
    let citations = parsed
        .cited
        .iter()
        .filter_map(|n| {
            hits.get(n.saturating_sub(1) as usize).map(|h| Citation {
                marker: *n,
                passage_id: h.passage_id,
                document_id: h.document_id,
                document_name: h.document_name.clone(),
                location: h.location.clone(),
            })
        })
        .collect();
    emit(
        app,
        TurnEvent::Finished {
            answer: Answer {
                turn_id: id,
                question,
                text: answer_text,
                citations,
                target,
                confidence: Confidence::Normal,
                latency: Latency {
                    transcribe_ms,
                    screen_ms,
                    retrieval_ms,
                    first_token_ms: Some(stats.first_token_ms),
                    total_ms: ms(started),
                },
            },
        },
    );
    Ok(())
}
fn ms(t: Instant) -> u32 {
    u32::try_from(t.elapsed().as_millis()).unwrap_or(u32::MAX)
}

pub fn import_document(
    app: tauri::AppHandle,
    state: Arc<AppState>,
    kb: KnowledgeBaseId,
    path: std::path::PathBuf,
) -> AppResult<Document> {
    let bytes = std::fs::read(&path)
        .map_err(|e| AppError::new(crate::error::ErrorKind::Io, e.to_string()))?;
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let kind = DocumentKind::from_extension(&ext)
        .ok_or_else(|| AppError::invalid(format!(".{ext} files are not supported yet")))?;
    let fp = crate::ingest::fingerprint(&bytes);
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document");
    let doc = state.store.doc_create(kb, name, kind, &fp)?;
    if let Err(e) = app.emit(crate::EVENT_DOCUMENT, doc.clone()) {
        tracing::warn!("could not emit document event: {e}");
    }
    let docid = doc.id;
    std::thread::spawn(move || {
        let result =
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| -> AppResult<Document> {
                let d = state
                    .store
                    .doc_set_status(docid, DocumentStatus::Processing, None)?;
                let _ = app.emit(crate::EVENT_DOCUMENT, d);
                let extracted = crate::ingest::extract(&bytes, kind).map_err(AppError::from)?;
                let chunks = crate::ingest::chunk(
                    &extracted.sections,
                    crate::ingest::TARGET_TOKENS,
                    crate::ingest::OVERLAP_TOKENS,
                );
                let engine = state.engine.wait();
                let embed = engine
                    .embedder
                    .as_ref()
                    .ok_or_else(|| AppError::unavailable("embedding model not available"))?;
                let mut passages = Vec::with_capacity(chunks.len());
                for batch in chunks.chunks(16) {
                    let refs = batch.iter().map(|c| c.text.as_str()).collect::<Vec<_>>();
                    let vectors = embed.embed_documents(&refs).map_err(AppError::from)?;
                    for (c, embedding) in batch.iter().zip(vectors) {
                        passages.push(NewPassage {
                            text: c.text.clone(),
                            location: c.location.clone(),
                            token_count: c.token_count,
                            embedding,
                        });
                    }
                }
                let d = state
                    .store
                    .doc_store_passages(docid, extracted.page_count, &passages)?;
                let _ = app.emit(crate::EVENT_DOCUMENT, d.clone());
                Ok(d)
            }));
        let failed = match result {
            Ok(Ok(_)) => return,
            Ok(Err(e)) => e.message,
            Err(_) => "document processing failed unexpectedly".into(),
        };
        tracing::warn!(document_id=%docid.0,"document import failed: {failed}");
        match state
            .store
            .doc_set_status(docid, DocumentStatus::Failed, Some(&failed))
        {
            Ok(d) => {
                let _ = app.emit(crate::EVENT_DOCUMENT, d);
            }
            Err(e) => tracing::error!("could not mark document failed: {e}"),
        }
    });
    Ok(doc)
}

pub fn stop(state: &AppState) {
    state.turns.cancel();
    if let Some(engine) = state.engine.get()
        && let Some(s) = &engine.speaker
    {
        s.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn turns_supersede_and_cancel() {
        let t = TurnControl::new();
        let a = t.begin();
        let b = t.begin();
        assert!(!t.is_current(a));
        assert!(t.is_current(b));
        t.cancel();
        assert!(!t.is_current(b));
    }
}
