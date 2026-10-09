//! Answer check: the Office Helper agent answers the questions in
//! `scripts/fixtures/answer-questions.json` (target pass, then answer) with the current
//! prompt and model (`GETCKO_CHAT=qwen3-vl` for Qwen3-VL). Prints each answer and writes
//! JSON lines to `$TMPDIR/answers-<label>.jsonl` (`GETCKO_ANSWERS_LABEL`, default
//! `current`) so two prompt or model versions can be compared side by side
//! (docs/MODELS.md).
use std::{io::Write, path::PathBuf, time::Instant};

use getcko_lib::{
    engine::{
        ChatModel, ChatRequest, Flow,
        llama::{LlamaChat, Runtime},
    },
    model::{Rect, ScreenElement, ScreenMode, ScreenSnapshot, TemplateId},
    prompt::{self, AnswerParser, Pointed, RetrievedPassage, TurnPrompt},
    templates,
};
use serde_json::Value;

#[path = "common/mod.rs"]
mod common;

fn main() {
    let label = std::env::var("GETCKO_ANSWERS_LABEL").unwrap_or_else(|_| "current".into());
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixture: Value = serde_json::from_str(
        &std::fs::read_to_string(manifest.join("../scripts/fixtures/answer-questions.json"))
            .expect("fixture"),
    )
    .expect("json");
    let m = manifest.join("models");
    let rt = Runtime::init().expect("rt");
    let gemma: std::sync::Arc<dyn ChatModel> = std::sync::Arc::new(
        LlamaChat::load(&rt, &m.join("gemma-4-E2B-it-Q4_0.gguf"), &m.join("none")).expect("gemma"),
    );
    let chat = common::chat_under_test(gemma, &m);
    let agent = templates::get(TemplateId::OfficeHelper).draft;
    let out_path = std::env::temp_dir().join(format!("answers-{label}.jsonl"));
    let mut out = std::fs::File::create(&out_path).expect("out");
    for q in fixture["questions"].as_array().expect("questions") {
        let (key, question) = (q[0].as_str().expect("key"), q[1].as_str().expect("q"));
        let s = &fixture["screens"][key];
        let screen = s["app"].as_str().map(|app| ScreenSnapshot {
            app_name: app.into(),
            window_title: s["window"].as_str().map(Into::into),
            elements: s["elements"]
                .as_array()
                .expect("elements")
                .iter()
                .enumerate()
                .map(|(i, e)| ScreenElement {
                    id: format!("e{}", i + 1),
                    role: e[0].as_str().expect("role").into(),
                    label: e[1].as_str().expect("label").into(),
                    value: None,
                    bounds: Rect {
                        x: 10.0 * i as f64,
                        y: 10.0,
                        width: 80.0,
                        height: 30.0,
                    },
                })
                .collect(),
        });
        let passages: Vec<RetrievedPassage> = s["passages"]
            .as_array()
            .expect("passages")
            .iter()
            .map(|p| RetrievedPassage {
                document_name: p[0].as_str().expect("doc"),
                location: p[1].as_str().expect("loc"),
                text: p[2].as_str().expect("text"),
            })
            .collect();
        let turn = TurnPrompt::new(&agent, screen.as_ref(), &[]);
        let body = turn.body(question, &passages);
        let element = screen
            .as_ref()
            .filter(|s| !s.elements.is_empty())
            .and_then(|screen| {
                let mut reply = String::new();
                chat.generate(
                    &ChatRequest {
                        system: &turn.system,
                        user: &format!("{body}{}", TurnPrompt::target_task(ScreenMode::Elements)),
                        max_tokens: 8,
                        grammar: Some(&prompt::target_grammar(screen)),
                        image: None,
                    },
                    &mut |p| {
                        reply.push_str(p);
                        Flow::Continue
                    },
                )
                .expect("target");
                prompt::target_element(&reply, screen).cloned()
            });
        let mut parser = AnswerParser::new(u32::try_from(passages.len()).expect("few passages"));
        let mut first = None;
        let started = Instant::now();
        chat.generate(
            &ChatRequest {
                system: &turn.system,
                user: &format!(
                    "{body}{}",
                    TurnPrompt::answer_task(
                        element.as_ref().map_or(Pointed::Nothing, Pointed::Element),
                        !passages.is_empty()
                    )
                ),
                max_tokens: turn.max_tokens,
                grammar: None,
                image: None,
            },
            &mut |p| {
                first.get_or_insert_with(|| started.elapsed().as_millis());
                parser.push(p);
                Flow::Continue
            },
        )
        .expect("answer");
        let (_, parsed) = parser.finish();
        let row = serde_json::json!({
            "question": question,
            "screen": key,
            "target": element.map(|e| e.label),
            "answer": parsed.text,
            "first_token_ms": first,
            "total_ms": started.elapsed().as_millis() as u64,
        });
        writeln!(out, "{row}").expect("write");
        println!(
            "[{key}] {question}\n  → {:?} | {}\n",
            row["target"], row["answer"]
        );
    }
    eprintln!("wrote {}", out_path.display());
}
