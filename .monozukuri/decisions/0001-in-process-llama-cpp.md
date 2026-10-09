# ADR 0001: In-process llama.cpp inference

- Status: accepted
- Date: 2026-10-09
- Deciders: GetCko team

## Context
BR-1 requires private, offline asking with only a maintainer's explicit one-time model download. Chat, embeddings and tier-3 grounding must be available on macOS and Windows with GPU acceleration when available and CPU fallback. The core uses `llama-cpp-2` 0.1.159 with Gemma 4 E2B Q4_0 for chat, Qwen3-VL-2B Q4_K_M for tier-3 grounding, and bge-small-en-v1.5 Q8_0 for embeddings; whisper.cpp runs out of process.

## Options considered
1. In-process llama.cpp (`llama-cpp-2`) — one app process, same model/runtime on both OSes, Metal/Vulkan plus CPU fallback / native library integration and model lifecycle belong to the app.
2. Ollama sidecar — mature model service / separate installation, process lifecycle, localhost endpoint and service availability.
3. MLX sidecar — Apple-native acceleration / macOS-specific, requires another process and does not provide Windows parity.

## Decision
Run llama.cpp in-process through `llama-cpp-2`, selecting Metal on macOS, Vulkan on Windows, and CPU fallback on both.

## Why this one
It directly satisfies BR-1 while avoiding a localhost port and external service dependency. Unlike MLX, the same implementation is available on both OSes; unlike Ollama, model execution and lifecycle remain inside the app. Hardware acceleration does not remove the CPU fallback.

## Tradeoffs and consequences
The native inference library increases build and packaging complexity and model loading happens within the app process. Builds bundle explicitly fetched, checksum-verified models; no model is fetched at runtime. GPU backends and CPU fallback must be maintained and verified on their target systems.
