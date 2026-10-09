# Models and measured speed

Everything runs on the device; nothing downloads at runtime. `bun run models` fetches and checksums the files once into `src-tauri/models/`, and release builds bundle them.

| Role | File | Size | Notes |
| --- | --- | ---: | --- |
| Chat, speech-to-text, vision | `gemma-4-E2B-it-Q4_0.gguf` | 2.65 GiB | Gemma 4 E2B instruct, llama.cpp in-process (Metal on macOS, Vulkan on Windows, CPU fallback) |
| Audio and image projector | `mmproj-gemma-4-E2B-it-Q8_0.gguf` | 0.52 GiB | Loaded with the chat model through llama-cpp-2 `mtmd`; gives Gemma its audio (speech-to-text) and vision encoders |
| Embeddings | `embeddinggemma-300M-Q8_0.gguf` | 0.31 GiB | 256-d (Matryoshka), sqlite-vector exact scan |
| Text-to-speech | OS voices | — | `tts` crate (AVFoundation on macOS, WinRT on Windows) |

Why Gemma's own audio encoder instead of whisper.cpp: see [ADR 0004](../.monozukuri/decisions/0004-gemma-audio-speech-to-text.md).

## How to measure

```sh
bun run models            # once
RUNS=10 ./scripts/benchmark.sh
```

The script prints the machine, generates a 4.8 s spoken question with `say`, and runs `src-tauri/examples/benchmark.rs` in release mode. Each run transcribes the clip, retrieves from a small grading manual, asks Gemma with a fixed Numbers-like class-record screen (40 elements), times speech start, and snapshots whatever app is frontmost through the Accessibility API. One warm-up run is discarded. Paste the printed Markdown below when re-measuring.

## Latency benchmark

- Run date: 2026-10-09, branch `macos-engineer`
- Machine: Apple M4 Pro; macOS 27.0.1; 24.0 GiB RAM
- Runs: 10 after one warm-up; question clip 4.8 s

| Stage | Median (ms) | p90 (ms) | Min (ms) | Max (ms) | PRD budget |
|---|---:|---:|---:|---:|---|
| Engine load (warm cache) | 854 | — | — | — | — |
| Import grading manual | 105 | — | — | — | — |
| Speech-to-text (4.8 s clip) | 468 | 473 | 461 | 494 | T2 ≤ 1500 |
| Retrieval (embed + search) | 14 | 15 | 13 | 18 | — |
| LLM first token | 1276 | 1290 | 1267 | 1298 | ≤ 300 |
| LLM first sentence | 1664 | 1680 | 1649 | 1702 | — |
| LLM full answer | 2066 | 2077 | 2038 | 2106 | — |
| AX snapshot (live app) | 11 | 14 | 10 | 21 | ≤ 200 |
| TTS speech start | 6 | 6 | 5 | 6 | ≤ 500 |
| End-to-end (STT + retrieval + first sentence + TTS start) | 2155 | 2165 | 2142 | 2187 | about 3000 |

End-to-end is the sum of stages measured in the same run; microphone capture is not built yet, so recording time is excluded. The first launch of a new build adds about 15 s to engine load while Metal compiles its shaders.

### Accuracy on the same run

| Check | Result |
| --- | --- |
| Transcript | "Where do I put **one's** grade in the class record and how is the final grade computed?" (spoken: "Juan's") |
| Answers citing the manual | 10/10 |
| Pointer target for the demo question ("Where do I put Juan's grade … and how is the final grade computed?"), spoken | 0/10 |
| Same question typed | 0/10 (model picks a toolbar button or header) |
| Single-part question typed ("Which cell do I type Juan Dela Cruz's first quarter grade in?") | 3/3 (throwaway check) |

## Findings to act on

1. **First token is 4× over budget.** The prompt (rules, 40 screen elements, 5 passages) is prefilled from scratch on every question and the chat creates a new llama context per call. Candidates: keep one context and reuse the cached system prefix, trim screen elements by relevance before prompting, smaller passage count. Answer streaming hides part of it: the first sentence is speakable at 1.7 s.
2. **Pointer target fails on compound questions.** Gemma 4 E2B answers the "how is it computed" half and points at an unrelated element; a one-part question succeeds. Candidates: a separate short target-selection pass (question + element list only, `TARGET:` only, a few tokens), or splitting the question. This is the demo question, so it blocks the demo.
3. **Names get misheard.** "Juan's" transcribes as "one's" with an English macOS voice as the speaker. Retest with a real Filipino speaker; a language hint or the agent's knowledge-base names in the transcription prompt are options.
4. **Fixed:** the prompt's output-protocol example contained a literal `\n`, which the model copied (`TARGET: e1\nTo add…` on one line), so no target or citation parsed. Fixed in `prompt::GUARANTEES`.
5. **One `tts` instance per process on macOS.** The AVFoundation backend registers a process-wide delegate class, so a second `Tts::new` fails with "Operation failed". The engine's `OsSpeaker` owns the only one; the benchmark takes it before loading the engine.
