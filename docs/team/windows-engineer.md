# Windows engineer

## Mission
Deliver Windows UI Automation, microphone capture and P1 office-document ingestion while maintaining identical user-facing behaviour with macOS. Follow the [parity contract](../architecture.md#cross-platform-parity).

## Owns
- `src-tauri/src/platform/windows.rs`
- Windows arm of `src-tauri/src/platform/mod.rs::current()`
- Cross-platform `Microphone` implementation using `cpal`
- `src-tauri/src/ingest.rs` DOCX/PPTX extraction
- Windows build, installer and GPU/CPU fallback acceptance evidence

## Consumes
- [Platform parity contract](../architecture.md#cross-platform-parity), [coordinates and threading](../architecture.md#coordinate-spaces-and-threading)
- [IPC contract](../architecture.md#ipc-contract), [models and setup](../architecture.md#local-models-and-runtime)
- PRD S1/S6, T2 and R6; `Platform`, `Microphone`, `DocumentKind`, `ScreenSnapshot`

## Tasks

### P0 — by 1 AM
1. Implement `Platform` in `src-tauri/src/platform/windows.rs` with Windows UI Automation (`windows` crate, `IUIAutomation`). Walk the focused window element tree, map control types to shared `ROLES`, exclude GetCko’s PID, and assign unique IDs. Use `BoundingRectangle` in physical pixels with per-monitor DPI awareness. Acceptance: at most 150 useful elements; `platform::conformance` passes on a real desktop; snapshot geometry maps through overlay `PhysicalPosition` without scaling drift (S1, S3 parity). Permission/commands: Accessibility and ScreenRecording return `NotRequired`; microphone maps to Windows privacy settings; `screen_snapshot` uses same shape.
2. Wire Windows arm of `platform::current()`. Acceptance: both OS implementations satisfy the identical `Platform` trait and permission API; no Windows-only command or answer behaviour.
Speech-to-text is shared through Gemma 4 E2B's audio encoder; there is nothing speech-specific to build for Windows. The T2 dependency in task 3 is microphone capture (`cpal`) only.
3. Implement microphone capture with `cpal`: default input device, resample to 16 kHz mono `f32` in [-1,1], `start`/`stop` per `Microphone` trait. This cross-platform code must build and work on macOS too; coordinate macOS build/API with macOS engineer. Acceptance: PTT captured 5-second input transcribes in ≤1.5 s with Wi-Fi off (T2; shared Gemma transcriber). Commands: `ptt_start`, `ask`.
   Windows build must compile `llama-cpp-2` with `mtmd` enabled; this feature is already in `Cargo.toml`.

### P1 — 1–4 AM
4. Replace Unsupported extraction arms in `src-tauri/src/ingest.rs` for DOCX and PPTX (R6). Acceptance: imports use existing queued processing and live `document` events; preserve page/section location where available; DOCX/PPTX reaches Ready with extractable text; 20-page PDF remains Ready <60 s on M4 Pro (R1 baseline). Commands/events: `doc_import`, `onDocument`.
5. Implement `Platform::capture` in `windows.rs` for screen tiers 2 and 3 ([three tiers](../architecture.md#screen-understanding-three-tiers), S4), in the same PR as the macOS engineer's core and vision work. Use Windows.Graphics.Capture (or DXGI desktop duplication) for the monitor containing the focused window; return RGBA8, `width`, `height`, `x`/`y` (desktop physical position of the top-left pixel; crop to the target window like macOS, or use the monitor origin) and that monitor's `MonitorFrame` in desktop physical pixels. The macOS reference is `capture_display` in `macos.rs`. Do **not** use `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` to hide GetCko: it also hides GetCko from screen sharing (breaks BR-3); the core hides the overlay around the capture instead. Acceptance: same `ScreenCapture` contract and permission semantics as macOS (`ScreenRecording` → `NotRequired` unless capture is blocked by policy); a tier-3 point lands correctly on 100%/150%/200% scaled monitors; then run the tier measurement protocol on a Windows machine and add the Windows rows to `docs/MODELS.md`.
6. Produce a Windows `bun run tauri:build` installer with models. Build prerequisites: MSVC Build Tools, Rust, bun, CMake, Vulkan SDK for GPU, Git Bash for `bun run models`. Verify on a Windows machine: Vulkan GPU path and CPU fallback both load the same model files; record actual logs and installer outcome.

### P2
7. If ahead, run the shared S1 acceptance scripts across three Windows demo apps for parity evidence (PRD S6 is P2). Acceptance: same normalized roles and pointer placement bar as macOS, with ≥8/10 correct scripted targets and no OS-specific IPC.

## Handoffs
- Before any shared-trait change: coordinate exact trait signature, test fixtures and same-PR macOS implementation with macOS engineer.
- By P0 integration: send overlay engineer real monitor/DPI test cases and observed coordinate conversions; send UI engineer permission semantics and microphone availability states.
- By P1: send backend/frontend engineers DOCX/PPTX extraction errors and status transitions; send team Windows GPU/CPU logs and installer evidence.

## Done
- [ ] UIA snapshot excludes own PID, maps roles, is DPI-aware and passes conformance.
- [ ] Windows permissions and screen-reading behaviour match shared API semantics.
- [ ] `cpal` microphone gives 16 kHz mono and works on both Windows and macOS; shared Gemma audio transcription meets T2.
- [ ] DOCX and PPTX extractable text imports meet R6 and document status events.
- [ ] `capture` shipped in the same PR as the macOS side; Windows tier measurements recorded.
- [ ] Windows installer bundles the same models; Vulkan and CPU fallback have recorded machine evidence.
- [ ] Same acceptance scripts and parity checklist pass on Windows as on macOS.
