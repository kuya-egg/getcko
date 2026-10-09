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
    model::{AgentDraft, Rect, ScreenElement, ScreenMode, ScreenSnapshot, TaskStep, TemplateId},
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

/// The screen before step `step` (0-based): steps before it are done, so the fields
/// they filled hold a value and the boxes they ticked are on, as the app reads them.
fn screen(task: &Task, step: usize) -> ScreenSnapshot {
    let done = &task.steps[..step.min(task.steps.len())];
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
                value: match *role {
                    "text" if *label == "Display" => {
                        task.display.get(step).map(|v| (*v).to_owned())
                    }
                    "textField" if done.contains(label) => {
                        Some(format!("my {}", label.to_lowercase()))
                    }
                    "checkbox" => Some(if done.contains(label) { "1" } else { "0" }.to_owned()),
                    _ => None,
                },
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

/// The plan of `question` on `snapshot` with no earlier steps, as the app plans it:
/// actions the screen shows as done left out.
fn plan_on(
    chat: &dyn ChatModel,
    agent: &AgentDraft,
    snapshot: &ScreenSnapshot,
    question: &str,
) -> Vec<String> {
    let turn = TurnPrompt::new(agent, Some(snapshot), &[]);
    let actions =
        pipeline::plan(chat, &turn.system, &turn.body(question), &|| true).expect("plan pass");
    pipeline::without_done(actions, snapshot)
}

/// The element the first action of `actions` grounds to on `snapshot`, if any.
fn first_grounded(
    chat: &dyn ChatModel,
    agent: &AgentDraft,
    snapshot: &ScreenSnapshot,
    actions: &[String],
) -> Option<String> {
    let turn = TurnPrompt::new(agent, Some(snapshot), &[]);
    let action = actions.first()?;
    match pipeline::aim(
        chat,
        &turn,
        &turn.body(action),
        ScreenMode::Elements,
        snapshot,
        None,
        None,
        &|| true,
    )
    .expect("target pass")
    {
        Aim::Element(element) => Some(element.label.clone()),
        _ => None,
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
    let (mut resume_right, mut resume_all) = (0, 0);
    for task in TASKS {
        eprintln!("\n== {} ({})", task.question, task.app);
        let mut earlier: Vec<TaskStep> = Vec::new();
        // The stored plan and the step it starts at (pipeline::Guide).
        let mut planned: Vec<String> = Vec::new();
        let mut plan_start = 0;
        let mut right = 0;
        for (index, expected) in task.steps.iter().enumerate() {
            let snapshot = screen(task, index);
            let question = if index == 0 { task.question } else { NEXT_STEP };
            let turn = TurnPrompt::new(&agent, Some(&snapshot), &earlier);
            let body = turn.body(question);
            // As the app does (pipeline::guide_step): plan on the first question and keep
            // a plan of two or more actions; a "next step" without one plans the first
            // question again on the screen as it is now (nothing left: the task is done).
            let mut done = false;
            if index == 0 {
                planned = pipeline::without_done(
                    pipeline::plan(chat.as_ref(), &turn.system, &body, &|| true)
                        .expect("plan pass"),
                    &snapshot,
                );
                if planned.len() < 2 {
                    planned.clear();
                }
                eprintln!("  plan: {planned:?}");
            } else if planned.is_empty() {
                planned = plan_on(chat.as_ref(), &agent, &snapshot, task.question);
                planned.truncate(getcko_lib::model::MAX_TASK_STEPS.saturating_sub(index));
                plan_start = index;
                done = planned.is_empty();
                eprintln!("  plan at step {}: {planned:?}", index + 1);
            }
            let action = index.checked_sub(plan_start).and_then(|i| planned.get(i));
            let action_body =
                action.map(|action| TurnPrompt::new(&agent, Some(&snapshot), &[]).body(action));
            let aim_with = |body: &str| {
                pipeline::aim(
                    chat.as_ref(),
                    &turn,
                    body,
                    ScreenMode::Elements,
                    &snapshot,
                    None,
                    None,
                    &|| true,
                )
                .expect("target pass")
            };
            let aim = match (&action_body, done) {
                (_, true) => Aim::Nothing,
                (Some(action_body), false) => match aim_with(action_body) {
                    Aim::Nothing => aim_with(&body),
                    found => found,
                },
                (None, false) => aim_with(&body),
            };
            let note = match action {
                Some(action) => prompt::step_note(index + 1, plan_start + planned.len(), action),
                None if done => prompt::TASK_DONE_NOTE.to_owned(),
                None => String::new(),
            };
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
        // Resuming: the task's question planned afresh with the first k steps done, as
        // a "next step" without a stored plan does. Its first action should be step k+1.
        let mut resumed = 0;
        for k in 1..task.steps.len() {
            let snapshot = screen(task, k);
            let actions = plan_on(chat.as_ref(), &agent, &snapshot, task.question);
            let first = first_grounded(chat.as_ref(), &agent, &snapshot, &actions);
            let ok = first.as_deref() == Some(task.steps[k]);
            resumed += usize::from(ok);
            eprintln!(
                "  {} resume after {k}: want {:?}, first {:?} of {actions:?}",
                if ok { "ok  " } else { "MISS" },
                task.steps[k],
                first.as_deref().unwrap_or("nothing"),
            );
        }
        all_right += right;
        all_steps += task.steps.len();
        resume_right += resumed;
        resume_all += task.steps.len() - 1;
        rows.push(format!(
            "| {} | {right}/{} | {resumed}/{} |",
            task.question,
            task.steps.len(),
            task.steps.len() - 1
        ));
    }
    println!("\n| Task | Steps pointed at correctly | Resumed at the right step |");
    println!("|---|---|---|");
    for row in rows {
        println!("{row}");
    }
    println!(
        "\nFirst step right: {first_right}/{}; all steps: {all_right}/{all_steps}; resumed: {resume_right}/{resume_all}",
        TASKS.len()
    );
}
