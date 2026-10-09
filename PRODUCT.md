# Product

<!-- impeccable:product-schema 1 -->

> Facts come from `docs/getcko-prd-v1.md` (PRD, Oct 9 2026) and `docs/getcko-design-system.md` (v0.4). No interview was run; the PRD is the confirmed product record. *(open)* = undecided in the PRD.

## Platform

web

- Web UI inside a desktop shell: Tauri 2 + React 19 + TypeScript + Vite.
- macOS first (M4 Pro demo machine); Windows 11 is a stretch goal. Must feel at home on both.
- Main window designed at 1040×680 (min 900×600); a transparent overlay window for the gecko and the answer card.

## Users

| User | Need | Why on this Mac matters |
|---|---|---|
| **Primary:** people learning new software on the job (LGU staff, teachers, office workers on systems digitized under RA 12254) | "Where do I click, and why?" on their own screen | Screens show citizen, student or client data |
| Professionals with confidential documents (lawyers, HR, consultants, NDA work) | Answers from their own files and the app in front of them | Files and screens can't go to a third-party cloud |
| People with unreliable or expensive internet | Help that works offline | Nothing to upload, no API bill |

- **Demo persona:** a teacher or LGU staffer on a new desktop system, asking out loud, getting a spoken answer plus a pointer grounded in the office manual.
- **Context:** only about 40% of Filipinos have at least one basic ICT skill, lowest among people 65+ (PIDS). Many users are not confident with computers.

## Product Purpose

- **What:** GetcKo is a private, offline desktop helper. Ask by voice or text about your screen or your documents; GetcKo answers out loud, flies a pixel gecko to the right on-screen element, and cites the document and page.
- **Where it runs:** everything on this Mac. Nothing leaves this Mac.
- **Success:** with Wi-Fi off on stage, a spoken question about the screen is answered from the user's own documents, spoken, and pointed at within about 3 seconds.

## Positioning

- **Line:** help that sits right next to your cursor. Nothing leaves this Mac.
- **What a cloud tool can't truthfully claim:** offline, grounded in your own documents, works across any desktop app through the OS accessibility tree, nothing leaves the machine.
- **The judges' objection** ("isn't this just a local ChatGPT with a pointer?") must be answered by the product itself, at first glance: show, don't tell.

## Operating Context

| Surface | Behavior |
|---|---|
| Shortcut | `⌥ Space` (macOS), `Ctrl Space` (Windows), from inside any app |
| Overlay | Transparent, frameless, always-on-top, click-through; gecko beside the target, answer card bottom-right. Visible on screen share; no stealth mode |
| Main window | Agents (templates, instructions, knowledge bases, voice, answer length and language), knowledge bases (import .md/.txt/.pdf, status per document), settings, onboarding (Accessibility → Screen Recording → Microphone → Shortcut) |
| Voice | Hold to talk → speech-to-text on this Mac; answers spoken sentence by sentence; Esc stops |
| Showcase | 5-minute live pitch in airplane mode with a network monitor; 1-minute demo video |

## Capabilities and Constraints

| Capability | Detail |
|---|---|
| Knowledge bases | Passages embedded and stored in one SQLite file with sqlite-vector; answers cite document and page; "I don't know" when nothing relevant is found |
| Agents | Name, instructions, up to 5 knowledge bases, answer length and language (English, Filipino, Taglish), voice. Templates: Office Helper, Teacher, Study Buddy, Taglish Explainer. One agent per session |
| Screen Help | Reads the focused app's accessibility tree; the model picks the target; the gecko points. Screenshot fallback labeled "Best guess" |
| Speech | Answer out loud and Hold to talk, stoppable with Esc |
| Models | Gemma 4 E2B (chat, vision), EmbeddingGemma-300m (embeddings), whisper.cpp (speech-to-text), OS voices via the Rust `tts` crate. Numbers in `docs/MODELS.md` |

- **Hard constraints:** no cloud AI in the core path; no accounts, servers or sync; GetcKo never clicks or types for the user; never claims a source that is not in the retrieved passages.
- Fonts and assets are bundled so the UI works offline.
- Hackathon: AppBuildersPH 2026 "Local AI"; code freeze Oct 10, 10:00 AM; reused code and assets disclosed.
- *(open)* Which demo apps have the best AX trees; whether a Filipino voice exists on macOS; which sample manual is the demo knowledge base.

## Brand Commitments

| | |
|---|---|
| Name | GetcKo: "gecko" + Filipino slang "gets ko" ("I get it"). The mascot shares the name |
| Tagline | "Gets mo na." ("Now you get it.") Product line: "Help that sits right next to your cursor." |
| Mascot | 22 × 27 cell pixel gecko, 31 poses chosen by moment (`MOMENT_POSE`). Whole-number scales, never smoothed or recolored, one per screen, still while the user types, never covering the target |
| Logo | Head mark (sprite rows 0–10) + "GetcKo" in Bricolage 800; files in `public/brand/logo/` |
| Voice | Friendly, short, specific; action → reason → source; Taglish when the agent is Taglish; "on this Mac", "Offline"; sentence case; no emoji |
| Show, don't tell | Headline ≤ 6 words, body ≤ 1 line; the rest becomes keyword chips, steps, a diagram or motion |
| Identity | Textured sections, solid content cards, one green for the helper, sun yellow only for the target halo, ink for dark surfaces; no gradients, glows or glass |

## Evidence on Hand

- PRD `docs/getcko-prd-v1.md`; design system `docs/getcko-design-system.md`; models `docs/MODELS.md`.
- Brand captures: `docs/brand/showcase-light.png`, `docs/brand/showcase-dark.png`; app icon `docs/brand/app-icon-1024.png`.
- Public statistics cited in the PRD (PIDS, PSA FLEMMS 2024, Stack Overflow 2025, RA 12254).
- **Absent, do not fabricate:** testimonials, customer logos, measured latency or tokens/s (only from the benchmark script and `MODELS.md`; TBD shows nothing), download counts, pricing.

## Product Principles

1. **It points, never clicks.** The user stays in control.
2. **The user's screen is the hero.** GetcKo sits beside the work, never on it.
3. **Honest.** "Offline", measured numbers only, real sources or "I don't know".
4. **Visible helper, not a stealth tool.** Nothing hides from screen share.
5. **Plain help for unconfident users.** Short, spoken, shown; Filipino and Taglish are first-class.

## Accessibility & Inclusion

- Text contrast ≥ 4.5:1 (3:1 at 24px+); green text uses `gecko-deep` on light, `gecko-tint` on dark.
- Real `<button>`, `<a href>`, `<input>` + `<label>`; icon-only buttons have `aria-label`; targets ≥ 44px; visible focus.
- Keyboard: dialogs trap and return focus; the answer card never steals focus; Esc = stop speaking → close answer → close dialog.
- Speech always stoppable with Esc; no autoplay unless "Answer out loud" is on.
- Users include older adults and people with low digital skills; English, Filipino and Taglish answers.
