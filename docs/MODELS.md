# Models and measured speed

Everything runs on the device; nothing downloads at runtime. `bun run models` fetches and checksums the files once into `src-tauri/models/`, and release builds bundle them.

| Role | File | Size | Notes |
| --- | --- | ---: | --- |
| Chat, speech-to-text, vision | `gemma-4-E2B-it-Q4_0.gguf` | 2.65 GiB | Gemma 4 E2B instruct, llama.cpp in-process (Metal on macOS, Vulkan on Windows, CPU fallback) |
| Audio and image projector | `mmproj-gemma-4-E2B-it-Q8_0.gguf` | 0.52 GiB | Loaded with the chat model through llama-cpp-2 `mtmd`; gives Gemma its audio (speech-to-text) and vision encoders |
| Embeddings | `embeddinggemma-300M-Q8_0.gguf` | 0.31 GiB | 256-d (Matryoshka), sqlite-vector exact scan |
| Text-to-speech | OS voices | — | `tts` crate (AVFoundation on macOS, WinRT on Windows) |

Why Gemma's own audio encoder instead of whisper.cpp: see [ADR 0004](../.monozukuri/decisions/0004-gemma-audio-speech-to-text.md).

## How a turn runs

```mermaid
sequenceDiagram
    participant U as User
    participant P as Pipeline
    participant G as Gemma (one KV cache)
    U->>P: push-to-talk pressed (ptt_start)
    P->>P: read screen (AX)
    P->>G: prefill system + screen (while the user speaks)
    U->>P: released
    P->>G: transcribe (audio encoder, separate context)
    P->>P: retrieve 5 passages
    P->>G: target pass: + question + passages, reply limited to the element ids
    G-->>P: e24 → pointer moves
    P->>G: answer pass: same prefix + "the pointer shows …", streamed
    G-->>U: sentences spoken as they complete
```

The chat model keeps one llama context; each request only evaluates the tokens after the prefix it shares with what is already cached. The prompts are ordered so the screen (known at hotkey press) comes first and both passes share everything up to their task line.

## How to measure

```sh
bun run models            # once
RUNS=10 ./scripts/benchmark.sh
```

The script prints the machine, generates two spoken questions with `say`, and runs `src-tauri/examples/benchmark.rs` in release mode for each:

- **taglish**: the PRD demo question, "Saan ko ilalagay ang grade ni Juan, at paano kinukuwenta ang final grade?", read by the Spanish (Mexico) voice Paulina. macOS has no Filipino voice; Spanish spelling-to-sound is the closest stand-in for how a Filipino speaker says "Juan" (/hwan/).
- **en**: "Where do I put Juan's grade in the class record, and how is the final grade computed?", read by the English voice Samantha.

Each run uses a new Numbers-like class-record screen (40 elements; Juan Dela Cruz's Q1 cell is the right target), prefills it as push-to-talk would, transcribes the clip, runs both passes, times speech start, and snapshots whatever app is frontmost through the Accessibility API. A typed turn on a screen that was not prefilled runs alongside. One warm-up run is discarded. `RUST_LOG=getcko_lib=debug` adds the engine's per-request token counts.

## Latency benchmark

- Run date: 2026-10-09, branch `macos-engineer`
- Machine: Apple M4 Pro; macOS 27.0.1; 24.0 GiB RAM
- Runs: 10 after one warm-up per language

| Stage (median ms) | Taglish demo (5.1 s clip) | English (4.8 s clip) | PRD budget |
|---|---:|---:|---|
| Engine load (warm cache) | 836 | 865 | — |
| Screen prefill, while the user speaks | 576 | 566 | hidden by speech |
| Speech-to-text | 474 | 437 | T2 ≤ 1500 |
| Retrieval (embed + search) | 14 | 14 | — |
| Pointer target chosen (after STT) | 576 | 571 | — |
| Answer first token (after STT) | 646 | 641 | ≤ 300 |
| Answer first sentence (after STT) | 1011 | 975 | — |
| Answer complete (after STT) | 1548 | 1516 | — |
| TTS speech start | 6 | 6 | ≤ 500 |
| **End of speech → first spoken word** | **1494** | **1419** | about 3000 |
| AX snapshot (live app) | 24 | 11 | ≤ 200 |
| Typed, screen not prefilled: pointer target | 1143 | 1122 | — |
| Typed, screen not prefilled: first sentence | 1555 | 1439 | — |

p90 is within 25 ms of the median for every stage except the live AX snapshot (p90 22–27 ms). "After STT" stages start when transcription ends; end of speech → first spoken word = STT + first sentence + TTS start in the same run. Microphone capture is not built yet, so a WAV file stands in for it. The first launch of a new build adds about 15 s to engine load while Metal compiles its shaders.

Before this design (same machine and English clip, one pass, a new context per request, no cache reuse): end of speech → first spoken word 2155 ms; the answer's first token came 1276 ms after generation started.

### Accuracy

| Check | Taglish demo | English |
| --- | --- | --- |
| Transcript | "Sanko, ilalagayan grade ni **Juan** at paano kinukwentahan final grade." | "Where do I put **one's** grade in the class record and how is the final grade computed?" |
| Pointer on Juan's Q1 cell, spoken | 10/10 | 0/10 (Juan → "one's") |
| Pointer on Juan's Q1 cell, typed | 10/10 | 10/10 |
| Answers citing the manual | 10/10 | 10/10 |

Before this design the typed English question pointed correctly 0/10 times.

## Findings

1. **Fixed: wrong prompt format.** llama.cpp's built-in template detection does not know Gemma 4's Jinja template, so every prompt fell back to Gemma 3 tags (`<start_of_turn>`), which Gemma 4 does not treat as turns: answers ran on into fake turn markers and transcription of hinted prompts ran to the 96-token cap. Prompts now use Gemma 4's `<|turn>role … <turn|>` format (`engine::llama::gemma4_prompt`).
2. **Fixed: pointer target on compound questions.** A separate target pass, constrained by a grammar to the element ids or `none`, and grounded in the retrieved passages (the manual names the Q1 cell), replaced the `TARGET:` line in the answer. The answer pass is told which element the pointer shows.
3. **Faster: prefix reuse.** One persistent llama context; requests evaluate only the suffix after the cached prefix. The screen is prefilled during push-to-talk (`ptt_start`), and both passes share the question and passages. Prefill runs at about 900–1,000 tokens/s on this Mac, so tokens not evaluated are the main lever.
4. **Still over budget: first token (641–646 ms vs 300 ms).** Remaining work after speech ends is the question + passages (~400 tokens) and a few target tokens. Next levers: fewer or shorter passages, fewer screen elements by relevance, multi-token prediction (`mtp-gemma-4-E2B-it-Q4_0.gguf`, supported by llama-cpp-2's `MtpSpeculative`) for decode speed.
5. **Names: English pronunciation of "Juan" is heard as "one's".** With Filipino pronunciation (Taglish clip) Gemma transcribes "Juan" and points correctly 10/10. Telling the transcriber the on-screen names did not help: Gemma echoed the list into the transcript and still wrote "one's"; the Taglish/Filipino language hints did not change the English clip either. Retest with a real Filipino speaker.
6. **One `tts` instance per process on macOS.** The AVFoundation backend registers a process-wide delegate class, so a second `Tts::new` fails with "Operation failed". The engine's `OsSpeaker` owns the only one; the benchmark takes it before loading the engine.
7. **Fixed earlier:** the prompt's output-protocol example contained a literal `\n`, which the model copied, so no target or citation parsed.

## Screen tiers 2–3 (vision)

Measured Oct 9 on the M4 Pro, Metal, Gemma 4 E2B Q4_0 + `mmproj-gemma-4-E2B-it-Q8_0.gguf`. First single-run checks; the tier protocol results follow below.

| Check | Result |
|---|---|
| Synthetic 640×400 image, "where is the blue/red square?" (`cargo test --release --lib vision_points -- --ignored`) | both points inside the square (±40 px); cold turn with image 547–579 ms |
| Same image and question, different task (image cached in the KV prefix) | 82 ms vs 547 ms cold |
| Calculator, tier 2 (element list + marked screenshot): "Where is the button for seven?" / "Which button gives me the result?" | `7` / `Equals`, target pass 1.1 s |
| Calculator, tier 3 (screenshot only), full display 3600×2338 | pointed at the menu bar (wrong) |
| Calculator, tier 3, cropped to the window (460×816) | "seven": one key right of 7; "result": on Equals |
| In-app, forced tier 3 (`GETCKO_SCREEN_MODE=imageOnly`), "Which button gives me the result?" | BestGuess pointer on Equals; capture 140 ms; turn 1.57 s (answer pass reused 671 of 712 prompt slots) |

8. **Gemma points as `[y, x]` normalized to 0–1000**, not image pixels: asked for `x,y` pixels it replied `398,677` for a 640×400 image. Tier 3 asks for and parses its native format.
9. **Crop to the target window.** The image is downscaled to a 1024 px long side; a whole Retina display leaves app controls a few pixels wide. Cropping to the window fixed the menu-bar miss above.

### Tier measurement (protocol)

`./scripts/tier-eval.sh` (`src-tauri/examples/tier_eval.rs`): 10 scripted questions in each of three apps, run in every forced tier through the same `pipeline::aim` the app uses. Apps: Safari on `scripts/fixtures/class-record.html` (stands in for the spreadsheet demo; Numbers and Excel are not installed on the demo Mac), Finder on a folder of demo files, Calculator. A pointer is **correct** when it lands inside the expected element, which is taken from the app's own accessibility tree, so all tiers are scored the same way. **Touched by the guess circle**: the overlay's 36 CSS px best-guess circle reaches the element (tier 3 only; elements are exact in tiers 1–2). No knowledge base, so passages do not help. Oct 9, M4 Pro, release build, one run each.

| App | Tier | Correct | Touched by the guess circle | Target pass median | Capture + prepare |
|---|---|---|---|---|---|
| Safari | 1 `elements` | 10/10 | 10/10 | 455 ms | — |
| Safari | 2 `elementsWithImage` | 10/10 | 10/10 | 1240 ms | 79 ms |
| Safari | 3 `imageOnly` | 0/10 | 0/10 | 1080 ms | 75 ms |
| Finder | 1 `elements` | 10/10 | 10/10 | 484 ms | — |
| Finder | 2 `elementsWithImage` | 9/10 | 9/10 | 979 ms | 37 ms |
| Finder | 3 `imageOnly` | 0/10 | 0/10 | 800 ms | 36 ms |
| Calculator | 1 `elements` | 9/10 | 9/10 | 306 ms | — |
| Calculator | 2 `elementsWithImage` | 10/10 | 10/10 | 690 ms | 35 ms |
| Calculator | 3 `imageOnly` | 0/10 | 4/10 | 695 ms | 35 ms |

Totals: tier 1 29/30 (S2 target ≥ 8/10 met in every app), tier 2 29/30 at 2–3× the target-pass time, tier 3 0/30 correct and 4/30 touched. The core now picks tier 1 for all three apps.

10. **Tier 2 does not pay for itself on these apps.** Same accuracy as tier 1, 2–3× slower. It stays as the automatic choice only for screens with look-alike controls (none of the three apps after the rule fix below); those screens are unmeasured.
11. **Tier 3 is not reliable with Gemma 4 E2B.** Points cluster on a few spots (`[831, 831]`, `[850, 850]`) and miss by one control or more. It stays labelled "best guess" (BR-18); whether to show a pointer at all in tier 3 is a product decision.
12. **Tried and removed: a zoom pass.** Pointing again on a crop around the first guess (40 % of the window) dropped Calculator from 2/10 to 0/10: the model pointed at the crop's top edge.
13. **Fixed: Safari web content was invisible.** The accessibility walk preferred `AXVisibleChildren`, which on Safari's tab group lists only the tabs; the page (inputs, buttons) never appeared. It now walks `AXChildren` first (Safari: 24 → 96 elements).
14. **Fixed: tables listed every cell two or three times** (under rows, columns and the table), pushing rows past the 150-element cap. Exact duplicates are dropped.
15. **Fixed: screenshot and element list could describe different windows.** The capture cropped to the topmost CoreGraphics window, the snapshot read the accessibility focused window; the capture now crops to the same accessibility window.
16. **Fixed: repeated static text forced tier 2.** "—" down a table column or "Zero bytes" in a file list counted as look-alike controls; the rule now counts only non-text elements.

17. **Fixed: answers without a knowledge base leaked markers.** With no passages the prompt said `(no documents)` and still asked for `[n]` citations, so answers ended in "[no documents]", "[e15]", "(e15)" or "(Screen: Calculator)". The prompt now omits the passages block when empty and asks for no source; the answer parser drops element ids in `[]` or `()` as a backstop. Checked on Calculator: four answers, none with a marker.
