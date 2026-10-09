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
  PIPE --> ENGINE[Engine: llama.cpp · Gemma 4 E2B + EmbeddingGemma; whisper STT; OS TTS; microphone]
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
| ptt_start | – | null (starts mic recording) |
| ask | request: AskRequest | TurnId (returns immediately; progress via `turn` events) |
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

## Cross-platform parity

macOS and Windows expose identical commands and behaviour. OS code lives only in `src-tauri/src/platform/macos.rs` and `windows.rs`, implementing the same `Platform` trait; both implementations pass `platform::conformance`. Any trait or IPC contract change updates both OS sides in the same PR. `whisper-rs`, `tts`, and `cpal` are cross-platform and used identically on both systems. llama.cpp uses Metal on macOS, Vulkan on Windows, automatic CPU fallback on both, and the same model files. No OS-only command or behaviour is permitted.

## Local models and runtime

| File | Approx. size | Use |
|---|---:|---|
| `gemma-4-E2B-it-Q4_0.gguf` | 2.8 GB | Chat, target selection; vision fallback when enabled |
| `embeddinggemma-300M-Q8_0.gguf` | 0.33 GB | Local embeddings, 256 dimensions |

`bun run models` fetches and SHA-256 verifies models using `scripts/fetch-models.sh`. Development uses `src-tauri/models/`; release bundles models via `bun run tauri:build` and `src-tauri/tauri.models.conf.json`. `GETCKO_MODELS_DIR` overrides model location. Nothing downloads at runtime; the only network use is explicit model setup.

## Setup and run

| OS | Prerequisites |
|---|---|
| macOS | Xcode Command Line Tools, Rust, bun, CMake (`brew`) |
| Windows | MSVC Build Tools, Rust, bun, CMake, Vulkan SDK for GPU builds, Git Bash for the models script |

Run: `bun install && bun run models && bun run tauri dev`.

## Privacy and licenses

All questions, screen data, documents, embeddings and answers stay on-device; GetCko remains visible in screen sharing. Disclose Gemma terms and llama.cpp MIT. sqlite-vector is Apache-2.0 (vendored binaries 1.1.2). Confirm model-specific terms for distribution and include license disclosures in release materials.
