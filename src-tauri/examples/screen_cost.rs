//! What screen help costs the chat model on this machine, through the app's own
//! target pass (`pipeline::aim`): the part evaluated while the user speaks or types
//! (screen context and, in tier 2, the screenshot) and the part left once the question
//! arrives, for tier 1 and for tier 2 at several screenshot sizes. Reads the window in
//! front a few seconds after the models load.
//!
//! `cargo run --example screen_cost` (llama.cpp is optimized in dev builds too).

use std::path::PathBuf;
use std::time::{Duration, Instant};

use getcko_lib::{
    engine::{self, ChatRequest, ImagePart, RgbImage},
    model::{ScreenMode, TemplateId},
    pipeline::{self, Aim},
    platform,
    prompt::TurnPrompt,
    screenshot::{self, Prepared},
    templates,
};

const QUESTION: &str = "Where do I click to open the settings?";
const ROUNDS: usize = 3;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("error")),
        )
        .with_writer(std::io::stderr)
        .init();
    let models = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models");
    let started = Instant::now();
    let ai = engine::Engine::load(&models);
    println!("engine loaded in {} ms", started.elapsed().as_millis());
    let chat = ai.chat.as_ref().expect("chat model");

    std::thread::sleep(Duration::from_secs(3));
    let os = platform::current();
    let snapshot = os.snapshot(platform::MAX_SNAPSHOT_ELEMENTS).expect("snapshot");
    let capture = os.capture().expect("capture");
    println!(
        "screen: {} ({} elements), capture {}x{}",
        snapshot.app_name,
        snapshot.elements.len(),
        capture.width,
        capture.height
    );
    let t = Instant::now();
    let full = screenshot::prepare(capture, Some(&snapshot.elements));
    println!("screenshot::prepare {} ms (this build's optimization level)", t.elapsed().as_millis());

    let agent = templates::get(TemplateId::OfficeHelper).draft;
    let turn = TurnPrompt::new(&agent, Some(&snapshot), &[]);
    let body = turn.body(QUESTION);
    let ahead = |shot: Option<&Prepared>| {
        let t = Instant::now();
        chat.prefill(&ChatRequest {
            system: &turn.system,
            user: turn.warm_user(),
            max_tokens: turn.max_tokens,
            grammar: None,
            image: shot.map(|s| ImagePart { image: &s.image, text_after: "" }),
        })
        .expect("prefill");
        t.elapsed().as_millis()
    };
    let target = |mode: ScreenMode, shot: Option<&Prepared>| {
        let t = Instant::now();
        let aim = pipeline::aim(chat.as_ref(), &turn, &body, mode, &snapshot, shot, None, &|| true)
            .expect("target pass");
        let picked = match aim {
            Aim::Element(e) => e.id.clone(),
            Aim::Point { .. } => "point".into(),
            Aim::Nothing => "nothing".into(),
        };
        (t.elapsed().as_millis(), picked)
    };

    // Loads the prefix and warms the GPU up.
    ahead(None);
    if std::env::var("SCREEN_COST").as_deref() == Ok("prefill") {
        // Cold reads of a fixed 150-element list: a different prompt first empties the cache.
        let synthetic = getcko_lib::model::ScreenSnapshot {
            app_name: "Class Record".into(),
            window_title: Some("Grade 7 - Section Sampaguita".into()),
            elements: (1..=150)
                .map(|i| getcko_lib::model::ScreenElement {
                    id: format!("e{i}"),
                    role: ["button", "cell", "textField", "text"][i % 4].into(),
                    label: format!("Learner {} quarter {} grade", i / 4 + 1, i % 4 + 1),
                    value: (i % 4 == 1).then(|| format!("{}", 75 + i % 20)),
                    bounds: getcko_lib::model::Rect { x: 0.0, y: f64::from(i as u32) * 20.0, width: 80.0, height: 18.0 },
                })
                .collect(),
        };
        let fixed = TurnPrompt::new(&agent, Some(&synthetic), &[]);
        for _ in 0..ROUNDS {
            chat.prefill(&ChatRequest { system: "x", user: "y", max_tokens: 8, grammar: None, image: None }).expect("reset");
            let t = Instant::now();
            let stats = chat
                .generate(
                    &ChatRequest { system: &fixed.system, user: fixed.warm_user(), max_tokens: 1, grammar: None, image: None },
                    &mut |_| getcko_lib::engine::Flow::Continue,
                )
                .expect("cold read");
            let ms = t.elapsed().as_millis();
            println!(
                "cold 150-element list: {} tokens in {ms} ms = {:.0} tokens/s",
                stats.prompt_tokens,
                f64::from(stats.prompt_tokens) * 1000.0 / ms as f64
            );
        }
        return;
    }
    let sizes: Vec<Prepared> = [1024u32, 768, 512].iter().map(|&side| shrink(&full, side)).collect();
    for round in 1..=ROUNDS {
        println!("== round {round}{}", if round == 1 { " (warm-up)" } else { "" });
        let before = ahead(None);
        let (after, picked) = target(ScreenMode::Elements, None);
        println!("tier 1: ahead {before} ms, after the question {after} ms -> {picked}");
        for shot in &sizes {
            let before = ahead(Some(shot));
            let (after, picked) = target(ScreenMode::ElementsWithImage, Some(shot));
            println!(
                "tier 2 at {}x{}: ahead {before} ms, after the question {after} ms -> {picked}",
                shot.image.width, shot.image.height
            );
        }
    }
}

/// `prepared` with its image box-filtered so the long side is at most `side`.
fn shrink(prepared: &Prepared, side: u32) -> Prepared {
    let image = &prepared.image;
    let long = image.width.max(image.height);
    if long <= side {
        return prepared.clone();
    }
    let ratio = f64::from(side) / f64::from(long);
    let w = ((f64::from(image.width) * ratio).round() as u32).max(1);
    let h = ((f64::from(image.height) * ratio).round() as u32).max(1);
    let mut rgb = Vec::with_capacity((w * h * 3) as usize);
    for y in 0..h {
        let (y0, y1) = (y * image.height / h, ((y + 1) * image.height / h).max(y * image.height / h + 1));
        for x in 0..w {
            let (x0, x1) = (x * image.width / w, ((x + 1) * image.width / w).max(x * image.width / w + 1));
            let mut sum = [0u32; 3];
            for sy in y0..y1 {
                for sx in x0..x1 {
                    let p = ((sy * image.width + sx) * 3) as usize;
                    for (c, total) in sum.iter_mut().enumerate() {
                        *total += u32::from(image.rgb[p + c]);
                    }
                }
            }
            let n = (y1 - y0) * (x1 - x0);
            rgb.extend(sum.map(|total| (total / n) as u8));
        }
    }
    Prepared {
        image: RgbImage { width: w, height: h, rgb },
        scale: prepared.scale * f64::from(w) / f64::from(image.width),
        ..prepared.clone()
    }
}
