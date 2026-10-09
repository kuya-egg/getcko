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
  PIPE --> ENGINE[Engine: llama.cpp · Gemma 4 E2B + EmbeddingGemma; Gemma audio STT; OS TTS; microphone]
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
| ptt_start | – | null (starts mic recording; in the background also reads the screen and prefills the model's prompt with it while the user speaks) |
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
| 1 | `elements` | Snapshot has ≥ 5 labelled elements and no label shared by > 3 elements | Element list only | element ID (target pass) | exact element bounds | `normal` |
| 2 | `elementsWithImage` | Snapshot non-empty but fails the tier-1 test (unlabelled icons, look-alike cells) | Element list **plus** a screenshot with a numbered box drawn on every listed element, labelled with the same IDs | element ID (target pass) | exact element bounds | `normal` |
| 3 | `imageOnly` | Snapshot empty (canvas, images, thin Electron trees) | Screenshot only | `640,312` (image pixels; target-pass grammar allows coordinates only in this tier) | point mapped to the monitor | `bestGuess` (BR-18) |

Rules:
- Screen Recording denied or no capture available → tier 1 only; an empty snapshot gives a targetless answer ("can't read this app"), never a guess.
- Tiers 2 and 3 are chosen per question by the core (`pipeline.rs`), identically on both OSes; the UI never chooses.
- GetCko's own windows must not appear in the screenshot. The core hides the `overlay` window, captures, then shows it again (same code on both OSes; no OS-specific capture exclusion, which on Windows would also hide GetCko from screen sharing and break BR-3).
- Benchmark override: `GETCKO_SCREEN_MODE=elements|elementsWithImage|imageOnly` forces a tier for measurement only.

Contract additions (one PR containing both OS implementations, per the parity rule):

| Piece | Addition | Owner |
|---|---|---|
| `Platform` trait | `fn capture(&self) -> Result<ScreenCapture, PlatformError>`: RGBA8 pixels of the monitor containing the focused window, `width`, `height`, and that monitor's `MonitorFrame` (desktop physical px). `PermissionDenied(ScreenRecording)` when not granted. | macOS engineer (`macos.rs`, ScreenCaptureKit), Windows engineer (`windows.rs`, Windows.Graphics.Capture or DXGI duplication) |
| Engine | llama-cpp-2 `mtmd` feature; `ChatRequest.image: Option<&EncodedImage>`; load `mmproj-gemma-4-E2B-it-Q8_0.gguf` (already downloaded by `bun run models` and bundled by `tauri.models.conf.json`) | macOS engineer |
| Core | Tier choice, resize to the model's image size, numbered-box drawing (set-of-mark), coordinate mapping image px → monitor → `PointerTarget`; target-pass grammar allows `x,y` only in tier 3 | macOS engineer |
| IPC types | `PointerTarget.elementId` becomes `string \| null` (null for tier-3 points); `Answer.screenMode: ScreenMode`; `Latency.captureMs` | macOS engineer; consumed by frontend |

Measurement protocol (decides whether tier 2 is worth its cost): the PRD's 10 scripted tasks × 3 demo apps, each run in all three forced tiers, on the demo Mac and on a Windows machine. Record per tier: correct element out of 10 (target ≥ 8/10, S2), first-token and total latency (budget ≈ 3 s end to end), into `docs/MODELS.md`. Tier 2 stays enabled only if it raises accuracy on the screens that trigger it without breaking the budget; otherwise those screens fall back to tier 1.

## Cross-platform parity

macOS and Windows expose identical commands and behaviour. OS code lives only in `src-tauri/src/platform/macos.rs` and `windows.rs`, implementing the same `Platform` trait; both implementations pass `platform::conformance`. Any trait or IPC contract change updates both OS sides in the same PR. Speech-to-text uses Gemma 4 E2B's audio encoder through llama-cpp-2 `mtmd` on both systems; `tts` and `cpal` are cross-platform. llama.cpp uses Metal on macOS, Vulkan on Windows, automatic CPU fallback on both, and the same model files. No OS-only command or behaviour is permitted.

Engine components:

| Component | Implementation |
|---|---|
| `Transcriber` | `LlamaChat` (`engine/llama.rs`), using Gemma 4 E2B audio via `mtmd` |
| `Speaker` | `engine/speaker.rs` |

## Local models and runtime

| File | Approx. size | Use |
|---|---:|---|
| `gemma-4-E2B-it-Q4_0.gguf` | 2.8 GB | Chat, target selection; vision fallback when enabled; audio transcription |
| `embeddinggemma-300M-Q8_0.gguf` | 0.33 GB | Local embeddings, 256 dimensions |
| `mmproj-gemma-4-E2B-it-Q8_0.gguf` | 0.56 GB | Gemma 4 E2B vision and audio encoder/projector; screenshots (tiers 2–3) and transcription, downloaded and bundled |

Gemma 4 E2B is one multimodal model. In GGUF/llama.cpp it ships as two files loaded together: language weights (`gemma-4-E2B-it-Q4_0.gguf`) and its own vision and audio encoder + projector (`mmproj-…`). The mmproj is not a second model. EmbeddingGemma is the only separate model, because search needs a dedicated embedding model. The same Hugging Face repo also has `mtp-gemma-4-E2B-it-*.gguf` multi-token-prediction files (faster generation, unverified with llama-cpp-2); not used yet, see macOS task 6.

The transcriber is `LlamaChat`, using Gemma 4 E2B's audio encoder via `mtmd`. This reuses the bundled model rather than downloading a separate speech model. `mtmd` audio input is experimental; Filipino/Taglish accuracy with a real speaker is not yet measured. If accuracy is inadequate, evaluate whisper.cpp in a separate process or build llama.cpp as shared libraries.

`bun run models` fetches and SHA-256 verifies models using `scripts/fetch-models.sh`. Development uses `src-tauri/models/`; release bundles models via `bun run tauri:build` and `src-tauri/tauri.models.conf.json`. `GETCKO_MODELS_DIR` overrides model location. Nothing downloads at runtime; the only network use is explicit model setup.

## Setup and run

| OS | Prerequisites |
|---|---|
| macOS | Xcode Command Line Tools, Rust, bun, CMake (`brew`) |
| Windows | MSVC Build Tools, Rust, bun, CMake, Vulkan SDK for GPU builds, Git Bash for the models script |

Run: `bun install && bun run models && bun run tauri dev`.

## Privacy and licenses

All questions, screen data, documents, embeddings and answers stay on-device; GetCko remains visible in screen sharing. Disclose Gemma terms and llama.cpp MIT. sqlite-vector is Apache-2.0 (vendored binaries 1.1.2). Confirm model-specific terms for distribution and include license disclosures in release materials.
