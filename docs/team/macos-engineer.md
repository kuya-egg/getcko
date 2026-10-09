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
2. Wire `platform::current()` macOS arm. Implement permission status/request with `AXIsProcessTrustedWithOptions` prompt and `CGPreflightScreenCaptureAccess`. Acceptance: setup status reports actual Accessibility and Screen Recording permissions; request opens system prompt/settings appropriately.
3. Implement `Transcriber` using `whisper-rs` and `Speaker` using `tts`; add whisper model file to `scripts/fetch-models.sh` with SHA-256 verification and `src-tauri/tauri.models.conf.json` bundle resources. Acceptance: 5-second audio transcribes in ≤1.5 s (T2); sentence-streamed TTS begins ≤0.5 s after first sentence (T1), `stop` silences immediately (T3); Filipino voice falls back to English when absent (T4). The same implementations must build and work on Windows; coordinate APIs and build compatibility with Windows engineer.
4. Add macOS `NSMicrophoneUsageDescription`. Ensure microphone permission denial appears as unavailable, without requesting unrelated permissions.

### P1 — 1–4 AM
5. Add S4 screenshot fallback using Gemma vision/mmproj and Screen Recording permission only in a paired macOS+Windows `Platform` trait change. Acceptance: image answers are labelled “best guess”; empty AX trees still have P0 targetless answer behaviour. Coordinate the Windows implementation in the same PR.
6. Add benchmark script and `docs/MODELS.md` with PRD latency table values measured over 10 runs on the demo Mac; include machine/model/date and method. Acceptance: median spoken-response ≤3 s target is reported honestly, with all latency figures reproducible (BR-24); do not publish estimates as measurements.
   Starting point measured on the M4 Pro (Oct 9, debug build, Metal): first launch of a new build loads models in ~16.6 s, ~15.9 s of it llama.cpp compiling its embedded Metal library; the next launch loaded in 0.87 s. First token 0.47–0.74 s for a ~420-token prompt (budget 0.3 s); full 55–63-token answer 1.1–1.3 s; top-5 retrieval 13–44 ms. Warm-launch the release build once before the pitch, investigate prompt-prefill cost (smaller snapshot, shorter system prompt) and record before/after numbers.

### P2
7. If ahead, benchmark exact-search vs `vector_quantize` on the demo library and record whether R7’s Recall@5 stays within a few points. Acceptance: publish no quantized-search quality claim without measured comparison; keep exact search as baseline.

## Handoffs
- Before platform integration: agree shared trait additions, permission semantics, test vectors and PR timing with Windows engineer; any trait addition lands with both OS implementations.
- By P0 integration: give frontend engineers permission states, voice list, and TTS stop/stream behaviour through the shared IPC contract.
- By 4–6 AM: provide benchmark script, raw measured results and `MODELS.md` to pitcher/designer; inform frontend of measured-latency field availability.

## Done
- [ ] AX implementation passes `platform::conformance` on macOS and reads three demo apps.
- [ ] AX physical-coordinate conversion handles display backing scale and excludes own PID.
- [ ] Permission prompts/statuses and microphone disclosure are in place.
- [ ] Whisper model is verified by checksum and bundled; T1–T4 criteria recorded.
- [ ] Shared whisper/tts implementations build and work on Windows too.
- [ ] Any screenshot Platform method shipped with Windows implementation in same PR.
- [ ] Ten-run measured benchmark and `docs/MODELS.md` are reproducible.
