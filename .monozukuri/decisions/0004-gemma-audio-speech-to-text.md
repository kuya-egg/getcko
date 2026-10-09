# ADR 0004: Gemma audio speech-to-text

- Status: Superseded by 0005
- Date: 2026-10-09
- Deciders: GetCko team

## Context

The app needs offline speech-to-text within the T2 latency budget of 1.5 seconds. Gemma 4 E2B is already downloaded and bundled with its `mmproj` encoder/projector. Adding whisper-rs bundles another ggml implementation, which collides with llama.cpp's ggml at link time through duplicate `ggml_*` symbols. Speech behavior must be identical on macOS and Windows.

## Options considered
1. Gemma 4 E2B audio encoder through llama-cpp-2 `mtmd` — reuses the model and download already shipped / llama.cpp audio input is experimental and Filipino/Taglish accuracy is unmeasured.
2. whisper.cpp through whisper-rs in the same process — purpose-built speech model / bundled ggml collides with llama.cpp at link time and requires another model download.
3. whisper.cpp in a separate process, or llama.cpp built as shared libraries — avoids the link collision / adds process or build complexity and still requires a separate speech model.

## Decision
Use Gemma 4 E2B's own audio encoder through llama-cpp-2 `mtmd` for speech-to-text on both macOS and Windows. Do not add a whisper model download.

## Why this one
A 3.8-second English clip transcribed in 0.44–0.67 seconds on an M4 Pro, within the 1.5-second T2 budget. This approach reuses the already downloaded and bundled model, avoids the ggml symbol collision, and has the same implementation and model files on both operating systems.

## Tradeoffs and consequences
llama.cpp marks audio input experimental, and Filipino/Taglish accuracy has not yet been measured with a real speaker. If accuracy is inadequate, evaluate whisper.cpp in a separate process or llama.cpp built as shared libraries. No extra speech model is downloaded or bundled under this decision.
