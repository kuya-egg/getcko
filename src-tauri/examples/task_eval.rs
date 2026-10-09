//! Guided-task check (PRD S5): does GetCko teach a multi-action task one action at a
//! time, pointing at the first action first and moving on with each "next step"?
//!
//! Each task is a synthetic screen (element list, tier 1) and the elements the user
//! should use, in order. Step 1 asks the question; every later step asks "What's the
//! next step?" with the earlier steps (question, answer, element pointed at), as the
//! overlay sends them, on the screen as it looks after the earlier actions. Prints each
//! step and a table of steps pointed at correctly (docs/MODELS.md). Uses the app's plan
//! pass (`pipeline::plan`): the actions in plain words, each grounded on its own.
//!
//! `cargo run --release --example task_eval`
use std::path::PathBuf;

use getcko_lib::{
    engine::{
        ChatModel, ChatRequest, Flow,
        llama::{LlamaChat, Runtime},
    },
    model::{Rect, ScreenElement, ScreenMode, ScreenSnapshot, TaskStep, TemplateId},
    pipeline::{self, Aim},
    prompt::{self, AnswerParser, Pointed, TurnPrompt},
    templates,
};

#[path = "common/mod.rs"]
mod common;

/// The overlay's "Next step" question (`src/overlay/Overlay.tsx`).
const NEXT_STEP: &str = "What's the next step?";

struct Task {
    question: &'static str,
    app: &'static str,
    /// (role, label) of every element on screen.
    elements: &'static [(&'static str, &'static str)],
    /// Labels to use, in order.
    steps: &'static [&'static str],
    /// The display element's value before each step (calculators), else empty.
    display: &'static [&'static str],
}

const CALCULATOR: &[(&str, &str)] = &[
    ("text", "Display"),
    ("button", "AC"),
    ("button", "percent"),
    ("button", "divide"),
    ("button", "7"),
    ("button", "8"),
    ("button", "9"),
    ("button", "multiply"),
    ("button", "4"),
    ("button", "5"),
    ("button", "6"),
    ("button", "minus"),
    ("button", "1"),
    ("button", "2"),
    ("button", "3"),
    ("button", "plus"),
    ("button", "0"),
    ("button", "point"),
    ("button", "equals"),
];

const TASKS: &[Task] = &[
    Task {
        question: "How do I multiply five times six here?",
        app: "Calculator",
        elements: CALCULATOR,
        steps: &["5", "multiply", "6", "equals"],
        display: &["0", "5", "5 ×", "5 × 6"],
    },
    Task {
        question: "How do I add 12 and 7?",
        app: "Calculator",
        elements: CALCULATOR,
        steps: &["1", "2", "plus", "7", "equals"],
        display: &["0", "1", "12", "12 +", "12 + 7"],
    },
    Task {
        question: "Show me how to divide 9 by 3.",
        app: "Calculator",
        elements: CALCULATOR,
        steps: &["9", "divide", "3", "equals"],
        display: &["0", "9", "9 ÷", "9 ÷ 3"],
    },
    Task {
        question: "How do I make the selected text bold and centered?",
        app: "TextEdit",
        elements: &[
            ("popUpButton", "Font family"),
            ("popUpButton", "Typeface"),
            ("comboBox", "Font size"),
            ("checkbox", "bold"),
            ("checkbox", "italic"),
            ("checkbox", "underline"),
            ("radioButton", "align left"),
            ("radioButton", "center"),
            ("radioButton", "align right"),
            ("textArea", "Document"),
        ],
        steps: &["bold", "center"],
        display: &[],
    },
    Task {
        question: "How do I create an account on this page?",
        app: "Google Chrome",
        elements: &[
            ("link", "Home"),
            ("link", "Log in"),
            ("textField", "Full name"),
            ("textField", "Email address"),
            ("textField", "Password"),
            ("checkbox", "I agree to the terms"),
            ("button", "Create account"),
            ("link", "Privacy policy"),
        ],
        steps: &[
            "Full name",
            "Email address",
            "Password",
            "I agree to the terms",
            "Create account",
        ],
        display: &[],
    },
];

fn screen(task: &Task, step: usize) -> ScreenSnapshot {
    ScreenSnapshot {
        app_name: task.app.into(),
        window_title: Some(task.app.into()),
        elements: task
            .elements
            .iter()
            .enumerate()
            .map(|(i, (role, label))| ScreenElement {
                id: format!("e{}", i + 1),
                role: (*role).into(),
                label: (*label).into(),
                value: (*label == "Display")
                    .then(|| task.display.get(step).map(|v| (*v).to_owned()))
                    .flatten(),
                bounds: Rect {
                    x: 40.0 * f64::from(u32::try_from(i % 4).unwrap_or(0)),
                    y: 40.0 * f64::from(u32::try_from(i / 4).unwrap_or(0)),
                    width: 36.0,
                    height: 36.0,
                },
            })
            .collect(),
    }
}

fn answer(
    chat: &dyn ChatModel,
    turn: &TurnPrompt,
    body: &str,
    note: &str,
    pointed: Pointed<'_>,
) -> String {
    let task = format!("{note}{}", TurnPrompt::answer_task(pointed, &[]));
    let mut parser = AnswerParser::new(0);
    let mut text = String::new();
    chat.generate(
        &ChatRequest {
            system: &turn.system,
            user: &format!("{body}{task}"),
            max_tokens: turn.max_tokens,
            grammar: None,
            image: None,
        },
        &mut |piece| {
            for sentence in parser.push(piece) {
                text.push_str(&sentence);
                text.push(' ');
            }
            Flow::Continue
        },
    )
    .expect("answer pass");
    for sentence in parser.finish().0 {
        text.push_str(&sentence);
    }
    text.trim().to_owned()
}

fn main() {
    let m = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models");
    let rt = Runtime::init().expect("runtime");
    let gemma: std::sync::Arc<dyn ChatModel> = std::sync::Arc::new(
        LlamaChat::load(&rt, &m.join("gemma-4-E2B-it-Q4_0.gguf"), &m.join("none")).expect("gemma"),
    );
    let chat = common::chat_under_test(gemma, &m);
    let agent = templates::get(TemplateId::OfficeHelper).draft;
    let mut rows = Vec::new();
    let (mut first_right, mut all_right, mut all_steps) = (0, 0, 0);
    for task in TASKS {
        eprintln!("\n== {} ({})", task.question, task.app);
        let mut earlier: Vec<TaskStep> = Vec::new();
        let mut planned: Vec<String> = Vec::new();
        let mut right = 0;
        for (index, expected) in task.steps.iter().enumerate() {
            let snapshot = screen(task, index);
            let question = if index == 0 { task.question } else { NEXT_STEP };
            let turn = TurnPrompt::new(&agent, Some(&snapshot), &earlier);
            let body = turn.body(question);
            // As the app does (pipeline::guide_step): plan on the first question, then
            // ground one planned action per step; no plan or none left: the question.
            if index == 0 {
                planned = pipeline::plan(chat.as_ref(), &turn.system, &body, &|| true)
                    .expect("plan pass");
                if planned.len() < 2 {
                    planned.clear();
                }
                eprintln!("  plan: {planned:?}");
            }
            let action = planned.get(index);
            let action_body =
                action.map(|action| TurnPrompt::new(&agent, Some(&snapshot), &[]).body(action));
            let aim_with = |body: &str| {
                pipeline::aim(
                    chat.as_ref(),
                    &turn.system,
                    body,
                    ScreenMode::Elements,
                    &snapshot,
                    None,
                    None,
                    &|| true,
                )
                .expect("target pass")
            };
            let aim = match &action_body {
                Some(action_body) => match aim_with(action_body) {
                    Aim::Nothing => aim_with(&body),
                    found => found,
                },
                None => aim_with(&body),
            };
            let note = action
                .map(|action| prompt::step_note(index + 1, planned.len(), action))
                .unwrap_or_default();
            let (label, pointed) = match aim {
                Aim::Element(element) => (Some(element.label.clone()), Pointed::Element(element)),
                _ => (None, Pointed::Nothing),
            };
            let text = answer(chat.as_ref(), &turn, &body, &note, pointed);
            let ok = label.as_deref() == Some(*expected);
            right += usize::from(ok);
            if index == 0 {
                first_right += usize::from(ok);
            }
            eprintln!(
                "  {} step {}: want {expected:?}, pointed {:?} | {text}",
                if ok { "ok  " } else { "MISS" },
                index + 1,
                label.as_deref().unwrap_or("nothing"),
            );
            earlier.push(TaskStep {
                question: question.into(),
                answer: text,
                target_label: label,
            });
        }
        all_right += right;
        all_steps += task.steps.len();
        rows.push(format!(
            "| {} | {right}/{} |",
            task.question,
            task.steps.len()
        ));
    }
    println!("\n| Task | Steps pointed at correctly |");
    println!("|---|---|");
    for row in rows {
        println!("{row}");
    }
    println!(
        "\nFirst step right: {first_right}/{}; all steps: {all_right}/{all_steps}",
        TASKS.len()
    );
}
