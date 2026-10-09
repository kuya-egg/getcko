# GetcKo Design System (v0.4)

> Source of truth for anyone (human or agent) building GetcKo's UI, marketing, slides or video.

| | |
|---|---|
| Stack | Tauri 2 + React 19 + Tailwind v4, macOS first, Windows second |
| Code | `src/brand/` (tokens, theme, fonts, motion, lexicon, icons, mascot), `src/components/ui/` (primitives) |
| Conflicts | **Code wins for values, this file wins for intent**; report the drift |
| Agent shortcut | `getcko-brand` skill (`.claude/skills/getcko-brand/`), triggered by "use brand"; snippets in its `references/recipes.md` |
| Captures | `docs/brand/showcase-light.png`, `docs/brand/showcase-dark.png`; canvas `docs/getcko-design-system.html` (v0.1) |

| Version | Adds |
|---|---|
| **v0.4** | Show, don't tell (§11.1); component-first recipes (§9); window sizes and z-index (§4); page transitions (§5.6); focus and keyboard map (§13); data formatting and honest numbers via `MEASURED` (§11.3); logo lockup and app icon (§10.1); "desktop helper" replaces "copilot"; "Nothing leaves this Mac." everywhere |
| v0.3 | Textured sections (§6.0), controlled vocabulary (§11), pixel icon set (§7), 31 mascot poses (§10), sprite outline fix |
| v0.2 | Dark theme, measured contrast, motion, texture, iconography, recipes, Taglish, anti-slop |

---

## 0. How to use it in code

| Need | Import |
|---|---|
| CSS, once per window | `import "./brand/index.css"` + `initTheme()` (already in `main.tsx`; the overlay entry does the same) |
| Colors, type, radius, shadows | Tailwind utilities from `src/brand/theme.css` (`bg-surface`, `text-text-2`, `text-h1`, `rounded-panel`, `shadow-overlay`) |
| Theme switch | `useTheme()` → `{ theme, resolved, setTheme, toggle }` |
| Components | `src/components/ui/index.ts` (§8). Build screens from them, never from raw markup |
| Words | `T`, `say`, `linesFor`, formatters and `MEASURED` from `src/brand/lexicon.ts` (§11) |
| Icons | `Icon`, `ICON_PROPS`, `docIcon` from `src/brand/icons.ts` (§7) |
| Motion | `DUR`, `EASE`, `flyTo`, `haloIn`, `answerCardIn`, `pageIn`, `stepIn`, `staggerIn` from `src/brand/motion.ts` (§5) |
| Mascot | `GetCkoSprite`, `GetCkoHeadMark`, `MOMENT_POSE` from `src/brand/mascot/` (§10) |
| Textures | `Surface`; `injectTextureStyles()` (called once in `main.tsx`), `textureStyle`, `plateStyle` from `src/brand/textures.ts` (§6) |
| Logo | `public/brand/logo/*.svg`, `public/brand/favicon.svg`, `docs/brand/app-icon-1024.png` (§10.1) |
| Image prompts, video | `docs/brand/image-prompts.md`, `docs/brand/video.md` |

**Rule:** components use **semantic** tokens (`bg`, `surface`, `text`, `accent-text`...). Raw palette (`paper`, `ink`, `night`, `gecko`...) is for the mascot, marketing frames and video, where the color must not flip with the theme.

---

## 1. Principles

- **North star: "The helper at your elbow."** Textured sections from the gecko's world, solid content cards, one small green creature, one yellow ring around the thing you need.

| # | Principle | In practice |
|---|---|---|
| 1 | **Textured sections, solid content** | Every section wears one texture (`docs/brand/textures.md`); content sits on `bg-surface` cards. Working screens and the overlay stay flat or `subtle`; never texture near the halo |
| 2 | **One green, one sun** | Green marks the helper (mascot, live dot, accent fill). Sun yellow marks the target. Nothing else is colorful |
| 3 | **It points, never clicks** | No auto-click, no auto-type, no "Do it for me" |
| 4 | **Show, don't tell** | Headline ≤ 6 words, body ≤ 1 line; the rest becomes keyword chips, steps, a diagram or motion (§11.1) |
| 5 | **Native on both** | At home on macOS and Windows 11. Flat surfaces, no vibrancy or Mica |
| 6 | **On this Mac, and honest** | "Offline" chip, measured numbers only, real sources or "I don't know" |
| 7 | **The eye follows the gecko** | Question → GetcKo → target → source (§9) |

---


## 2. Color

### 2.1 Raw palette, light side

| Token | Hex | Use | Rules |
|---|---|---|---|
| `paper` | `#FFFFFF` | Default surface | |
| `canvas` | `#F6F7F4` | Wells, hover, secondary panels | |
| `line` | `#E6E8E3` | Borders, dividers | 1px |
| `line-strong` | `#C9CCC4` | Input borders, keycap edges | |
| `ink` | `#0E0F0C` | Text, primary button, chat bubble, session bar | |
| `ink-2` | `#4A4D46` | Secondary text | |
| `ink-3` | `#6C7067` | Captions, disabled text | 5.06:1 on paper, 4.70:1 on canvas (v0.2; was `#73776E`, which failed on canvas) |
| `gecko` | `#39D86F` | Mascot, live dot, accent fills | **Fill only. Never text on light** (1.87:1) |
| `gecko-deep` | `#0F7A3D` | Links, citations, green text, focus border (light) | Never on dark (3.42:1) |
| `gecko-wash` | `#EAFBEF` | Ready chips, tints, focus outline | |
| `sun` | `#FFC83D` | **Target halo only** | Never decorative, never text |
| `alert` / `alert-wash` | `#B3321D` / `#FDECEA` | Errors, Failed status | |

### 2.2 Raw palette, dark side (v0.2)

- Ink family with a faint green-black undertone. Not `#000`, not navy, not charcoal blue.

| Token | Hex | Use |
|---|---|---|
| `night` | `#121410` | Dark ground |
| `night-1` | `#191B16` | Raised surface (cards, panels) |
| `night-2` | `#21241E` | Wells, hover, secondary panels |
| `night-line` | `#2E3229` | Borders, dividers |
| `night-line-strong` | `#474C41` | Input borders, keycap edges (non-text, 2.1:1 is fine for a border with a label) |
| `mist` | `#F1F3EC` | Primary text on dark; inverse fill (primary button on dark) |
| `mist-2` | `#B8BDB0` | Secondary text on dark |
| `mist-3` | `#8D9285` | Captions on dark |
| `gecko-tint` | `#6FE598` | Green **text** on dark (links, citations) |
| `gecko-night` | `#15301E` | Green wash on dark (Ready chip, focus wash) |
| `alert-tint` / `alert-night` | `#FF8F78` / `#3A1B14` | Error text / error wash on dark |
| `ink-raised` | `#1E201B` | Agent chip inside the session bar |
| `keycap-dark` | `#2A2C27` | Keycap inside a primary button |

### 2.3 Semantic tokens: light vs dark

- Set by `<html data-theme="light|dark">`; with no attribute the OS setting wins (`theme.ts`, key `gc-theme`). Tailwind name in parens.

| Semantic (`--gc-*`) | Light | Dark | Role |
|---|---|---|---|
| `bg` (`bg`) | paper `#FFFFFF` | night `#121410` | Window ground |
| `surface` (`surface`) | paper `#FFFFFF` | night-1 `#191B16` | Cards, panels, answer card |
| `surface-2` (`surface-2`) | canvas `#F6F7F4` | night-2 `#21241E` | Wells, hover, question strip |
| `border` | line `#E6E8E3` | night-line `#2E3229` | Dividers, card edges |
| `border-strong` | line-strong `#C9CCC4` | night-line-strong `#474C41` | Inputs, keycaps, dashed "new" card |
| `text` | ink `#0E0F0C` | mist `#F1F3EC` | Primary text |
| `text-2` | ink-2 `#4A4D46` | mist-2 `#B8BDB0` | Secondary text, eyebrows |
| `text-3` | ink-3 `#6C7067` | mist-3 `#8D9285` | Captions, timestamps |
| `accent-fill` (`accent`) | gecko `#39D86F` | gecko `#39D86F` | Fills only |
| `on-accent` | ink | ink | Icon/text on a gecko fill |
| `accent-text` | gecko-deep `#0F7A3D` | gecko-tint `#6FE598` | Links, citations |
| `accent-wash` | gecko-wash `#EAFBEF` | gecko-night `#15301E` | Ready chip, tints |
| `target` | sun | sun | Halo only |
| `danger` / `danger-wash` | alert / alert-wash | alert-tint / alert-night | Errors |
| `inverse-bg` / `inverse-text` (`inverse`, `inverse-text`) | ink / paper | mist / ink | Primary button, GetcKo chat bubble |
| `chrome-bg` / `chrome-raised` (`chrome`, `chrome-raised`) | ink / ink-raised | ink / ink-raised | Session bar: **dark in both themes** |
| `chrome-text` / `chrome-text-2` | paper / line-strong | mist / mist-2 | Text in the session bar |
| `focus` / `focus-wash` | gecko-deep / gecko-wash | gecko / gecko-night | Focus ring |
| `selection` | gecko-wash | `#24502F` | `::selection` |
| `disabled` / `disabled-border` / `disabled-text` | canvas / line / ink-3 | night-2 / night-line / mist-3 | Disabled controls |
| `keycap` / `keycap-border` | paper / line-strong | night-2 / night-line-strong | Keycaps |

Dark-theme notes:
- On dark, the **primary button inverts to `mist` with `ink` text** (17.19:1). Do not make it green.
- Dark halo is two rings: `0 0 0 3px night, 0 0 0 6px sun` (the night gap separates the ring from the element). On the always-dark session bar or an ink video frame use `--gc-halo-on-dark` (`6px white, 10px sun`).
- Shadows on dark are deeper black (`rgba(0,0,0,.4/.5)`) and do most of their work through the `border` token; every dark card keeps its 1px `border`.

### 2.4 Contrast, measured (WCAG 2.x relative luminance)

- Computed from the hex values in `src/brand/tokens.css`. Target: 4.5:1 for text under 24px, 3:1 for 24px+ and for non-text UI.

**Light**

| Pair | Ratio | Verdict |
|---|---|---|
| text (ink) on bg/surface (paper) | 19.23 | AAA |
| text on surface-2 (canvas) | 17.88 | AAA |
| text-2 (ink-2) on paper | 8.60 | AAA |
| text-2 on canvas | 8.00 | AAA |
| text-3 (ink-3) on paper | 5.06 | AA |
| text-3 on canvas | 4.70 | AA (v0.2 token fix; captions are fine on `surface-2`) |
| accent-text (gecko-deep) on paper | 5.42 | AA |
| accent-text on canvas | 5.04 | AA |
| accent-text on accent-wash | 5.05 | AA (Ready chip) |
| danger (alert) on paper | 6.19 | AA |
| danger on danger-wash | 5.42 | AA (Failed chip) |
| on-accent (ink) on gecko | 10.28 | AAA (accent icon button) |
| inverse-text (paper) on ink | 19.23 | AAA (primary button, bubble) |
| chrome-text-2 (line-strong) on ink | 11.83 | AAA (hotkey hint) |
| paper on ink-raised | 16.44 | AAA (agent chip) |
| gecko on paper | 1.87 | **Never as text** |
| sun on paper | 1.55 | Halo only, so the light halo adds a 1px ink keyline outside the sun ring (`0 0 0 3px sun, 0 0 0 4px ink`) to clear 3:1 for non-text UI. It never carries meaning alone (the gecko and the answer do) |

**Dark**

| Pair | Ratio | Verdict |
|---|---|---|
| text (mist) on bg (night) | 16.56 | AAA |
| text on surface (night-1) | 15.52 | AAA |
| text on surface-2 (night-2) | 14.05 | AAA |
| text-2 (mist-2) on night / night-1 / night-2 | 9.66 / 9.05 / 8.19 | AAA |
| text-3 (mist-3) on night / night-1 / night-2 | 5.81 / 5.44 / **4.93** (lowest) | AA |
| accent-text (gecko-tint) on night / night-1 / night-2 | 11.77 / 11.03 / 9.98 | AAA |
| accent-text on accent-wash (gecko-night) | 9.05 | AAA (Ready chip) |
| gecko (fill) on night / night-1 | 9.91 / 9.28 | Live dot and icon fills read clearly |
| danger (alert-tint) on night / night-1 / alert-night | 8.34 / 7.81 / 7.02 | AAA |
| inverse-text (ink) on inverse-bg (mist) | 17.19 | AAA (primary button on dark) |
| chrome-text-2 (mist-2) on ink / ink-raised | 10.02 / 8.57 | AAA |
| text on selection `#24502F` | 8.29 | AAA |
| sun on night / night-2 | 11.98 / 10.17 | Halo is strongly visible on dark |
| gecko-deep on night | 3.42 | **Never use gecko-deep on dark** |

### 2.5 Color rules

- **The 3% rule.** On any app screen, green covers at most ~3% of pixels (mascot, one live dot, one accent button). Sun appears on exactly one element or not at all.
- No gradients, no glows, no gradient washes, no glassmorphism, no purple, no blue. Where a fade is needed, use a **dither step** (§6), never a gradient.
- Dark surfaces in the light theme are `ink` only: session bar, chat bubble, primary button, app icon tile.
- Colors that must be told apart also differ in lightness (Ready vs Failed chips differ in hue **and** carry a word).

---

## 3. Typography

- All fonts are bundled offline via fontsource in `src/brand/index.css`. Never a CDN; never Inter, Roboto, Arial or system-ui as the visible face.

| Style | Tailwind | Font | Size/line | Weight | Tracking | Use |
|---|---|---|---|---|---|---|
| Hero | `text-hero font-display` | Bricolage Grotesque | 84/82 | 800 | -0.035em | Marketing hero, video title card |
| Display | `text-display font-display` | Bricolage Grotesque | 64/64 | 800 | -0.035em | Onboarding step title, slides. **Never on app screens** |
| H1 | `text-h1 font-display` | Bricolage Grotesque | 36/40 | 700 | -0.02em | Page titles. **The biggest headline in the app** |
| H2 | `text-h2 font-display` | Bricolage Grotesque | 24/30 | 700 | 0 | Section titles, empty-state titles |
| Title | `text-title font-display` | Bricolage Grotesque | 20/26 | 700 | 0 | Card titles (agent, template) |
| Row | `text-row` | Geist | 15/20 | 600 | 0 | List-row names, inline error titles |
| Body | `text-body` | Geist | 16/24 | 400 | 0 | Settings, descriptions (one line) |
| Answer | `text-answer` | Geist | 16/1.55 | 400 | 0 | GetcKo's answer text |
| Label | `text-label` | Geist | 14/20 | 500 | 0 | Buttons, tabs, chips |
| Eyebrow | `eyebrow` | Geist | 13/16 | 600 | 0.08em UPPERCASE | Section labels in `text-2` |
| Caption | `text-caption text-text-3` | Geist | 12/16 | 400 | 0 | Sources, timestamps |
| Keys | `text-keys font-mono nums` | Geist Mono | 13/16 | 500 | 0 | Shortcuts, measured numbers |
| Pixel | `text-pixel font-pixel` | Silkscreen | 22/24 | 400 | 0 | Mascot badge ("Gets mo na."), video stamps |

- Headings left-aligned. Centered only on the video title card and the single-line app-icon lockup.
- Display weights (800) only at 36px and up. Body never bolder than 600.
- **Silkscreen is a seasoning:** max once per screen, ≤ 4 words, beside the mascot or a pixel element.
- Numbers that update use `font-mono nums`. Answers max `max-w-answer`; copy columns `max-w-copy`.
- No arbitrary values: no `text-[…]`, `rounded-[…]`, `w-[…]`, `max-w-[…]`, `z-[…]` in components.

---

## 4. Spacing, radius, elevation, windows, layers

| Token | Values |
|---|---|
| Spacing (4px base) | 4, 8, 12, 16, 24, 32, 48, 64 (`--gc-space-1..8`, Tailwind `1, 2, 3, 4, 6, 8, 12, 16`) |
| Rhythm | Inside a component 8–16 · between components 24 · between sections 48 · gutter 32 (app), 64 (marketing) |
| Radius | `rounded-input` 8 · `keycap` 7 · `window` 10 (mac) / 8 (Win) · `button` 14 · `bubble` 18 (tail 4) · `panel` 20 · `icon` 22 at 96 · `pill`. Nested: inner = outer − padding |
| Elevation | 0 = 1px `border` · 1 = `shadow-card` · 2 = `shadow-overlay`. Nothing higher. Dark keeps the 1px border |
| Targets | ≥ 44px (`hit`) |

### 4.1 Window sizes

| Surface | Design at | Min | Rule |
|---|---|---|---|
| Main window | 1040×680 | 900×600 | No `lg:`/`xl:` breakpoints in app screens; content scrolls, nav does not |
| Onboarding | Main window | 900×600 | Only app surface allowed `text-display` |
| Overlay | Full screen, transparent | — | Answer card `max-w-answer` (380), 24px inset, flips to avoid the target |
| Marketing | 1440 | 360 | Breakpoints allowed, 64px gutter |
| Video | 1920×1080, 1080×1920 | — | `docs/brand/video.md` |

### 4.2 Z-index scale

| Token | Layer |
|---|---|
| `z-base` | Page content |
| `z-raised` | Hovered or dragged cards |
| `z-sticky` | Sticky page headers |
| `z-scrim` | Dialog backdrop (flat `ink` at low opacity, no blur) |
| `z-dialog` | `Dialog` |
| `z-toast` | `Toast` |
| `z-overlay` | Gecko + answer card layer in the overlay window |

Never `z-[…]` or raw numbers.

---


## 5. Motion system

| | |
|---|---|
| Code | `src/brand/motion.ts` (GSAP) mirrors the CSS tokens; helper values there win |
| Character | Quick and calm. UI gets out of the way; only the gecko has personality (landing hop, stepped frames) |
| Order | Gecko → halo → words → sources |

### 5.1 Durations and eases

| Token | CSS | GSAP (`DUR`, `EASE`) | Use |
|---|---|---|---|
| instant | 80ms | `DUR.instant` | Press feedback, reduced-motion crossfade |
| fast | 140ms | `DUR.fast` | Hover, chip state, halo draw (default transition) |
| base | 220ms | `DUR.base` | Panel enter, card enter, tab switch |
| slow | 360ms | `DUR.slow` | Overlay answer card enter, page transition |
| pointer | 520ms | `DUR.pointer` | Gecko flight to a target |
| ease-out | `cubic-bezier(.2,.8,.2,1)` | `EASE.out` = `power3.out` | Anything entering |
| ease-in-out | `cubic-bezier(.65,0,.35,1)` | `EASE.inOut` = `power2.inOut` | Moves between two places, panels sliding |
| ease-point | `cubic-bezier(.34,1.32,.64,1)` | `EASE.point` = `back.out(1.6)` | Gecko landing only (GSAP `flyTo`). Not exposed as a Tailwind utility, so it cannot land on UI |
| ease-step | `steps(2, jump-none)` | `EASE.step` = `steps(2)` | Sprite frame swaps, pixel trail fades |

Exits are faster than entrances (use the next shorter duration, `ease-in-out`). Never animate width/height/top/left on UI; use `transform` and `opacity`.
### 5.2 The gecko flight path (Screen Help)

| Step | Rule |
|---|---|
| Takeoff | Pose from `MOMENT_POSE` (`pointPoseFor()` for right / down-right), flip toward the target with a frame swap, never a mirror tween |
| Landing spot | `placeBeside()`: hand tip just outside the target's side (8px default in the overlay; 12px / `gap-3` in static layouts). Never covers the target or the caret |
| Flight | `flyTo(el, rect, opts)`: one shallow arc, `DUR.pointer`, then a small landing hop (the only bounce in the product) |
| Pixel snap | x/y snapped to whole pixels (`snap` = sprite scale for a pixel feel); scale stays an integer |
| Trail (optional) | 3–4 `gecko` squares along the path, each fading in 2 steps over 220ms. No blur, no smears |
| Long flights | `MOMENT_POSE.moving` (walk frames) during the arc |

### 5.3 Halo pulse

- Draw: target gets `target-halo`; ring spread animates 0 → 3px over 140ms `ease-out`, no overshoot, plus the 1px ink keyline in light (dark: 0 → 6px including the night gap).
- Pulse: **two** soft pulses, spread 3 → 6 → 3px, 360ms each, `ease-in-out`. Then it holds still until the user acts or dismisses. Never an infinite pulse, never a glow or blur.
- One halo at a time. Moving to the next step removes the old halo (80ms fade) before the gecko takes off.

### 5.4 Entrance choreography

| t (ms) | What (always gecko → target → words → source) |
|---|---|
| 0 | Gecko lands (end of flight) |
| 0–140 | Halo draws |
| 80–440 | Answer card enters: opacity 0 → 1, translateY 8px → 0, 360ms `ease-out` |
| 200+ | Answer text streams in by sentence as TTS speaks (no per-letter typewriter) |
| after text | Citation chips + latency fade in, 140ms, 40ms stagger |

- Screens: `pageIn` / `staggerIn` (§5.6). Mascot enters with a 2-frame step pop (`steps(2)`), not a smooth scale.
- Sprite loops (`speakLoop`, `thinkingLoop`, `idleLoop`, `frameLoop`) follow the moment (§10 States). **Never animate the mascot while the user is typing.**

### 5.5 Reduced motion

- Trigger: `prefersReducedMotion()` (CSS already clamps durations to 1ms); every helper checks it.
- Gecko **teleports** to the landing spot (80ms crossfade), no arc, no trail.
- Halo draws at full size, no pulse.
- Panels crossfade (80ms opacity only), no translate.
- Sprite frame swaps for speaking/thinking stay (they are state, not decoration) but at half rate.

### 5.6 Page transitions

| Change | Helper | Motion |
|---|---|---|
| Route mount | `pageIn(el)` | Rise 8px + fade, 220ms `EASE.out` |
| Onboarding step | `stepIn(el, dir)` | Short slide in the step direction (`1` forward, `-1` back) + fade |
| Nav switch | crossfade | Opacity only, no slide, no stagger |
| Lists, cards | `staggerIn(els)` | 40ms stagger, max 4 items |
| Reduced motion | all of the above | 80ms opacity only |

---


## 6. Imagery and texture

| Is | Is not |
|---|---|
| Paper and pixels, the gecko's habitat (footprints, pothos canopy, pointer field, banig weave) | Stock photography, 3D blobs, abstract AI swirls |
| Real UI on solid cards | Texture behind body text, inputs or the halo |
| One pixel creature | A second mascot, an image-model redraw |

### 6.0 Textured sections (v0.3)

- Use: `<Surface texture="footprints" intensity="subtle|standard|bold" tone="canvas|paper|green|ink">` from `./components/ui`. CSS `src/brand/surfaces.css` (generated). Meanings, contrast and do/don't: **`docs/brand/textures.md`**.
- Light hero: **`footprints` + a `canopy-corner` branch**, or an ink hero.
- One texture per section; alternate loud and quiet; at most one `bold` per page.
- **Light mode taste rule:** prefer `footprints`, `canopy*`, `pointer`, `how`, `footer`. `lamellae`, `skin`, `weave` and the `dither-*` fields read as grey noise on light grounds: use them only as narrow bands (96–200px) or in `tone="ink"` / dark. The `hero` ghost-gecko plate reads as a grey checkerboard on light: use `canopy-corner` + `footprints` for a light hero, or put the hero in ink.
- `tone="ink"` makes a dark island in either theme (tokens re-scope inside it).
- Headings, `text`, `text-2` straight on texture; captions (`text-3`), links and body copy over two lines go on a content card.

### 6.1 Texture set (`public/brand/textures/`, `public/brand/plates/`)

| | |
|---|---|
| Code | `src/brand/textures.ts`: `TEXTURES`, `PLATES`, `textureStyle`, `plateStyle`, `injectTextureStyles()` (called once in `main.tsx`; classes `.gc-tex-<id>`, `.gc-tex--light/--dark`, `.gc-tex-layer`) |
| Files | SVG per texture, light (ink) and dark (mist), colors baked to tokens |
| Preview, regenerate | `scripts/brand/preview.html`; `node scripts/brand/generate.mjs .` |

v1 texture IDs (still supported; prefer the v0.3 `Surface` set in §6.0):

| ID | What it is | Where |
|---|---|---|
| `grid-cell` | Pixel-cell grid, one tile = the 22×27 sprite canvas at 8px/cell | Onboarding, empty states, title cards. Says "pixel world" quietly. |
| `dither-lo` | Flat 2/16 Bayer dither, 4px cells | Wells and side panels, instead of a grey fill |
| `dither-mid` | Flat 4/16 Bayer dither | Hero blocks, video lower thirds |
| `dither-fade` | Stepped dither band 0 → 8/16, 288px tall | **The no-gradient fade**: section bottoms, footers, video ground |
| `grain` | Paper grain, ~6% noise | Large flat marketing / slide / video surfaces only. Never in the app or overlay. |
| `scales` | Pixel hex lattice with a few green-wash scales | Brand moments: about page, social, splash |
| `crosshair` | 2px dots every 24px, crosshair every 96px | Screen Help explainers, pointing demos, the demo video (says "coordinates on your screen") |
| `watermark-solid` | Flat gecko silhouette | Huge, cropped by an edge, behind empty space |
| `watermark-dither` | Dithered gecko silhouette | Title cards, splash, empty states |

Plates (1920×1080, with a `titleSafe` rect in `PLATES`): `point` (full-color GetcKo at 16× pointing at a target chip with the sun halo: video opener, README hero), `watermark` (chapter/section card), `headmark` (end card / app-icon reveal).

**Scanline-free:** no CRT scanlines, no VHS noise, no chromatic aberration. The pixel style is "clean sprite", not "retro arcade".

Usage rules:
- **One texture per surface.** Never stack, never tint.
- Never behind body text denser than a caption, never behind inputs, tables, or the overlay target.
- Integer `background-size` multiples only; pixel textures keep `image-rendering: pixelated` (the helpers set it).
- In the app: onboarding, empty states and about use `standard`; working screens (agent editor, knowledge bases, settings) stay flat or `subtle`; the overlay is never textured.
- Sun yellow appears only inside `plate-point`, because there it *is* the target halo.

```tsx
<Surface texture="pointer" intensity="subtle" className="rounded-panel">…</Surface>
<Surface texture="dither-fade" mode="dark">…</Surface> {/* forced dark, for video */}
```

### 6.2 Generated imagery

- Prompts: `docs/brand/image-prompts.md`.
- Flat, ink + paper (or night + mist), with green only on the gecko and yellow only on a target ring.
- Real-feeling screens of real software (spreadsheets, forms, Finder) beat abstract concepts. Show a Filipino office or classroom context through **content** (a DepEd grade sheet, a barangay form), not through stock "diverse team smiling at a computer".
- The mascot is never re-drawn by an image model. Composite the real sprite (`sprites.ts`) on top.
- No people with glowing screens, no brains, no circuit boards, no holograms, no robots.

### 6.3 Screenshots of the product

- Real app windows at 1× or 2× DPR, window radius kept, `shadow-overlay` under them on marketing.
- Crop to the moment: gecko + halo + answer card in frame.

---

## 7. Iconography

| Rule | Detail |
|---|---|
| Source | `Icon`, `ICON_PROPS`, `ICON_SIZE`, `DOC_ICON`, `docIcon(name)`, `STATUS_ICON` from `src/brand/icons.ts`; never an icon package in a component |
| Set | pixelarticons (MIT, 24 grid) for generic actions + hand-drawn maps for GetcKo's own concepts (agent, Screen Help, target, source, knowledge base, document types, Hold to talk, statuses...) |
| One per concept | No concept borrows another's icon. In-flight keys: `switchAgent`, `chevronDown`, `mic`, `back`, `search`, `info`, `drop` |
| Grid | 24 × 24 units, 2-unit strokes, notched corners, 2×2 diagonal steps, `crispEdges`, `currentColor` |
| Sizes | 24 in the UI; 48 (`ICON_SIZE.x2`) for empty states and docs. Multiples of 24 only |
| Treatment | Only where it adds meaning (action, status, file type, source). None beside headings, none on every nav row, never in a tinted circle or tile. Color with text tokens, `gap-2` to the label |
| Processing | 8 squares lit in turn (`gc-icon-spin`, `steps()`), static under reduced motion |
| Banned | Sparkles, wand, stars, robot, brain, cpu as decoration, zap, rocket, cursor or hand pointers, cloud, upload, any smooth line-icon package |

Full map and drawing rules: **`docs/brand/icons.md`**; contact sheet `docs/brand/icons-sheet.png`.

---

## 8. Components

- **The component is the spec.** Read its Props interface in `src/components/ui/`; this table says what each is for. *(in-flight)* = being added now.

### 8.1 Frame and content

| Component | Use |
|---|---|
| `AppShell` *(in-flight)* | Main window frame: nav + content, 32px gutter |
| `NavLink` *(in-flight)* | Nav row. Active = `GeckoDot` after the label + `bg-surface`; no side stripe, no icon per row |
| `Wordmark` *(in-flight)* | Head mark + "GetcKo" lockup (§10.1) |
| `PageHeader` *(in-flight)* | `text-h1` title ≤ 6 words + one primary action |
| `Surface` | Textured section (`texture`, `intensity`, `tone`) |
| `Panel` | Solid content card (`eyebrow`, `title`, `actions`, `elevation`, `tone="well"`) |
| `Tabs` *(in-flight)* | Label weight, 2px `text` underline when active, arrow keys |

### 8.2 Controls

| Component | Use |
|---|---|
| `Button` | `primary` (solid `inverse`), `secondary` (2px `text` border), `ghost` (underlined); `sm` 44 / `md` 48 / `lg` 52; optional `icon`, `keycap` |
| `IconButton` | 48 (44 dense); `accent` = gecko fill, mic or the single main action only; `label` required |
| `Keycap` | `⌥ Space` / `Ctrl Space`; `hotkey` prop; `tone` default / inverse / chrome |
| `TextField` | h44, radius 8, visible label, helper or error caption; `multiline` |
| `Toggle`, `Checkbox` | Native input + label, `accent-color: var(--gc-focus)` |
| `SegmentedControl` *(in-flight)* | 2–4 exclusive options (answer length, theme) |
| `Select` *(in-flight)* | Longer lists; `Icon.chevronDown` |
| `Slider` *(in-flight)* | Speaking speed; value in mono |
| `VoicePicker` *(in-flight)* | Installed OS voices (answers are English only) |
| `Tooltip` *(in-flight)* | Supplementary only; never the only label |
| `Composer` | Text input → Hold to talk (accent) → Screen Help → Ask |

### 8.3 Status and feedback

| Component | Use |
|---|---|
| `StatusChip` | Processing (`surface-2`, `Icon.processing`) · Ready (`accent-wash`) · Failed + reason (`danger-wash`) · Offline (`inverse`, `Icon.offline`) |
| `CitationChip` | `Icon.source` 24, 1.5px `accent-text` border: `Manual · p. 4`. Every grounded answer has one |
| `OfflineBadge`, `GeckoDot`, `Tag` | Header chip, live dot, knowledge-base / language tags |
| `Kw` *(in-flight)* | Keyword chip: `bg-accent-wash text-accent-text` pill. Max 3 per block |
| `Steps` *(in-flight)* | Numbered 1 → 2 → 3 visual; replaces explanatory paragraphs |
| `Stat` *(in-flight)* | One measured number + label; `value={null}` renders nothing |
| `ProofLine` *(in-flight)* | Mono caption: "Wi-Fi off · Nothing leaves this Mac." + measured figures |
| `Notice` *(in-flight)* | Inline info or warning in the flow, `Icon.info` |
| `ErrorNotice` | Failure + fix + "Try again", GetcKo `failed` (confused) at 3×, no halo |
| `EmptyState` | Gecko 6× pointing at the primary action, which wears the halo |
| `Dialog` *(in-flight)* | Confirm destructive actions; traps focus, Esc closes, returns focus |
| `Toast` + `useToast` *(in-flight)* | Brief confirmation, `role="status"`, never focused |

### 8.4 Domain

| Component | Use |
|---|---|
| `AgentCard`, `NewAgentCard` | Name in `text-title`, one line, tags, "Start" (aria `Start {agent}`); new = dashed `border-strong` |
| `KnowledgeBaseRow`, `KnowledgeBaseList` | `docIcon(name)`, name in `text-row`, meta caption, status chip |
| `DropZone`, `ImportProgress` *(in-flight)* | "Add documents" target; import progress with GetcKo reading |
| `OnboardingStep`, `StepSquares`, `MockToggle` *(in-flight)* | Onboarding frame, 4 pixel squares, mock OS toggle wearing the halo |
| `AnswerCard` | `variant` `answer` / `bestGuess` / `dontKnow` / `noTarget` *(in-flight)*, `step`; radius 20, `shadow-overlay`, `max-w-answer` |
| `SessionBar` | `chrome` pill, dark in both themes: agent chip, mic, Screen Help, stop, shortcut hint |
| `ChatBubble` | `from="getcko"` (inverse, tail toward the mascot) or `"user"` |
| `TargetHalo` | Wraps the one target; `onDark` on chrome or ink frames |

### 8.5 Overlay window

- Transparent, frameless, always-on-top, click-through when unfocused; imports `src/brand/index.css`.
- Answer card bottom-right, 24px inset; flips to bottom-left rather than cover the target. Never steals focus.
- Follows the theme. **Not hidden from screen share**: no stealth mode.

---

## 9. Layout recipes

| Spine (every composition) | |
|---|---|
| 1. Ask | The question or headline (≤ 6 words) |
| 2. GetcKo | The sprite, facing the next thing |
| 3. Target | The one element with the sun halo (no target → the primary action) |
| 4. Source | Citation chip or proof line |

Snippets for every recipe: `.claude/skills/getcko-brand/references/recipes.md`. The gecko never sits in a corner facing out and never floats with nothing to point at.

### 9.1 App shell screen

| Part | Rule |
|---|---|
| Frame | `AppShell`, 1040×680, `NavLink` active = `GeckoDot` |
| Header | `PageHeader`: `text-h1` ≤ 6 words, one primary |
| Body | `Surface` (flat or `subtle` on working screens) → `Panel` cards, `max-w-copy` columns |

### 9.2 Onboarding (4 steps)

```
┌──────────────────────────────────────────────────────────┐
│ ▪▪▫▫  (StepSquares)                            Offline ● │  32 gutter
│                                                          │
│  Let GetcKo read             ┌── Surface pointer subtle ┐ │
│  this app.  (display, ≤6w)   │ [gecko 8×] ──▶ [MockToggle]│ │
│                              │              (sun halo)  │ │
│  macOS asks once. Nothing    └──────────────────────────┘ │
│  leaves this Mac. (1 line)                                │
│                                                          │
│  [ Open System Settings ]  Not now                        │
└──────────────────────────────────────────────────────────┘
```

| Step | Visual | States |
|---|---|---|
| 1 Accessibility | `MockToggle` Accessibility · GetcKo | Granted "Turned on" · waiting "Waiting for macOS…" · "Check again" |
| 2 Screen Recording | `MockToggle` Screen Recording · GetcKo | Same |
| 3 Microphone | `MockToggle` Microphone · GetcKo; then GetcKo `listening` ≥ 3× | Denied → `Notice` with `T.errors.micBlocked` |
| 4 Shortcut | `Keycap hotkey` wears the halo | Primary "Start" |
| Finish | GetcKo `endCard`, `say.tl.onboardingDone` | — |

- `OnboardingStep`: text 5 cols, visual well 7 cols; H1 takes focus on step change; `stepIn(el, dir)`.
- "Open System Settings" has no keycap. One primary per step.

### 9.3 Agents

| Part | Rule |
|---|---|
| Templates | One row of 3: Office Helper, Teacher, Study Buddy. Name `font-display text-title`, one line, "Use template". No icons |
| List | `AgentCard` grid; "Start"; `NewAgentCard` |
| Editor | `Panel` sections 48px apart: Instructions · Knowledge bases · Voice and language · Try it |
| Controls | `SegmentedControl` (answer length), `Slider` (speaking speed), `VoicePicker`, `LanguagePicker` |
| Try it | `ChatBubble` + GetcKo 3×, the only gecko on screen |

### 9.4 Knowledge bases

| Part | Rule |
|---|---|
| Import | `DropZone` with "Add documents" + caption "PDF, TXT or MD · stays on this Mac" |
| Progress | `ImportProgress page total`: pixel squares + mono "12 / 48 pages"; GetcKo `processing` reads along on the row (`KnowledgeBaseRow mascot`) |
| Rows | `KnowledgeBaseRow`: `docIcon`, `T.knowledgeBase.meta`, `StatusChip` (Failed always has a reason) |

### 9.5 Overlay answer card

```
            [target]   ← sun halo
      [gecko 2×] ↗      (placeBeside, facing target)

                              ┌ max-w-answer ──────────────────┐
                              │ ● GetcKo · Office Helper  Offline │ header
                              │ "Saan ko ilalagay…" (surface-2)  │ question strip
                              │ Ilagay mo sa cell D7 ang grade   │ text-answer, ≤ 4 lines
                              │ [Manual · p. 4]   0.9 s · on this Mac │ footer
                              └──────────────────────────────────┘
```

| `variant` | GetcKo | Halo | Footer |
|---|---|---|---|
| `answer` | `screenHelp` 2× beside the target | Target | Sources + latency (measured only) |
| `bestGuess` | `screenHelp` 2× | Guessed target | "Best guess" chip |
| `dontKnow` | `failed` (confused) 3× | None | No sources; "I don't know. It's not in your documents." |
| `noTarget` | `failed` (confused) 3× | None | "I can't find that on this screen." + hint |

`step` adds "Next step" for multi-step help. Action first, reason second, source last.

### 9.6 Settings

| Section | Content |
|---|---|
| Shortcut | `Keycap hotkey` + one-line help |
| Theme | `SegmentedControl`: Light / Dark / Match system |
| Permissions | Per permission: "Turned on" chip or "Open System Settings" |
| Models | Name, `fmtBytes` size, "Downloaded once. Everything runs on this Mac."; speed only via `Stat` |

### 9.7 Benchmark and proof

| Rule | How |
|---|---|
| Measured only | `MEASURED` mirrors `docs/MODELS.md`; TBD = `null` |
| Missing = invisible | `<Stat value={null}>` renders nothing; no dashes, no "coming soon" |
| Format | `fmtSeconds` / `fmtSpeed` + "on this Mac", mono |
| Close | `ProofLine`: "Wi-Fi off · Nothing leaves this Mac." |

### 9.8 Dialog, toast, notice

| Need | Component |
|---|---|
| Destructive confirm | `Dialog`: title ≤ 6 words, one-line body, primary names the action |
| Quick confirmation | `const t = useToast()` → `t.show(…)` + `<Toast {...t.props} />` |
| Inline info / warning | `Notice` |
| Failure with a fix | `ErrorNotice` (confused GetcKo, "Try again", no halo) |

### 9.9 Empty, error, loading by screen

- Loading is GetcKo's moment (`thinking` or `processing` pose + its line). Never a shimmer, skeleton or spinner block.

| Screen | Loading | Empty | Error |
|---|---|---|---|
| Agents | `thinking` 3× (only if > 300ms) | `EmptyState` "No agents yet." → "Use template" | `ErrorNotice` |
| Agent editor, Try it | `thinking` in the bubble | "This test chat is not saved." | `ErrorNotice` (model not loaded) |
| Knowledge bases | `ImportProgress` + Processing chips | `EmptyState` "No documents yet." → "Add documents" | Row Failed + reason |
| Overlay | `listening`, then `thinking` | — | `dontKnow` / `noTarget`; `offline` pose if the model is down |
| Onboarding | "Waiting for macOS…" + "Check again" | — | `Notice` + "Open System Settings" |
| Settings | `processing` on model rows | — | `Notice` |
| Benchmark | `processing` while running | Nothing rendered | `ErrorNotice` |

### 9.10 Empty and error states

| | Empty | Error |
|---|---|---|
| Place | Left-aligned, top third of the pane | Inline block, never full-screen |
| GetcKo | `EmptyState`: 6×, pointing at the primary action | `ErrorNotice`: `failed` (confused) 3× |
| Halo | On the primary action | **None anywhere on screen** |
| Copy | What's missing (H2) → one line why → primary → caption | What happened → what to do → "Try again". Never "Oops" |

### 9.11 Marketing hero (1440), video, slides

| Surface | Recipe |
|---|---|
| Hero | `Surface texture="footprints"` + `canopy-corner` branch (or an ink hero). Left 7 cols: `text-hero` ≤ 6 words, subline ≤ 2 lines, primary + keycap, `ProofLine`. Right 5 cols: real screenshot, halo on one cell, gecko 12× beside it, answer card overlapping the bottom edge by 48px |
| Below hero | One worked example per feature, text + screenshot rows alternating. `Kw` chips and `Steps`, no paragraphs, no card grids |
| Transitions | `dither-fade` band, never a gradient |
| Video title (1920×1080) | `night` + dark texture or `plateStyle("point", "dark")`; gecko 16× left third facing right; title Bricolage 800 120–144px ≤ 2 lines; "Gets mo na." Silkscreen 32px in `gecko-tint`. `docs/brand/video.md` |
| Slides | 16:9, one idea, title ≤ 6 words, real screenshots, measured numbers only, one gecko pointing at the key element |

---


## 10. Mascot: GetcKo (pixel sprite)

| | |
|---|---|
| Name | **GetcKo**: "gecko" + "gets it". Same name as the product |
| Form | 2D pixel sprite, 22 × 27 cells, standing, pointing up-right |
| Code | `src/brand/mascot/`: `<GetCkoSprite pose scale flip label palette />`, `<GetCkoHeadMark size tile="ink\|paper" />`, `buildPose`, `buildHeadMark`, `handTip`, `pointPoseFor`, `POSE_CYCLES`, `validateSprites()` |
| Poses | Chosen by moment: `MOMENT_POSE[moment]` (§10 Poses); never typed by hand |

### Palette

| Key | Hex | Token | Meaning |
|---|---|---|---|
| `.` | transparent | | Empty |
| `K` | `#0E0F0C` | `--gc-sprite-outline` | Ink outline |
| `G` | `#39D86F` | `--gc-sprite-body` | Body |
| `L` | `#9BF2B6` | `--gc-sprite-highlight` | Highlight |
| `B` | `#D6F8E0` | `--gc-sprite-belly` | Belly |
| `W` | `#FFFFFF` | `--gc-sprite-eye` | Eye white |
| `P` | `#FF9DB0` | `--gc-sprite-cheek` | Cheek |
| `D` | `#0E5E2E` | `--gc-sprite-mouth` | Open mouth (speaking) |

- On dark grounds the ink outline merges with `night`; the body still reads at 9.9:1. At 1–3× on dark, seat the sprite on a `surface-2` well.
- Never recolor the body (the `palette` prop is for special plates, not themes).

### Poses and moments (v0.3)

- 31 poses (wave, listening, reading, success, confused, sleeping, offline, cling, clingSide, pointRight, pointDownRight, walk, celebrate, plus blink frames).
- Surfaces never pick a pose by hand: `MOMENT_POSE[moment]` (`src/brand/mascot/moments.ts`); `T.moments[moment]` is the word beside it; `pointPoseFor()` picks the pointing direction.
- Offline, confused and listening carry small props: 3× or larger.
- Frames, timing and scale notes: **`docs/brand/mascot-poses.md`**.

### Sprite map (pointing, faces right)

- Source: `src/brand/mascot/sprites.ts`. Rows 14 and 24 changed in v0.3 (outline closed; `validateSprites()` checks it).

```
......KKKK..KKKK......
.....KWWWWKKWWWWK.....
.....KWKKWKKWKKWK.....
.....KWKKWKKWKKWK.....
....KGWWWWGGWWWWGK....
...KGGGGGGGGGGGGGGK...
...KGLGGGGGGGGGGPGK...
...KGGKGGGGGGGGKGGK...
...KGGGKKKKKKKKGGGK...
....KGGGGGGGGGGGGK..KK
.....KKGGGGGGGGKK..KGK
......KGGGGGGGGK..KGK.
......KGBBBBGGGK.KGK..
......KGBBBBGGGGKGK...
.....KGGBBBBGGGGKK....
....KGKGBBBBGGGK......
...KGK.KGBBBBGGK......
..KGGK.KGBBBBGGK......
..KKK..KGBBBBGGK......
.......KGGBBBGGK......
.KK....KGGGGGGGK......
KGK...KGGGGGGGGGK.....
KGK..KGGGGGGGGGGK.....
KGGKKGGGGGGGGGGK......
.KKKKKKGGKKKKGGK......
......KGGGK.KGGGK.....
......KKKKK.KKKKK.....
```

### Pose overrides (replace rows by 0-based index)

- **Thinking** (eyes up-left, flat mouth): row 2 → `.....KKKWWKKKKWWK.....`, row 3 → `.....KWWWWKKWWWWK.....`, row 7 → `...KGGGGGGGGGGGGGGK...`, row 8 → `...KGGGGKKKKKGGGGGK...`
- **Speaking** (open mouth): row 8 → `...KGGGKDDDDDDKGGGK...`, row 9 → `....KGGGKKKKKKGGGK..KK`
- **Facing left:** reverse every row string.
- **Head mark / app icon:** rows 0–10, on an `ink` tile (dark icon) or `paper` tile with a `line` border (light), radius 22 at 96px. Logo files and rules: §10.1.
### States

- States are moments: `MOMENT_POSE` maps idle → `sleeping`, listening → `listening`, thinking → `thinking`, processing → `reading`, screenHelp → `pointing`, speaking → `speaking`, ready → `success`, failed → `confused`, offline → `offline`, empty → `cling`, moving → `walk1`, endCard → `celebrate`. Loops: `speakLoop`, `thinkingLoop`, `idleLoop`, `frameLoop(setPose, POSE_CYCLES.*)`. Timing: `docs/brand/mascot-poses.md`.

### Rendering rules

- Integer scales only: 1× (menu bar), 2× (overlay pointer), 3× (inline in UI), 6× (cards, empty states), 8× (onboarding), 12–16× (hero, video). Never fractional, never CSS `scale(1.5)`.
- `image-rendering: pixelated` (`pixelated` utility); canvas `imageSmoothingEnabled = false`. For the overlay, draw once to an offscreen canvas at 1px per cell, then blit scaled.
- Don't: recolor outside the green family, add a gradient/shine/shadow to it, cover the target, animate while the user types, show more than one GetcKo per screen, rotate it (flip only), or redraw it with an image model.

### 10.1 Logo, lockup and app icon

| Asset | File | Rule |
|---|---|---|
| Head mark | `public/brand/logo/headmark.svg` | Sprite rows 0–10, pointing-arm stub removed, cropped to the head (16 × 11 cells) |
| Lockup | `public/brand/logo/wordmark-light.svg`, `wordmark-dark.svg`; `Wordmark` in the app | Head mark + "GetcKo" in Bricolage 800, cap height ≈ head height, 4-cell gap |
| Tiles | `headmark-ink-tile.svg` (dark), `headmark-paper-tile.svg` (light, `line` border) | Radius 22 at 96 (23%), mark at a whole scale ≈ 62% of the tile |
| Favicon | `public/brand/favicon.svg` | Ink tile, 24-cell grid |
| App icon | `docs/brand/app-icon-1024.png` | Ink tile on the macOS grid: 824 tile centered in a transparent 1024 canvas |
| Generator | `node --experimental-strip-types scripts/brand/app-icon.mjs` | Reads `sprites.ts`; never redraw the mark by hand |

| Rule | Value |
|---|---|
| Clearspace | 4 head-mark cells on every side (1 cell = head mark width / 16) |
| Minimum size | Head mark 24px wide; below that use the favicon tile |
| Grounds | Light: `headmark.svg` or the paper tile. Dark: the ink tile or `wordmark-dark.svg` |
| Never | Recolor, outline, rotate, stretch, add shadow or glow, put on a busy texture, add the arm back |

**Hand-off (src-tauri owner):** run `npx tauri icon docs/brand/app-icon-1024.png`, set `productName` and the window title to `GetcKo`, and add `<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">` to `index.html` and `overlay.html`.

---


## 11. Voice and copy

| | |
|---|---|
| Strings | `src/brand/lexicon.ts`: `T` (UI chrome, English), `say.en` / `say.tl` (GetcKo's lines), `linesFor(language)`, `latencyLine`, `sourceLabel`, `statusLabel`, `MEASURED`, `fmt*`. Never hardcode visible text |
| Vocabulary | **`docs/brand/lexicon.md`**: assistant/copilot → desktop helper or agent, library → knowledge base, response → answer, citation → source, Retry → Try again, Send → Ask, Upload → Add documents, push to talk → Hold to talk, read aloud → Answer out loud, hotkey → shortcut, local → on this Mac |
| Category | "A private, offline desktop helper." |
| Tone | A patient officemate who already knows the system. Friendly, short, specific |
| Tagline | "Now you get it." Product line: "Help that sits right next to your cursor." |
| Answer order | Action → reason → source. "Ilagay mo sa cell D7. Doon kinukuha ang final grade. (Manual, p. 4)" |
| Case, marks | Sentence case. No emoji. No "!" except "Ready ka na!" once at onboarding finish |
| Privacy line | **"Nothing leaves this Mac."** (Windows: "this PC"). One wording only |
| Unsure | "Hindi ko alam. Wala ito sa mga document mo." Never invent a source |
| Keywords | Beside · Pointing · On this Mac · Honest · Patient · Pinoy · Pixel-plain (`T.keywords`) |

### 11.1 Show, don't tell

| Element | Limit | Longer becomes |
|---|---|---|
| Headline | ≤ 6 words | Cut; let the visual carry the rest |
| Body, app | ≤ 1 line (~60 ch) | `Kw` chips (max 3 per block), `Steps` 1→2→3, a diagram, or motion |
| Body, marketing | ≤ 2 lines | Same |
| Explainer / pitch UI | No paragraphs | A worked example: question → gecko → halo → source |

Users are new to computers and hackathon judges decide in seconds. Test: hide the text; does the picture still say what happens?

### 11.2 Taglish, done right

> **English only (Oct 10):** user-facing copy and answers are English only; agents no longer have a language setting. This section is kept for reference only.

- English nouns for software things (cell, button, file, settings), Filipino for the glue and the warmth. Only when the agent language is Taglish or Filipino; UI chrome stays English.

| Situation | English | Taglish |
|---|---|---|
| Pointing answer | Click **Save** at the top right. | I-click mo ang **Save** sa taas, kanan. |
| Grounded answer | Put Juan's grade in cell D7. It's the average of the three quarters. | Ilagay mo sa cell D7 ang grade ni Juan. Average ito ng tatlong quarter. |
| Thinking status | Looking at your screen... | Tinitingnan ko ang screen mo... |
| No source | I don't know. It's not in your documents. | Hindi ko alam. Wala ito sa mga document mo. |
| Empty state | No documents yet. Add your office manual. | Wala pang document. I-add mo ang office manual ninyo. |
| Error | I can't read this PDF. It looks like a scanned image. | Hindi ko mabasa ang PDF na ito. Mukhang scanned image siya. |
| Offline proof | Works with Wi-Fi off. | Gumagana kahit naka-off ang Wi-Fi. |
| Close / tagline | Now you get it. | Gets mo na. |

Avoid: deep formal Filipino ("Pindutin ang pindutang Itago"), forced slang ("lodi", "petmalu"), and mixing within a single word except standard forms (`i-click`, `i-save`, `in-add`).

### 11.3 Numbers and data

| Data | Helper | Shape |
|---|---|---|
| Measured values | `MEASURED` (mirrors `docs/MODELS.md`) | `null` when TBD → render nothing |
| Seconds | `fmtSeconds`, `latencyLine` | `0.9 s · on this Mac` |
| Throughput | `fmtSpeed` | `42 tokens/s` |
| Sizes | `fmtBytes` | `3.6 GB` |
| Counts | `fmtCount` | `1,204 passages` |
| Dates | `fmtDate` | Short, sentence case |
| Sources | `sourceLabel` | `Manual · p. 4` |

All in `font-mono nums`. No "10x", no "up to", no unmeasured figure, no placeholder dash.

### 11.4 Words we don't use

- "AI-powered", "magic", "supercharge", "unleash", "seamless", "revolutionize", "your AI assistant", "Oops!", "Something went wrong", "Let's dive in". Full list: `docs/brand/lexicon.md` §4.

---

## 12. Platform adaptations

| | macOS | Windows 11 |
|---|---|---|
| Shortcut | `⌥ Space` | `Ctrl Space` (configurable) |
| Place words | "on this Mac", "Nothing leaves this Mac." | "on this PC", "Nothing leaves this PC." |
| Window corners | 10px, traffic lights left | 8px, caption buttons right |
| Material | Flat surface (no vibrancy behind text) | Flat surface (no Mica) |
| Screen reading | AX API (Accessibility permission) | UI Automation |
| Menu presence | Menu bar head mark (1×) | Taskbar/tray head mark |

---

## 13. Accessibility, focus and keyboard

| Check | Rule |
|---|---|
| Contrast | Text ≥ 4.5:1 (3:1 at 24px+); measured in §2.4 |
| Green text | `gecko-deep` on light, `gecko-tint` on dark; never `gecko` as text |
| Semantics | Real `<button>`, `<a href>`, `<input>` + `<label>`; icon-only buttons have `aria-label`; targets ≥ 44px |
| Focus | Visible on every control (base CSS + `focus-visible:` in primitives) |
| Halo | Never the only signal: the answer names the element ("the **Save** button") |
| Speech | Esc always stops it; no autoplay unless "Answer out loud" is on |
| Motion | Reduced motion honored everywhere (§5.5) |

| Situation | Keyboard and focus behavior |
|---|---|
| Dialog | Traps focus, Esc closes, focus returns to the opener |
| Answer card | Never steals focus from the user's app |
| Onboarding | Focus moves to the step H1 on every step change |
| Esc order | Stop speaking → close answer → close dialog (one per press) |
| Toast | `role="status"`, never focused |
| Tabs, SegmentedControl | Arrow keys move, Tab leaves |
| Hold to talk | Space or Enter held on the focused mic |
| Global | `⌥ Space` / `Ctrl Space` opens GetcKo from any app |

---

## 14. Anti-slop: DO / DON'T

| DON'T (generic AI slop) | DO (GetcKo) |
|---|---|
| Centered hero with a gradient blob or mesh background | Left-aligned hero on `footprints` + a `canopy-corner` branch (or ink), gecko pointing at a real screenshot with one sun halo |
| Paragraphs explaining the product | Show, don't tell: ≤ 6-word headline, one line, then `Kw` chips, `Steps`, a diagram or motion |
| 3-card feature grid with icons in colored circles | One worked example: the question, the gecko, the target, the cited answer |
| Glass cards, backdrop blur, frosted panels | Flat `surface` + 1px `border` + `shadow-card` at most |
| Purple/blue "AI" palette, neon glows, glowing borders | Ink, paper, one green, one yellow ring |
| Sparkles, wand, robot, brain, stars icons for "AI" | The gecko is the only AI signifier. Pixel icons from `Icon` for actions |
| Smooth line-icon packages | Pixel icons on the mascot's grid (`src/brand/icons.ts`, `docs/brand/icons.md`) |
| Icons in tinted circles or tiles, an icon on every row or heading | Icons only where they add meaning, bare, colored with a text token |
| Emoji in UI or headings | Words, and the pixel badge "Gets mo na." |
| Gradient text, gradient buttons | Solid ink type; primary button is solid `inverse` |
| Pill badges everywhere ("New", "Beta", "AI") | Chips only for real state: Ready, Processing, Failed, Offline, sources, `Kw` keywords |
| Title Case Marketing Headlines | Sentence case, plain words, Taglish where it fits |
| Typewriter streaming, bouncing dots, skeleton shimmer | Sentence-by-sentence text with speech; `thinking` / `processing` pose while waiting |
| Fake stats, fake logos, testimonials, placeholder dashes | `MEASURED` numbers in mono with "on this Mac"; missing = nothing |
| Mascot as a sticker in the corner, waving at nothing, multiple mascots | One gecko, pose from `MOMENT_POSE`, facing and pointing at the next thing |
| Smooth-scaled blurry pixel art, fractional scales | Integer scales, `pixelated` |
| Everything centered and symmetric | Left-aligned text column + asymmetric visual |
| Infinite pulsing / glowing "live" indicators | Static live dot; halo pulses twice, then holds |
| CRT scanlines, glitch, VHS "retro" filters | Clean sprite pixels; dither only as a fade |
| Dark mode = pure black + neon | `night` `#121410`, mist text, same single green |
| "AI-powered assistant to supercharge your workflow" | "Help that sits right next to your cursor." / "Gets mo na." |

**Self-check before shipping any screen:** (1) one target, one halo? (2) green under ~3%? (3) gecko faces the next thing? (4) any gradient, glow, blur, emoji, sparkle, purple? (5) every number from `MEASURED`? (6) headline ≤ 6 words, body ≤ 1 line? (7) correct in `data-theme="light"` and `"dark"`?
