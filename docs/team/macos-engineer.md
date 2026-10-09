# macOS engineer

## Mission
Deliver macOS screen accessibility and platform setup while keeping the Rust engine components cross-platform. Coordinate every shared trait and engine change with the Windows engineer under [parity rules](../architecture.md#cross-platform-parity).

## Owns
- `src-tauri/src/platform/macos.rs`
- macOS arm of `src-tauri/src/platform/mod.rs::current()`
- macOS microphone usage disclosure in `src-tauri/Info.plist` / Tauri bundle configuration
- Benchmark script and `docs/MODELS.md`
- Shared `Transcriber` / `Speaker` implementations, coordinated with Windows engineer

## Consumes
- [Platform parity contract](../architecture.md#cross-platform-parity)
- [Model files and runtime](../architecture.md#local-models-and-runtime), [coordinate spaces](../architecture.md#coordinate-spaces-and-threading)
- [`Platform` and `Engine` traits](../architecture.md#ipc-contract) and PRD S1/S4/T1–T4

## Tasks

### P0 — by 1 AM
1. Implement `Platform` in `src-tauri/src/platform/macos.rs` with Accessibility API. Snapshot focused app’s element list, map native roles to shared `ROLES`, exclude GetCko’s own PID, cap at 150, and assign unique IDs. Convert AX global points to desktop physical pixels with each `NSScreen.backingScaleFactor`. Prefer `accessibility-sys` / `objc2` crates. Acceptance: `platform::conformance` passes on a real desktop; useful labeled/actionable elements from Finder, browser, and Numbers or Excel; screen permission denial is returned, never bypassed (S1). Types: `ScreenSnapshot`, `ScreenElement`, `PermissionKind`, `PermissionStatus`.
   Status: `platform::conformance` passes on a real desktop. Chrome web content is read: Chrome builds its web tree only when `AXEnhancedUserInterface` is set as well as `AXManualAccessibility` (16afb97; class record 42 → 108 elements). Survey: 18/18 named-control questions across Chrome, Finder, TextEdit. Empty table cells/rows are dropped so dense grids fit the 150-element cap (held-out grade grid: tier 1 6/10 → 10/10; MODELS.md finding 31).
2. Wire `platform::current()` macOS arm. Implement permission status/request with `AXIsProcessTrustedWithOptions` prompt and `CGPreflightScreenCaptureAccess`. Acceptance: setup status reports actual Accessibility and Screen Recording permissions; request opens system prompt/settings appropriately.
   Status (f68285f): implemented.
3. Implement the shared `Transcriber` with `LlamaChat` and Gemma 4 E2B's audio encoder through llama-cpp-2 `mtmd`; implement `Speaker` using `tts`. No separate speech model is fetched. Acceptance: 5-second audio transcribes in ≤1.5 s (T2); sentence-streamed TTS begins ≤0.5 s after first sentence (T1), `stop` silences immediately (T3); Filipino voice falls back to English when absent (T4). The same implementation builds and works on Windows.
   Status (f68285f): implemented; 3.8-second English clip transcribes in 0.44–0.67 s on M4 Pro. TTS uses `tts` on a dedicated thread; demo Mac has 180 voices and no Filipino voice, so English fallback is used. Filipino/Taglish transcription accuracy remains unmeasured with a real speaker.
4. Add macOS `NSMicrophoneUsageDescription`. Ensure microphone permission denial appears as unavailable, without requesting unrelated permissions.
   Status (f68285f): implemented; `NSMicrophoneUsageDescription` is present. Development runs (`bun run tauri dev`) inherit permissions from the terminal app that launched them; the bundled app asks for its own.

### P1 — 1–4 AM
5. Build screen tiers 2 and 3 ([three tiers](../architecture.md#screen-understanding-three-tiers), S4) in one PR with the Windows engineer's `capture`:
   - `Platform::capture` in `macos.rs` with ScreenCaptureKit (monitor containing the focused window, RGBA8 + `MonitorFrame`); `PermissionDenied(ScreenRecording)` when not granted.
   - Engine vision: llama-cpp-2 `mtmd`, `ChatRequest.image`; load `src-tauri/models/mmproj-gemma-4-E2B-it-Q8_0.gguf` (already fetched with SHA-256 by `bun run models` and bundled by `tauri.models.conf.json`). Rerun `bun run models` to get it.
   - Core: tier choice in `pipeline.rs`, hide `overlay` → capture → show, resize, numbered-box drawing with element IDs, target-pass grammar allowing `x,y` replies in tier 3 only, image px → `PointerTarget` with `elementId: null` and `Confidence::BestGuess`; add `Answer.screenMode`, `Latency.captureMs`; `GETCKO_SCREEN_MODE` override for benchmarks.
   - Acceptance: tier 2 still answers with an element ID; tier 3 is labelled best guess; Screen Recording denied → tier 1 only, empty snapshot → targetless answer; regenerate `src/bindings` and tell both frontend engineers about the changed types.
   Status: macOS side done. `capture` via CoreGraphics `CGDisplay::image`, cropped to the target window (cropping moved Calculator tier-3 points from the menu bar onto the keypad). Gemma points as `[y, x]` normalized to 0–1000, so tier 3 uses that format instead of `x,y` pixels. In-app tier 3 (forced, Calculator, "Which button gives me the result?"): BestGuess pointer on Equals, capture 140 ms, turn 1.57 s; tier 2 picked the right key for both questions tried. Waiting on Windows `capture`. Tier protocol run (`./scripts/tier-eval.sh`, Chrome/Finder/TextEdit): tier 1 28/30, tier 2 28/30 at 2–3× the time, tier 3 0/30 with Gemma's own point → 15/30 reading text first (`Platform::recognize_text`, Vision; a22b42b). Held-out pages (`--heldout`, 50 questions, never tuned on): tier 1 47/50, tier 2 46/50, tier 3 8/50; the optional Qwen3-VL-2B grounder scores 30/50 there but is not bundled or wired into the app (decision pending). Gemma E2B could not be made to ground by prompting, zooming or pixel-detected marks. See MODELS.md findings 10–34.
6. Add benchmark script and `docs/MODELS.md` with PRD latency table values measured over 10 runs on the demo Mac; include machine/model/date and method. Acceptance: median spoken-response ≤3 s target is reported honestly, with all latency figures reproducible (BR-24); do not publish estimates as measurements.
   Status: `scripts/benchmark.sh` + `src-tauri/examples/benchmark.rs`; 10-run results in [`docs/MODELS.md`](../MODELS.md). Turn redesigned (persistent KV cache with prefix reuse, screen prefilled during push-to-talk, grammar-constrained target pass, Gemma 4 prompt format): end of speech → first spoken word 1.42–1.49 s, Taglish demo question points correctly 10/10 spoken and typed. Open: answer first token 0.64 s vs 0.3 s budget (prompt processing is ~1,170 tokens/s with every setting tried, so it needs fewer prompt tokens; finding 34); English pronunciation of "Juan" transcribes as "one's". Tier protocol not measured yet (needs tiers 2–3).
   Starting point measured on the M4 Pro (Oct 9, debug build, Metal): first launch of a new build loads models in ~16.6 s, ~15.9 s of it llama.cpp compiling its embedded Metal library; the next launch loaded in 0.87 s. First token 0.47–0.74 s for a ~420-token prompt (budget 0.3 s); full 55–63-token answer 1.1–1.3 s; top-5 retrieval 13–44 ms. Warm-launch the release build once before the pitch, investigate prompt-prefill cost (smaller snapshot, shorter system prompt) and record before/after numbers.
   Include the [tier measurement protocol](../architecture.md#screen-understanding-three-tiers): 10 scripted tasks × 3 apps in each forced tier, accuracy and latency per tier; it decides whether tier 2 stays on.
   Optional latency experiment: `ggml-org/gemma-4-E2B-it-GGUF` also publishes `mtp-gemma-4-E2B-it-Q4_0.gguf` (59 MB) for multi-token prediction. Check whether llama-cpp-2 0.1.159 can use it; if it does, measure first-token and total latency with and without it, and only add it to `fetch-models.sh` if the numbers improve.

### P2
7. If ahead, benchmark exact-search vs `vector_quantize` on the demo library and record whether R7’s Recall@5 stays within a few points. Acceptance: publish no quantized-search quality claim without measured comparison; keep exact search as baseline.

## Handoffs
- Before platform integration: agree shared trait additions, permission semantics, test vectors and PR timing with Windows engineer; any trait addition lands with both OS implementations.
- By P0 integration: give frontend engineers permission states, voice list, and TTS stop/stream behaviour through the shared IPC contract.
- By 4–6 AM: provide benchmark script, raw measured results and `MODELS.md` to pitcher/designer; inform frontend of measured-latency field availability.

## Done
- [x] AX implementation passes `platform::conformance` on macOS; Chrome snapshot and real-desktop conformance evidence recorded under task 1.
- [x] AX physical-coordinate conversion handles display backing scale and excludes own PID.
- [x] Permission prompts/statuses and microphone disclosure are in place.
- [x] Shared Gemma audio `Transcriber` and `tts` `Speaker` implemented; English clip latency recorded. Filipino/Taglish accuracy with a real speaker remains unmeasured.
- [ ] Tiers 2–3 shipped with the Windows `capture` and `recognize_text` (macOS side done; waiting on Windows); macOS tier measurements recorded in `docs/MODELS.md` (regression set: tier 1 27/30, tier 2 27/30, tier 3 14/30; held-out: 47/50, 46/50, 8/50).
- [x] Ten-run measured benchmark and `docs/MODELS.md` are reproducible.
