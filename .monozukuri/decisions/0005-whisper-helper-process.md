# ADR 0005: Whisper helper process for speech-to-text

- Status: accepted
- Date: 2026-10-09
- Deciders: GetCko team

## Context

GetCko needs offline English speech-to-text. Gemma 4's audio encoder remains available only as a fallback when the Whisper helper or model is missing. whisper-rs 0.16 and llama-cpp-2 both bundle ggml; linking both implementations into the app produces 195 duplicate symbols. Speech behavior and model files must be shared across macOS and Windows.

## Options considered

1. Gemma 4 E2B audio encoder through llama-cpp-2 `mtmd` — reuses the bundled model and needs no additional speech weights / measured transcription took 440–670 ms per clip, slower than Whisper small.en (≈160–230 ms).
2. whisper.cpp through whisper-rs in the app process — purpose-built speech model / impossible with current dependencies because both bundle ggml, causing 195 duplicate symbols at link time.
3. whisper.cpp in a helper process — isolates ggml and keeps the existing llama.cpp app process / requires building, packaging and managing a helper binary and separate model weights.

## Decision

Run whisper.cpp small.en (`ggml-small.en.bin`) through whisper-rs 0.16 in the `getcko-whisper` helper process. Build the helper with `scripts/build-whisper.sh` as `src-tauri/binaries/getcko-whisper-<target-triple>` and bundle it with Tauri `externalBin`. Use the same helper design on both operating systems.

## Why this one

Small.en transcribed the accented-English test clip correctly in 235 ms, versus base.en's inaccurate 60–96 ms result; Gemma's audio encoder took 440–670 ms. A separate process avoids the native ggml symbol collision while delivering measured, offline speech recognition.

## Tradeoffs and consequences

The helper adds a target-specific binary to build and bundle, plus approximately 0.5 GB of Whisper small.en weights. The script must be run on each target OS for its target triple; in particular, Windows must run `scripts/build-whisper.sh` on Windows to produce `getcko-whisper-x86_64-pc-windows-msvc`. Windows still needs a GPU feature decision (Vulkan or CPU); CPU works. The app supplies a screen-derived initial prompt and restarts a dead helper once. If the helper or model is missing, the Gemma projector's audio encoder remains the fallback.
