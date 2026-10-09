use crate::{
    engine::{ChatModel, ChatRequest, Engine, Flow, ImagePart},
    error::{AppError, AppResult},
    model::*,
    platform::Platform,
    prompt::{self, AnswerParser, Pointed, RetrievedPassage, TurnPrompt},
    screenshot::Prepared,
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
    let grounder = engine.grounder.as_deref();
    // Tiers 2-3: a screenshot when the element list is weak or empty.
    let mut capture_ms = None;
    let mut mode = snapshot.as_ref().map(screen_mode);
    let mut screenshot = None;
    // Tier 3: text read from the screenshot, offered like an element list.
    let mut screen_text = None;
    if let (Some(wanted), Some(snap)) = (mode, snapshot.as_ref())
        && wanted != ScreenMode::Elements
    {
        let t = Instant::now();
        match capture_screen(app, state.platform.as_ref()) {
            Ok(capture) => {
                if wanted == ScreenMode::ImageOnly && grounder.is_some() {
                    // The grounder reads the screenshot itself, unmarked.
                    screenshot = Some(crate::screenshot::prepare(capture, None));
                    screen_text = Some(ScreenSnapshot {
                        app_name: String::new(),
                        window_title: None,
                        elements: Vec::new(),
                    });
                } else if wanted == ScreenMode::ImageOnly {
                    let (shot, text) = read_screenshot(state.platform.as_ref(), capture);
                    screenshot = Some(shot);
                    screen_text = Some(text);
                } else {
                    screenshot = Some(crate::screenshot::prepare(capture, Some(&snap.elements)));
                }
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
            let hint = snapshot.as_ref().map(speech_hint).unwrap_or_default();
            let text = trans.transcribe(&pcm, &hint).map_err(AppError::from)?;
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

    // Pass 1: where to point.
    let mut pointed = Pointed::Nothing;
    let mut target = None;
    let mut confidence = Confidence::Normal;
    let screen = screen_text.as_ref().or(snapshot.as_ref());
    if let (Some(mode), Some(screen)) = (mode, screen) {
        match aim(
            chat.as_ref(),
            &turn.system,
            &body,
            mode,
            screen,
            screenshot.as_ref(),
            grounder.map(|model| Grounding {
                model,
                question: &question,
            }),
            &check,
        )? {
            Aim::Element(element) if mode == ScreenMode::ImageOnly => {
                // Text read from a screenshot: its box is exact, but whether it is
                // the control to use is a guess (BR-18), so no element id.
                target = crate::pointer::locate(element, &crate::pointer::monitors(app)).map(|t| {
                    PointerTarget {
                        element_id: None,
                        ..t
                    }
                });
                pointed = Pointed::Element(element);
                confidence = Confidence::BestGuess;
            }
            Aim::Element(element) => {
                target = crate::pointer::locate(element, &crate::pointer::monitors(app));
                pointed = Pointed::Element(element);
            }
            Aim::Point { x, y, monitor } => {
                target = Some(crate::pointer::locate_point(x, y, monitor));
                pointed = Pointed::Guess;
                confidence = Confidence::BestGuess;
            }
            Aim::Nothing => {}
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
                agent.draft.speech_rate,
            )
        {
            tracing::warn!("speech failed: {e}");
        }
    };
    let mut parser = AnswerParser::new(u32::try_from(hits.len()).unwrap_or(u32::MAX));
    let answer_task = TurnPrompt::answer_task(pointed, !passages.is_empty());
    let answer_user = with_task(&body, &answer_task, screenshot.is_some());
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

/// Text pieces read from a tier-3 screenshot are offered to the model, at most this many.
const MAX_TEXT_PIECES: usize = crate::platform::MAX_SNAPSHOT_ELEMENTS;

/// Tier-3 input: the text the OS reads in `capture` as elements `t1`, `t2`, … (role
/// `text`), and the screenshot with each piece's box and id drawn on it. No text
/// (or no OCR on this OS) gives an empty list and an unmarked screenshot.
pub fn read_screenshot(
    platform: &dyn Platform,
    capture: crate::platform::ScreenCapture,
) -> (Prepared, ScreenSnapshot) {
    let boxes = platform.recognize_text(&capture).unwrap_or_else(|error| {
        tracing::debug!(%error, "no text read from the screenshot");
        Vec::new()
    });
    let elements: Vec<ScreenElement> = boxes
        .into_iter()
        .take(MAX_TEXT_PIECES)
        .enumerate()
        .map(|(index, piece)| ScreenElement {
            id: format!("t{}", index + 1),
            role: "text".into(),
            label: piece.text,
            value: None,
            bounds: piece.bounds,
        })
        .collect();
    let marks = (!elements.is_empty()).then_some(&elements[..]);
    let shot = crate::screenshot::prepare(capture, marks);
    let text = ScreenSnapshot {
        app_name: String::new(),
        window_title: None,
        elements,
    };
    (shot, text)
}

/// Runs text recognition once on a tiny blank image so the OS loads its model now.
pub fn warm_up_text_recognition(platform: &dyn Platform) {
    let blank = crate::platform::ScreenCapture {
        width: 64,
        height: 32,
        rgba: vec![255; 64 * 32 * 4],
        x: 0,
        y: 0,
        monitor: MonitorFrame {
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            scale_factor: 1.0,
        },
    };
    let started = Instant::now();
    match platform.recognize_text(&blank) {
        Ok(_) => tracing::info!(elapsed_ms = ms(started), "text recognition warmed up"),
        Err(error) => tracing::debug!(%error, "text recognition unavailable"),
    }
}

/// A GUI grounding model for tier 3 and the user's question it should locate.
#[derive(Clone, Copy)]
pub struct Grounding<'q> {
    pub model: &'q dyn crate::engine::Grounder,
    pub question: &'q str,
}

/// Where the target pass says to point.
#[derive(Debug, Clone, Copy)]
pub enum Aim<'a> {
    Element(&'a ScreenElement),
    /// Tier 3: a desktop physical point on `monitor`.
    Point {
        x: f64,
        y: f64,
        monitor: MonitorFrame,
    },
    Nothing,
}

/// The user prompt for a pass: `body` then `task`, unless an image is attached, in
/// which case the task follows the image ([`ImagePart::text_after`]).
fn with_task(body: &str, task: &str, has_image: bool) -> String {
    if has_image {
        body.to_owned()
    } else {
        format!("{body}{task}")
    }
}

/// Target pass (pass 1) for `mode`: element ids for tiers 1-2. Tier 3 asks the
/// grounding model when one is given (`shot` unmarked), else picks a text id from the
/// text read off the screenshot, else Gemma's own point. `shot` is required for tier 3
/// and adds the marked screenshot in tier 2. `keep_going` stops generation early.
#[allow(clippy::too_many_arguments)] // one call site per caller; a struct would only rename them
pub fn aim<'a>(
    chat: &dyn ChatModel,
    system: &str,
    body: &str,
    mode: ScreenMode,
    screen: &'a ScreenSnapshot,
    shot: Option<&Prepared>,
    grounding: Option<Grounding<'_>>,
    keep_going: &dyn Fn() -> bool,
) -> AppResult<Aim<'a>> {
    if mode == ScreenMode::ImageOnly {
        let Some(shot) = shot else {
            return Ok(Aim::Nothing);
        };
        // A grounding model alone scored higher than text-first, then grounder
        // (MODELS.md): once Gemma picks a text box the grounder never sees the question.
        if let Some(Grounding { model, question }) = grounding {
            let point = model
                .ground(&shot.image, question)
                .map_err(AppError::from)?;
            return Ok(point.map_or(Aim::Nothing, |(fx, fy)| {
                let (x, y) = crate::screenshot::to_physical(
                    shot,
                    fx * f64::from(shot.image.width),
                    fy * f64::from(shot.image.height),
                );
                Aim::Point {
                    x,
                    y,
                    monitor: shot.monitor,
                }
            }));
        }
        // `screen` holds the text read from the screenshot ([`read_screenshot`]):
        // pick a piece by id like tier 2; point only when none fits (icons).
        if !screen.elements.is_empty() {
            let reply = target_reply(
                chat,
                system,
                body,
                &TurnPrompt::text_target_task(screen),
                &prompt::target_grammar(screen),
                TARGET_MAX_TOKENS,
                Some(shot),
                keep_going,
            )?;
            if let Some(piece) = prompt::target_element(&reply, screen) {
                return Ok(Aim::Element(piece));
            }
        }
        return point(chat, system, body, shot, keep_going);
    }
    if screen.elements.is_empty() {
        return Ok(Aim::Nothing);
    }
    let reply = target_reply(
        chat,
        system,
        body,
        &TurnPrompt::target_task(mode),
        &prompt::target_grammar(screen),
        TARGET_MAX_TOKENS,
        shot,
        keep_going,
    )?;
    Ok(prompt::target_element(&reply, screen).map_or(Aim::Nothing, Aim::Element))
}

/// Tier 3: one point on the screenshot. A second pass on a crop around the first
/// guess was measured and made accuracy worse (the model pointed at the crop's top
/// edge), so there is none.
fn point(
    chat: &dyn ChatModel,
    system: &str,
    body: &str,
    shot: &Prepared,
    keep_going: &dyn Fn() -> bool,
) -> AppResult<Aim<'static>> {
    let reply = target_reply(
        chat,
        system,
        body,
        &TurnPrompt::target_task(ScreenMode::ImageOnly),
        crate::screenshot::POINT_GRAMMAR,
        POINT_MAX_TOKENS,
        Some(shot),
        keep_going,
    )?;
    Ok(
        crate::screenshot::parse_point(shot, &reply).map_or(Aim::Nothing, |(x, y)| {
            let (x, y) = crate::screenshot::to_physical(shot, x, y);
            Aim::Point {
                x,
                y,
                monitor: shot.monitor,
            }
        }),
    )
}

/// One grammar-constrained target-pass generation; returns the raw reply.
#[allow(clippy::too_many_arguments)]
fn target_reply(
    chat: &dyn ChatModel,
    system: &str,
    body: &str,
    task: &str,
    grammar: &str,
    max_tokens: u32,
    shot: Option<&Prepared>,
    keep_going: &dyn Fn() -> bool,
) -> AppResult<String> {
    let mut reply = String::new();
    chat.generate(
        &ChatRequest {
            system,
            user: &with_task(body, task, shot.is_some()),
            max_tokens,
            grammar: Some(grammar),
            image: shot.map(|s| ImagePart {
                image: &s.image,
                text_after: task,
            }),
        },
        &mut |piece| {
            reply.push_str(piece);
            if keep_going() {
                Flow::Continue
            } else {
                Flow::Stop
            }
        },
    )
    .map_err(AppError::from)?;
    // An element id, `[y, x]` or `none`: never user text.
    tracing::debug!(reply = %reply, "target pass");
    Ok(reply)
}

/// Labelled elements needed before the element list alone is trusted.
const MIN_LABELLED: usize = 5;
/// More controls than this sharing one label (look-alike cells, icons) makes the
/// list ambiguous without a picture.
const MAX_SAME_LABEL: usize = 3;
/// Embeds again, with the configured model, the passages the store kept from another
/// embedding model ([`Store::reembed_pending`]), then makes their documents searchable
/// (or failed, asking for a new import, if embedding fails). Runs once the engine is
/// loaded; emits [`crate::EVENT_DOCUMENT`] for each changed document.
pub fn reembed_documents<R: tauri::Runtime>(
    store: &Store,
    engine: &Engine,
    app: &tauri::AppHandle<R>,
) {
    let pending = match store.reembed_pending() {
        Ok(pending) if pending.is_empty() => return,
        Ok(pending) => pending,
        Err(error) => {
            tracing::warn!(%error, "could not list passages to re-embed");
            return;
        }
    };
    let started = Instant::now();
    let result = engine
        .embedder
        .as_ref()
        .ok_or_else(|| AppError::unavailable("embedding model is not available"))
        .and_then(|embedder| {
            for batch in pending.chunks(16) {
                let texts: Vec<&str> = batch.iter().map(|(_, text)| text.as_str()).collect();
                let vectors = embedder.embed_documents(&texts).map_err(AppError::from)?;
                let rows: Vec<(i64, Vec<f32>)> =
                    batch.iter().map(|(id, _)| *id).zip(vectors).collect();
                store.reembed_store(&rows)?;
            }
            Ok(())
        });
    let failure = result.err().map(|error| {
        tracing::warn!(%error, "re-embedding failed");
        "could not re-index after a model update; import the file again"
    });
    match store.reembed_finish(failure) {
        Ok(documents) => {
            tracing::info!(
                passages = pending.len(),
                documents = documents.len(),
                elapsed_ms = ms(started),
                "passages re-embedded"
            );
            for document in documents {
                let _ = app.emit(crate::EVENT_DOCUMENT, document);
            }
        }
        Err(error) => tracing::warn!(%error, "could not finish re-embedding"),
    }
}

/// Words the speaker may say, for speech recognition: the distinct pieces of the
/// screen's labels and values ("Q1, Juan Dela Cruz" gives "Q1" and "Juan Dela Cruz"),
/// control roles first, numbers left out, at most [`MAX_HINT_CHARS`]. Whole labels
/// repeat names across a grid's cells and crowd them out; names in cell values were
/// missed (the benchmark heard "Juan's" as "once" until the hint carried the name).
pub fn speech_hint(snapshot: &ScreenSnapshot) -> String {
    let mut hint = String::new();
    let mut seen = std::collections::HashSet::new();
    for preferred in [true, false] {
        for element in &snapshot.elements {
            let is_preferred = matches!(
                element.role.as_str(),
                "cell" | "textField" | "text" | "button"
            );
            if preferred != is_preferred {
                continue;
            }
            let pieces = element
                .label
                .split(',')
                .chain(element.value.as_deref().unwrap_or_default().split(','))
                .map(str::trim)
                .filter(|piece| piece.chars().any(char::is_alphabetic));
            for piece in pieces {
                if !seen.insert(piece.to_lowercase()) {
                    continue;
                }
                let separator = if hint.is_empty() { 0 } else { 2 };
                if hint.chars().count() + separator + piece.chars().count() > MAX_HINT_CHARS {
                    continue;
                }
                if !hint.is_empty() {
                    hint.push_str(", ");
                }
                hint.push_str(piece);
            }
        }
    }
    hint
}

/// Longest speech hint; Whisper's prompt holds about 224 tokens.
const MAX_HINT_CHARS: usize = 400;

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

/// The tier the core picks for `snapshot` when nothing forces one.
pub fn tier_for(snapshot: &ScreenSnapshot) -> ScreenMode {
    if snapshot.elements.is_empty() {
        return ScreenMode::ImageOnly;
    }
    let labelled = snapshot
        .elements
        .iter()
        .filter(|e| !e.label.trim().is_empty())
        .count();
    // Only controls can be confused with each other: repeated static text ("—" in
    // a table, "Zero bytes" in a file list) is not something the user acts on.
    let mut counts = std::collections::HashMap::new();
    for element in snapshot
        .elements
        .iter()
        .filter(|e| e.role != "text" && !e.label.trim().is_empty())
    {
        *counts.entry(element.label.trim()).or_insert(0usize) += 1;
    }
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
    fn speech_hint_splits_labels_takes_values_and_prefers_controls() {
        let mut snapshot = screen(&["Other", "Q1, Juan Dela Cruz", "Q2, Juan Dela Cruz", "Save"]);
        snapshot.elements[0].role = "menuItem".into();
        snapshot.elements[1].role = "cell".into();
        snapshot.elements[2].role = "cell".into();
        snapshot.elements[2].value = Some("85".into());
        snapshot.elements[3].role = "button".into();
        snapshot.elements[3].value = Some("Maria Reyes".into());
        assert_eq!(
            speech_hint(&snapshot),
            "Q1, Juan Dela Cruz, Q2, Save, Maria Reyes, Other"
        );
    }

    #[test]
    fn speech_hint_truncates_at_label_boundaries_and_handles_empty_snapshot() {
        assert_eq!(speech_hint(&screen(&[])), "");
        let long = "x".repeat(390);
        let snapshot = screen(&[&long, "this piece must not be partially included", "short"]);
        assert_eq!(speech_hint(&snapshot), format!("{long}, short"));
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
        // Repeated static text ("—" down a table column) is not a look-alike control.
        let mut table = screen(&["a", "b", "c", "d", "e", "—", "—", "—", "—"]);
        for cell in &mut table.elements[5..] {
            cell.role = "text".into();
        }
        assert_eq!(tier_for(&table), ScreenMode::Elements);
    }
}
