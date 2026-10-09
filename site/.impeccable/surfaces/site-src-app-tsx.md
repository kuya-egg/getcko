---
version: 1
slug: "site-src-app-tsx"
primary_target: "site/src/App.tsx"
related_targets: ["site/src/sections/Hero.tsx"]
---

## Scope

The GetcKo landing page in `site/` (Vite + React, brand kit v0.4 vendored from `main`). Visitor mode: Persuade. Primary action: Watch the 1-min demo. Audience: hackathon judges first, then teachers and LGU staff.

Visual authority: `site/DESIGN.md` (brand kit v0.4). The approved D3 mock (`mocks/hero-v3/D3-centered-stage.png`) lives on as the How it works visual; the intro storyboard (`mocks/intro-storyboard/storyboard.png`) beats 1–3 still drive the logo entry.

## Direction contract

THESIS: Ask out loud, GetcKo points. Every section is one worked example with one GetcKo and one ring. This refuses the AI-startup page (centered gradient hero, a feature-card grid, paragraphs).

OWN-WORLD: The brand kit. Textured sections from the gecko's world (footprints, pointer, how band, weave, canopy, skin, footer) with solid content cards. One green creature and one sun ring. Bricolage, Geist and Silkscreen. Kit components and lexicon words only.

STORY: The logo is born from pixels and walks into the nav. The hero shows the whole loop (ask, point, source, offline). Then: how it points, your documents, Taglish voice, templates, the seven brand keywords, the one dark offline island, and "Gets mo na."

FIRST VIEWPORT: The kit's GetCkoHero. On the left, "Ask out loud. GetcKo points." with the CTA, the beats, the shortcut and "Nothing leaves this Mac." On the right, an LGU e-service form (business permit renewal, step 2 of 4, Next disabled until a valid ID is added), the voxel GetcKo hopping to Upload ID, the answer card and the source.

FORM: A GSAP logo intro hands off to the kit hero timeline. A canvas GetcKo re-forms per section from MOMENT_POSE, with a halo via haloIn.

SIGNATURE: The brand keywords. GetcKo walks down the list and points at each word as it crosses the reading band.

## Unresolved

- `DEMO_VIDEO_URL` is empty.
- `REPO_PUBLIC` is false.
