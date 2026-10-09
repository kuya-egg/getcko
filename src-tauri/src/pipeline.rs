use crate::{
    engine::{ChatRequest, Engine, Flow, ImagePart},
    error::{AppError, AppResult},
    model::*,
    platform::Platform,
    prompt::{self, AnswerParser, Pointed, RetrievedPassage, TurnPrompt},
    store::{NewPassage, Store},
};
use std::sync::{
    Arc, Mutex, OnceLock,
    atomic::{AtomicU32, Ordering},
};
use std::time::{Duration, Instant};
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
    /// Screen read when push-to-talk started; a voice turn uses it if fresh.
    pub prepared: Mutex<Option<PreparedScreen>>,
}

/// A snapshot taken at push-to-talk start, whose prompt prefix was evaluated
/// while the user was speaking.
pub struct PreparedScreen {
    taken: Instant,
    snapshot: ScreenSnapshot,
}

/// A prepared screen older than this is re-read instead.
const PREPARED_MAX_AGE: Duration = Duration::from_secs(60);
/// Element ids are a few tokens; the grammar ends the reply after one.
const TARGET_MAX_TOKENS: u32 = 8;
/// `[yyyy, xxxx]` can take one token per character; the grammar ends it sooner.
const POINT_MAX_TOKENS: u32 = 16;

/// Reads the screen and evaluates the active agent's prompt prefix for it, so a
/// voice turn only evaluates the question and passages. Runs while the user speaks;
/// failures only cost that head start.
pub fn prepare_turn(state: &AppState) {
    let snapshot = match state
        .platform
        .snapshot(crate::platform::MAX_SNAPSHOT_ELEMENTS)
    {
        Ok(snapshot) => snapshot,
        Err(error) => {
            tracing::debug!(%error, "screen not prepared");
            return;
        }
    };
    let taken = Instant::now();
    if let Ok(mut prepared) = state.prepared.lock() {
        *prepared = Some(PreparedScreen {
            taken,
            snapshot: snapshot.clone(),
        });
    }
    let prefilled = (|| -> AppResult<()> {
        let agent = state
            .store
            .active_agent()?
            .ok_or_else(|| AppError::invalid("no active agent"))?;
        let engine = state
            .engine
            .get()
            .ok_or_else(|| AppError::unavailable("models are loading"))?;
        let chat = engine
            .chat
            .as_ref()
            .ok_or_else(|| AppError::unavailable("chat model is not available"))?;
        let turn = TurnPrompt::new(&agent.draft, Some(&snapshot), &[]);
        chat.prefill(&ChatRequest {
            system: &turn.system,
            user: turn.warm_user(),
            max_tokens: turn.max_tokens,
            grammar: None,
            image: None,
        })
        .map_err(AppError::from)
    })();
    if let Err(error) = prefilled {
        tracing::debug!(error = %error.message, "prompt not prefilled");
    }
}

pub fn run_turn(
    app: tauri::AppHandle,
    state: Arc<AppState>,
    request: AskRequest,
) -> AppResult<TurnId> {
    validate_task(request.task.as_deref().unwrap_or_default())?;
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
fn validate_task(task: &[TaskStep]) -> AppResult<()> {
    if task.len() > MAX_TASK_STEPS - 1 {
        return Err(AppError::invalid("a guided task has at most 5 steps"));
    }
    Ok(())
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
    // A voice turn reuses the screen read (and prefilled) when push-to-talk started.
    let prepared = state.prepared.lock().ok().and_then(|mut p| p.take());
    let mut screen_ms = None;
    let snapshot = if request.screen_help {
        let fresh = prepared
            .filter(|p| {
                matches!(request.input, AskInput::Voice) && p.taken.elapsed() < PREPARED_MAX_AGE
            })
            .map(|p| p.snapshot);
        match fresh {
            Some(snapshot) => Some(snapshot),
            None => {
                let t = Instant::now();
                let s = state
                    .platform
                    .snapshot(crate::platform::MAX_SNAPSHOT_ELEMENTS)
                    .map_err(AppError::from)?;
                screen_ms = Some(ms(t));
                Some(s)
            }
        }
    } else {
        None
    };
    // Tiers 2-3: a screenshot when the element list is weak or empty.
    let mut capture_ms = None;
    let mut mode = snapshot.as_ref().map(screen_mode);
    let mut screenshot = None;
    if let (Some(wanted), Some(snap)) = (mode, snapshot.as_ref())
        && wanted != ScreenMode::Elements
    {
        let t = Instant::now();
        match capture_screen(app, state.platform.as_ref()) {
            Ok(capture) => {
                let marks = (wanted == ScreenMode::ElementsWithImage).then_some(&snap.elements[..]);
                screenshot = Some(crate::screenshot::prepare(capture, marks));
                capture_ms = Some(ms(t));
            }
            Err(error) => {
                tracing::info!(%error, "no screenshot; using the element list only");
                mode = Some(ScreenMode::Elements);
            }
        }
    }
    // Nothing on screen could be read (no elements, no screenshot): no tier applies.
    if screenshot.is_none() && snapshot.as_ref().is_some_and(|s| s.elements.is_empty()) {
        mode = None;
    }
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
    let thinking = Instant::now();
    let chat = engine
        .chat
        .as_ref()
        .ok_or_else(|| AppError::unavailable("chat model is not available"))?;
    let turn = TurnPrompt::new(
        &agent.draft,
        snapshot.as_ref(),
        request.task.as_deref().unwrap_or_default(),
    );

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

    let body = turn.body(&question, &passages);
    // Without an image the task ends the user text; with one it follows the image.
    let user_text = |task: &str| match &screenshot {
        Some(_) => body.clone(),
        None => format!("{body}{task}"),
    };

    // Pass 1: where to point. Element ids (tiers 1-2) or a screenshot point (tier 3),
    // constrained by a grammar.
    let mut pointed = Pointed::Nothing;
    let mut target = None;
    let mut confidence = Confidence::Normal;
    if let (Some(mode), Some(screen)) = (mode, snapshot.as_ref())
        && (mode == ScreenMode::ImageOnly || !screen.elements.is_empty())
    {
        let task = TurnPrompt::target_task(mode);
        let grammar = match mode {
            ScreenMode::ImageOnly => crate::screenshot::POINT_GRAMMAR.to_owned(),
            _ => prompt::target_grammar(screen),
        };
        let user = user_text(&task);
        let mut reply = String::new();
        chat.generate(
            &ChatRequest {
                system: &turn.system,
                user: &user,
                max_tokens: if mode == ScreenMode::ImageOnly {
                    POINT_MAX_TOKENS
                } else {
                    TARGET_MAX_TOKENS
                },
                grammar: Some(&grammar),
                image: screenshot.as_ref().map(|s| ImagePart {
                    image: &s.image,
                    text_after: &task,
                }),
            },
            &mut |piece| {
                reply.push_str(piece);
                if check() { Flow::Continue } else { Flow::Stop }
            },
        )
        .map_err(AppError::from)?;
        // An element id, `[y, x]` or `none`: never user text.
        tracing::debug!(?mode, reply = %reply, "target pass");
        match (mode, screenshot.as_ref()) {
            (ScreenMode::ImageOnly, Some(shot)) => {
                if let Some((x, y)) = crate::screenshot::parse_point(shot, &reply) {
                    let (px, py) = crate::screenshot::to_physical(shot, x, y);
                    target = Some(crate::pointer::locate_point(px, py, shot.monitor));
                    pointed = Pointed::Guess;
                    confidence = Confidence::BestGuess;
                }
            }
            _ => {
                if let Some(element) = prompt::target_element(&reply, screen) {
                    target = crate::pointer::locate(element, &crate::pointer::monitors(app));
                    pointed = Pointed::Element(element);
                }
            }
        }
    }
    if !check() {
        emit(app, TurnEvent::Cancelled { turn_id: id });
        return Ok(());
    }
    emit(
        app,
        TurnEvent::Target {
            turn_id: id,
            target: target.clone(),
        },
    );

    // Pass 2: the spoken answer; shares the prompt prefix evaluated by pass 1.
    let mut answering = false;
    let mut first_token_ms = None;
    let mut on_sentence = |sentence: String| {
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
    };
    let mut parser = AnswerParser::new(u32::try_from(hits.len()).unwrap_or(u32::MAX));
    let answer_task = TurnPrompt::answer_task(pointed);
    let answer_user = user_text(&answer_task);
    chat.generate(
        &ChatRequest {
            system: &turn.system,
            user: &answer_user,
            max_tokens: turn.max_tokens,
            grammar: None,
            image: screenshot.as_ref().map(|s| ImagePart {
                image: &s.image,
                text_after: &answer_task,
            }),
        },
        &mut |piece| {
            if !check() {
                return Flow::Stop;
            }
            first_token_ms.get_or_insert_with(|| ms(thinking));
            for sentence in parser.push(piece) {
                on_sentence(sentence);
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
    let (sentences, parsed) = parser.finish();
    for sentence in sentences {
        on_sentence(sentence);
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
    tracing::debug!(
        screen_mode = ?mode,
        ?confidence,
        pointed = target.is_some(),
        capture_ms,
        total_ms = ms(started),
        "turn finished"
    );
    emit(
        app,
        TurnEvent::Finished {
            answer: Answer {
                turn_id: id,
                question,
                text: answer_text,
                citations,
                target,
                confidence,
                screen_mode: mode,
                latency: Latency {
                    transcribe_ms,
                    screen_ms,
                    capture_ms,
                    retrieval_ms,
                    first_token_ms,
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

/// Labelled elements needed before the element list alone is trusted.
const MIN_LABELLED: usize = 5;
/// More elements than this sharing one label (look-alike cells, icons) makes the
/// list ambiguous without a picture.
const MAX_SAME_LABEL: usize = 3;

/// Tier for a snapshot (architecture: three tiers). `GETCKO_SCREEN_MODE` =
/// `elements` | `elementsWithImage` | `imageOnly` forces one, for measurement.
fn screen_mode(snapshot: &ScreenSnapshot) -> ScreenMode {
    match std::env::var("GETCKO_SCREEN_MODE").as_deref() {
        Ok("elements") => ScreenMode::Elements,
        Ok("elementsWithImage") => ScreenMode::ElementsWithImage,
        Ok("imageOnly") => ScreenMode::ImageOnly,
        _ => tier_for(snapshot),
    }
}

fn tier_for(snapshot: &ScreenSnapshot) -> ScreenMode {
    if snapshot.elements.is_empty() {
        return ScreenMode::ImageOnly;
    }
    let mut counts = std::collections::HashMap::new();
    for element in snapshot
        .elements
        .iter()
        .filter(|e| !e.label.trim().is_empty())
    {
        *counts.entry(element.label.trim()).or_insert(0usize) += 1;
    }
    let labelled: usize = counts.values().sum();
    if labelled >= MIN_LABELLED && counts.values().all(|&n| n <= MAX_SAME_LABEL) {
        ScreenMode::Elements
    } else {
        ScreenMode::ElementsWithImage
    }
}

/// Captures the screen with GetCko's overlay hidden, so the gecko and answer card
/// never appear in what the model sees (same code on every OS).
fn capture_screen(
    app: &tauri::AppHandle,
    platform: &dyn Platform,
) -> Result<crate::platform::ScreenCapture, crate::platform::PlatformError> {
    use tauri::Manager;
    let overlay = app
        .get_webview_window("overlay")
        .filter(|w| w.is_visible().unwrap_or(false));
    if let Some(window) = &overlay {
        if let Err(error) = window.hide() {
            tracing::warn!(%error, "could not hide the overlay for capture");
        }
        // Let the window server remove it from the next frame.
        std::thread::sleep(OVERLAY_HIDE_DELAY);
    }
    let result = platform.capture();
    if let Some(window) = &overlay
        && let Err(error) = window.show()
    {
        tracing::warn!(%error, "could not show the overlay after capture");
    }
    result
}

const OVERLAY_HIDE_DELAY: Duration = Duration::from_millis(60);

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
    #[test]
    fn task_allows_four_earlier_steps_not_five() {
        let step = TaskStep {
            question: "q".into(),
            answer: "a".into(),
            target_label: None,
        };
        assert!(validate_task(&vec![step.clone(); MAX_TASK_STEPS - 1]).is_ok());
        assert!(validate_task(&vec![step; MAX_TASK_STEPS]).is_err());
    }
    fn screen(labels: &[&str]) -> ScreenSnapshot {
        ScreenSnapshot {
            app_name: "App".into(),
            window_title: None,
            elements: labels
                .iter()
                .enumerate()
                .map(|(i, label)| ScreenElement {
                    id: format!("e{i}"),
                    role: "button".into(),
                    label: (*label).into(),
                    value: None,
                    bounds: Rect {
                        x: 0.0,
                        y: 0.0,
                        width: 1.0,
                        height: 1.0,
                    },
                })
                .collect(),
        }
    }
    #[test]
    fn tier_follows_element_list_quality() {
        assert_eq!(tier_for(&screen(&[])), ScreenMode::ImageOnly);
        assert_eq!(
            tier_for(&screen(&["a", "b", "c", "d", "e"])),
            ScreenMode::Elements
        );
        // Four labelled elements (blank labels don't count) are too few.
        assert_eq!(
            tier_for(&screen(&["a", "b", "c", "d", " "])),
            ScreenMode::ElementsWithImage
        );
        // Three look-alikes are fine; four are ambiguous without a picture.
        assert_eq!(
            tier_for(&screen(&["a", "b", "x", "x", "x"])),
            ScreenMode::Elements
        );
        assert_eq!(
            tier_for(&screen(&["a", "x", "x", "x", "x"])),
            ScreenMode::ElementsWithImage
        );
    }
}
