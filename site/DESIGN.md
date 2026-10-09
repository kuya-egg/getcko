---
name: GetcKo
description: A private, offline desktop helper. A pixel gecko points at your screen and says "Gets mo na."
colors:
  paper: "#FFFFFF"
  canvas: "#F6F7F4"
  line: "#E6E8E3"
  line-strong: "#C9CCC4"
  ink: "#0E0F0C"
  ink-2: "#4A4D46"
  ink-3: "#6C7067"
  gecko: "#39D86F"
  gecko-deep: "#0F7A3D"
  gecko-wash: "#EAFBEF"
  sun: "#FFC83D"
  alert: "#B3321D"
  alert-wash: "#FDECEA"
  night: "#121410"
  night-1: "#191B16"
  night-2: "#21241E"
  night-line: "#2E3229"
  night-line-strong: "#474C41"
  mist: "#F1F3EC"
  mist-2: "#B8BDB0"
  mist-3: "#8D9285"
  gecko-tint: "#6FE598"
  gecko-night: "#15301E"
  alert-tint: "#FF8F78"
  alert-night: "#3A1B14"
  ink-raised: "#1E201B"
  keycap-dark: "#2A2C27"
typography:
  hero:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "84px"
    fontWeight: 800
    lineHeight: "82px"
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: "64px"
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
  title:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "26px"
  row:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  answer:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  eyebrow:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.08em"
  caption:
    fontFamily: "Geist Variable, Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  keys:
    fontFamily: "Geist Mono Variable, Geist Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "16px"
    fontFeature: "tnum"
  pixel:
    fontFamily: "Silkscreen, ui-monospace, monospace"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "24px"
rounded:
  input: "8px"
  keycap: "7px"
  window: "10px"
  button: "14px"
  bubble: "18px"
  panel: "20px"
  icon: "22px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
  target-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "48px"
  button-primary-dark:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "48px"
  button-accent-icon:
    backgroundColor: "{colors.gecko}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    size: "48px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    height: "44px"
    padding: "0 12px"
  chip-ready:
    backgroundColor: "{colors.gecko-wash}"
    textColor: "{colors.gecko-deep}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-failed:
    backgroundColor: "{colors.alert-wash}"
    textColor: "{colors.alert}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-offline:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-citation:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.gecko-deep}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  answer-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.answer}"
    rounded: "{rounded.panel}"
    padding: "20px"
    width: "380px"
  session-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "10px"
  chat-bubble-getcko:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.bubble}"
    padding: "12px 16px"
  keycap:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.keys}"
    rounded: "{rounded.keycap}"
    padding: "2px 8px"
---


> **Copied from `main` at d63f829 (brand kit v0.4) for the landing page in `site/`.** Paths under `docs/` live at the repo root; `src/brand/` and `src/components/ui/` are vendored here unchanged except where the Landing page section below says so. Update both copies together.

# Design System: GetcKo

| Summary for agents | |
|---|---|
| Source of truth | **`docs/getcko-design-system.md` (v0.4)**: contrast, motion, textures, component-first recipes, mascot, logo, voice, anti-slop |
| Code | `src/brand/` (tokens, theme, surfaces, motion, lexicon, icons, mascot), `src/components/ui/` (primitives) |
| Detail docs | `docs/brand/textures.md`, `lexicon.md`, `icons.md`, `mascot-poses.md`, `video.md`, `image-prompts.md` |
| Agents | The `getcko-brand` skill handles "use brand"; snippets in its `references/recipes.md` |

## Overview

- **Creative North Star: "The helper at your elbow."**

- **What it is:** a private, offline desktop helper. Textured sections from the gecko's world, solid content cards, one small green pixel gecko, one yellow ring around the thing to click. A plain white page is slop.
- **Where personality lives:** the sprite (crisp, integer-scaled, a little cheeky) and the voice (a patient officemate, plain English or Taglish). Everything else is calm desktop UI for people new to computers.
- **Dark theme:** ink ground `#121410`, never pure black or navy; same rules.
- **Eye path:** ask → GetcKo → target → source. The gecko faces into the layout toward the next thing.
- **Show, don't tell:** headline ≤ 6 words, body ≤ 1 line; the rest becomes keyword chips, steps, a diagram or motion.

**Key Characteristics:**
- Textured sections (`<Surface>`, `docs/brand/textures.md`) with solid content cards; light theme on paper/canvas, ink-based dark theme driven by `data-theme` and the OS setting.
- One vocabulary (`T` / `say` in `src/brand/lexicon.ts`), one icon per concept (`Icon` in `src/brand/icons.ts`), one pose per moment (`MOMENT_POSE`), one component per job (`src/components/ui`).
- One green (fills) with a deep/tint partner for text; sun yellow reserved for a single target halo.
- Bricolage Grotesque display, Geist UI, Geist Mono for keys and measured numbers, Silkscreen as a pixel seasoning.
- Flat surfaces, 1px borders, two soft shadow levels. No gradients, glows, glass, purple or emoji.
- Pixel mascot scaled by integers with `image-rendering: pixelated`. It points; it never clicks.

## Colors

- Paper and ink with a single green creature and a single yellow ring.

### Primary
- **Gecko Green** (#39D86F): the mascot's body, the live dot, the mic button, accent icon-button fills. Fill only; it is 1.87:1 on paper, so it is never text on light.
- **Deep Gecko** (#0F7A3D): green text on light (links, citations, focus border). 5.42:1 on paper. Never on dark (3.42:1).
- **Gecko Tint** (#6FE598): green text on dark. 11.77:1 on night.
- **Gecko Wash / Gecko Night** (#EAFBEF / #15301E): Ready chips, tints and focus wash, light and dark.

### Secondary
- **Target Sun** (#FFC83D): the target halo, on exactly one element at a time. Never decorative, never text.

### Neutral
- **Paper** (#FFFFFF), **Canvas** (#F6F7F4): light surfaces and wells.
- **Line / Line Strong** (#E6E8E3 / #C9CCC4): dividers and input borders.
- **Ink** (#0E0F0C), **Ink 2** (#4A4D46), **Ink 3** (#6C7067): text levels. Ink also fills the primary button, GetcKo's chat bubble and the session bar.
- **Night** (#121410), **Night 1** (#191B16), **Night 2** (#21241E): dark ground, raised surface, wells.
- **Mist** (#F1F3EC), **Mist 2** (#B8BDB0), **Mist 3** (#8D9285): text levels on dark. Lowest dark pairing is Mist 3 on Night 2 at 4.93:1.
- **Alert / Alert Tint** (#B3321D / #FF8F78) on **Alert Wash / Alert Night** (#FDECEA / #3A1B14): errors only.

### Named Rules
**The One Green Rule.** Green covers at most about 3% of any screen: the mascot, one live dot, one accent button. Green text uses Deep Gecko on light, Gecko Tint on dark.

**The One Ring Rule.** Sun yellow appears on exactly one element, the target GetcKo points at, or not at all.

**The Caption Floor Rule.** Ink 3 is the lightest text allowed: 5.06:1 on Paper, 4.70:1 on Canvas. Nothing lighter carries text.

**The Dither, Not Gradient Rule.** No gradients anywhere. Where a fade is needed, use the `dither-fade` texture (`src/brand/textures.ts`, files in `public/brand/textures/`).

## Typography

- **Display:** Bricolage Grotesque (bundled, variable)
- **Body:** Geist (bundled, variable)
- **Mono / pixel:** Geist Mono for keys and measured numbers; Silkscreen for the pixel badge only
- **Character:** a warm, slightly quirky grotesque over a precise, neutral UI sans. The pixel face only beside the mascot, like a name tag.

### Hierarchy
- **Hero** (800, 84px, 82px, -0.035em): marketing hero and video title card.
- **Display** (800, 64px, 64px, -0.035em): onboarding step titles, slides. Never on app screens.
- **Headline / H1** (700, 36px, 40px, -0.02em): page titles; the biggest headline in the app.
- **H2** (700, 24px, 30px): section and empty-state titles.
- **Title** (700, 20px, 26px): card titles (agents, templates).
- **Row** (Geist 600, 15px, 20px): list-row names.
- **Body / Answer** (400, 16px, 24px / 1.55): settings text and GetcKo's answers; answers max 60–72ch.
- **Label** (500, 14px, 20px): buttons, tabs, chips.
- **Eyebrow** (600, 13px, 0.08em, uppercase): section labels in Ink 2.
- **Caption** (400, 12px, 16px): sources and timestamps.
- **Keys** (Geist Mono 500, 13px, tabular): shortcuts and real latency figures.

### Named Rules
**The Seasoning Rule.** Silkscreen appears at most once per screen, at most four words, always next to the mascot or another pixel element.

**The Sentence Case Rule.** Every heading and button is sentence case and left-aligned. Centered type only on the video title card.

## Layout

| | |
|---|---|
| Scale | 4px base: 4, 8, 12, 16, 24, 32, 48, 64 |
| Rhythm | 8–16 inside a component, 24 between components, 48 between sections; gutters 32 (app), 64 (marketing) |
| App window | Design at 1040×680, min 900×600; no `lg:`/`xl:` breakpoints; `AppShell` + `PageHeader` |
| Grids | Text column + visual column, 12 cols, 24px gaps (onboarding 5 + 7, marketing hero 7 + 5) |
| Overlay | Answer card `max-w-answer` (380), 24px from the corner, flips rather than cover the target |
| Layers | `z-base` < `z-raised` < `z-sticky` < `z-scrim` < `z-dialog` < `z-toast` < `z-overlay` |
| Targets | ≥ 44px |

Recipes: `docs/getcko-design-system.md` §9.

**The Eye Path Rule.** Every composition reads ask → GetcKo → target → source. The gecko faces into the layout toward the target or the primary action, which then wears the halo.

## Elevation & Depth

- Mostly flat: depth from 1px borders and two soft ambient shadows.
- Dark theme keeps the border on every elevated surface and uses deeper black shadows.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgba(14,15,12,.06), 0 4px 12px rgba(14,15,12,.06)`; dark `0 1px 2px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.28)`): agent cards, wells that lift.
- **Overlay** (`0 2px 4px rgba(14,15,12,.06), 0 16px 40px rgba(14,15,12,.12)`; dark `... rgba(0,0,0,.5)`): overlay panels, answer card, popovers.
- **Keycap** (`inset 0 -2px 0 #E6E8E3`): keycaps only.
- **Halo** (`0 0 0 3px #FFC83D, 0 0 0 4px #0E0F0C`; dark `0 0 0 3px #121410, 0 0 0 6px #FFC83D`; on ink chrome `0 0 0 6px #fff, 0 0 0 10px #FFC83D`): the single target.

### Named Rules
**The Two Levels Rule.** Level 1 for cards, level 2 for floating panels. Nothing higher, no glows, no blur, no glass.

## Shapes

| Shape | Radius |
|---|---|
| Input · keycap · button | 8 · 7 · 14 |
| Chat bubble | 18, 4px tail corner toward the mascot |
| Panel, card | 20 |
| Chip, `Kw` | pill |
| App icon | 22 at 96 |
| Window | OS (10 macOS, 8 Windows) |

- Nested corners shrink by the padding. No icon tiles; icons sit bare.
- The only hard edge is the pixel: sprite, pixel icons, `StepSquares`, pixel trail, dither.

## Components

### Buttons
- **Shape:** gently rounded (14px), 48px tall (52px in heroes), 20px horizontal padding, 2px border matching the fill.
- **Primary:** solid Ink with Paper text; on dark it inverts to Mist with Ink text. Can hold a keycap.
- **Secondary:** surface fill, text-colored 2px border.
- **Ghost:** underlined text, 4px offset.
- **Accent icon:** 48px Gecko Green square with an Ink icon; only for the mic or the single main action.
- **Hover / Focus:** 140ms ease-out; focus is a 2px `focus` outline with 2px offset.

### Chips
- **Status:** Processing (Canvas / Ink 2, pixel processing icon), Ready (Gecko Wash / Deep Gecko), Failed (Alert Wash / Alert, with the reason), Offline (Ink / Paper).
- **Keyword (`Kw`):** Gecko Wash / Deep Gecko pill, max 3 per block; replaces explanatory sentences.
- **Citation:** pill with a 1.5px green-text border and the pixel source icon, e.g. `Manual · p. 4`. Every grounded answer carries one.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** `surface`; wells use `surface-2`.
- **Shadow Strategy:** Card level at most; the overlay answer card uses Overlay.
- **Border:** 1px `border`, always on dark.
- **Internal Padding:** 20px.

### Inputs / Fields
- **Style:** 44px tall, 8px radius, 1.5px `border-strong`, visible label above, caption helper below.
- **Focus:** border turns `focus` plus a 3px `focus-wash` outline.
- **Error / Disabled:** Alert text below the field; disabled uses Canvas / Line / Ink 3 (dark: Night 2 / Night Line / Mist 3).

### Navigation
- `NavLink` in `AppShell`: the active item is `surface` with a `GeckoDot` after the label. No side stripe, no icon on every row. Tabs are Label weight with a 2px Ink underline when active.

### Signature: GetcKo sprite and target halo
- 22 × 27 cell pixel gecko (`src/brand/mascot/`), integer scales (2× overlay, 3× inline, 6× empty states, 8× onboarding, 12–16× hero and video).
- 31 poses, chosen by moment with `MOMENT_POSE` (failed = confused, processing = reading, idle = sleeping).
- Flies beside the target (`flyTo`, `placeBeside`) in a 520ms shallow arc with a small landing hop; the halo draws and pulses twice; the answer card rises in. Reduced motion: teleport, static halo.

### Signature: Logo
- Head mark = sprite rows 0–10 (arm stub removed); lockup = head mark + "GetcKo" in Bricolage 800. Clearspace 4 head-mark cells; head mark min 24px. Files: `public/brand/logo/`, `public/brand/favicon.svg`, `docs/brand/app-icon-1024.png`.

### Signature: Session bar
An Ink pill that stays dark in both themes: agent chip, green mic, Screen Help, stop, and the shortcut hint (`⌥ Space` / `Ctrl Space`).

## Do's and Don'ts

### Do:
- **Do** give every page section a `<Surface>` texture chosen by meaning; in light mode prefer footprints, canopy, pointer, how and footer; keep weave, skin, lamellae and dither to narrow bands or ink tone (`docs/brand/textures.md`).
- **Do** take every visible string from `T` / `say` (`src/brand/lexicon.ts`) and every icon from `Icon` (`src/brand/icons.ts`); pick mascot poses with `MOMENT_POSE`.
- **Do** use semantic tokens (`bg-surface`, `text-text-2`, `text-accent-text`) so both themes work without `dark:`.
- **Do** put the sun halo on exactly one element and have the gecko face it from 12px away.
- **Do** left-align copy and pair it with an asymmetric visual: a real screenshot, the gecko, and one halo.
- **Do** show only `MEASURED` numbers, in Geist Mono with "on this Mac"; a TBD number renders nothing.
- **Do** show, don't tell: headline ≤ 6 words, body ≤ 1 line in the app (2 in marketing); longer becomes `Kw` chips, `Steps`, a diagram or motion.
- **Do** build screens from `AppShell`, `PageHeader` and the primitives in `src/components/ui`; loading is GetcKo's thinking or processing moment, never a shimmer.
- **Do** use the pixel icons from `Icon` (24 grid, 2-unit strokes, 24 / 48px), bare and only where they add meaning; see `docs/brand/icons.md`.
- **Don't** use smooth line-icon packages, icon tiles or tinted icon circles, or an icon on every row or heading.
- **Do** use one texture per surface; working screens flat or `subtle`; never texture the overlay or behind answer text. Light hero = `footprints` + `canopy-corner`.
- **Do** write action → reason → source, in sentence case, with Taglish when the agent's language is Taglish.

### Don't:
- **Don't** ship a plain white page: untextured sections read as generic AI slop.
- **Don't** use banned synonyms (assistant, library, response, reply, citation, Retry, Send, Upload, push to talk, read aloud, TTS, hotkey, local, on-device and the rest of the list) in visible text; see `docs/brand/lexicon.md`. The privacy line is always "Nothing leaves this Mac."
- **Don't** use gradients, glows, glassmorphism, backdrop blur, purple or blue.
- **Don't** build centered gradient heroes or three-card feature grids with icons in circles.
- **Don't** use sparkles, wands, robots, brains or stars as "AI" iconography; the gecko is the only AI signifier.
- **Don't** use emoji, Title Case, "AI-powered", "magic", "supercharge" or "Oops!".
- **Don't** use Gecko Green as text or Deep Gecko on dark.
- **Don't** scale, rotate, recolor, blur or redraw the sprite; integer scales and flips only, one gecko per screen, still while the user types.
- **Don't** use arbitrary values (`text-[…]`, `rounded-[…]`, `w-[…]`, `z-[…]`) or `text-display` on app screens.
- **Don't** add CRT scanlines, glitch or VHS filters; the pixel world is clean.

## Landing page (`site/`)

Built only from the kit: `Surface`, `GetCkoHero`, `AgentCard`, `KnowledgeBaseRow`, `ImportProgress`, `SessionBar`, `ChatBubble`, `Stat`, `ProofLine`, `MockToggle`, `Kw`, `Steps`, `Wordmark`, `Dialog`; words from `T` / `say`, with PROPOSED marketing keys in `src/copy.ts`.

**Section rhythm (one texture each, loud and quiet alternate):**

| Section | Surface | GetcKo (`MOMENT_POSE` / `pointPoseFor`) | Halo |
|---|---|---|---|
| Hero | kit `GetCkoHero` (canopy-corner; light only) with an e-service form instead of the grade sheet | voxel GetcKo from the kit timeline | the form's Upload ID button |
| How it works | `pointer` subtle, paper; `how` band under the `Steps` | `screenHelp` | Student Record "Final" field |
| Knowledge bases | `footprints` subtle | `processing` while importing, then `screenHelp` | the passage behind "Manual · p. 4" |
| Taglish | `weave` subtle | `listening` held, `speakLoop` while speaking, else `pointRight` | session bar mic (dark two-ring halo) |
| Templates | `canopy`, paper | `pointDownRight` | Office Helper's Start |
| Brand keywords | `skin` subtle, paper | `walk1`/`walk2` while moving, then `pointRight` | none (the active word wears the green mark) |
| Offline | `footprints`, tone `ink` (the one dark island) | `offline` | none |
| Closing + footer | `footer` | `pointRight` | the demo poster's play button (poster = the kit `headmark` end-card plate + an ink caption bar; the whole poster is the button) |

**One GetcKo per screen.** `src/gecko/director.ts` draws the page's canvas GetcKo from `buildPose` at integer scale; sections register a slot (`GeckoSlot`), and moving between sections dissolves the sprite into its cells and re-forms it. The hero registers a vacant slot, so the canvas sprite scatters away and the kit's voxel GetcKo is the only one on screen. Halos use the kit's `haloIn` / `haloOut` (140 ms draw, two pulses, hold), with the two-ring dark variant on ink chrome.

**Intro (GSAP, once per session, `?intro` replays, skipped under reduced motion):** `<html class="intro-pending">` is set before first paint. (1) The head mark's cells (`buildHeadMark`) assemble from a scattered pixel field; (2) the ink tile pops in and "GetcKo" and the "Gets mo na." badge print; (3) the tile flies into the nav `Wordmark` tile, kept at the same 22:36 head-to-tile ratio; (4) the hero's text column rises; (5) the e-service form window springs up and de-rasters through a pixel curtain; (6) the kit hero timeline starts. Click, scroll or any key skips it.

**How it works band (GSAP ScrollTrigger):** on desktop the section pins when its bottom meets the viewport and scrubs for 140% of a screen. The `how` texture's prints walk one 640 px stop. The band's `how` texture is drawn at exactly 2× (a 352 px ruler strip, prints doubled; integer scale only) and the section above it is tightened so the beats get the room. Each beat (pixel icon in a 64 px tile, mono number, `text-h2` label, and its line from `T.board.how.steps` on a surface chip) sits in one row inside the strip with ~90 px of air, and they light up in turn: opacity 0.36 → 1, the kit's keyword mark (wash block + 4 px `gecko` foot) scales in, the icon pops with `steps(2)`, and six pixel-square connectors fill green toward the next beat. Layout tiers: one row at 1100 px and up (tighter gaps under 1280 px); below 1100 px the beats stack, unpinned, on plain ground (the strip would cut through the stack). Reduced motion shows every beat lit. The pinned section fits an 800 px screen.

**Seams (no hard section edges):** every light section uses the `paper` ground, and its texture is painted on a `::before` masked by a 4×4 Bayer dither (`public/site/seam-*.svg`, 4 px cells, 96 px ramp), so the texture dissolves pixel by pixel at its top and bottom: the brand's dither fade, never a gradient. `seam-top` / `seam-bottom` keep the canopy's top edge and the footer's bottom edge crisp. The ink island masks its whole ground, so it dithers out into the page.

**Site edits to vendored kit code:** `GetCkoHero` gains an `actions` prop (the CTA row) and `data-hero="copy" | "window"` hooks for the intro, and its grade sheet is replaced by `EServiceForm`: an LGU business permit renewal at step 2 of 4, with name and TIN filled, no valid ID, and Next disabled. The question is "Bakit hindi ko ma-click ang Next?", GetcKo points at Upload ID, and the source is "Permit guide · p. 2" (sample data in `hero/copy.ts`); `lexicon.ts` `MEASURED.firstSpokenWord` is filled from `docs/MODELS.md`.
