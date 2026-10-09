---
version: 1
slug: "site-src-app-tsx"
primary_target: "site/src/App.tsx"
related_targets: ["site/src/sections/Hero.tsx"]
---

## Scope

The GetCko landing page in `site/` (Vite + React). Visitor mode: Persuade. Primary action: Watch the 1-min demo. Audience: people learning newly digitized desktop systems (teachers, LGU staff), privacy-bound professionals, and hackathon judges.

Approved hero comp: `.impeccable/mocks/hero-v3/D3-centered-stage.png`. Approved intro storyboard: `.impeccable/mocks/intro-storyboard/storyboard.png` (F1–F3; F4 replaced by D3). The earlier B2 comp is superseded.

## Direction contract

THESIS: A manual passage becomes a pixel gecko that points at the one field on your screen. This refuses the cluttered hero that shows every feature at once.

OWN-WORLD: The GetCko design system, unchanged. White paper, ink type, one gecko green for the helper only, and sun yellow only as the single target halo. Bricolage Grotesque 800 for display, Geist for UI, Geist Mono for values, and Silkscreen for the badge. The 22×27 sprite is drawn at an integer scale. No gradients or glows.

STORY: A logo entry (as on movara.world) hands off into the hero. The visitor sees the helper born from their own manual and pointing at their own screen, then learns Screen Help, documents, agents, voice and offline.

FIRST VIEWPORT: A one-line centered headline "Your manual. Your screen.", the subline, and a centered ink CTA. Below them, a pair sized from one integer cell `--hc`: the 16× gecko, and to its right a two-row "Student Record" window (Cruz, Juan; Final grade empty) with the halo on Final grade.

FORM: A GSAP intro. Head pixels assemble, the ink tile grows, and the tile flies into the nav logo. The headline words rise. The manual and window build in through pixel curtains. The passage pours into the gecko and the manual fades. The answer card moves to the next section.

SIGNATURE: One persistent canvas gecko re-forms at each section's slot and halo target.

## Stated deviations

- The manual card exists only in the intro.
- "target ≤ 3 s" is labeled as a target; nothing is measured yet.

## Unresolved

- `DEMO_VIDEO_URL` is empty.
- `REPO_PUBLIC` is false.
