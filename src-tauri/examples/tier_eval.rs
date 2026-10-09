//! Screen-tier measurement (architecture: three tiers). Opens three apps on fixed
//! content, asks scripted questions in each forced tier, and scores the pointer:
//! correct when it lands inside the expected element's bounds (the element comes
//! from the app's own accessibility tree, so tiers are scored the same way).
//!
//! Run with `./scripts/tier-eval.sh`; `--app <name>` runs one app, `--survey` asks
//! about controls found on each app's screen instead, `--dump <app>` prints that app's
//! elements and saves the screenshot the model sees (and tier 3's marked one).
//! `--heldout` measures the held-out pages in Chrome instead (never used for tuning).
//! Brings Google Chrome, Finder and TextEdit (no other apps) to the front while it runs.

use std::{
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::{Duration, Instant},
};

use getcko_lib::{
    engine::{self, ChatModel, Grounder, grounder::LlamaGrounder},
    model::{ScreenElement, ScreenMode, ScreenSnapshot, TemplateId},
    pipeline::{self, Aim},
    platform::{self, Platform},
    prompt::TurnPrompt,
    screenshot, templates,
};

#[path = "common/mod.rs"]
mod common;

struct Task {
    question: &'static str,
    /// Accessibility label or value (any case) of the element the pointer should land on.
    expect: &'static str,
}

struct App {
    name: &'static str,
    tasks: &'static [Task],
}

const CLASS_RECORD: &[Task] = &[
    Task {
        question: "Where do I type Juan Dela Cruz's first quarter grade?",
        expect: "Q1, Juan Dela Cruz",
    },
    Task {
        question: "Where do I put Ana Santos's grade for the second quarter?",
        expect: "Q2, Ana Santos",
    },
    Task {
        question: "Where do I put Maria Reyes's grade for the third quarter?",
        expect: "Q3, Maria Reyes",
    },
    Task {
        question: "Where is the fourth quarter grade of Jose Rizal Mercado entered?",
        expect: "Q4, Jose Rizal Mercado",
    },
    Task {
        question: "How do I save the class record?",
        expect: "Save",
    },
    Task {
        question: "How do I print this?",
        expect: "Print",
    },
    Task {
        question: "How do I compute the final grades?",
        expect: "Compute final grades",
    },
    Task {
        question: "I need to add a new student to the class.",
        expect: "Add student",
    },
    Task {
        question: "Where can I look for a student by name?",
        expect: "Search students",
    },
    Task {
        question: "How do I switch to another section?",
        expect: "Section",
    },
];

const FINDER: &[Task] = &[
    Task {
        question: "Where is the grading manual?",
        expect: "Grading Manual.pdf",
    },
    Task {
        question: "Which file is the class record for the first quarter?",
        expect: "Class Record Q1.csv",
    },
    Task {
        question: "Where are the photos?",
        expect: "Photos",
    },
    Task {
        question: "Open the attendance sheet.",
        expect: "Attendance.xlsx",
    },
    Task {
        question: "Where is the lesson plan for week 3?",
        expect: "Lesson Plan Week 3.docx",
    },
    Task {
        question: "How do I go back to the previous folder?",
        expect: "Back",
    },
    Task {
        question: "Where do I search for a file?",
        expect: "Search",
    },
    Task {
        question: "Where are my downloads?",
        expect: "Downloads",
    },
    Task {
        question: "How do I get to the Applications folder?",
        expect: "Applications",
    },
    Task {
        question: "Where is the Desktop folder?",
        expect: "Desktop",
    },
];

const TEXTEDIT: &[Task] = &[
    Task {
        question: "How do I make the text bold?",
        expect: "bold",
    },
    Task {
        question: "How do I make it italic?",
        expect: "italic",
    },
    Task {
        question: "Where do I underline words?",
        expect: "underline",
    },
    Task {
        question: "How do I change the font?",
        expect: "typeface",
    },
    Task {
        question: "How do I make the letters bigger?",
        expect: "font size",
    },
    Task {
        question: "How do I center the title?",
        expect: "align center",
    },
    Task {
        question: "How do I align the text to the right?",
        expect: "align right",
    },
    Task {
        question: "How do I add bullet points?",
        expect: "list style",
    },
    Task {
        question: "How do I change the color of the text?",
        expect: "text color",
    },
    Task {
        question: "Where do I change the line spacing?",
        expect: "line spacing",
    },
];

/// At most three apps are opened: a browser, the file manager and a document editor.
const APPS: &[App] = &[
    App {
        name: "Google Chrome",
        tasks: CLASS_RECORD,
    },
    App {
        name: "Finder",
        tasks: FINDER,
    },
    App {
        name: "TextEdit",
        tasks: TEXTEDIT,
    },
];

/// Questions about the regression apps that no control answers (an explanation, a
/// definition, a fact): the target pass should point at nothing.
fn no_target_questions(app: &str) -> &'static [&'static str] {
    match app {
        "Google Chrome" => &[
            "What does quarterly assessment mean?",
            "Why is the total of the grades divided by four?",
            "What is a passing grade?",
        ],
        "Finder" => &[
            "What does a lesson plan usually include?",
            "What is the difference between a PDF and a Word file?",
            "When are the grades due this quarter?",
        ],
        "TextEdit" => &[
            "How is the final grade computed?",
            "What is a class record?",
            "How should I explain a failing grade to parents?",
        ],
        _ => &[],
    }
}

/// One screen to measure: the app to open, the page it shows (Chrome) and the questions.
struct Run {
    /// Row label, and the `--app` / `--dump` name.
    name: String,
    app: &'static str,
    page: Option<PathBuf>,
    /// (question, accessible name of the expected element)
    tasks: Vec<(String, String)>,
}

/// The fixed apps, or with `--heldout` the held-out pages in Chrome
/// (`scripts/fixtures/heldout/questions.json`, never used to tune the pipeline).
fn runs(fixtures: &Path, heldout: bool) -> Vec<Run> {
    if !heldout {
        return APPS
            .iter()
            .map(|app| Run {
                name: app.name.to_owned(),
                app: app.name,
                page: (app.name == "Google Chrome").then(|| fixtures.join("class-record.html")),
                tasks: app
                    .tasks
                    .iter()
                    .map(|t| (t.question.to_owned(), t.expect.to_owned()))
                    .collect(),
            })
            .collect();
    }
    let dir = fixtures.join("heldout");
    let json: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(dir.join("questions.json")).expect("held-out questions"),
    )
    .expect("held-out questions are JSON");
    json["pages"]
        .as_array()
        .expect("pages")
        .iter()
        .map(|page| Run {
            name: page["slug"].as_str().expect("slug").to_owned(),
            app: "Google Chrome",
            page: Some(dir.join(page["file"].as_str().expect("file"))),
            tasks: page["questions"]
                .as_array()
                .expect("questions")
                .iter()
                .map(|q| {
                    (
                        q["question"].as_str().expect("question").to_owned(),
                        q["expect"].as_str().expect("expect").to_owned(),
                    )
                })
                .collect(),
        })
        .collect()
}

/// Elements read for scoring (not for prompts).
const TRUTH_ELEMENTS: usize = 2000;

/// Radius of the overlay's best-guess circle in CSS px (`Halo.tsx`: 36 px diameter).
const HALO_RADIUS: f64 = 18.0;

const MODES: [ScreenMode; 3] = [
    ScreenMode::Elements,
    ScreenMode::ElementsWithImage,
    ScreenMode::ImageOnly,
];

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("error")),
        )
        .with_writer(std::io::stderr)
        .init();
    let args: Vec<String> = std::env::args().skip(1).collect();
    let dump = args
        .iter()
        .position(|a| a == "--dump")
        .and_then(|i| args.get(i + 1))
        .cloned();
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixtures = manifest.join("../scripts/fixtures");
    let platform = platform::current();

    let heldout = args.iter().any(|a| a == "--heldout");
    let runs = runs(&fixtures, heldout);
    if let Some(name) = dump {
        let run = runs
            .iter()
            .find(|r| r.name == name)
            .expect("--dump names an app or held-out page");
        let snapshot = show(run, platform.as_ref()).expect("app shown");
        println!(
            "{} ({} elements, auto tier {:?})",
            snapshot.app_name,
            snapshot.elements.len(),
            pipeline::tier_for(&snapshot)
        );
        let capture = platform.capture().expect("screen capture");
        let shot = screenshot::prepare(capture.clone(), None);
        let (marked, text) = pipeline::read_screenshot(platform.as_ref(), capture);
        let write = |shot: &screenshot::Prepared, suffix: &str| {
            let path = std::env::temp_dir().join(format!("tier-eval-{name}{suffix}.ppm"));
            let mut ppm =
                format!("P6\n{} {}\n255\n", shot.image.width, shot.image.height).into_bytes();
            ppm.extend_from_slice(&shot.image.rgb);
            std::fs::write(&path, ppm).expect("write screenshot");
            path
        };
        println!(
            "model image {}x{} at origin {:?}: {} (tier 3 marks: {})",
            shot.image.width,
            shot.image.height,
            shot.origin,
            write(&shot, "").display(),
            write(&marked, "-tier3").display()
        );
        for e in snapshot.elements.iter().chain(&text.elements) {
            println!(
                "{} | {} | {:?} | {:?} | {:?}",
                e.id, e.role, e.label, e.value, e.bounds
            );
        }
        return;
    }

    let ai = engine::Engine::load(&manifest.join("models"));
    let chat = common::chat_under_test(
        ai.chat.clone().expect("chat model loads"),
        &manifest.join("models"),
    );
    // Tier-3 grounding model under test: GETCKO_GROUNDER=qwen3-vl.
    let grounder = std::env::var("GETCKO_GROUNDER").ok().map(|name| {
        assert_eq!(name, "qwen3-vl", "unknown GETCKO_GROUNDER");
        let models = manifest.join("models");
        let rt = engine::llama::Runtime::init().expect("runtime");
        let started = Instant::now();
        let grounder = LlamaGrounder::load(
            &rt,
            &models.join(engine::GROUNDER_MODEL_FILE),
            &models.join(engine::GROUNDER_PROJECTOR_FILE),
        )
        .expect("grounder loads");
        eprintln!(
            "{} loaded in {} ms",
            grounder.name(),
            started.elapsed().as_millis()
        );
        grounder
    });
    let agent = templates::get(TemplateId::OfficeHelper).draft;
    if args.iter().any(|a| a == "--survey") {
        survey(chat.as_ref(), &agent, platform.as_ref(), &runs);
        return;
    }
    println!(
        "| App | Tier | Correct | Touched by the guess circle | Target pass median | Capture + prepare |"
    );
    println!("|---|---|---|---|---|---|");
    let mut misses = Vec::new();
    let mut none_rows = Vec::new();
    let none_only = args.iter().any(|a| a == "--none-only");
    let only = args
        .iter()
        .position(|a| a == "--app")
        .and_then(|i| args.get(i + 1));
    for app in runs
        .iter()
        .filter(|a| only.is_none_or(|name| *name == a.name))
    {
        let snapshot = show(app, platform.as_ref()).expect("app shown");
        // Ground truth: the whole tree, not the app's 150-element prompt list (a dense
        // grid's cells can fall outside it).
        let truth = platform.snapshot(TRUTH_ELEMENTS).expect("full snapshot");
        let capture_start = Instant::now();
        let capture = platform
            .capture()
            .expect("screen capture (Screen Recording granted?)");
        let capture_ms = capture_start.elapsed().as_millis();
        eprintln!(
            "{}: {} elements, auto tier {:?}",
            app.name,
            snapshot.elements.len(),
            pipeline::tier_for(&snapshot)
        );
        let questions = if heldout {
            &[][..]
        } else {
            no_target_questions(&app.name)
        };
        if !questions.is_empty() {
            let turn = TurnPrompt::new(&agent, Some(&snapshot), &[]);
            let mut right = 0;
            for question in questions {
                let aim = pipeline::aim(
                    chat.as_ref() as &dyn ChatModel,
                    &turn,
                    &turn.body(question),
                    ScreenMode::Elements,
                    &snapshot,
                    None,
                    None,
                    &|| true,
                )
                .expect("target pass");
                match aim {
                    Aim::Nothing => right += 1,
                    Aim::Element(e) => misses.push(format!(
                        "{} no-target: {question:?} → {} {:?}",
                        app.name, e.role, e.label
                    )),
                    Aim::Point { .. } => {
                        misses.push(format!("{} no-target: {question:?} → point", app.name));
                    }
                }
            }
            none_rows.push(format!("| {} | {right}/{} |", app.name, questions.len()));
        }
        if none_only {
            continue;
        }
        for mode in MODES {
            let prepare_start = Instant::now();
            // Tier 3 sees only the screenshot and the text read from it, as in the app.
            let mut text = None;
            let shot = match mode {
                ScreenMode::Elements => None,
                ScreenMode::ElementsWithImage => Some(screenshot::prepare(
                    capture.clone(),
                    Some(&snapshot.elements),
                )),
                ScreenMode::ImageOnly => {
                    // The grounder replaces text recognition and needs an unmarked image.
                    if grounder.is_none() {
                        let (shot, pieces) =
                            pipeline::read_screenshot(platform.as_ref(), capture.clone());
                        text = Some(pieces);
                        Some(shot)
                    } else {
                        text = Some(ScreenSnapshot {
                            app_name: String::new(),
                            window_title: None,
                            elements: Vec::new(),
                        });
                        Some(screenshot::prepare(capture.clone(), None))
                    }
                }
            };
            let screen = text.as_ref().unwrap_or(&snapshot);
            let image_ms = shot
                .as_ref()
                .map(|_| capture_ms + prepare_start.elapsed().as_millis());
            let turn = TurnPrompt::new(&agent, Some(&snapshot), &[]);
            let mut correct = 0;
            let mut near = 0usize;
            let mut times = Vec::new();
            for (question, expect) in &app.tasks {
                let named = |text: &str| text.eq_ignore_ascii_case(expect);
                let expected: Vec<&ScreenElement> = truth
                    .elements
                    .iter()
                    .filter(|e| named(&e.label) || e.value.as_deref().is_some_and(named))
                    .collect();
                assert!(
                    !expected.is_empty(),
                    "{}: no element labelled {:?}; run --dump {}",
                    app.name,
                    expect,
                    app.name
                );
                let started = Instant::now();
                let aim = pipeline::aim(
                    chat.as_ref() as &dyn ChatModel,
                    &turn,
                    &turn.body(question),
                    mode,
                    screen,
                    shot.as_ref(),
                    grounder
                        .as_ref()
                        .map(|g| pipeline::Grounding { model: g, question }),
                    &|| true,
                )
                .expect("target pass");
                times.push(started.elapsed().as_millis());
                let point = match aim {
                    Aim::Element(e) => Some(e.bounds.center()),
                    Aim::Point { x, y, .. } => Some((x, y)),
                    Aim::Nothing => None,
                };
                // Physical px from the point to the nearest expected element (0 inside).
                let gap = point.map_or(f64::INFINITY, |(x, y)| {
                    expected
                        .iter()
                        .map(|e| {
                            let b = &e.bounds;
                            let dx = (b.x - x).max(x - (b.x + b.width)).max(0.0);
                            let dy = (b.y - y).max(y - (b.y + b.height)).max(0.0);
                            dx.hypot(dy)
                        })
                        .fold(f64::INFINITY, f64::min)
                });
                // The overlay draws a best guess as a circle of HALO_RADIUS CSS px.
                if let Aim::Point { monitor, .. } = aim
                    && gap <= HALO_RADIUS * monitor.scale_factor
                {
                    near += 1;
                }
                if gap == 0.0 {
                    correct += 1;
                    near += usize::from(!matches!(aim, Aim::Point { .. }));
                } else {
                    let got = match aim {
                        Aim::Element(e) => format!("{} {:?}", e.role, e.label),
                        Aim::Point { x, y, .. } => format!("point ({x:.0}, {y:.0})"),
                        Aim::Nothing => "nothing".into(),
                    };
                    misses.push(format!("{} {:?}: {:?} → {got}", app.name, mode, question));
                }
            }
            times.sort_unstable();
            let median = times[times.len() / 2];
            println!(
                "| {} | {:?} | {correct}/{} | {near}/{} | {median} ms | {} |",
                app.name,
                mode,
                app.tasks.len(),
                app.tasks.len(),
                image_ms.map_or("—".into(), |ms| format!("{ms} ms"))
            );
        }
    }
    if !none_rows.is_empty() {
        println!("\n| App | No-target questions answered with no pointer |\n|---|---|");
        for row in &none_rows {
            println!("{row}");
        }
    }
    println!("\nMisses:");
    for miss in misses {
        println!("- {miss}");
    }
}

/// Opens `app` on its fixture, brings it to the front and reads its screen.
fn show(target: &Run, platform: &dyn Platform) -> Result<ScreenSnapshot, String> {
    let app = target.app;
    match app {
        "Google Chrome" => {
            // One fixture tab: earlier runs' copies would fill the tab strip and
            // use up the element budget before the page's fields.
            run(
                "osascript",
                &[
                    "-e",
                    r#"tell application "Google Chrome" to close (every tab of every window whose URL contains "/scripts/fixtures/")"#,
                ],
            );
            let page = target.page.as_ref().ok_or("Chrome needs a page")?;
            run("open", &["-a", app, &page.to_string_lossy()]);
        }
        "TextEdit" => {
            // Rich text, so the formatting bar (font, style, alignment, lists) shows.
            let letter = std::env::temp_dir().join("GetCko letter.rtf");
            std::fs::write(
                &letter,
                r"{\rtf1\ansi{\fonttbl\f0 Helvetica;}\f0\fs28 Dear parents,\par\par Grades for the first quarter are ready.\par}",
            )
            .expect("fixture letter");
            run("open", &["-a", "TextEdit", &letter.to_string_lossy()]);
        }
        "Finder" => {
            // Only the fixture's window: leftover windows on the temp folder (its
            // parent, "T") would otherwise be read instead.
            run(
                "osascript",
                &[
                    "-e",
                    r#"tell application "Finder"
                        repeat with w in (get every Finder window)
                            if name of w is in {"T", "GetCko Demo"} then close w
                        end repeat
                    end tell"#,
                ],
            );
            let folder = finder_folder();
            run("open", &["-a", "Finder", &folder.to_string_lossy()]);
        }
        other => run("open", &["-a", other]),
    }
    // A just-launched app can take a few seconds to own the frontmost window, and
    // its window animates into place and pages load: wait until two reads agree on the
    // window and the element count.
    let window_frame = |s: &ScreenSnapshot| {
        s.elements
            .iter()
            .find(|e| e.role == "window")
            .map(|e| e.bounds)
    };
    let mut previous: Option<ScreenSnapshot> = None;
    for _ in 0..15 {
        thread::sleep(Duration::from_secs(1));
        run(
            "osascript",
            &["-e", &format!("tell application \"{app}\" to activate")],
        );
        thread::sleep(Duration::from_millis(500));
        let snapshot = match platform.snapshot(platform::MAX_SNAPSHOT_ELEMENTS) {
            Ok(snapshot) => snapshot,
            Err(error) => {
                previous = None;
                eprintln!("{app}: {error}");
                continue;
            }
        };
        if snapshot.app_name != app {
            previous = None;
            continue;
        }
        if let Some(before) = &previous
            && window_frame(before) == window_frame(&snapshot)
            && before.elements.len() == snapshot.elements.len()
        {
            return Ok(snapshot);
        }
        previous = Some(snapshot);
    }
    Err(format!("{app} did not settle at the front"))
}

/// A folder of empty files with the names the Finder tasks ask about.
fn finder_folder() -> PathBuf {
    let folder = std::env::temp_dir().join("GetCko Demo");
    std::fs::create_dir_all(folder.join("Photos")).expect("fixture folder");
    for name in [
        "Grading Manual.pdf",
        "Class Record Q1.csv",
        "Attendance.xlsx",
        "Lesson Plan Week 3.docx",
    ] {
        std::fs::write(folder.join(name), b"").expect("fixture file");
    }
    folder
}

fn run(program: &str, args: &[&str]) {
    let status = Command::new(program)
        .args(args)
        .status()
        .expect("command runs");
    assert!(status.success(), "{program} {args:?} failed");
}

/// Roles worth asking "where is" about: things the user acts on.
const ASKABLE: &[&str] = &[
    "button",
    "checkbox",
    "radio",
    "textField",
    "textArea",
    "comboBox",
    "listItem",
    "tab",
    "link",
    "cell",
    "slider",
];
const SURVEY_QUESTIONS: usize = 6;

/// Generic check: reads each app's screen and asks about controls it finds, in the
/// tier the core would pick. Questions name the control, so a miss means the screen
/// read, the ids or the model failed, not that the question was hard.
fn survey(
    chat: &dyn ChatModel,
    agent: &getcko_lib::model::AgentDraft,
    platform: &dyn Platform,
    runs: &[Run],
) {
    println!(
        "| App | Elements | Labelled | Read | Auto tier | Named-control questions | Target pass median |"
    );
    println!("|---|---|---|---|---|---|---|");
    let mut misses = Vec::new();
    for target in runs {
        let app = target.name.as_str();
        let snapshot = match show(target, platform) {
            Ok(snapshot) => snapshot,
            Err(error) => {
                println!("| {app} | — | — | — | — | {error} | — |");
                continue;
            }
        };
        let started = Instant::now();
        let snapshot = platform
            .snapshot(platform::MAX_SNAPSHOT_ELEMENTS)
            .ok()
            .filter(|s| s.app_name == app)
            .unwrap_or(snapshot);
        let read_ms = started.elapsed().as_millis();
        let labelled = snapshot
            .elements
            .iter()
            .filter(|e| !e.label.trim().is_empty())
            .count();
        let mode = pipeline::tier_for(&snapshot);
        let unique = |label: &str| {
            snapshot
                .elements
                .iter()
                .filter(|e| e.label == label)
                .count()
                == 1
        };
        let candidates: Vec<&ScreenElement> = snapshot
            .elements
            .iter()
            .filter(|e| {
                ASKABLE.contains(&e.role.as_str())
                    && !e.label.trim().is_empty()
                    && e.label.chars().count() <= 40
                    && unique(&e.label)
            })
            .collect();
        let step = (candidates.len() / SURVEY_QUESTIONS).max(1);
        let picks: Vec<&ScreenElement> = candidates
            .iter()
            .step_by(step)
            .take(SURVEY_QUESTIONS)
            .copied()
            .collect();
        let mut text = None;
        let shot = match mode {
            ScreenMode::Elements => None,
            ScreenMode::ElementsWithImage => platform
                .capture()
                .ok()
                .map(|c| screenshot::prepare(c, Some(&snapshot.elements))),
            ScreenMode::ImageOnly => platform.capture().ok().map(|c| {
                let (shot, pieces) = pipeline::read_screenshot(platform, c);
                text = Some(pieces);
                shot
            }),
        };
        let screen = text.as_ref().unwrap_or(&snapshot);
        let turn = TurnPrompt::new(agent, Some(&snapshot), &[]);
        let mut correct = 0;
        let mut times = Vec::new();
        for pick in &picks {
            let question = format!("Where is the \"{}\" {}?", pick.label, pick.role);
            let started = Instant::now();
            let aim = pipeline::aim(
                chat,
                &turn,
                &turn.body(&question),
                mode,
                screen,
                shot.as_ref(),
                None,
                &|| true,
            )
            .expect("target pass");
            times.push(started.elapsed().as_millis());
            let point = match aim {
                Aim::Element(e) => Some(e.bounds.center()),
                Aim::Point { x, y, .. } => Some((x, y)),
                Aim::Nothing => None,
            };
            let b = &pick.bounds;
            if point.is_some_and(|(x, y)| {
                x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
            }) {
                correct += 1;
            } else {
                let got = match aim {
                    Aim::Element(e) => format!("{} {:?}", e.role, e.label),
                    Aim::Point { x, y, .. } => format!("point ({x:.0}, {y:.0})"),
                    Aim::Nothing => "nothing".into(),
                };
                misses.push(format!("{app}: {question} → {got}"));
            }
        }
        times.sort_unstable();
        let median = times
            .get(times.len() / 2)
            .map_or("—".into(), |ms| format!("{ms} ms"));
        println!(
            "| {app} | {} | {labelled} | {read_ms} ms | {mode:?} | {correct}/{} | {median} |",
            snapshot.elements.len(),
            picks.len()
        );
    }
    println!("\nMisses:");
    for miss in misses {
        println!("- {miss}");
    }
}
