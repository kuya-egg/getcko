# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Landing page: new `site/` folder, Vite + React, separate from the Tauri desktop app in `src/`, sharing the GetCko tokens. Desktop app: Tauri 2 + React + Rust (macOS first, Windows stretch).

## Users

- New-to-the-software workers (LGU staff, teachers, office workers on newly digitized systems) who need "where do I click, and why?" answered on their own screen.
- Professionals with confidential documents (lawyers, HR, consultants, agencies under NDA) whose files and screens can't go to a third-party cloud.
- People with unreliable or expensive internet who need help that works offline.
- Landing-page visitors also include AppBuildersPH 2026 "Local AI" hackathon judges.

Primary persona: a teacher or LGU staffer learning a new desktop system who asks GetCko out loud and gets a spoken answer plus a pointer, grounded in the office's own manual.

## Product Purpose

GetCko is a private desktop copilot whose AI runs entirely on the user's laptop. Ask about what's on screen or in your own documents; it answers out loud, points at where to click, and works with Wi-Fi off. Success: with Wi-Fi off, a spoken question about the screen is answered from the user's own documents, spoken aloud, with the pointer on the right element in about 3 seconds.

## Positioning

A visible helper that points (never clicks) at the exact element on any app, grounded in your own documents, with every model running on the device. Nothing leaves the laptop; the internet is only used once to download models.

## Operating Context

Hotkey (`⌥ Space` on macOS, `Ctrl Space` on Windows) → ask by voice or text → GetCko reads the focused app's accessibility tree (screenshot fallback), retrieves passages from attached knowledge bases, answers with citations, speaks via OS TTS, and moves the pixel gecko pointer beside the target element. Agents are presets (instructions, knowledge bases, language, voice). Templates: Office Helper, Teacher (DepEd forms), Study Buddy, Taglish Explainer.

## Capabilities and Constraints

- Four local features: RAG over your documents (sqlite-vector), Customizable Agents, Screen Help, TTS + voice input.
- Imports .md, .txt, text PDFs (P0); .docx/.pptx (P1).
- Models (locked Oct 9): Gemma 4 E2B for chat/element picking/vision fallback; EmbeddingGemma-300m at 256-d; sqlite-vector exact search; whisper.cpp STT; OS voices via Rust `tts` crate.
- Never clicks or types for the user. No stealth mode; visible in screen share. No accounts, servers, or sync.
- Landing page primary action: watch the 1-minute demo video (video asset not yet produced; placeholder until it exists).

## Brand Commitments

- Name: GetCko ("gecko" + Filipino slang "gets ko", "I get it"). Mascot also named GetCko: a 22×27 pixel sprite (see `../docs/getcko-design-system.md` §6).
- Tagline: "Gets mo na." Product line: "Help that sits right next to your cursor."
- Voice: friendly, short, specific. Copy is English with Taglish accents. Sentence case. No emoji in UI.
- Visual authority: `../docs/getcko-design-system.md` (binding). Reference for energy and playfulness: notbor.ing.

## Evidence on Hand

- PRD: `../docs/getcko-prd-v1.md`. Design system: `../docs/getcko-design-system.md`, `../docs/getcko-design-system.html`.
- Cited public data: RA 12254 E-Governance Act (Sept 5, 2025); ~40% of Filipinos have at least one of six basic ICT skills (PIDS); 81.4% of developers have privacy concerns about AI agents (Stack Overflow 2025).
- No measured latency numbers yet (targets only: ≤3 s end to end). No testimonials, customers, press, pricing, or download build. Do not fabricate any of these; targets must be labeled as targets.

## Product Principles

1. It points, never clicks: the user stays in control.
2. Local and honest: show "Offline" and real measured numbers; never fake.
3. The user's own screen is the hero; GetCko never competes with it.
4. Grounded or silent: cite the source or say "I don't know."

## Accessibility & Inclusion

Users include people with low digital skills and adults 65+. Text contrast ≥ 4.5:1; `gecko` green never as text on white; visible focus on every control; speech always stoppable with Esc; respect reduced motion.
