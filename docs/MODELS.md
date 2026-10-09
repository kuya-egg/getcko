# Models and measured speed

Everything runs on-device; model downloads happen once, with consent during onboarding, and never during use. `bun run models` fetches and checksums the manifest-listed files for development and release bundles.

| Role | File | Size | Notes |
| --- | --- | ---: | --- |
| Chat, element picking (tiers 1–2), answers, tier-2 screenshots | `gemma-4-E2B-it-Q4_0.gguf` | 2.65 GiB | Unchanged |
| Gemma projector | `mmproj-gemma-4-E2B-it-Q8_0.gguf` | 0.52 GiB | Vision; audio encoder is only a fallback when the Whisper helper/model is missing |
| Tier-3 grounding | `Qwen3VL-2B-Instruct-Q4_K_M.gguf` + `mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf` | 1056 MB + 424 MB (≈1.48 GB) | Apache-2.0; `engine::llama::OnDemand`, loaded on first tier-3 turn; replies `point_2d` in 0–1000. Skips text recognition and sends the unmarked screenshot when present; otherwise falls back to OCR text. `Engine.grounder`, `GROUNDER_MODEL_FILE` / `GROUNDER_PROJECTOR_FILE` |
| Embeddings | `bge-small-en-v1.5-q8_0.gguf` | 36 MB | MIT; CLS pooling, 384 dimensions (full, no truncation); query prefix "Represent this sentence for searching relevant passages: ", no document prefix; 512-token input (longer chunks use their first 512 tokens). `OnDemand::embedder`, loaded on first search (33 ms) |
| Speech-to-text | `ggml-small.en.bin` (whisper.cpp) | 466 MiB (488 MB) | `getcko-whisper` helper process; whisper-rs 0.16, Metal on macOS |
| Text-to-speech | OS voices | — | `tts` crate (AVFoundation on macOS, WinRT on Windows) |

Whisper.cpp runs out of process because whisper-rs and llama-cpp-2 each bundle ggml (195 duplicate symbols at link time); see [ADR 0005](../.monozukuri/decisions/0005-whisper-helper-process.md).

The helper protocol starts with READY byte `0xA5`; requests contain a `u32` sample count, `f32` samples, `u32` hint length and UTF-8 hint; replies contain `u8` status, `u32` length and UTF-8 text. A dead helper is restarted once. The app supplies a screen-derived initial prompt (comma-split labels, element values, control roles first; at most 400 characters). `scripts/build-whisper.sh` builds `src-tauri/binaries/getcko-whisper-<target-triple>`, bundled through `externalBin`.


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
    P->>P: transcribe via getcko-whisper (small.en; screen-derived hint)
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

`./scripts/tier-eval.sh` (`src-tauri/examples/tier_eval.rs`): 10 scripted questions in each of three apps, run in every forced tier through the same `pipeline::aim` the app uses. It opens only these three: Google Chrome on `scripts/fixtures/class-record.html` (a web class record, standing in for the spreadsheet demo; Numbers and Excel are not installed on the demo Mac), Finder on a folder of demo files, and TextEdit on a rich-text letter. A pointer is **correct** when it lands inside the expected element, which is taken from the app's own accessibility tree, so all tiers are scored the same way. **Touched by the guess circle**: the overlay's 36 CSS px best-guess circle reaches the element (only differs from Correct in tier 3; elements are exact in tiers 1–2). No knowledge base, so passages do not help. Oct 9, M4 Pro, release build, one run each.

| App | Tier | Correct | Touched by the guess circle | Target pass median | Capture + prepare |
|---|---|---|---|---|---|
| Google Chrome | 1 `elements` | 9/10 | 9/10 | 510 ms | — |
| Google Chrome | 2 `elementsWithImage` | 9/10 | 9/10 | 1158 ms | 78 ms |
| Google Chrome | 3 `imageOnly` | 0/10 | 0/10 | 957 ms | 75 ms |
| Finder | 1 `elements` | 10/10 | 10/10 | 444 ms | — |
| Finder | 2 `elementsWithImage` | 10/10 | 10/10 | 962 ms | 39 ms |
| Finder | 3 `imageOnly` | 0/10 | 0/10 | 789 ms | 39 ms |
| TextEdit | 1 `elements` | 9/10 | 9/10 | 277 ms | — |
| TextEdit | 2 `elementsWithImage` | 9/10 | 9/10 | 991 ms | 55 ms |
| TextEdit | 3 `imageOnly` | 0/10 | 1/10 | 974 ms | 55 ms |

Totals: tier 1 28/30 (S2 target ≥ 8/10 met in every app), tier 2 28/30 at 2–3× the target-pass time, tier 3 0/30 correct and 1/30 touched. The core picks tier 1 for all three apps. Tier-1 misses: "Ana Santos's grade for the second quarter" → Q3 field; "center the title" → align right. An earlier run with Safari and Calculator in place of Chrome and TextEdit gave tier 1 29/30, tier 2 29/30, tier 3 0/30.

`./scripts/tier-eval.sh --survey` reads each app and asks six "Where is the "<label>" <role>?" questions about controls it found, in the tier the core picks; a miss there means the screen read, ids or model failed rather than a hard question:

| App | Elements | Labelled | Read | Auto tier | Named-control questions | Target pass median |
|---|---|---|---|---|---|---|
| Google Chrome | 108 | 105 | 83 ms | elements | 6/6 | 456 ms |
| Finder | 101 | 61 | 42 ms | elements | 6/6 | 432 ms |
| TextEdit | 32 | 29 | 19 ms | elements | 6/6 | 274 ms |

An earlier survey over 15 apps (Safari, Chrome, Finder, Calculator, TextEdit, System Settings, App Store, Font Book, Dictionary, Weather, Clock, Chess, Tips, Activity Monitor, Disk Utility; before the Chrome and walk fixes below) scored 63/65 on the apps it could read; the two misses picked a look-alike neighbour ("2 AM" → "3 AM", "h5" → "h4").

10. **Tier 2 does not pay for itself on these apps.** Same accuracy as tier 1, 2–3× slower. It stays as the automatic choice only for screens with look-alike controls (none of the three apps after the rule fix below); those screens are unmeasured.
11. **Tier 3 is not reliable with Gemma 4 E2B.** Points cluster on a few spots (`[831, 831]`, `[850, 850]`) and miss by one control or more. It stays labelled "best guess" (BR-18); whether to show a pointer at all in tier 3 is a product decision.
12. **Tried and removed: a zoom pass.** Pointing again on a crop around the first guess (40 % of the window) dropped Calculator from 2/10 to 0/10: the model pointed at the crop's top edge.
13. **Fixed: Safari web content was invisible.** The accessibility walk preferred `AXVisibleChildren`, which on Safari's tab group lists only the tabs; the page (inputs, buttons) never appeared. It now walks `AXChildren` first (Safari: 24 → 96 elements).
14. **Fixed: tables listed every cell two or three times** (under rows, columns and the table), pushing rows past the 150-element cap. Exact duplicates are dropped.
15. **Fixed: screenshot and element list could describe different windows.** The capture cropped to the topmost CoreGraphics window, the snapshot read the accessibility focused window; the capture now crops to the same accessibility window.
16. **Fixed: repeated static text forced tier 2.** "—" down a table column or "Zero bytes" in a file list counted as look-alike controls; the rule now counts only non-text elements.

17. **Fixed: answers without a knowledge base leaked markers.** With no passages the prompt said `(no documents)` and still asked for `[n]` citations, so answers ended in "[no documents]", "[e15]", "(e15)" or "(Screen: Calculator)". The prompt now omits the passages block when empty and asks for no source; the answer parser drops element ids in `[]` or `()` as a backstop. Checked on Calculator: four answers, none with a marker.
18. **Fixed: Chrome page content was invisible.** Chrome builds its web accessibility tree only for clients that set `AXEnhancedUserInterface` (VoiceOver does); we set only Electron's `AXManualAccessibility`. Both are set now, and the first read of an app waits 250 ms for the tree (Chrome class record: 42 → 108 elements).
19. **Fixed: long lists exhausted the walk.** Walking `AXChildren` (finding 13) also walked every off-screen row; lists, outlines, tables, browsers and grids use their visible children (Finder: 1,400 nodes and a 300 ms timeout → 144 nodes in 70 ms).
20. **Fixed: the first read of an app had almost no walk budget.** The 250 ms web-tree wait counted against the 300 ms walk budget.
21. **Leaner prompts:** unnamed elements of unknown role (ruler ticks carrying a number, layout groups) are dropped (TextEdit: 47 → 32 elements).
22. **Tier 3 reads text first: 0/30 → 15/30.** The screenshot goes through on-device text recognition (`Platform::recognize_text`; macOS Vision `VNRecognizeTextRequest`, accurate, no language correction). Each text line becomes an element `t1`, `t2`, … with its box and id drawn on the screenshot, and Gemma picks one by id as in tier 2; the `[y, x]` point is the fallback when no text fits. The pointer shows the text's exact box, still labelled best guess. Same three apps, forced tier 3:

| App | Before (point only) | Text first |
|---|---|---|
| Google Chrome | 0/10 | 5/10 |
| Finder | 0/10 | 8/10 |
| TextEdit | 0/10 | 2/10 |

   Remaining misses: empty grade fields have no text, so the model points at the column header ("Q1") instead of the cell; TextEdit's toolbar is icons (Vision reads B I U S as one "BIUS" box; alignment and list buttons have no text). Icons need a GUI grounding model (e.g. UI-TARS-2B, Apache-2.0, GGUF) — not bundled.
23. **Text recognition loads its model on first use:** 28 s for the first call in a cold system, ~110 ms after. GetCko warms it up at startup on a 64×32 blank image (`pipeline::warm_up_text_recognition`).
24. **Grounding model head-to-head (tier 3): Qwen3-VL-2B wins, not bundled.** Both run as a separate llama.cpp model (`engine::grounder::LlamaGrounder`, ChatML prompt, reply parsed as `(x, y)` on 0–1000; both models use that order, checked on a synthetic two-square image). The harness loads one with `GETCKO_GROUNDER=ui-tars|qwen3-vl`; the app does not. Same 30 questions, forced tier 3:

| Setup | Chrome | Finder | TextEdit | Total | Target pass |
|---|---|---|---|---|---|
| Text first (finding 22) | 5 | 8 | 2 | 15/30 | ~1 s |
| UI-TARS-2B-SFT Q4_K_M alone | 2 | 6 | 1 | 9/30 | ~165 ms |
| **Qwen3-VL-2B-Instruct Q4_K_M alone** | 8 | 7 | 4 | **19/30** | ~215 ms |
| Text first, then UI-TARS | 6 | 8 | 2 | 16/30 | ~1 s |
| Text first, then Qwen3-VL | 6 | 8 | 2 | 16/30 | ~1 s |

   Text first, then grounder barely helps: Gemma almost always picks some text box (often the wrong one, e.g. "BIUS"), so the grounder seldom runs. With a grounder, `pipeline::aim` therefore asks it first, on an unmarked screenshot. A rerun reproduced Qwen3-VL's Chrome 8/10 and TextEdit 4/10.

| Cost (M-series, Metal, files in page cache) | Qwen3-VL-2B | UI-TARS-2B |
|---|---|---|
| Files (model + projector) | 1,056 + 424 MB = 1.48 GB | 1,065 + 1,269 MB = 2.33 GB |
| Load | 0.4–0.8 s | 1.0–1.5 s |
| First point after load / warm point | 1.3 s / ~0.2 s | 2.5 s / ~0.2 s |
| Physical footprint added, idle / after a point | +0.9 / +1.0 GB | +1.5 / +1.6 GB |

   Gemma alone is ~0.9 GB physical footprint (RSS 3.5 GB counts mmapped weights). Dropping a grounder returns its memory. Cold-disk load is unmeasured.

   **Correction:** the ~0.2 s target passes above reuse one screenshot for all ten questions, so its image is already in the KV cache. With a new screenshot per call, as in the app, a point costs **0.9–1.4 s** with Qwen3-VL and 0.7–0.95 s with Gemma's own detection (1024 px images, Chrome/Finder/TextEdit).
25. **Qwen3-VL-2B cannot replace Gemma.** On the demo class record both pick the right field and cite both passages, but Qwen3-VL's Taglish is broken ("kung kaya magbigay ngayon ngayon … sumbaga sa na pagkakasunod") and it repeats role names ("textField"); its English is fine. It also has no audio input, so speech-to-text would still need Gemma.
26. **Held-out set: the 30 questions are now a regression check, not the quality bar.** `scripts/fixtures/heldout/` holds five pages written separately from the pipeline and never used to tune it (`./scripts/tier-eval.sh --heldout`, 50 questions, all in Chrome): a two-column DepEd enrollment form, an 8×9 grade grid with an icon toolbar, a rich-text editor with icon-only buttons, a settings page with switches and side navigation, and a dark-mode store dashboard with row action icons. Scoring reads the whole accessibility tree (up to 2,000 elements), not the 150 the model sees, so grid cells outside the prompt list still have ground truth.

| Tier | Enrollment | Grade grid | Editor | Settings | Dark dashboard | Total |
|---|---|---|---|---|---|---|
| 1 (elements) | 9 | 6 | 8 | 9 | 10 | 42/50 |
| 2 (elements + marks) | 10 | 6 | 9 | 9 | 10 | 44/50 |
| 3, text first (shipped) | 2 | 0 | 0 | 5 | 1 | 8/50 |
| 3, Qwen3-VL-2B grounder | 9 | 4 | 3 | 9 | 5 | **30/50** |

   Grade-grid tier 1 misses are cells beyond the 150-element prompt list.
27. **Gemma 4 E2B cannot ground by coordinates, in any measured form.** Gemma 4's documented detection reply (`[{"box_2d": [y1, x1, y2, x2], "label": …}]`, 0–1000; a bare "detect X" prompt gets prose in our template, so the JSON is asked for) scored 4/30 on the regression set; its `point` form 3/30. Boxes have the right size and shape but land on the wrong control (asked for "Q1", it boxed "Q4"). Larger screenshots (2048 px, up to its 1,120-token image budget) made it worse (1/30, 0/30). A 2× zoom around the first answer helped on a hand-picked crop but not overall (4/30). Qwen3-VL with the same zoom: 20/30, but 8/10 instead of 9/10 on the first held-out page and ~2–2.8 s per point; not adopted.
28. **Pixel-detected candidates did not help Gemma pick (removed).** Tried: finding empty fields and icons from edges and connected shapes (4–18 ms), naming grid cells from the header above and the row label to the left ("Q1, Juan Dela Cruz"), splitting letter rows that text recognition merges ("BIUS" → B, I, U, S; Vision's per-character boxes are the word's box in accurate mode, so the split used the glyph shapes), and drawing id tags above boxes so they do not hide icons. Regression set 15/30 (same as text only: Chrome 5→7, TextEdit 2→0); held-out 8/50 with and without them. Gemma picks numbered marks well when they have meaningful names (tiers 1–2); unnamed icons give it nothing to match. Naming icons first (a contact sheet of enlarged crops, one Gemma pass) gave shape words ("circle", "list") rather than functions and took 8 s for 23 controls. Gemma does name toolbar icons when shown the whole toolbar row enlarged (B, I, U, S, text colour, font, size right; alignment called "list"), so per-row naming remains an untested option.
29. **Taglish instruction: measured and changed.** `scripts/fixtures/taglish-questions.json` holds 20 questions (class record with manual passages, Finder, TextEdit, three with no screen or passage) asked of the Taglish Explainer; `cargo run --release --example taglish_eval` writes the answers to `$TMPDIR/taglish-<label>.jsonl`. Blind A/B judgment by an LLM judge (`anthropic/claude-sonnet-5-5`; not a native speaker; order randomized per question), new instruction against the old "use a natural mix of Filipino and English":

| Instruction | Natural Taglish (old / new / tie) | Correct and safe (old / new / tie) |
|---|---|---|
| Style guide + two example answers | 5 / 11 / 4 | 7 / 6 / 7 |
| Style guide, no examples, "never override the rules above" | 4 / 12 / 4 | 6 / 7 / 7 |
| Same, as shipped in `TurnPrompt::new` | 1 / 16 / 3 | 2 / 9 / 9 |

   The example answers made Gemma invent answers to questions with no source (2 of 3) and add steps nobody asked for; without them the "don't know" answers stay intact (3/3). Role names (popUpButton, colorWell) still leak in a few answers despite the instruction. A native-speaker review is still needed.
30. **Decision input for tier 3.** On screens with an accessibility tree, tiers 1–2 already score 42–44/50 on held-out pages without any extra model. Only screenshot-only screens (canvas apps, games, remote desktops, some Electron/Java apps) reach tier 3, where Gemma alone scores 8/50 and the on-demand Qwen3-VL-2B grounder 30/50 at +1.48 GB on disk, ~+1 GB memory while loaded, and ~1–1.4 s per point. Making Gemma itself ground would need fine-tuning (LoRA on screenshot → box data, e.g. Qwen3-VL predictions checked by hand), not prompting.
31. **Fixed: empty table cells filled the element list.** Chrome exposes each `<td>` as an unnamed `AXCell`; on the held-out grade grid 90 of the 150 listed elements were these wrappers and only 11 of the 72 grade fields made the list. Unnamed, valueless `cell` and `row` elements are now dropped like unnamed `other` ones (the field or text inside is listed itself): all 72 fields listed. Held-out tier 1 42 → **47/50** (grade grid 6 → 10), tier 2 44 → **46/50**, tier 3 unchanged (8/50). Regression set: tier 1 and 2 28 → 27/30 (Finder "Applications": Gemma picked the AirDrop icon once the ids shifted; the item is still listed), tier 3 15 → 14/30.
32. **Fixed: role names in answers.** The answer pass was told "the pointer is showing this textField", and repeated it ("sa textField na …"). It now gets the role in plain words (`prompt::plain_role`: field, drop-down, option, …). Taglish set: 0 of 20 answers name a role (before: 1–2 per run), no-source "don't know" answers still 3/3. The Taglish fixture now uses the shared `ROLES` only (it had macOS names like popUpButton).
33. **EmbeddingGemma loads on first search** (`engine::llama::LazyEmbedder`; now `OnDemand`, the generic lazy loader also used by the grounder). Sessions whose agents have no documents never load it. Measured: +62 MB physical footprint once loaded, first search 306 ms (load + embed), later searches 13 ms. Unloading after idle was tried and dropped: the footprint stayed at 163 MB after release (llama.cpp keeps the allocation) and every first search after idle would pay the 0.3 s again.
34. **First token: the 0.3 s budget is out of reach with the current prompt.** Prompt processing runs at ~1,170 tokens/s on the M4 Pro with any setting tried (flash attention default/on/off, `n_ubatch` 512/1024; 398 tokens in 335–344 ms), so the ~400-token question + passages alone take ~0.34 s. Reaching 0.3 s means fewer prompt tokens (e.g. 3 passages instead of 5, shorter chunks), which needs a retrieval/answer-quality check first. End of speech → first spoken word stays 1.4–1.5 s against the ~3 s budget.
35. **Whisper cannot run in-process.** whisper-rs and llama-cpp-2 each bundle ggml, producing 195 duplicate symbols at link time; whisper.cpp therefore runs as a helper process.
36. **Whisper small.en beats base.en for accented English.** On an accented-English clip ("hwan", macOS voice Paulina reading the demo question) with the app's screen hint, base.en transcribed "Where do we put Juan Scranton in the Clash records? And how is the final Graint computers?" while small.en returned "Where do we put Juan's grade in the class records, and how is the final grade computed?" (235 ms). small.en takes ≈160–230 ms per clip versus base.en ≈60–96 ms; Gemma's audio encoder took 440–670 ms. Chose small.en.
37. **Qwen3-VL-2B was rejected as the main answering and element-picking model.** Tier 1 regression: 15/30 vs Gemma 27/30; held-out: 26/50 vs Gemma 47/50. Tier 2 regression: 15/30; held-out: 26/50 vs Gemma 46/50. Misses included "How do I save the class record?" → Print, Finder sidebar questions → nothing, and "Ana Santos's second quarter" → Q4 cell. Though faster (benchmark, Whisper base.en, US clip, 10 runs), end of speech → first spoken word was 846 ms vs Gemma 1023 ms; answer first token 433 vs 639 ms; target pass 383 vs 568 ms. Hybrid decision: Gemma answers and picks elements; Qwen3-VL-2B grounds tier 3 only (30/50 held-out vs Gemma 8/50; finding 30).
38. **bge-small-en-v1.5 replaces EmbeddingGemma.** Retrieval over 24 questions and 18 sections from grading, enrollment and office-IT manuals:

| Model | Dim | Recall@1 | Recall@3 | MRR | ms/query | Size |
|---|---:|---:|---:|---:|---:|---:|
| EmbeddingGemma-300M (old) | 768 | 24/24 | 24/24 | 1.00 | 6.1 | 314 MB |
| Qwen3-Embedding-0.6B | 1024 | 22/24 | 24/24 | 0.96 | 15.9 | 624 MB |
| bge-small-en-v1.5 | 384 | 24/24 | 24/24 | 1.00 | 4.5 | 36 MB |

   nomic-embed-text-v1.5 crashed the harness (llama.cpp abort) and was not pursued because bge matched the best result.
39. **Existing databases are re-embedded, not discarded.** The store records `embedding_model` and `embedding_dim` in `meta`; on a model change (or a database with no recorded model, interpreted as EmbeddingGemma), documents with passages enter `processing` and leave search while their kept passage text is re-embedded in the background after engine load (`pipeline::reembed_documents`). They then become ready, or fail with "could not re-index after a model update; import the file again". A quit midway resumes next start. Smoke: an old-style 256-dimensional database with two passages re-embedded in 59 ms at app start, ended at 384 dimensions, document ready.
40. **Spoken benchmark with Whisper small.en + screen hint (Gemma answering, bge search, 10 runs).** Accented clip ("hwan", Paulina): correct target spoken **10/10** (base.en: 0/10), typed 10/10, STT 218 ms, end of speech → first spoken word 1.04 s, answer first token 628 ms; transcript "Where do we put Juan's grade in the class record, and how is the final grade computed?". US clip (Samantha): spoken 0/10, typed 10/10, 1.19 s; small.en still hears her "Juan" as "one's" even with "Juan Dela Cruz" in the hint, so the target pass picks a generic grade field. Open: names that Whisper misses (e.g. matching transcript words to on-screen names by sound).
41. **Re-run after the English-only prompt (Gemma answering, Qwen3-VL-2B grounder for tier 3).** Regression set: tier 1 27/30, tier 2 28/30, tier 3 19/30. Held-out: tier 1 46/50 (was 47), tier 2 45/50 (was 46), tier 3 29/50 (was 30). English answer set (`answer_eval`, 20 questions): no-source questions 3/3 "I don't know"; 2 of 20 answers name a raw role ("comboBox"), copied from the element list, where roles are still raw (`plain_role` only rewrites the pointer note). Open: plain role words in the element list, which changes the target-pass prompt and needs a tier re-run.
42. **Fixed: raw roles in the element list.** The element list now shows roles in plain words too (`plain_role`: field, drop-down, …), not only the pointer note. English answer set: 0 of 20 answers name a raw role (was 2), no-source "don't know" 3/3. Tiers after the change: regression tier 1 27/30, tier 2 26/30; held-out tier 1 45/50, tier 2 46/50, tier 3 29/50 (±1–2 vs finding 41). Quarter mix-ups remain one per run but move around (this run: "Juan Dela Cruz's first quarter" → Q2; "Ana Santos's second quarter" now right). Regression tier 3 Chrome fell 8/10 → 0/10 because Chrome's window now has a vertical tab strip on the left: Qwen's points land in it (x ≈ 43). The grounder never sees the element list, so this is the window layout, not the change.
43. **App-level tier 3 works end to end** (`GETCKO_SCREEN_MODE=imageOnly`, typed question over TextEdit, agent with a grading manual). The grounder loaded on demand in 1.16 s on the first tier-3 turn; "How do I make the title bold?" pointed at the document title, answered "Use the Format menu …" with a citation, "Best guess" label, 3.0 s total. "How is the final grade computed?" answered from the manual with 2 citations. Caveat: a GetCko window lying over the target app is captured with it (the overlay hides for screenshots, the main window does not); the first try pointed into GetCko's own status window.
44. **Tried and reverted: target pass picks by label instead of id.** Reply "Q1, Juan Dela Cruz (e24)" under a grammar of label + id pairs, to fix one-off quarter mix-ups. Accuracy collapsed: regression tier 1 15/30 (was 27), held-out tier 1 22/50 (was 45), tier 2 14/50; Finder and TextEdit questions went to short menu names ("Go", "Format"). Writing the name first commits Gemma to the first word before the whole choice is weighed; a bare id is chosen among all elements in one step. During this run Chrome also showed a ChatGPT-extension popup that entered the element list as a combo box.
45. **Two general tier 1–2 fixes.** (a) `platform::drop_control_captions`: static text whose words all appear in a control's label (a form caption beside its field, "Male" beside the radio "Sex, Male") leaves the list; the model had picked such captions, and each was a wasted line. (b) Look-alike tie-break (`pipeline::tie_break`, `prompt::look_alikes`): when the picked element has siblings of the same role whose multi-word label differs in exactly one word ("Q1, Juan Dela Cruz"/"Q2, …", "Align left"/"Align right"), a second pass chooses among their spelled-out labels (2–8 of them, +100–200 ms only then). Regression: tier 1 27 → **29/30**, tier 2 26 → **29/30** (Chrome grid 10/10 in both; TextEdit "center" fixed). Held-out: tier 1 45 → **47/50**, tier 2 46 → **47/50**. Remaining misses are semantic: "surname" → First name (the tie-break's one wrong call), "slant to the right" → Align right, Applications → Documents, one PT2/PT3 cell.
46. **Tried and reverted: snapping the tier-3 point to read text.** Moving Qwen's point onto the text box within the 18 px halo cost held-out tier 3 29 → 25/50 (enrollment 9 → 7, grade grid 5 → 4): a point on an empty field snapped onto its caption. Tier 3 stays as Qwen gives it: Chrome 8/10 (vertical tab strip off), Finder 8, TextEdit 4; held-out 28/50.
47. **Screenshots leave out GetCko's own windows.** `capture` now asks CoreGraphics for the target window and everything below it (`kCGWindowListOptionOnScreenBelowWindow | IncludingWindow` on the target's window number), so the main window or overlay lying over the app is never in the model's image. App smoke with the main window covering most of TextEdit, tier 3 forced: the gecko pointed at the document title (before the fix it pointed into GetCko's status window), answer with citation, 4.7 s including the one-time 1.17 s grounder load.
48. **No pointer for knowledge questions.** The demo question "How is the final grade computed?" pointed at the Apple menu: the answer lives in the document, yet the element pick took the nearest plausible item. `prompt::TARGET_TASK` now says that a question asking for an explanation, a definition or a fact gets `none` unless one on-screen element does exactly that, and that an empty field, text area or label is never picked just because it is there. `tier_eval --none-only` runs 9 such questions (3 per regression app): 4/9 → **9/9** with no pointer. Regression: tier 1 29/30, tier 2 29/30, tier 3 19/30. Held-out: tier 1 47 → **45/50**, tier 2 47 → **45/50**, tier 3 28/50. Of the two lost per tier, "Where can I manage how long my data is kept?" now gets no pointer, and "account privacy" picked a Chrome tab from an unrelated window in the capture. The rule stays because a confident wrong pointer costs more than a missing one.
49. **The target pass no longer sees the passages.** In the app the Apple-menu bug of finding 48 came back: an agent with a knowledge base puts the retrieved passages in the prompt, and the harness had never supplied any. With the passage that answers each no-target question added, `tier_eval --none-only` fell from 9/9 to **0/9** (Apple menu, Help, empty fields, the document icon): with the answer in view, the model picks an element anyway. `TurnPrompt::body` now holds only the screen, earlier task steps and the question; `TurnPrompt::answer_task` starts with the passages. The target pass is therefore exactly what every tier figure above measured (none of them had passages), and the answer prompt text is unchanged for tier 1 (with a screenshot the passages now follow the image, which the answer pass reuses). App smoke, Office Helper with a syllabus PDF over TextEdit: "How is the final grade computed?" gets no pointer and the cited answer (1.8 s); "How do I make the text italic?" still circles the I button (0.8 s). The same run showed the answer quoting "[BR-4]": requirement ids are gone from `prompt::GUARANTEES`.
50. **Guided tasks: plan in words, then point one action at a time.** "How do I multiply five times six here?" pointed at multiply first (Windows demo), and "Next step" kept pointing at done or wrong keys: the single target pass names the element that achieves the goal, not the first action. `task_eval` (synthetic tier-1 screens: three calculator sums, bold + center, a five-field sign-up form; each "next step" sent with the earlier steps on the updated screen) before: first step right **1/5**, steps **2/20**. Plan variants: the model listing element ids 10/20, listing labels 5/20 (digits and order mixed up), writing the actions in plain words ("1. Click 5") and grounding each one alone with the usual target pass 14/20, 17/20 with the wording that names each element by label and splits values typed key by key. That version cost the regression set 3 single-action questions (tier 1 29 → 28/30, tier 2 29 → 27/30: "How do I get to the Applications folder?" planned through the File menu instead of the sidebar). "Use the fewest actions" restored tier 1/2 to 29/30 but cut steps to 14/20, and in the app a sign-up form with 150 elements (mostly Chrome tabs) planned one action and pointed at a tab. The kept wording: "when one element on the screen (a link, a sidebar item, a button) does it directly, that one action is enough; otherwise list every action, including each field to fill and each box to tick": tier 1 **29/30**, tier 2 **29/30**, no-target **9/9** (tier 3 does not plan; 19–20/30 is grounder noise), steps **16/20** (form 5/5), first step **5/5**. The same app run read Chrome's vertical-tab names with their hover detail ("Create your account - Memory usage - 31.5 MB") into the answer: `platform::without_hover_details` drops it from every label. The app runs `pipeline::plan` on a new screen-help question with an element list; two or more actions start a guided task at the first (`AppState::guide`), the answer covers that action only (`prompt::step_note`), the overlay shows "Step n of total", and "Next step" (`AskRequest::next_step`) grounds the next action on the screen as it is then. In the app the question was first asked with another Chrome tab in front, so it planned one action and no plan was stored; each "Next step" then asked the model freely and it jumped to "Create account" over the empty fields. A "next step" without a stored plan now plans the task's first question again on the current screen, numbering on from the steps answered (`GuideStep`); nothing left is said as done, without a pointer. Told to "leave out actions the screen shows as done", the model copied the typed values into the plan instead (task_eval resume 0/15), so `pipeline::without_done` drops them by rule: an action whose longest named label is a text field holding a value or a ticked checkbox. task_eval now fills the fields and ticks the boxes of done steps and adds a resume check (the question planned afresh with the first k steps done): forms **3/4**, bold + center **1/1**, calculators **0/10** (a display showing "5" does not say which keys were pressed; within a task the stored plan carries them), steps **16/20**, first step **5/5**; regression unchanged (29/30, 29/30, 20/30, 9/9). The selected tab is also no longer listed (`describe`: it is already open and repeats the window title); with the sign-up page open, asking it pointed at its own tab. Remaining misses: "five times six" plans 5, 6, multiply (the model's operation order, and it drops equals). Cost: one free-text pass of up to 96 tokens per screen-help question; tier-1 target pass median 650–940 ms with it.
