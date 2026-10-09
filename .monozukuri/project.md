# GetCko

GetCko is a local-AI desktop copilot that helps one person understand their screen and personal documents. It answers by voice or text, cites relevant local passages, and points beside an on-screen target without taking control of the user's apps. Questions, screen data, documents, embeddings and answers stay on the user's computer; runtime operation is offline.

## Actors
- User — the sole human user, working with their own apps and documents.
- Operating system — supplies screen accessibility, permissions and installed voice capabilities.
- Maintainer — prepares model files and records measured performance.

## Current phase
**Phase 1 complete — local text-question vertical slice.** The Rust/Tauri core has the typed contract, SQLite + sqlite-vector store, in-process llama.cpp chat/embedding engine, pipeline and IPC path. Text questions run end to end. Next is Phase 2: macOS accessibility platform. Overlay and main-window UI, microphone/STT/TTS, Windows platform/build and P1 product capabilities remain to be delivered as ordered in `.monozukuri/blueprint/04-phase-plan.md`.
