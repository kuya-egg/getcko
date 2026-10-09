# GetcKo textures v2: the gecko's world

The old rule "calm white everywhere" is retired. GetcKo's pages are now built from **textured sections**: each band of a page wears one texture from the gecko's world, and the content on it (cards, inputs, answers) stays flat and readable. Textures give the design life; content cards keep it usable.

Contact sheets (every texture × intensity, with real type on top): `docs/brand/textures-light.png`, `docs/brand/textures-dark.png`.

## Wiring (one time)

```css
/* src/brand/index.css, after theme.css */
@import "./surfaces.css";
```

```ts
// src/components/ui/index.ts
export { Surface } from "./Surface";
export type { SurfaceProps } from "./Surface";
```

## Use

```tsx
<Surface texture="footprints" intensity="standard" tone="canvas" className="px-16 py-12">
  <h2 className="text-h1 font-display">Gets mo na.</h2>
  <Panel>…content on a card…</Panel>
</Surface>
```

Or plain classes: `<section class="surface surface-weave surface--bold surface--green">`.

| Prop / class | Values | Default |
|---|---|---|
| `texture` / `.surface-<name>` | `footprints` `lamellae` `skin` (`scales` alias) `canopy` `canopy-bottom` `canopy-corner` `pointer` `weave` `dither-lo` `dither-mid` `dither-hi` `dither-fade` `hero` `how` `footer`, or `none` | `footprints` |
| `intensity` / `.surface--<i>` | `subtle` `standard` `bold` | `standard` |
| `tone` / `.surface--<tone>` | `canvas` (canvas / night) · `paper` (paper / night-1) · `green` (gecko-wash / gecko-night) · `ink` (ink in both themes) | `canvas` |
| `mode` / `.surface--light` `.surface--dark` | `auto` follows `<html data-theme>` and the OS; force for video frames and plates | `auto` |
| `as` | `section` `div` `header` `footer` `aside` `article` `main` | `section` |

`tone="ink"` and `mode="dark"` make a **dark island**: they re-scope the semantic tokens, so `text-text`, `text-text-2`, `bg-surface`, `border-border` inside read as the dark theme even on a light page.

Data: `TEXTURES[id].intensities[intensity][mode]`, `textureUrl(id, mode, intensity)`, `textureStyle(id, mode, intensity)`, `SURFACE_TEXTURES` in `src/brand/textures.ts`. v1 names (`grid-cell`, `crosshair`, `grain`, `watermark-*`, `scales`, `dither-*`, `.gc-tex-*`) keep working.

## The library

| Texture | What it is, what it means | Where it goes |
|---|---|---|
| `footprints` (signature) | Two geckos crossing a wall: pixel 5-toe prints, round sticky pads in green, one trail climbing up-right, a fainter one heading down-left. **GetcKo was here; it walked to the answer.** | Onboarding, empty states, about, the marketing "how it points" section, splash. The default when you need life. |
| `lamellae` | The ridged underside of gecko toes: staggered columns of curved sticky ridges, each capped by a round pad. **Grip, it holds on to your context.** | Narrow bands (96–200px), dividers between sections, side rails, the settings header. Dense: keep body copy off it at `bold`. |
| `skin` | Granules plus raised tubercles with lit cells and a few green pigment spots. **The creature itself, up close.** | Brand moments: about, splash, social cards, the back of a chapter card. |
| `canopy` / `canopy-bottom` | A pothos vine with hanging (or rising) heart leaves, front leaves solid, back leaves dithered. **The gecko's habitat, the Filipino home it lives in.** | Section top or bottom edges; repeat-x band 192px tall. Pair a top canopy with a section whose content starts ≥ 120px down. |
| `canopy-corner` | One branch entering the top-right corner. | Hero corners and splash when the gecko plate is not used (e.g. a hero with a real screenshot on the left). |
| `pointer` | Pixel arrow cursors aimed at bracketed targets on a coordinate dot field. **It points.** | Screen Help explainers, "how it points" sections, the permissions step of onboarding. |
| `weave` | Banig: pandan-strip plain weave (strip ends shaded where they dive under) with a dyed nested diamond. **Made here; a Filipino mat in brand greens.** | Section bands for Taglish/language, community, "built in the Philippines", testimonials-free about blocks. A band texture: 160–320px tall, not a full page. |
| `dither-lo` / `-mid` / `-hi` | Flat Bayer tone, 2/16, 4/16, 8/16. | Wells, side panels, video lower thirds, quiet bands between loud ones. |
| `dither-fade` | Stepped dither, 0 → 10/16 bottom-up. The no-gradient fade. | Section bottoms, footers, video ground. |
| `hero` | Composed plate (1040×560, anchored right bottom): a giant ghost GetcKo (dithered body, green belly) standing in pothos, its own trail walking in from the left. | Marketing hero, README hero, splash. Text goes top-left; needs ≥ 560px height and ≥ 1100px width to show whole. |
| `how` | Repeat-x band: ruler edges top and bottom, prints walking left to right, a bracketed stop every 640px. | "How it works" steps: put the 3 steps along the band; the stop bracket marks "here". |
| `footer` | Repeat-x band: dither ground rising, pothos growing up out of it. | Page footer, end cards. |

Skipped on purpose: a "bug dot" scatter. At pixel scale a fly reads as dirt on the screen, not as charm, and it fights the pointer motif.

## Intensity

| Level | Use it for |
|---|---|
| `subtle` | Behind dense content and working screens' wells. You notice it on the second look. |
| `standard` | The default for marketing and onboarding sections. Clearly there, never louder than the headline. |
| `bold` | One section per page at most: the hero or a single brand band. Bands and edges, not long reading. |

Rhythm: alternate loud and quiet sections (e.g. hero `bold` → features `subtle` → weave band `standard` → footer `standard`). Never put two `bold` sections next to each other. One texture per section; layers come only from the generated recipes (`hero`).

Working app screens (agent editor, knowledge bases, overlay answer card, session bar) stay flat; they can use `dither-lo` wells or a `subtle` band in a header. Never texture the overlay or anything near the target halo.

## Text contrast (measured)

Marks are alpha-composited token colours (ink on light, mist on dark, gecko / gecko-deep for green), so the worst-case pixel under a letter is known. `node scripts/brand/contrast-check.mjs` checks every key × tone × intensity:

- **Headings, `text` and `text-2` pass 4.5:1 on every mark, every tone, every intensity.** Put them straight on the texture.
- `text-3` (captions) and `text-accent-text` (links, citations) drop below 4.5:1 on the strongest marks. Put them on a **content card** (`bg-surface border border-border rounded-panel`, i.e. `Panel`), never directly on a texture.
- Dark `green` tone at `bold` is capped to `standard` in the CSS (bold marks on gecko-night would take `text-2` under 4.5:1).
- Body copy longer than 2 lines, inputs, tables, code: on a card.

## Do / don't

Do
- Pick the texture by meaning (table above), not by looks.
- Keep headings left-aligned over the texture and let the motif breathe in the remaining space; the `hero` plate is composed for text top-left.
- Use `tone="ink"` for one dark band on a light page (it flips the tokens inside for you).
- Regenerate instead of editing: `node scripts/brand/generate.mjs .` (art lives in `scripts/brand/texture-lib.mjs`).

Don't
- Don't use sun yellow in any texture. It belongs to the target halo only.
- Don't scale tiles by non-integers or add `opacity` / filters to them: intensity is baked, colour comes from tokens.
- Don't stack two textures or put a texture inside a card.
- Don't tint textures with custom colours, gradients, glows or blur.
- Don't put the gecko sprite on top of the `hero` plate (one gecko per screen: the plate *is* the gecko).

## Files and tools

| Path | What |
|---|---|
| `scripts/brand/texture-lib.mjs` | All texture art (pixel grids), alpha table per intensity, surface recipes, CSS generator |
| `scripts/brand/generate.mjs` | Writes `public/brand/textures/*`, `public/brand/sections/*`, `public/brand/plates/*`, `src/brand/surfaces.css` |
| `scripts/brand/contrast-check.mjs` | Worst-case text contrast table; exits 1 if `text`/`text-2` fail |
| `scripts/brand/build-sheet.mjs` + `shoot-sheet.mjs` | Build `scripts/brand/textures-sheet.html` (`?theme=dark`, `&rows=footprints,skin`) and screenshot it to `docs/brand/textures-*.png` |
| `public/brand/{textures,sections}/<id>-<light|dark>[-subtle|-bold].svg` | Standard has no suffix. All tiles < 25KB |
