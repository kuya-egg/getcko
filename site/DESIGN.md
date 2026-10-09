---
name: GetCko
description: A local pixel gecko that reads your files and points at the answer.
colors:
  paper: "#FFFFFF"
  canvas: "#F6F7F4"
  line: "#E6E8E3"
  line-strong: "#C9CCC4"
  ink: "#0E0F0C"
  ink-2: "#4A4D46"
  ink-3: "#73776E"
  ink-raised: "#1E201B"
  ink-key: "#2A2C27"
  gecko: "#39D86F"
  gecko-deep: "#0F7A3D"
  gecko-wash: "#EAFBEF"
  sun: "#FFC83D"
  alert: "#B3321D"
  alert-wash: "#FDECEA"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: "64px"
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
  body:
    fontFamily: "'Geist Sans', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  lede:
    fontFamily: "'Geist Sans', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "28px"
  label:
    fontFamily: "'Geist Sans', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.08em"
  caption:
    fontFamily: "'Geist Sans', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  mono:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
  pixel:
    fontFamily: "'Silkscreen', ui-monospace, monospace"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
rounded:
  input: "8px"
  key: "7px"
  window: "10px"
  button: "14px"
  panel: "20px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-6: "24px"
  s-8: "32px"
  s-12: "48px"
  s-16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "48px"
  button-primary-hero:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.button}"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "48px"
  button-small:
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "44px"
  button-disabled:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-3}"
  keycap:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.key}"
    padding: "0 8px"
    height: "28px"
  chip-ready:
    backgroundColor: "{colors.gecko-wash}"
    textColor: "{colors.gecko-deep}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  chip-processing:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  chip-queued:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  chip-offline:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  chip-cite:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.gecko-deep}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  chip-cite-lit:
    backgroundColor: "{colors.gecko-wash}"
    textColor: "{colors.gecko-deep}"
  speech-bubble:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "18px 18px 18px 4px"
  answer-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  agent-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  session-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "10px"
  session-agent:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  kb-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "14px 16px"
  passage-cell:
    rounded: "{rounded.input}"
    padding: "0 10px"
    height: "56px"
  passage-cell-answer:
    backgroundColor: "{colors.gecko-wash}"
    rounded: "{rounded.input}"
  app-window:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.window}"
  nav:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "64px"
---

# Design System: GetCko

Governing law: `../docs/getcko-design-system.md` is binding. This file records how this landing page (`src/`) applies it; where they disagree, the brand doc wins and this file is stale. Token source: `src/styles/tokens.css` (primitive `--gc-*` → semantic → component layers). Primitives are copied verbatim from brand doc §2.

## Overview

**Creative North Star: "The Pointing Gecko"**

A calm, paper-white product world where one pixel gecko is the only animated, colorful character. Everything else is ink on paper: real app chrome (spreadsheet window, PDF manual, session bar, agent cards) drawn flat and legible, so the gecko can travel between them and point at the exact cell, button, or citation that answers the question. Color is spent on meaning: green means "the gecko / ready / cited", sun yellow means "this exact thing, right now".

Density is product-like, not marketing-like: real UI at real sizes, integer pixel art, no decoration. Depth comes from 1px lines and two ambient shadows; motion comes almost entirely from the gecko's single canvas.

**Key Characteristics:**
- One persistent canvas gecko per screen, moving between registered slots by dissolving and re-forming.
- Sun halo lights only the single target the gecko is pointing at.
- Ink-black primary buttons, 14px corners, 2px ink border.
- Flat paper surfaces, hairline `line` borders, no gradients or glows.
- Integer sprite cell sizes (3–7px) snapped to device pixels.

## Colors

A near-monochrome ink-and-paper palette with one living green and one pointing yellow.

### Primary
- **Gecko Green** (gecko): the sprite body, live dot, accent icon button, morph/trail pixels. Never text on white.
- **Deep Gecko** (gecko-deep): links, citation chip text and stroke, ready-chip text, answer passage cell border, focus border.
- **Gecko Wash** (gecko-wash): ready-chip fill, lit citation, highlighted manual passage, agent tile, focus ring fill.

### Tertiary
- **Sun** (sun): the target halo (`--halo: 0 0 0 3px`) only. Never a fill, never text.

### Neutral
- **Paper** (paper): page, cards, windows, nav.
- **Canvas** (canvas): wells: Files panel, processing chip, sheet row/column headers, answer question block, disabled button.
- **Line / Line Strong** (line, line-strong): hairline borders and dividers / keycap stroke, dashed placeholders, spinner track, window lights.
- **Ink, Ink 2, Ink 3** (ink, ink-2, ink-3): primary text and primary-button fill / secondary text / tertiary, captions, muted.
- **Ink Raised** (ink-raised): agent chip inside the dark session bar; dark icon-button hover.
- **Ink Key** (ink-key): keycap inside a primary button.
- **Alert / Alert Wash** (alert, alert-wash): error states only; not used on the landing page.

The budget bar is the one place the neutral ramp is shown as data: ink → ink-2 → ink-3 → line-strong → line.

### Named Rules
**The Sun Is A Pointer Rule.** Sun yellow appears on at most one element per screen: the target the gecko points at, via `data-gc-target="on"`.
**The Green Means Gecko Rule.** Green is reserved for the gecko, readiness, and citations. It is never decoration.

## Typography

**Display Font:** Bricolage Grotesque (system-ui fallback)
**Body Font:** Geist Sans (system-ui fallback)
**Label/Mono Font:** Geist Mono (keycaps, file tags, cell refs); Silkscreen for the single pixel badge.

**Character:** A heavy, tightly tracked grotesque for headlines against a quiet, neutral UI sans; mono only where a user would type or read a reference.

### Hierarchy
- **Display** (800, 64px/64px, -0.035em): section headings (`.h-section`). Hero title is one line at `min(8.2vw, 12.5svh, 136px)`, line-height 1; closing `clamp(48px, 6.2vw, 96px)`.
- **Headline** (700, 36px/40px, -0.02em): `.h1`.
- **Title** (700, 24px/30px): card and principle titles (`.h2`).
- **Body** (400, 16px/24px): default. **Lede** 18px/28px, ink-2, max 34em.
- **Label** (600, 13px/16px, 0.08em, uppercase): eyebrows and table headers.
- **Caption** (400, 12px/16px, ink-3).
- **Mono** (500, 13px): keycaps; 10px in PDF tags, 14px inline kbd.
- **Pixel** (Silkscreen 400, 22px): the "Gets mo na." badge only (closing section, intro).

### Named Rules
**The Weight Carries Display Rule.** Headlines get size and 700–800 weight with negative tracking; never color or gradient text.

## Layout

- **Container:** sections max 1312px, padding 128px 48px (80px 20px below 900px). Files panel max 1248px, canvas well, 64px padding, 20px radius.
- **Spacing scale:** 4/8/12/16/24/32/48/64 (`--gc-s-*`); grid gaps 20 (agents), 48–64 (two-column sections).
- **Nav:** fixed 64px, paper, border appears only after scroll; links hidden below 900px.
- **Hero (D3 centered stage):** min-height 100svh, centered one-line title, subline, CTA, then a pair: the hero gecko slot and a two-row "Student Record" window. Both size from one integer cell `--hc` (8px base; 10 ≥900w; 12 ≥1100w & ≥760h; 14 ≥1280w & ≥860h; 16 ≥1400w & ≥980h). The window is 32 cells wide, its "Final grade" field sits at the gecko's hand height (window `margin-top: -3.5 cells`), and the field is the halo target. Below 900px the pair stacks with the window on top.
- **Intro (GSAP, once per session, `?intro` forces it, skipped under reduced motion):** `<html class="intro-pending">` is set before first paint. Beats: (1) the head mark's cells assemble from a scattered pixel field; (2) an ink tile with a 29% radius grows behind it, and the "GetCko" chars and pixel badge print in; (3) the tile flies into the 48px nav tile and the white overlay lifts; (4) the headline words rise from masks, then the subline and CTA; (5) the windows enter through a pixel-raster curtain: the manual card springs up and de-rasters top-left first, while the Student Record window unfolds from its left edge and de-rasters at random; (6) the director releases its `intro` hold and the manual passage pours into the gecko; the manual card then fades (it exists only in the intro). Click, any key, wheel or touch skips it.
- **Sprite cell sizes (integer px, per breakpoint):** the sprite is 22×27 cells. Hero slot uses `--hc` (above). Section slots are 5px (4px ≤1099). Closing slot is 7px (5px ≤1099).
- **Breakpoints:** 359px (hide wordmark), 899px (flat stack), 1099px, 1399px.

## Elevation & Depth

Flat by default, hairlines first. Surfaces sit on paper with 1px `line` borders; wells use canvas instead of shadow. Two ambient shadows exist:

### Shadow Vocabulary
- **Lift** (`--gc-shadow-1`): agent-card hover only (with translateY(-2px)).
- **Window** (`--gc-shadow-2`): floating app windows (hero Student Record, intro manual card, answer card) and the demo dialog.
- **Keycap bevel** (`inset 0 -2px 0 line`): keycaps and inline kbd.
- **Halo stack:** `--halo` (3px sun) on light; `--halo-on-dark` (6px paper gap + 4px sun) on dark targets.

### Named Rules
**The No Glow Rule.** No gradients, blurred glows, or colored shadows anywhere. Emphasis is a solid ring, never a bloom.

## Shapes

Soft rectangles with a fixed radius ladder: 4px tags/passages, 7px keycaps, 8px inputs/tiles/passage cells, 10px windows, 14px buttons and icon buttons, 20px cards/panels, pill for chips and the session bar. The speech bubble is 18/18/18/4 (tail bottom-left); user chat bubbles mirror it (18/18/4/18). Dashed 1.5px line-strong borders mark empty or "new" slots (passage cells, New agent card). The gecko itself is hard-edged pixel squares; never round or smooth it.

## Components

### Buttons
- **Shape:** gently rounded (14px), 2px ink border, Geist 600 16px/20px, gap 10px.
- **Primary:** ink fill, paper text, 48px tall, 20px side padding; hero variant 52px (scales to `max(52px, 64u)`) at 17px. Keycap inside uses ink-key.
- **Secondary:** paper fill, ink text, same ink border.
- **Small / Nav:** 44px, 16px padding, 14px text.
- **Hover / Active:** translateY(-1px) / 0, 150ms ease-out. Disabled: canvas fill, line border, ink-3 text, no motion.
- **Icon buttons:** 48px square transparent, canvas on hover; accent 44px gecko fill; dark 44px paper glyph, ink-raised hover.

### Keycap
Paper, 1px line-strong stroke, 7px radius, inset 2px bottom bevel, mono 500 13px, min 28×28. Hero keycaps grow to `max(32px, 38u)`.

### Chips
- **Style:** pill, 28px, 0 12px, Geist 500 13px/16px, gap 6px.
- **States:** ready (wash/deep), processing (canvas/ink-2 + 12px spinner), queued (paper/ink-3 + 1px inset line), offline (ink/paper), plain (canvas/ink-2). Live dot is 8px gecko.
- **Citation chip:** paper with 1.5px inset gecko-deep stroke and deep text; fills with wash when lit (`.is-lit`, 300ms). Rides under the speech bubble at 26px/12px.

### Cards / Containers
- **Answer card:** paper, 20px radius, 1px line, window shadow, padding `18u + 4px`, gap 12. Head with agent name and chip; question in a canvas 8px well; body line-height 1.55. Docks up from below with `--dock`.
- **Agent card:** paper, 1px line, 20px radius, 20px padding, gap 10; 44px wash tile with deep icon; mono code top-right; chips row; Start button bottom-right. Hover: shadow-1 + lift 2px (250ms). "New agent" variant: dashed border, transparent.
- **Knowledge-base list:** paper, 1px line, 20px radius; rows 14px 16px, gap 14, hairline dividers, 40px canvas icon tile, 600 15px name with ellipsis, 12px caption meta, status chip at end.
- **Passages grid:** 6 columns, 56px rows (44px mobile), gap 10 (6 mobile). Empty cells: dashed 1.5px line-strong, 8px radius. Filled: paper + 1px line with three 3px line-strong bars (100/70/45%). The answer cell fills wash with deep border and bars.
- **Sheet mock:** paper window, 10px radius, window shadow; traffic lights are neutral line-strong dots (never colored); pill canvas toolbar; formula row with name box; grid of hairline cells with canvas row/column headers, active row/column in line. The target cell sits raised (z-index 2) on paper.
- **Manual card:** PDF window, 10px radius; ink mono PDF tag; highlighted passage in wash that fades to transparent/ink-3 while it dissolves into the gecko.

### Session bar
Ink pill, padding 10px, gap 8; agent chip 44px ink-raised pill; line-strong hint text 13px; 3px waveform bars (ink-3 idle, paper animated 900ms when live). Wraps with 28px radius on mobile.

### Navigation
Fixed 64px paper bar, 3.6vw side padding; 48px ink brand tile + Bricolage 800 26px wordmark; Geist 500 15px links, underline on hover; border-bottom line appears on scroll.

### Signature: The canvas gecko (`site/src/gecko/director.ts`)
- **One canvas:** a single fixed, full-viewport, pointer-events-none canvas (z 30) draws the only gecko. Sections never render their own sprite; they register **slots** (`GeckoSlot`: a box sized `22×27 × --cell`, the owning section, an optional **target**, optional **source**, pose, flip).
- **Slot choice:** the active slot is the one whose section contains (or is nearest to) the viewport midline. The sprite is bottom-centered in its slot and snapped to device pixels; cell size is read as an integer from `--cell`.
- **Morph:** changing slots dissolves the sprite into its cells and re-forms it at the new slot. Each cell eases (cubic in-out) along a quadratic arc, delay `row/27 × 420ms + ≤260ms`, duration 760–1180ms, size interpolating to the new cell size. Interrupted morphs re-target from the in-flight pixels.
- **Passage pour:** on first arrival with a source, the source passage (`data-gc-dissolving`) breaks into 3–7px pixels in a narrow descent corridor, tinted gecko/light/pale/ink, settling into the sprite. A stepped trail then streams 2 squares every 45ms from the passage to the target, snapped to a 6px lattice (occasional 12px), 1300–1800ms each, fading in/out at the ends, tracking the live target.
- **Flow:** `flow(from, targets)` sends 7 pixels per target (6–10px, 650–1000ms, 45ms stagger) to fill passage cells.
- **Sun halo moves with the gecko:** 80ms after landing, the slot's target gets `data-gc-target="on"`; the previous target is cleared before every morph, so only one halo ever exists. Halo transition 250ms ease-out.
- **Idle:** pointing pose blinks for 140ms every 2.6–5.8s. Idle frames skip redraw. Director starts 450ms after fonts are ready.
- **Reduced motion:** no particles, trail, flows, or blink; the gecko appears settled in the active slot, halo lands immediately, flows complete instantly, CSS transitions/animations on targets, passages, chips, spinner, and waveform are removed.

## Do's and Don'ts

### Do:
- **Do** render the gecko only through the director canvas; add a new appearance by registering a `GeckoSlot` with an integer `--cell`.
- **Do** give every slot at most one target, and let the director own `data-gc-target`.
- **Do** keep sprite cells integer (3, 4, 5, 6, 7px) and size layout around `22 × cell` by `27 × cell`.
- **Do** keep the focus ring visible over a lit halo: 2px gecko-deep border then sun (`0 0 0 2px focus-border, 0 0 0 5px sun`; dark adds a 5px paper gap before a 9px sun ring). Default focus: 3px wash outline, 2px offset, 2px deep shadow.
- **Do** collapse to the flat stack below 900px and under reduced motion; the gecko still points, it just doesn't travel.
- **Do** use ink primary buttons with 2px ink borders and 14px corners.

### Don't:
- **Don't** show more than one gecko on screen, or a second static gecko image beside the canvas.
- **Don't** use sun yellow anywhere except the single pointed target's halo.
- **Don't** use gradients, glows, blur, or colored shadows.
- **Don't** scale the sprite by fractional factors or smooth it.
- **Don't** color window traffic lights; chrome stays neutral.
- **Don't** set green text on white; use gecko-deep for text and strokes.
