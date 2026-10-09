use std::{
    env, fs,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use getcko_lib::{
    engine::{self, ChatRequest, Flow},
    ingest,
    model::{DocumentKind, Rect, ScreenElement, ScreenMode, ScreenSnapshot, TemplateId},
    pipeline, platform,
    prompt::{self, AnswerParser, Pointed, RetrievedPassage, TurnPrompt},
    store::{NewPassage, Store},
    templates,
};
use tts::Tts;

#[path = "common/mod.rs"]
mod common;

const MANUAL: &str = r#"# Class Record Grading Manual

## Entering grades
Enter each learner's quarterly grade in the matching subject and quarter column. Confirm the learner name and quarter before typing. For Juan Dela Cruz, enter the first-quarter grade in the Q1 Grade cell.

## Computing the final grade
Compute the final grade by averaging the four quarterly grades: add Q1, Q2, Q3, and Q4, then divide the sum by four. Keep the unrounded average for verification and record the rounded result as the final grade.

## Checking entries
Review each entry against the learner's assessment records. Correct misplaced scores before calculating the quarterly average.

## Quarterly assessment
The quarterly grade combines written work, performance tasks, and the quarterly assessment using the weights specified for the subject.

## Recording results
Use the class record's learner row and quarter columns. Preserve the original assessment values so the calculation can be audited.

## Final review
Compare the computed final grade with the four quarter values, verify the learner identity, and save the completed class record.
"#;

fn main() {
    let (runs, wav) = parse_args().expect("usage: benchmark --runs N --wav PATH");
    // Stage timings from the engine: RUST_LOG=getcko_lib=debug ./scripts/benchmark.sh
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("error")),
        )
        .with_writer(std::io::stderr)
        .init();
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let models = manifest.join("models");
    // The tts crate's AVFoundation backend registers a process-wide delegate class, so
    // only the first `Tts` in a process succeeds. Take it here to time speech start
    // directly; the engine's speaker then reports unavailable, which this tool ignores.
    let mut tts = Tts::default();
    let mut tts_error = tts.as_ref().err().map(ToString::to_string);
    let engine_start = Instant::now();
    let ai = engine::Engine::load(&models);
    let engine_ms = millis(engine_start.elapsed());
    for status in ai.status() {
        println!(
            "component {:?}: ready={}{}",
            status.component,
            status.ready,
            status
                .detail
                .as_ref()
                .map(|s| format!(" ({s})"))
                .unwrap_or_default()
        );
    }
    let chat = &common::chat_under_test(
        ai.chat
            .clone()
            .expect("chat model unavailable; check models and component status"),
        &manifest.join("models"),
    );
    let embedder = ai
        .embedder
        .as_ref()
        .expect("embedding model unavailable; check models and component status");
    let transcriber = ai
        .transcriber
        .as_ref()
        .expect("audio transcription model unavailable; check models and component status");

    let temp = tempfile::tempdir().expect("create benchmark temporary directory");
    let db = temp.path().join("benchmark.sqlite");
    let vector = manifest.join("vendor/sqlite-vector/macos-arm64/vector.dylib");
    let store = Store::open(
        &db,
        &vector,
        engine::EMBEDDING_DIM,
        engine::EMBEDDING_MODEL_ID,
    )
    .expect("open benchmark vector store");
    let kb = store
        .kb_create("Benchmark grading manual")
        .expect("create benchmark knowledge base");
    let import_start = Instant::now();
    let extracted = ingest::extract(MANUAL.as_bytes(), DocumentKind::Markdown)
        .expect("extract embedded grading manual");
    let chunks = ingest::chunk(
        &extracted.sections,
        ingest::TARGET_TOKENS,
        ingest::OVERLAP_TOKENS,
    );
    let texts: Vec<&str> = chunks.iter().map(|chunk| chunk.text.as_str()).collect();
    let vectors = embedder
        .embed_documents(&texts)
        .expect("embed grading manual");
    let fingerprint = ingest::fingerprint(MANUAL.as_bytes());
    let document = store
        .doc_create(
            kb.id,
            "grading-manual.md",
            DocumentKind::Markdown,
            &fingerprint,
        )
        .expect("create benchmark document");
    let passages: Vec<NewPassage> = chunks
        .into_iter()
        .zip(vectors)
        .map(|(chunk, embedding)| NewPassage {
            token_count: chunk.token_count,
            text: chunk.text,
            location: chunk.location,
            embedding,
        })
        .collect();
    store
        .doc_store_passages(document.id, None, &passages)
        .expect("store grading manual passages");
    let import_ms = millis(import_start.elapsed());

    let agent = &templates::get(TemplateId::OfficeHelper).draft;
    let typed_question = QUESTION;
    let audio = read_wav(&wav).expect("read 16-bit PCM WAV");
    let audio_seconds = audio.len() as f64 / 16_000.0;

    // One turn after the question is known, in the pipeline's order: retrieval,
    // target pass, answer pass. Times are from the start of the turn.
    let turn = |question: &str, snapshot: &ScreenSnapshot| -> Turn {
        let started = Instant::now();
        let prompts = TurnPrompt::new(agent, Some(snapshot), &[]);
        let query = embedder.embed_query(question).expect("embed query");
        let hits = store
            .search(&[kb.id], &query, 5)
            .expect("search benchmark knowledge base");
        let retrieval_ms = millis(started.elapsed());
        let retrieved: Vec<RetrievedPassage<'_>> = hits
            .iter()
            .map(|hit| RetrievedPassage {
                document_name: &hit.document_name,
                location: &hit.location,
                text: &hit.text,
            })
            .collect();
        let grammar = prompt::target_grammar(snapshot);
        let body = prompts.body(question, &retrieved);
        let mut reply = String::new();
        chat.generate(
            &ChatRequest {
                system: &prompts.system,
                user: &format!("{body}{}", TurnPrompt::target_task(ScreenMode::Elements)),
                max_tokens: 8,
                grammar: Some(&grammar),
                image: None,
            },
            &mut |piece| {
                reply.push_str(piece);
                Flow::Continue
            },
        )
        .expect("target pass");
        let element = prompt::target_element(&reply, snapshot);
        let pointed = element.map_or(Pointed::Nothing, Pointed::Element);
        let target_ms = millis(started.elapsed());
        let mut parser =
            AnswerParser::new(u32::try_from(retrieved.len()).expect("passage count fits u32"));
        let mut first_token_ms = None;
        let mut sentence_ms = None;
        chat.generate(
            &ChatRequest {
                system: &prompts.system,
                user: &format!(
                    "{body}{}",
                    TurnPrompt::answer_task(pointed, !retrieved.is_empty())
                ),
                max_tokens: prompts.max_tokens,
                grammar: None,
                image: None,
            },
            &mut |piece| {
                first_token_ms.get_or_insert_with(|| millis(started.elapsed()));
                if !parser.push(piece).is_empty() && sentence_ms.is_none() {
                    sentence_ms = Some(millis(started.elapsed()));
                }
                Flow::Continue
            },
        )
        .expect("answer pass");
        let (_, parsed) = parser.finish();
        let total_ms = millis(started.elapsed());
        Turn {
            target: element.map(|e| e.id.clone()),
            target_ms,
            retrieval_ms,
            first_token_ms: first_token_ms.unwrap_or(total_ms),
            sentence_ms: sentence_ms.unwrap_or(total_ms),
            total_ms,
            parsed,
        }
    };

    let mut prepare = Vec::with_capacity(runs);
    let mut stt_times = Vec::with_capacity(runs);
    let mut target_times = Vec::with_capacity(runs);
    let mut retrieval = Vec::with_capacity(runs);
    let mut first_token = Vec::with_capacity(runs);
    let mut first_sentence = Vec::with_capacity(runs);
    let mut full_answer = Vec::with_capacity(runs);
    let mut tts_start_times = Vec::with_capacity(runs);
    let mut e2e = Vec::with_capacity(runs);
    let mut ax_times = Vec::with_capacity(runs);
    let mut typed_target_times = Vec::with_capacity(runs);
    let mut typed_sentence = Vec::with_capacity(runs);
    let mut voice_correct = 0usize;
    let mut typed_correct = 0usize;
    let mut citations = 0usize;
    let mut run_one = None;
    let live_ax = platform::current();

    for iteration in 0..=runs {
        // Voice turn: a new screen each run, read and prefilled while the user speaks.
        let (snapshot, target_id) = mock_snapshot(iteration);
        let prompts = TurnPrompt::new(agent, Some(&snapshot), &[]);
        let prepare_start = Instant::now();
        chat.prefill(&ChatRequest {
            system: &prompts.system,
            user: prompts.warm_user(),
            max_tokens: prompts.max_tokens,
            grammar: None,
            image: None,
        })
        .expect("prefill screen");
        let prepare_ms = millis(prepare_start.elapsed());
        let stt_start = Instant::now();
        let transcript = transcriber
            .transcribe(&audio, &pipeline::speech_hint(&snapshot))
            .expect("transcribe benchmark WAV");
        let stt_ms = millis(stt_start.elapsed());
        let voice = turn(&transcript, &snapshot);
        let sentence = voice
            .parsed
            .text
            .split_inclusive(['.', '!', '?'])
            .next()
            .unwrap_or(&voice.parsed.text)
            .trim()
            .to_owned();
        let mut tts_ms = None;
        if let (Ok(tts), false) = (tts.as_mut(), sentence.is_empty()) {
            let begin = Instant::now();
            match tts.speak(&sentence, true) {
                Ok(_) => {
                    let deadline = begin + Duration::from_secs(2);
                    loop {
                        match tts.is_speaking() {
                            Ok(true) => {
                                tts_ms = Some(millis(begin.elapsed()));
                                break;
                            }
                            Ok(false) if Instant::now() < deadline => {
                                std::thread::sleep(Duration::from_millis(5));
                            }
                            Ok(false) => {
                                tts_error = Some("speech did not start within 2 s".into());
                                break;
                            }
                            Err(error) => {
                                tts_error = Some(format!("is_speaking: {error}"));
                                break;
                            }
                        }
                    }
                    let _ = tts.stop();
                }
                Err(error) => tts_error = Some(format!("speak: {error}")),
            }
        }
        // Typed turn on a screen that was not prefilled.
        let (typed_snapshot, typed_target) = mock_snapshot(1_000 + iteration);
        let typed = turn(typed_question, &typed_snapshot);
        let ax_start = Instant::now();
        let ax_ms = live_ax
            .snapshot(platform::MAX_SNAPSHOT_ELEMENTS)
            .ok()
            .map(|_| millis(ax_start.elapsed()));
        if iteration == 0 {
            continue; // warm-up
        }
        prepare.push(prepare_ms);
        stt_times.push(stt_ms);
        target_times.push(voice.target_ms);
        retrieval.push(voice.retrieval_ms);
        first_token.push(voice.first_token_ms);
        first_sentence.push(voice.sentence_ms);
        full_answer.push(voice.total_ms);
        tts_start_times.extend(tts_ms);
        ax_times.extend(ax_ms);
        e2e.push(stt_ms + voice.sentence_ms + tts_ms.unwrap_or(0.0));
        typed_target_times.push(typed.target_ms);
        typed_sentence.push(typed.sentence_ms);
        voice_correct += usize::from(voice.target.as_deref() == Some(target_id.as_str()));
        typed_correct += usize::from(typed.target.as_deref() == Some(typed_target.as_str()));
        citations += usize::from(!voice.parsed.cited.is_empty());
        if run_one.is_none() {
            run_one = Some((transcript, voice, target_id));
        }
    }

    let mut stages = vec![
        ("Engine load (single)", vec![engine_ms]),
        ("Import (single)", vec![import_ms]),
        ("Screen prefill (while the user speaks)", prepare),
        ("STT (question clip)", stt_times),
        ("Pointer target chosen", target_times),
        ("Retrieval", retrieval),
        ("Answer first token", first_token),
        ("Answer first sentence", first_sentence),
        ("Answer complete", full_answer),
    ];
    if !ax_times.is_empty() {
        stages.push(("AX snapshot (live app)", ax_times));
    }
    stages.push(("TTS speech start", tts_start_times));
    stages.push(("End of speech → first spoken word", e2e));
    stages.push(("Typed, cold screen: pointer target", typed_target_times));
    stages.push(("Typed, cold screen: first sentence", typed_sentence));

    println!("\n## Latency benchmark");
    println!(
        "\n- Run date: {}",
        env::var("BENCH_DATE").unwrap_or_else(|_| "unknown".into())
    );
    println!(
        "- Machine: {}",
        env::var("BENCH_MACHINE").unwrap_or_else(|_| "unknown".into())
    );
    println!("- Models: {}", model_sizes(&models));
    println!("- Runs: {runs} after one warm-up; question clip {audio_seconds:.1} s");
    println!("\n| Stage | Median (ms) | p90 (ms) | Min (ms) | Max (ms) |");
    println!("|---|---:|---:|---:|---:|");
    for (name, values) in stages {
        print_stats(name, &values);
    }
    println!("\n- Correct target, spoken question: {voice_correct}/{runs}");
    println!("- Correct target, typed question: {typed_correct}/{runs}");
    println!("- Answers with citations: {citations}/{runs}");
    if let Some((transcript, voice, target_id)) = run_one {
        println!("- Run 1 transcript: {transcript}");
        println!("- Run 1 target: {:?} (expected {target_id})", voice.target);
        println!("- Run 1 answer: {}", voice.parsed.text);
    }
    if let Some(error) = tts_error {
        println!("- TTS: {error}");
    }
    println!(
        "\nTimes after \"Screen prefill\" are from the end of speech (STT) or the start of the turn. \
         End of speech → first spoken word = STT + first sentence + TTS start in the same run; \
         microphone capture is not built yet, so a WAV file stands in for it."
    );
}

/// The PRD demo question.
const QUESTION: &str =
    "Where do I put Juan's grade in the class record, and how is the final grade computed?";

struct Turn {
    target: Option<String>,
    target_ms: f64,
    retrieval_ms: f64,
    first_token_ms: f64,
    sentence_ms: f64,
    total_ms: f64,
    parsed: prompt::ParsedAnswer,
}

fn parse_args() -> Result<(usize, PathBuf), String> {
    let mut args = env::args().skip(1);
    let mut runs = 10usize;
    let mut wav = None;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--runs" => {
                runs = args
                    .next()
                    .ok_or("missing --runs value")?
                    .parse()
                    .map_err(|_| "--runs must be a positive integer")?
            }
            "--wav" => wav = Some(PathBuf::from(args.next().ok_or("missing --wav path")?)),
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }
    if runs == 0 {
        return Err("--runs must be positive".into());
    }
    Ok((runs, wav.ok_or("--wav is required")?))
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

/// A Numbers-like class record: toolbar, header row, and one row per learner whose
/// cells are labelled "<column>, <learner>" the way spreadsheet AX trees expose them.
/// Returns the snapshot and the id of Juan Dela Cruz's empty Q1 cell (the right answer).
/// `run` goes into the window title, so each run's screen prompt differs right after
/// the system prompt, like a new screen would.
fn mock_snapshot(run: usize) -> (ScreenSnapshot, String) {
    const COLUMNS: [&str; 6] = ["Name", "Q1", "Q2", "Q3", "Q4", "Final"];
    const LEARNERS: [&str; 6] = [
        "Ana Santos",
        "Ben Reyes",
        "Juan Dela Cruz",
        "Maria Garcia",
        "Paolo Mendoza",
        "Rosa Villanueva",
    ];
    let mut elements = Vec::new();
    let mut push = |role: &str, label: String, value: Option<String>, x: f64, y: f64| {
        let id = format!("e{}", elements.len() + 1);
        elements.push(ScreenElement {
            id: id.clone(),
            role: role.into(),
            label,
            value,
            bounds: Rect {
                x,
                y,
                width: 160.0,
                height: 40.0,
            },
        });
        id
    };
    for (i, button) in ["Insert", "Sort", "Filter", "Share"]
        .into_iter()
        .enumerate()
    {
        push(
            "button",
            button.into(),
            None,
            200.0 + i as f64 * 180.0,
            20.0,
        );
    }
    for (c, column) in COLUMNS.into_iter().enumerate() {
        push(
            "cell",
            format!("Column {column}"),
            None,
            40.0 + c as f64 * 170.0,
            120.0,
        );
    }
    let mut target = String::new();
    for (r, learner) in LEARNERS.into_iter().enumerate() {
        let y = 170.0 + r as f64 * 45.0;
        push(
            "cell",
            format!("Name, row {}", r + 1),
            Some(learner.into()),
            40.0,
            y,
        );
        let empty = learner == "Juan Dela Cruz";
        for (c, column) in COLUMNS[1..].iter().enumerate() {
            let value = (!empty).then(|| format!("{}", 80 + (r * 3 + c * 2) % 15));
            let id = push(
                "cell",
                format!("{column}, {learner}"),
                value,
                210.0 + c as f64 * 170.0,
                y,
            );
            if empty && *column == "Q1" {
                target = id;
            }
        }
    }
    let snapshot = ScreenSnapshot {
        app_name: "Numbers".into(),
        window_title: Some(format!("Class Record {run} — Grades")),
        elements,
    };
    (snapshot, target)
}

fn read_wav(path: &Path) -> Result<Vec<f32>, String> {
    let bytes = fs::read(path).map_err(|error| format!("{}: {error}", path.display()))?;
    if bytes.get(0..4) != Some(b"RIFF") || bytes.get(8..12) != Some(b"WAVE") {
        return Err("expected RIFF/WAVE".into());
    }
    let mut cursor = 12usize;
    let mut format = None;
    let mut data = None;
    while cursor.saturating_add(8) <= bytes.len() {
        let id = &bytes[cursor..cursor + 4];
        let size = u32::from_le_bytes(
            bytes[cursor + 4..cursor + 8]
                .try_into()
                .map_err(|_| "invalid WAV chunk size")?,
        ) as usize;
        let begin = cursor + 8;
        let end = begin.checked_add(size).ok_or("WAV chunk overflow")?;
        if end > bytes.len() {
            return Err("truncated WAV chunk".into());
        }
        if id == b"fmt " && size >= 16 {
            let channels = u16::from_le_bytes([bytes[begin + 2], bytes[begin + 3]]);
            let sample_rate = u32::from_le_bytes(
                bytes[begin + 4..begin + 8]
                    .try_into()
                    .map_err(|_| "invalid sample rate")?,
            );
            let bits = u16::from_le_bytes([bytes[begin + 14], bytes[begin + 15]]);
            format = Some((channels, sample_rate, bits));
        } else if id == b"data" {
            data = Some(&bytes[begin..end]);
        }
        cursor = end + (size & 1);
    }
    let (channels, rate, bits) = format.ok_or("WAV fmt chunk missing")?;
    if channels != 1 || rate != 16_000 || bits != 16 {
        return Err("WAV must be mono 16-bit PCM at 16 kHz".into());
    }
    let data = data.ok_or("WAV data chunk missing")?;
    if data.len() % 2 != 0 {
        return Err("odd PCM data length".into());
    }
    Ok(data
        .as_chunks::<2>()
        .0
        .iter()
        .map(|sample| f32::from(i16::from_le_bytes(*sample)) / 32768.0)
        .collect())
}

fn model_sizes(models: &Path) -> String {
    [
        engine::CHAT_MODEL_FILE,
        engine::EMBEDDING_MODEL_FILE,
        engine::PROJECTOR_FILE,
    ]
    .iter()
    .map(|name| {
        let path = models.join(name);
        match fs::metadata(&path) {
            Ok(meta) => format!("{name} ({:.2} GiB)", meta.len() as f64 / 1_073_741_824.0),
            Err(_) => format!("{name} (missing)"),
        }
    })
    .collect::<Vec<_>>()
    .join(", ")
}

fn print_stats(name: &str, values: &[f64]) {
    if values.is_empty() {
        println!("| {name} | n/a | n/a | n/a | n/a |");
        return;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let median = if sorted.len().is_multiple_of(2) {
        (sorted[sorted.len() / 2 - 1] + sorted[sorted.len() / 2]) / 2.0
    } else {
        sorted[sorted.len() / 2]
    };
    let p90 = sorted[((sorted.len() * 90).div_ceil(100))
        .saturating_sub(1)
        .min(sorted.len() - 1)];
    println!(
        "| {name} | {median:.1} | {p90:.1} | {:.1} | {:.1} |",
        sorted[0],
        sorted[sorted.len() - 1]
    );
}
