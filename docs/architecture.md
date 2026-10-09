# GetCko architecture

Shared implementation contract. Product requirements and design tokens remain authoritative in [PRD](getcko-prd-v1.md) and [design system](getcko-design-system.md).

## Layers

```mermaid
flowchart TB
  UI[React main window] --> IPC[Tauri IPC]
  OV[React overlay window] --> IPC
  IPC --> CORE[Rust core: commands]
  CORE --> PIPE[Ask / document pipeline]
  PIPE --> STORE[Store: SQLite + sqlite-vector]
  PIPE --> ENGINE[Engine: llama.cpp · Gemma 4 E2B + bge-small embeddings + on-demand Qwen3-VL tier-3 grounder; whisper.cpp helper; OS TTS; microphone]
  PIPE --> PLATFORM[Platform: macOS AX | Windows UIA]
```

## IPC contract

The typed client is [`src/lib/getcko.ts`](../src/lib/getcko.ts); wire types are generated, one `export type` per file, in [`src/bindings/`](../src/bindings/). Regenerate with `cd src-tauri && cargo test`. JS args use camelCase; Rust params use snake_case. Every command returns `Result<T, AppError>`.

| command | args | returns |
|---|---|---|
| setup_status | – | SetupStatus |
| permission_request | kind: PermissionKind | PermissionStatus |
| voice_list | – | Voice[] (empty when TTS unavailable) |
| kb_list | – | KnowledgeBase[] |
| kb_create | name | KnowledgeBase |
| kb_rename | id, name | KnowledgeBase |
| kb_delete | id | null |
| doc_list | knowledgeBaseId | Document[] |
| doc_import | knowledgeBaseId, path (absolute file path) | Document (queued; processing continues in background, progress via `document` events) |
| doc_delete | id | null |
| template_list | – | Template[] |
| agent_list | – | Agent[] |
| agent_get | id | Agent |
| agent_create | draft: AgentDraft | Agent |
| agent_create_from_template | templateId | Agent |
| agent_update | id, draft | Agent |
| agent_duplicate | id | Agent |
| agent_delete | id | null |
| agent_active | – | Agent \| null |
| agent_set_active | id | Agent |
| ptt_start | screenHelp? (default true) | null (starts mic recording; with screen help on, in the background also reads the screen, takes the screenshot when its tier needs one (not while the overlay has keyboard focus), and prefills the model's prompt with both while the user speaks; that press's voice turn uses them) |
| screen_prepare | – | null (the composer opened with screen help on: reads the screen and prefills the prompt while the user types; no screenshot; the typed turn reads the screen again and reuses the prefilled prompt if the screen did not change) |
| ask | request: AskRequest (optional `task`: up to 4 earlier TaskSteps of a guided task, oldest first, for S5 "next"; more is rejected as invalid) | TurnId (returns immediately; progress via `turn` events) |
| stop | – | null (cancels current turn, silences speech) |
| screen_snapshot | – | ScreenSnapshot (debug/dev aid) |

| event | payload | contract |
|---|---|---|
| `turn` | TurnEvent | Turn lifecycle: phase(thinking\|transcribing) → question → target (always exactly once, null when no pointing) → phase(answering) → sentence* → finished \| cancelled \| failed. A new `ask` cancels the running turn. |
| `document` | Document | emitted on every document status change |
| `engine` | ComponentStatus[] | emitted once when model loading finishes (M4 Pro: ~16 s on the first launch of a new build while llama.cpp compiles Metal shaders, ~0.9 s afterwards); until then `setup_status` reports every component as `loading models` |

The `overlay` and `main` are Tauri window labels. Types crossing IPC are defined in `src-tauri/src/model.rs`, serialized camelCase; do not hand-maintain bindings.

## Coordinate spaces and threading

| Data | Space / rule |
|---|---|
| `ScreenElement.bounds` | Desktop physical pixels, origin at primary display top-left; same space as Tauri `PhysicalPosition`. |
| `PointerTarget.monitor` | Monitor frame in desktop physical pixels. Set overlay position and size with `PhysicalPosition` / `PhysicalSize` so it covers that monitor. |
| `PointerTarget.rect` | CSS pixels relative to that monitor's top-left; draw the gecko beside the element, not over it. |

Engine and platform trait calls block. Run them on worker threads, never the async runtime. Keep at most one targeted element and ensure the panel does not cover it.

## Turn flow

A turn asks Gemma twice (`pipeline.rs`, `prompt.rs`). Both prompts start with the same text — system rules, screen elements, question, retrieved passages — and the chat model keeps one llama context, evaluating only the tokens after the prefix it already holds.

1. `ptt_start`: read the screen; prefill system + screen while the user speaks. A voice `ask` within 60 s uses that snapshot.
2. Transcribe (voice) → retrieve passages.
3. **Target pass**: + "name the element" task; the reply is grammar-constrained to the element IDs or `none` (`ChatRequest.choices`). The pointer moves as soon as it returns.
4. **Answer pass**: + "the pointer is showing …" + answer task; sentences stream to the panel and TTS. The answer never contains element IDs.

Measured timings per stage: [`docs/MODELS.md`](MODELS.md).

## Overlay window

Code: [`src/overlay/`](../src/overlay/) (page `overlay.html`, window label `overlay`, capability `src-tauri/capabilities/overlay.json`).

| Rule | Detail |
|---|---|
| Global shortcuts | Owned by the overlay. `⌥Space` (macOS) / `Ctrl+Space` (Windows): hold ≥ 250 ms = `ptt_start`, release = `ask` voice; tap = text composer. Global `Esc` is registered **only while the answer card is open** and calls `stop`. The main window must not register these keys. |
| Turn ownership | `turn` events go to every window. The overlay shows only turns it started (it adopts an unseen `turnId` only while its own `ask` is in flight), so main-window "Try this agent" turns never open the overlay card. |
| Placement | Covers `PointerTarget.monitor` with `PhysicalPosition`/`PhysicalSize`; panels stay inside the monitor work area (Dock, menu bar and taskbar sit above always-on-top windows) and never cover the target or the gecko. |
| Click-through | Ignores cursor events except while the cursor is over the panel (polled) or the composer is open. |
| Capture hide | Never re-shows or re-positions itself on visibility/focus changes; state survives the core's hide/show around a screenshot. |
| Guided task (S5) | "Next step" sends `AskRequest.task` (earlier steps, oldest first) with `screenHelp: true`; after step 5 the card says the task is done and stops offering next. |

## Screen understanding: three tiers

The model points by **element ID** whenever it can. A small local model picks an ID from a list reliably, but guessing pixel coordinates is error-prone. Clicky (farzaa/clicky) is screenshot-only with `[POINT:x,y]` from Claude's computer-use model; that works for a cloud frontier model, not for Gemma 4 E2B. Screenshots are therefore *context* for hard screens, and coordinates are a last resort.

| Tier | `ScreenMode` | When the core picks it | Model input | Model answers | Pointer | `Confidence` |
|---|---|---|---|---|---|---|
| 1 | `elements` | Snapshot has ≥ 5 labelled elements and no label shared by > 3 controls (static `text` elements don't count) | Element list only | element ID (target pass) | exact element bounds | `normal` |
| 2 | `elementsWithImage` | Snapshot non-empty but fails the tier-1 test (unlabelled icons, look-alike cells) | Element list **plus** a screenshot with a numbered box drawn on every listed element, labelled with the same IDs | element ID (target pass) | exact element bounds | `normal` |
| 3 | `imageOnly` | Snapshot empty (canvas, images, thin Electron trees) | Qwen3-VL-2B on demand receives an unmarked screenshot when present, skipping OCR; otherwise falls back to OCR text | `point_2d` coordinates normalized to 0–1000 | point mapped to the monitor | `bestGuess` (BR-18) |

Rules:
- Screen Recording denied or no capture available → tier 1 only; an empty snapshot gives a targetless answer ("can't read this app"), never a guess.
- Tiers 2 and 3 are chosen per question by the core (`pipeline.rs`), identically on both OSes; the UI never chooses.
- GetCko's own windows must not appear in the screenshot. The core hides the `overlay` window, captures, then shows it again (same code on both OSes; no OS-specific capture exclusion, which on Windows would also hide GetCko from screen sharing and break BR-3).
- Benchmark override: `GETCKO_SCREEN_MODE=elements|elementsWithImage|imageOnly` forces a tier for measurement only.

Contract additions (one PR containing both OS implementations, per the parity rule):

| Piece | Addition | Owner |
|---|---|---|
| `Platform` trait | `fn capture(&self) -> Result<ScreenCapture, PlatformError>`: RGBA8 pixels of the target window's area (cropping to the window is recommended: more of the model's image budget goes to the app; the whole monitor is allowed), `width`, `height`, `x`/`y` = desktop physical position of the top-left pixel, and `monitor` = the `MonitorFrame` of the display holding it (desktop physical px; the overlay covers it to draw a guess). `PermissionDenied(ScreenRecording)` when not granted. | macOS engineer (`macos.rs`, done: CoreGraphics `CGDisplay::image`, cropped to the target window), Windows engineer (`windows.rs`, Windows.Graphics.Capture or DXGI duplication) |
| `Platform` trait | `fn recognize_text(&self, capture: &ScreenCapture) -> Result<Vec<TextBox>, PlatformError>`: on-device OCR of a capture, `TextBox { text, bounds }` in desktop physical px; `Unavailable` where not built (tier 3 then falls back to a point). | macOS engineer (`macos.rs`, done: Vision `VNRecognizeTextRequest`), Windows engineer (`windows.rs`, `Windows.Media.Ocr`) |
| Engine | llama-cpp-2 `mtmd` feature; `ChatRequest.image: Option<ImagePart>` (RGB image + the text after it; the image goes after `user`, which is the screen context, so the screenshot is prefilled with it before the question is known), `ChatRequest.grammar: Option<&str>` (GBNF); an image is cached in the KV prefix like text, so the answer pass reuses it; load `mmproj-gemma-4-E2B-it-Q8_0.gguf` (already downloaded by `bun run models` and bundled by `tauri.models.conf.json`) | macOS engineer |
| Core | `pipeline.rs` tier choice, `screenshot.rs` resize (long side 1024 px), set-of-mark boxes with element IDs, `[y, x]` → image px → desktop px → `PointerTarget` (24 CSS px square); target-pass grammar allows a point only in tier 3 | macOS engineer (done) |
| IPC types | `PointerTarget.elementId` is `string \| null` (null for tier-3 points); `Answer.screenMode: ScreenMode \| null` (null when screen help is off); `Latency.captureMs` (null when no screenshot) | macOS engineer (done); consumed by frontend |

Measurement protocol (decides whether tier 2 is worth its cost): the PRD's 10 scripted tasks × 3 demo apps, each run in all three forced tiers, on the demo Mac and on a Windows machine. Record per tier: correct element out of 10 (target ≥ 8/10, S2), first-token and total latency (budget ≈ 3 s end to end), into `docs/MODELS.md`. Tier 2 stays enabled only if it raises accuracy on the screens that trigger it without breaking the budget; otherwise those screens fall back to tier 1. macOS results (`./scripts/tier-eval.sh`, Oct 9, Chrome/Finder/TextEdit): tier 1 28/30, tier 2 28/30 at 2–3× the time, tier 3 0/30; see [MODELS.md](MODELS.md#tier-measurement-protocol). Windows: not measured yet.

## Cross-platform parity

macOS and Windows expose identical commands and behaviour. OS code lives only in `src-tauri/src/platform/macos.rs` and `windows.rs`, implementing the same `Platform` trait; both implementations pass `platform::conformance`. Speech-to-text uses the `getcko-whisper` helper running whisper.cpp small.en on both systems; `tts` and `cpal` are cross-platform. llama.cpp uses Metal on macOS, Vulkan on Windows, automatic CPU fallback on both, and the same model files. No OS-only command or behaviour is permitted. User-facing language is English only.

Engine components:

| Component | Implementation |
|---|---|
| `Transcriber` | whisper.cpp small.en in `getcko-whisper` helper process |
| `Speaker` | `engine/speaker.rs` |

## Local models and runtime

| File | Approx. size | Use |
|---|---:|---|
| `gemma-4-E2B-it-Q4_0.gguf` | 2.65 GiB | Chat, element picking (tiers 1–2), answers, tier-2 screenshots |
| `mmproj-gemma-4-E2B-it-Q8_0.gguf` | 0.52 GiB | Gemma vision projector; audio encoder is fallback only if the Whisper helper/model is missing |
| `Qwen3VL-2B-Instruct-Q4_K_M.gguf` + `mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf` | 1056 + 424 MB | Apache-2.0 tier-3 grounder; loaded on demand |
| `bge-small-en-v1.5-q8_0.gguf` | 36 MB | MIT English embeddings, 384 dimensions |
| `ggml-small.en.bin` | 488 MB | Whisper small.en weights for the `getcko-whisper` helper |

Gemma 4 E2B ships as language weights and its own vision projector. The Qwen3-VL-2B grounder loads on the first tier-3 turn. Speech-to-text uses whisper.cpp small.en in the `getcko-whisper` helper process (see [ADR 0005](../.monozukuri/decisions/0005-whisper-helper-process.md)); the binary is built per target triple and bundled through `externalBin`. User-facing speech and text are English only.

`bun run models` fetches and SHA-256 verifies models using `scripts/fetch-models.sh`. Development uses `src-tauri/models/`; release bundles models via `bun run tauri:build` and `src-tauri/tauri.models.conf.json`. `GETCKO_MODELS_DIR` overrides model location. Nothing downloads at runtime; the only network use is explicit model setup.

## Setup and run

| OS | Prerequisites |
|---|---|
| macOS | Xcode Command Line Tools, Rust, bun, CMake (`brew`) |
| Windows | MSVC Build Tools, Rust, bun, CMake, Vulkan SDK for GPU builds, Git Bash for the models script |

Run: `bun install && bun run models && bun run tauri dev`.

## Privacy and licenses

All questions, screen data, documents, embeddings and answers stay on-device; GetCko remains visible in screen sharing. Disclose Gemma terms and llama.cpp MIT. sqlite-vector is Apache-2.0 (vendored binaries 1.1.2). Confirm model-specific terms for distribution and include license disclosures in release materials.
