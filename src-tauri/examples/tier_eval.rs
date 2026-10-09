//! Screen-tier measurement (architecture: three tiers). Opens three apps on fixed
//! content, asks scripted questions in each forced tier, and scores the pointer:
//! correct when it lands inside the expected element's bounds (the element comes
//! from the app's own accessibility tree, so tiers are scored the same way).
//!
//! Run with `./scripts/tier-eval.sh`; `--app <name>` runs one app, `--dump <app>` prints
//! that app's elements and saves the screenshot the model sees.
//! Brings Safari, Finder and Calculator to the front while it runs.

use std::{
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::{Duration, Instant},
};

use getcko_lib::{
    engine::{self, ChatModel},
    model::{ScreenElement, ScreenMode, ScreenSnapshot, TemplateId},
    pipeline::{self, Aim},
    platform::{self, Platform},
    prompt::TurnPrompt,
    screenshot, templates,
};

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
        question: "Saan ko ilalagay ang grade ni Maria Reyes sa third quarter?",
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

const CALCULATOR: &[Task] = &[
    Task {
        question: "Where is the button for seven?",
        expect: "7",
    },
    Task {
        question: "Which button gives me the result?",
        expect: "Equals",
    },
    Task {
        question: "How do I clear everything?",
        expect: "All Clear",
    },
    Task {
        question: "Which button adds numbers?",
        expect: "Add",
    },
    Task {
        question: "Where is multiply?",
        expect: "Multiply",
    },
    Task {
        question: "How do I divide?",
        expect: "Divide",
    },
    Task {
        question: "Where is the percent key?",
        expect: "Percent",
    },
    Task {
        question: "Where is zero?",
        expect: "0",
    },
    Task {
        question: "How do I subtract?",
        expect: "Subtract",
    },
    Task {
        question: "Where is the decimal point?",
        expect: "Point",
    },
];

const APPS: &[App] = &[
    App {
        name: "Safari",
        tasks: CLASS_RECORD,
    },
    App {
        name: "Finder",
        tasks: FINDER,
    },
    App {
        name: "Calculator",
        tasks: CALCULATOR,
    },
];

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

    if let Some(name) = dump {
        let snapshot = show(&name, &fixtures, platform.as_ref());
        println!(
            "{} ({} elements, auto tier {:?})",
            snapshot.app_name,
            snapshot.elements.len(),
            pipeline::tier_for(&snapshot)
        );
        let shot = screenshot::prepare(platform.capture().expect("screen capture"), None);
        let path = std::env::temp_dir().join(format!("tier-eval-{name}.ppm"));
        let mut ppm = format!("P6\n{} {}\n255\n", shot.image.width, shot.image.height).into_bytes();
        ppm.extend_from_slice(&shot.image.rgb);
        std::fs::write(&path, ppm).expect("write screenshot");
        println!(
            "model image {}x{} at origin {:?}: {}",
            shot.image.width,
            shot.image.height,
            shot.origin,
            path.display()
        );
        for e in &snapshot.elements {
            println!(
                "{} | {} | {:?} | {:?} | {:?}",
                e.id, e.role, e.label, e.value, e.bounds
            );
        }
        return;
    }

    let ai = engine::Engine::load(&manifest.join("models"));
    let chat = ai.chat.clone().expect("chat model loads");
    let agent = templates::get(TemplateId::OfficeHelper).draft;
    println!(
        "| App | Tier | Correct | Touched by the guess circle | Target pass median | Capture + prepare |"
    );
    println!("|---|---|---|---|---|---|");
    let mut misses = Vec::new();
    let only = args
        .iter()
        .position(|a| a == "--app")
        .and_then(|i| args.get(i + 1));
    for app in APPS
        .iter()
        .filter(|a| only.is_none_or(|name| name == a.name))
    {
        let snapshot = show(app.name, &fixtures, platform.as_ref());
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
        for mode in MODES {
            let prepare_start = Instant::now();
            let shot = match mode {
                ScreenMode::Elements => None,
                ScreenMode::ElementsWithImage => Some(screenshot::prepare(
                    capture.clone(),
                    Some(&snapshot.elements),
                )),
                ScreenMode::ImageOnly => Some(screenshot::prepare(capture.clone(), None)),
            };
            let image_ms = shot
                .as_ref()
                .map(|_| capture_ms + prepare_start.elapsed().as_millis());
            let turn = TurnPrompt::new(&agent, Some(&snapshot), &[]);
            let mut correct = 0;
            let mut near = 0usize;
            let mut times = Vec::new();
            for task in app.tasks {
                let named = |text: &str| text.eq_ignore_ascii_case(task.expect);
                let expected: Vec<&ScreenElement> = snapshot
                    .elements
                    .iter()
                    .filter(|e| named(&e.label) || e.value.as_deref().is_some_and(named))
                    .collect();
                assert!(
                    !expected.is_empty(),
                    "{}: no element labelled {:?}; run --dump {}",
                    app.name,
                    task.expect,
                    app.name
                );
                let started = Instant::now();
                let aim = pipeline::aim(
                    chat.as_ref() as &dyn ChatModel,
                    &turn.system,
                    &turn.body(task.question, &[]),
                    mode,
                    &snapshot,
                    shot.as_ref(),
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
                    misses.push(format!(
                        "{} {:?}: {:?} → {got}",
                        app.name, mode, task.question
                    ));
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
    println!("\nMisses:");
    for miss in misses {
        println!("- {miss}");
    }
}

/// Opens `app` on its fixture, brings it to the front and reads its screen.
fn show(app: &str, fixtures: &Path, platform: &dyn Platform) -> ScreenSnapshot {
    match app {
        "Safari" => {
            let page = fixtures.join("class-record.html");
            run("open", &["-a", "Safari", &page.to_string_lossy()]);
        }
        "Finder" => {
            let folder = finder_folder();
            run("open", &["-a", "Finder", &folder.to_string_lossy()]);
        }
        other => run("open", &["-a", other]),
    }
    // A just-launched app can take a few seconds to own the frontmost window, and
    // its window animates into place: wait until two reads agree on the window.
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
        let snapshot = platform
            .snapshot(platform::MAX_SNAPSHOT_ELEMENTS)
            .expect("accessibility snapshot (Accessibility granted?)");
        if snapshot.app_name != app {
            previous = None;
            continue;
        }
        if let Some(before) = &previous
            && window_frame(before).is_some()
            && window_frame(before) == window_frame(&snapshot)
        {
            return snapshot;
        }
        previous = Some(snapshot);
    }
    panic!("{app} did not settle at the front");
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
