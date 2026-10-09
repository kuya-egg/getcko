# GetcKo PRD: Local AI Desktop Copilot

Oct 9, 2026 · @Louie Miguel

## Overview

GetcKo is a private desktop copilot whose AI runs entirely on your own laptop. You ask it anything about what is on your screen or in your own documents. It answers out loud, points at where to click, and works the same with Wi-Fi off. For the AppBuildersPH 2026 "Local AI" challenge, it rebuilds the GetcKo v1 concept around four local features: **RAG** over your documents (stored with sqlite-vector), **Customizable Agents**, **Screen Help**, and **TTS**.

**What changes from GetcKo v1:**

| v1 (upstream app) | Hackathon build |
| --- | --- |
| Hidden from screen share and the app switcher; answers meeting questions covertly | **Removed.** GetcKo is a visible helper, not a stealth tool. |
| Cloud AI: OpenAI chat and embeddings, DeepSeek question detection, Soniox/AssemblyAI transcription | **All local:** on-device LLM, embeddings, speech-to-text, TTS |
| Postgres + pgvector server, Better Auth accounts, FastAPI agents service | **No server.** One local SQLite file with sqlite-vector; agents and knowledge stored on the device |
| Documents sent to OpenAI for indexing | Documents never leave the laptop |
| Windows only (Win32 calls) | macOS first (the M4 Pro is the demo machine), Windows as a stretch goal |

**Hackathon rule to respect.** GetcKo v1 was extracted on 2026-09-30, before the hackathon. The rules require the project to be substantially built during the hackathon and every piece of existing code to be disclosed, and a pre-existing project can get the result disputed. Build this as a **new repo during the hackathon**. Reuse only small pieces where it saves real time (for example the brand assets or the overlay window setup), and list each one under "Existing code and assets" in the submission.

## Problem and target users

People are being pushed onto digital tools faster than they can learn them. The help that does exist, cloud AI assistants, needs a screenshot of a screen full of private data plus a working internet connection.

**The data:**

- **Digitization is now law.** The E-Governance Act (RA 12254), signed Sept 5, 2025, requires national agencies, LGUs, state universities and GOCCs to digitize their services ([w.media](https://w.media/marcos-signs-law-in-push-for-digital-transformation/)).
- **Low digital skills.** Only about 40% of Filipinos have at least one of the six basic ICT skills, and skills are lowest among people aged 65 and over ([PIDS](https://pids.gov.ph/details/fact-friday-on-digital-literacy-skills-of-filipinos)).
- **Weak skills even among internet users.** 16.17M Filipinos aged 15–64 don't use the internet. Among those who do, only 50.4% are above basic at solving problems with digital tools ([PSA FLEMMS 2024 via Newsbytes](https://newsbytes.ph/2026/06/23/psa-internet-use-reaches-57-9-million-filipinos-in-2024/)).
- **Privacy holds people back from AI.** 81.4% of developers have security or privacy concerns about AI agents, and 28.2% say their company forbids agent tools ([Stack Overflow 2025](https://survey.stackoverflow.co/2025/ai)).

**Target users:**

| User | What they need | Why local matters |
| --- | --- | --- |
| New-to-the-software workers (LGU staff, teachers, office workers on newly digitized systems) | "Where do I click, and why?" answered on their own screen | Screens show citizen, student or client data |
| Professionals with confidential documents (lawyers, HR, consultants, agencies under NDA) | Answers from their own files and the app in front of them | Files and screens can't go to a third-party cloud |
| People with unreliable or expensive internet | Help that works offline | Nothing to upload, no API bill |

**Primary demo persona:** a teacher or LGU staffer learning a new desktop system, who asks GetcKo out loud and gets a spoken answer plus a pointer, grounded in the office's own manual.

## Goals and non-goals

The build succeeds if, with Wi-Fi off on stage, GetcKo answers a spoken question about the screen from the user's own documents. It must speak the answer and point at the right element within about 3 seconds.

**Goals:**

1. **Fully local core.** Chat, embeddings, retrieval, screen understanding, speech-to-text and TTS all run on the laptop. Nothing in the core path calls a cloud AI API.
2. **Grounded answers.** When an agent has a knowledge base, answers cite the document and section they came from.
3. **Any app, one helper.** Screen Help works across desktop apps by reading the OS accessibility tree, with a screenshot fallback.
4. **Agents as presets.** A user can create an agent (instructions + knowledge bases + voice + answer style) in under a minute, and start from templates.
5. **Honest numbers.** Every speed figure shown is measured and reproducible through a benchmark script and `MODELS.md`.

**Non-goals (this hackathon):**

- Hiding from screen share, covert meeting answers, or any stealth mode
- Accounts, sign-in, servers or sync
- Live call transcription of other people (system-audio capture)
- GetcKo clicking or typing for the user. It only points and explains; the user stays in control.
- iOS/Android apps (possible later as GetcKo Lens / SDK)
- Windows parity (stretch only, if the macOS build is done)

## Features and requirements

P0 items are the demo; P1 items make it feel like a product; P2 items happen only if the team is ahead by 3 AM.

### 1. RAG over your own documents (sqlite-vector)

Users drop files into a knowledge base. GetcKo reads them once, splits them into passages, embeds each passage on the device, and stores everything in one local SQLite file with the sqlite-vector extension. At question time it retrieves the top passages and the LLM answers with citations.

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| R1 | Import .md, .txt and .pdf (text PDFs) into a knowledge base | P0 | A 20-page PDF is Ready in under 60 s on the M4 Pro, Wi-Fi off |
| R2 | Chunk into passages of \~300–500 tokens with overlap; keep the document name and page or heading | P0 | Each stored passage has its source and location |
| R3 | Embed passages locally; store embeddings as BLOBs; search with `vector_full_scan` (exact) | P0 | Top-5 retrieval in under 100 ms for a few thousand passages |
| R4 | Answers cite the document and page or section; "I don't know" when nothing relevant is found | P0 | No answer claims a source that isn't in the retrieved passages |
| R5 | Small knowledge bases go to the model whole instead of retrieved (v1 behaviour) | P1 | Below a token threshold, all passages are included |
| R6 | .docx and .pptx import | P1 | Same as R1 |
| R7 | `vector_quantize` (INT8) for large libraries | P2 | Recall@5 within a few points of exact search on our own data |

License note: sqlite-vector is Elastic License 2.0, but it is free when used by an open-source project under an OSI license ([repo](https://github.com/sqliteai/sqlite-vector)). Publish the repo under MIT or Apache-2.0 and disclose it.

### 2. Customizable Agents

An agent is a saved preset: a name, instructions, attached knowledge bases, answer length and language, and a voice. One agent is active per session.

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| A1 | Create, edit, duplicate and delete agents, stored locally | P0 | Survives app restart, Wi-Fi off |
| A2 | Instructions field plus a toggle to include or replace GetcKo's base rules | P0 | Turning the base rules off changes the behaviour in the next answer |
| A3 | Attach up to 5 knowledge bases | P0 | Answers draw only from the attached knowledge bases |
| A4 | Templates: Office Helper (new software), Teacher (DepEd forms), Study Buddy (my notes) | P0 | One click makes an editable copy |
| A5 | Answer language: English | P1 | Answers are in English |
| A6 | Per-agent voice and speaking speed | P1 | Applied by TTS |
| A7 | "Try this agent" test chat on the agent page | P1 | Not saved |

### 3. Screen Help

The user presses a hotkey and asks, by voice or text, "Where do I...?" or "What does this mean?". GetcKo reads the current screen, answers, and moves an on-screen pointer (the gecko) to the right element. It never clicks for the user.

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| S1 | Read the focused app's accessibility tree (macOS AX API) into a compact list of elements: role, label, value, position | P0 | Works on at least 3 demo apps (e.g. Finder, a browser, Numbers or Excel) |
| S2 | LLM picks the target element by its ID from that list plus the question, and writes a 1–2 sentence explanation | P0 | Right element at least 8 of 10 times on the scripted demo tasks |
| S3 | Transparent, always-on-top, click-through overlay draws the gecko pointer at the element's position | P0 | Pointer lands on the element across monitor scaling |
| S4 | Screenshot fallback to a local vision model when the tree is empty (canvas apps, images) | P1 | Labeled as "best guess"; slower path is acceptable |
| S5 | Multi-step guidance ("next" continues the task) | P1 | Keeps the task context for up to 5 steps |
| S6 | Windows UI Automation module | P2 | Same as S1 on Windows |

macOS needs Accessibility and Screen Recording permission once, which goes in onboarding.

### 4. TTS and voice input

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| T1 | Speak every answer with on-device TTS (OS voices through the Rust `tts` crate) | P0 | Speech starts within \~0.5 s of the first sentence being ready (streamed by sentence) |
| T2 | Push-to-talk voice question with on-device speech-to-text | P0 | A 5-second question is transcribed in under 1.5 s, Wi-Fi off |
| T3 | Stop or skip speech with a hotkey | P0 | Immediate |
| T4 | English voice by agent setting | P1 | Uses an installed OS English voice |

## Architecture

&#91;embedded content: GetcKo architecture · 3 inputs, local AI core, 3 outputs\]

The question, the screen's element list and the retrieved passages all meet in one local LLM call. Its answer drives the voice, the pointer and the citations. The internet is touched once, to download the models before the event, and never during use.

## Local models and performance budget

**Locked Oct 9, 7:15 PM:** Gemma 4 E2B (thinking off) for chat, element picking and screenshots. EmbeddingGemma-300m at 256 dimensions for RAG. sqlite-vector exact search. OS voices through the Rust `tts` crate for speech. Fallbacks: Qwen3-4B, multilingual-e5-small, Kokoro-82M. Details are in `docs/MODELS.md`.

**Updated Oct 9:** Current lineup: Gemma 4 E2B Q4_0 for chat, tiers 1–2 element picking, answers and tier-2 screenshots; Qwen3-VL-2B Q4_K_M on demand for tier-3 grounding; bge-small-en-v1.5 Q8_0 for embeddings; whisper.cpp small.en in a helper process for STT; OS voices for TTS. English only.

Gemma handles chat and tiers 1–2; Qwen3-VL-2B is the on-demand tier-3 grounder.

| Job | First choice | Backup | Notes |
| --- | --- | --- | --- |
| Chat, element picking, citations | Gemma 4 E2B, 4-bit | Qwen3-4B (Apache-2.0) | Google reports \~160 tok/s and 0.1 s to first token on an M4 GPU via LiteRT-LM ([Google AI Edge](https://developers.google.com/edge/litert-lm/models/gemma-4)). Our runtime (llama.cpp or MLX) will differ, so measure it. License listed as Apache-2.0 there, but the MLX listing says Gemma license; check before disclosing. |
| Vision fallback (tier 3) | Qwen3-VL-2B-Instruct Q4_K_M + projector, on demand | Gemma 4 E2B projector remains for vision; Qwen receives the unmarked screenshot when present, otherwise OCR text |
| Embeddings | bge-small-en-v1.5 Q8_0 (MIT) | — | 384-dimensional CLS embeddings; query prefix only |
| Vector store | sqlite-vector, exact `vector_full_scan` | INT8 `vector_quantize_scan` | Project benchmark: 37.6 ms/query on 1M 768-d vectors, INT8 preloaded, Apple M5 Pro ([repo](https://github.com/sqliteai/sqlite-vector)). Our libraries are far smaller. |
| Speech-to-text | whisper.cpp small.en in helper process | — | Screen-derived initial prompt; see ADR 0005 |
| TTS | OS English voices via the Rust `tts` crate | — | Use an installed English voice |

**Latency budget per question (target about 3 s, Wi-Fi off):**

| Step | Budget |
| --- | --- |
| Speech-to-text, 5 s question | ≤ 1.5 s |
| Accessibility dump + retrieval | ≤ 0.3 s |
| LLM first token | ≤ 0.3 s |
| LLM full answer (≤ 60 tokens) | ≤ 1.0 s |
| TTS starts speaking | ≤ 0.5 s after the first sentence |

Run the model as a llama.cpp library inside the Rust core, or as a local Ollama/MLX sidecar on 127.0.0.1. Either way nothing leaves the machine. Pick whichever is faster to wire up in the first hour.

## Demo script and success metrics

The 5-minute pitch is mostly the live demo, run in airplane mode with a network monitor visible to show nothing leaving the laptop.

1. **Hook (30 s).** RA 12254 is moving every office online, and only about 40% of Filipinos have basic ICT skills. Cloud AI help means screenshotting private screens to someone else's server.
2. **Airplane mode on (10 s).** Show Wi-Fi off and the network monitor at zero.
3. **Agent (40 s).** Open the "Office Helper" template, attach a knowledge base containing a sample office manual PDF, and select an English voice.
4. **Screen Help + RAG (90 s).** In a spreadsheet or form app, press the hotkey and ask aloud: “Where do I put Juan's grade, and how is the final grade computed?” The gecko flies to the cell, the answer is spoken, and it cites "Manual p. 4".
5. **Second app (40 s).** The same question style works in a different app, showing it is a general helper.
6. **Proof (30 s).** Show measured latency and tokens per second on screen, read from `MODELS.md`.
7. **Close (30 s).** "Gets mo na." Next: GetcKo Lens for iPhone and the SDK for any app.

**Success metrics for the hackathon:**

| Metric | Target | How measured |
| --- | --- | --- |
| End-to-end response, spoken question to speech start | ≤ 3 s median | Benchmark script, 10 runs |
| Correct element pointed on scripted tasks | ≥ 8 / 10 | Scripted test across 3 apps |
| Grounded answers citing the right document | ≥ 9 / 10 | 10 questions against the demo manual |
| Works with Wi-Fi off | 100% of the core flow | Live, with network monitor |
| Demo reliability | 3 clean rehearsals in a row before 8 AM | Team dry runs |

## Build plan to the 10 AM freeze

The build runs on macOS Tauri 2 + React + Rust on the M4 Pro. P0 must be working end to end by 1 AM.

**Roles:**

| Role | Owns |
| --- | --- |
| Backend / local AI | Rust core: model runtime, embeddings, sqlite-vector store and retrieval, whisper STT, the speed-test script and `MODELS.md` |
| Frontend | Tauri + React: agents and knowledge-base screens, chat panel, overlay window, gecko pointer, hotkeys, macOS AX module |
| Design | Gecko pointer and states, overlay and agent screens, demo manual PDF, pitch visuals, 1-minute demo video |
| Pitcher | Demo script and rehearsals, "why local" answer, judge Q&A, README setup steps, disclosures, X/LinkedIn post tagging Devin/Cognition + #AppBuildersPH |

**Timeline (Oct 9–10):**

1. **6:30–7:30 PM:** speed test of the LLM, embeddings and whisper on the M4 Pro. Fresh Tauri repo scaffolded; AX dump of one app printed.
2. **7:30–11:00 PM:** RAG pipeline (import, chunk, embed, sqlite-vector, retrieve, cite). Overlay window with the gecko pointing at a hard-coded element.
3. **11:00 PM–1:00 AM:** wire it together. A voice question becomes an answer with the AX element picked, the pointer moved and the answer spoken. **P0 done.**
4. **1:00–4:00 AM:** agents CRUD and English-only templates, vision fallback (P1).
5. **4:00–6:00 AM:** polish, latency tuning, three rehearsals, measured benchmarks.
6. **6:00–8:30 AM:** demo video, README, disclosures, public repo.
7. **9:15 AM:** submit on Cerebral Valley, leaving a 45-minute buffer before the 10:00 AM freeze.

**Compliance checklist (submission):**

- [ ] New public repo created during the hackathon; MIT or Apache-2.0 license (also covers the sqlite-vector open-source exception)
- [ ] Existing code and assets disclosed (any piece taken from GetcKo v1, brand art, the `.claude/` config)
- [ ] Models, frameworks and licenses listed: the LLM, embedding model, whisper, sqlite-vector, Tauri
- [ ] What runs locally (everything in the core path) and what needs internet (only the first model download)
- [ ] AI dev tools disclosed (Claude Code, etc.)
- [ ] Answer: "Why does this product benefit from running AI locally?"
- [ ] 1-minute demo video plus the X/LinkedIn post
- [ ] Every number shown is reproducible from the benchmark script

## Risks and open questions

The biggest risk is the judges' first question: "Isn't this just a local ChatGPT with a pointer?" The answer has to land in the demo itself: offline, your own documents, any app, nothing leaves the laptop.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Seen as a pre-existing project (GetcKo v1) | Result can be disputed | New repo, built tonight; disclose every reused piece |
| Small model picks the wrong element | Demo misfire | Pick from numbered AX elements, not coordinates; scripted demo tasks; pre-recorded backup run |
| Apps with a thin accessibility tree (Electron, canvas) | Pointer has nothing to target | Demo on apps with good AX trees; vision fallback labeled "best guess" |
| End-to-end latency over 3 s | Feels slow on stage | Stream answer and TTS by sentence; smaller whisper; warm-load models before the pitch |
| No suitable English TTS voice on macOS | Spoken answers unavailable or unclear | Check installed English voices in hour 1 |
| "Too general" pitch | Weak Problem score | Lead with one persona (a teacher or LGU staffer on a new system) and one manual |
| License surprises | Disclosure issues | Check Gemma 4, the embedding model and sqlite-vector terms; repo under OSI license |

**Open questions:**

- [ ] Which demo apps have the best AX trees on macOS? Test Numbers, Excel, Finder, Safari and Chrome in hour 1.
- [ ] Which English voice is installed or available in macOS Settings?
- [ ] llama.cpp inside Rust or an Ollama/MLX sidecar: which is faster to wire up tonight?
- [ ] Which sample manual or PDF for the demo knowledge base: an office manual, the DepEd grading guide, or the team's own?
- [ ] Keep the name GetcKo in the pitch, with the gecko pointer as the hero visual?

## Sources

- [sqlite-vector (sqliteai) on GitHub](https://github.com/sqliteai/sqlite-vector)
- [Google AI Edge: Gemma 4 on LiteRT-LM](https://developers.google.com/edge/litert-lm/models/gemma-4)
- [MLX community 4-bit Gemma 4 E2B](https://aiweekly.co/alerts/mlx-community-ships-4-bit-gemma-4-e2b-vlm-for-apple-silicon)
- [E-Governance Act signed (w.media)](https://w.media/marcos-signs-law-in-push-for-digital-transformation/)
- [PIDS: digital literacy of Filipinos](https://pids.gov.ph/details/fact-friday-on-digital-literacy-skills-of-filipinos)
- [PSA FLEMMS 2024 internet use (Newsbytes)](https://newsbytes.ph/2026/06/23/psa-internet-use-reaches-57-9-million-filipinos-in-2024/)
- [Stack Overflow Developer Survey 2025: AI](https://survey.stackoverflow.co/2025/ai)
- [farzaa/clicky on GitHub](https://github.com/farzaa/clicky)
