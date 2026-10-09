# Tech stack — GetCko

## Summary

| Component | Choice | Why — over what |
| --- | --- | --- |
| Desktop/runtime | Rust 2024 (MSRV 1.88) core + Tauri 2; React 19/TypeScript 6 UI, Vite 8, Bun | Native local execution and shared desktop UI for BR-1/2/3; over a remote/web-only app that cannot provide offline/private access and screen integration. |
| IPC | Tauri commands/events, serde models, ts-rs generated bindings, typed `src/lib/getcko.ts` | One contract across UI/core and OSes (BR-10, BR-14); over separately maintained JS/Rust wire types. |
| Chat and embeddings | llama.cpp in-process via `llama-cpp-2` 0.1.159; Gemma 4 E2B Q4_0 and EmbeddingGemma 300M Q8_0, 256 dimensions | Local private inference (BR-1/6), same models on both OSes and GPU/CPU fallback; over Ollama/MLX sidecar, see ADR-0001. |
| Persistence/search | One bundled SQLite database via rusqlite 0.40, SQL schema; vendored sqlite-vector 1.1.2 exact full scan | Local relational ownership and exact retrieval (BR-2/4/5/9); over a separate vector database, see ADR-0002. |
| OS integration | Rust `Platform` trait and OS-specific implementations with conformance tests | Shared snapshot/permission semantics (BR-15/16/20); over OS-specific IPC, see ADR-0003. |
| Speech-to-text | Gemma 4 E2B audio encoder through llama-cpp-2 `mtmd` | Reuses the already-bundled multimodal model across macOS and Windows; avoids a separate speech-model download and whisper-rs/llama.cpp ggml symbol collision. Audio input is experimental; Filipino/Taglish accuracy remains unmeasured. See ADR-0004. |

## Runtime
Rust 2024, MSRV 1.88, with Tauri 2 desktop host; blocking engine/platform calls run on worker threads rather than async runtime. The React 19/TypeScript 6 frontend is bundled by Vite 8 and uses Bun scripts. Native local execution serves offline/privacy and desktop screen needs (BR-1, BR-14).

## Framework
Tauri 2 for native windows, commands and events; React 19 for UI. Chosen over a browser-only frontend because permissions, screen integration, and always-visible desktop windows are required (BR-3, BR-15). UI implementation is team-owned/future.

## Data
One local SQLite file, schema in `src-tauri/src/store/schema.sql`, rusqlite bundled SQLite, vendored sqlite-vector 1.1.2 extension for 256-dimensional embeddings and exact top-5 search. Parent/child relations and deletion preserve INV-1/2; passage-limited citations enforce BR-4/7. No remote store or runtime downloads (BR-1/2). See ADR-0002.

## Infra and deploy
Development models in `src-tauri/models/`; explicit `bun run models` invokes `scripts/fetch-models.sh` with SHA-256 verification. Release bundles model resources via `src-tauri/tauri.models.conf.json`; `GETCKO_MODELS_DIR` overrides location. Tauri packages native macOS/Windows applications. No CI/environment deployment component is claimed here; machine-local use and offline guarantee are BR-1. Build prerequisites: Xcode CLT/CMake on macOS; MSVC/CMake and Vulkan SDK for Windows GPU builds.

## Key libraries
- `llama-cpp-2` — in-process local chat/embedding inference; avoids sidecar lifecycle and network port (BR-1); ADR-0001.
- `rusqlite` + vendored sqlite-vector — relational store and exact vector search (BR-2/9); ADR-0002.
- `tauri`, `serde`, `ts-rs` — desktop IPC and generated cross-language contract (BR-14/15).
- `pdf-extract` — extract text from supported PDFs for passages (BR-9); more complex formats are future work.
- `sha2` — verify explicitly fetched model files before use (BR-1).
- `tracing` / `tracing-subscriber` — Rust runtime diagnostics; no product rule depends on telemetry.

## Rejected alternatives
- Ollama/MLX sidecar — adds a separately managed process and localhost endpoint and diverges by OS; in-process llama.cpp supports same model/runtime shape and GPU plus CPU fallback.
- Separate vector database — duplicates persistence and adds a service boundary for local exact retrieval; one SQLite file meets current scale and integrity needs.
- Separate macOS/Windows IPC — rejected for a single shared `Platform` contract and conformance requirement; see ADR-0003.

## ADRs raised
- `.monozukuri/decisions/0001-in-process-llama-cpp.md` — in-process llama.cpp over Ollama/MLX sidecar.
- `.monozukuri/decisions/0002-sqlite-vector-single-file-store.md` — one SQLite file with sqlite-vector exact full scan.
- `.monozukuri/decisions/0003-platform-trait-parity.md` — Platform trait as sole OS seam and conformance parity.
- `.monozukuri/decisions/0004-gemma-audio-speech-to-text.md` — Gemma 4 E2B audio transcription through llama-cpp-2 `mtmd`, avoiding whisper-rs ggml symbol collisions.
