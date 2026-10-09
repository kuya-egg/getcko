# GetCko

GetCko is a local, offline desktop helper that stays visible while you work: it answers questions over your local documents with retrieval-augmented generation (RAG), supports configurable agents, helps with what is on screen, and can speak answers aloud. Models run on-device; nothing downloads at runtime.

## Quick start

### Prerequisites

- **macOS:** Xcode Command Line Tools, Rust, [bun](https://bun.sh/), and CMake (`brew install cmake`).
- **Windows:** MSVC Build Tools, Rust, bun, CMake, Vulkan SDK, and Git Bash (used by the model-fetch script).

From the repository root:

```sh
bun install
bun run models
bun run tauri dev
```

`bun run models` downloads and SHA-256 verifies the models into `src-tauri/models/`: Gemma 4 E2B (chat), its vision projector (screenshots, screen tiers 2–3) and EmbeddingGemma (search), about 3.7 GB in total. To use models stored elsewhere, set `GETCKO_MODELS_DIR` to their directory. Nothing is fetched by the running app.

Build a release with `bun run tauri:build`; this uses the release configuration that bundles the approximately 3.7 GB of models.

## Tests

```sh
cd src-tauri
cargo test
cargo test -- --ignored
```

`cargo test` regenerates the TypeScript IPC bindings in `src/bindings/`. The ignored tests require the real models; fetch them first with `bun run models` from the repository root.

## Repository guide

| Path | Contents |
|---|---|
| `src-tauri/src/commands.rs` | Tauri IPC commands and app-facing operations |
| `src-tauri/src/engine/` | Local inference engine and model loading |
| `src-tauri/src/error.rs` | Shared application error types |
| `src-tauri/src/ingest.rs` | Document text extraction and ingestion |
| `src-tauri/src/model.rs` | Serialized domain and IPC data types |
| `src-tauri/src/paths.rs` | Application data, model, and resource paths |
| `src-tauri/src/pipeline.rs` | Ask/answer and document-processing orchestration |
| `src-tauri/src/platform/` | OS screen-accessibility platform interface and implementations |
| `src-tauri/src/pointer.rs` | Screen element pointer-target selection and geometry |
| `src-tauri/src/prompt.rs` | Prompt construction for local model tasks |
| `src-tauri/src/store/` | SQLite persistence and vector search |
| `src-tauri/src/templates.rs` | Built-in agent templates |
| `src/lib/getcko.ts` | Typed TypeScript client for Tauri commands and events |
| `src/bindings/` | Generated TypeScript types from Rust |
| `docs/architecture.md` | Architecture, IPC contract, setup, and runtime details |
| `docs/team/` | Team ownership and implementation briefs |

## Team briefs

- [Main-window frontend](docs/team/frontend-app.md)
- [Overlay frontend](docs/team/frontend-overlay.md)
- [macOS engineer](docs/team/macos-engineer.md)
- [Windows engineer](docs/team/windows-engineer.md)
- [Designer](docs/team/designer.md)

## Status

| Area | Status | Owner |
|---|---|---|
| Rust core: SQLite + sqlite-vector, local llama.cpp inference, document/RAG and agent pipeline, typed IPC | Implemented and verified | Core |
| macOS Accessibility screen capture | Not yet implemented | [macOS engineer](docs/team/macos-engineer.md) |
| Windows UI Automation screen capture | Not yet implemented | [Windows engineer](docs/team/windows-engineer.md) |
| Gemma 4 E2B audio speech-to-text, microphone capture, and text-to-speech | Speech and TTS implemented; microphone capture pending | [macOS engineer](docs/team/macos-engineer.md) (shared engine); [Windows engineer](docs/team/windows-engineer.md) (microphone) |
| DOCX/PPTX ingestion | Not yet implemented | [Windows engineer](docs/team/windows-engineer.md) |
| Main application UI | Not yet implemented | [Main-window frontend](docs/team/frontend-app.md) |
| Visible overlay UI | Not yet implemented | [Overlay frontend](docs/team/frontend-overlay.md) |

## Licenses and disclosure

- **sqlite-vector 1.1.2:** Apache-2.0; vendored binaries are in `src-tauri/vendor/sqlite-vector`.
- **Gemma 4 E2B and EmbeddingGemma 300M:** both are Gemma models; review and comply with the applicable [Gemma Terms of Use](https://ai.google.dev/gemma/terms) for each model.
- **llama.cpp:** MIT, used through `llama-cpp-2`.
- **Tauri:** Tauri 2 framework and associated crates; see [Tauri’s licensing information](https://tauri.app/).
- **AI development tools:** Claude Code was used during development.
