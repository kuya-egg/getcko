# GetcKo image prompts (v0.2)

These are copy-paste prompts for Midjourney, Imagen, Flux and GPT-image. Use them only for things the hand-made SVGs in `public/brand/` cannot cover: scenes, social visuals, b-roll stills and icon explorations. For backgrounds, try the SVG textures and plates first, because they are exact, tiny and already on palette (`src/brand/textures.ts`, preview at `scripts/brand/preview.html`).

Generated images are references and drafts. Never ship one that redraws the GetcKo sprite. Generate the scene, then paste the real sprite on top (see Post-processing).

## The palette block (paste into every prompt)

```
Strict limited palette, flat colour only:
paper white #FFFFFF, canvas off-white #F6F7F4, hairline grey #E6E8E3, mid grey #C9CCC4,
ink near-black #0E0F0C, graphite #4A4D46, gecko green #39D86F, deep green #0F7A3D,
pale green #EAFBEF, sun yellow #FFC83D (only as one thin ring around one target).
Dark variant grounds: night #121410, night raised #191B16, night line #2E3229, mist text #F1F3EC.
```

## The negative block (paste into every prompt)

```
no gradients, no glow, no bloom, no lens flare, no bokeh, no neon, no purple, no blue-violet,
no navy, no glassmorphism, no frosted glass, no 3D render, no clay render, no octane, no isometric 3D,
no plastic shine, no drop shadows, no stock-photo people, no smiling-at-camera models,
no text, no letters, no logos, no watermarks, no UI text artifacts, no emoji, no anti-aliased pixel art,
no blurry pixels, no dithering noise in photos, no vignette, no HDR
```

For Midjourney, put the negative list in `--no`, comma separated and shortened: `--no gradient, glow, purple, neon, 3d render, glass, text, letters, logo, watermark, stock photo people, blur, vignette`.

## Pixel-art constraints (paste whenever the image is pixel art)

```
True pixel art on an integer grid: every pixel is a hard-edged square of one flat colour,
no anti-aliasing, no sub-pixel blending, no soft edges, max 8 colours from the palette,
1-pixel near-black #0E0F0C outlines, nearest-neighbour upscale only, crisp blocky edges.
Shading only through solid colour steps or ordered (Bayer) checkerboard dither, never gradients.
```

The mascot reference: GetcKo is a small, upright, front-facing pixel gecko on a 22 x 27 grid. It is gecko green #39D86F with highlight #9BF2B6, pale belly #D6F8E0, big white square eyes with near-black pupils, tiny pink cheek #FF9DB0, ink outline #0E0F0C, a curled tail at the lower left, and one hand raised up-right, pointing. It points and never clicks. Only one GetcKo appears per image.

---

## 1. Background plates

Use these when you need texture variety beyond the SVG plates, for example social or slides. Leave the left 45% empty for a title.

### 1a. Light plate, pixel grid

```
Minimal flat background plate, 16:9, pure white #FFFFFF ground with a very faint square pixel grid
of 1px hairlines in #E6E8E3 every 8 pixels, a stepped band of ordered Bayer dither in #E6E8E3 along the
bottom edge growing denser in 4 hard steps, a large cropped pixel-art gecko silhouette in pale grey
#E6E8E3 bleeding off the right edge, left half empty negative space. Editorial, Swiss, calm, quiet.
[palette block] [pixel-art constraints] [negative block]
```
Midjourney: `--ar 16:9 --style raw --stylize 50`

### 1b. Dark plate, coordinate field

```
Minimal flat background plate, 16:9, deep green-black #121410 ground, a sparse field of tiny 2px square
dots in #474C41 on a 24px lattice, small thin crosshair marks every fourth dot, one thin square bracket
target shape in mist #F1F3EC to the right of centre, a stepped Bayer-dither floor band in #2E3229 along
the bottom. Precise, technical, nocturnal, quiet, like a survey map.
[palette block] [pixel-art constraints] [negative block]
```
Midjourney: `--ar 16:9 --style raw --stylize 50`

### 1c. Gecko-scale texture (square, tileable)

```
Seamless tileable pattern, 1:1, flat pixel-art hexagonal gecko scales drawn as 1px outlines in #E6E8E3
on white #FFFFFF, roughly one in seven scales filled pale green #EAFBEF, perfectly even staggered lattice,
no perspective, no shading. [pixel-art constraints] [negative block]
```
Dark variant: change ground to `#121410`, outlines to `#2E3229`, fills to `#15301E`. Midjourney: `--tile --ar 1:1 --style raw`

---

## 2. Pixel-art GetcKo in scenes

Treat these as scene drafts. Generate the scene with an empty spot where GetcKo stands, then composite the real sprite (`docs/getcko-design-system.md` section 6) at an integer scale. If you let the model draw the gecko, use it only as a mood reference.

### 2a. LGU office

```
Pixel-art scene, 16:9, a Philippine municipal government (LGU) office desk at daytime: a laptop showing a
simple white spreadsheet window, stacked manila folders, a rubber stamp, a small electric fan, a wall
calendar, capiz-shell window light rendered as flat pale blocks. Flat white and off-white walls #F6F7F4,
ink outlines. On the laptop screen one button has a thin sun-yellow #FFC83D ring. To the left of the laptop
a small upright green pixel gecko stands, one hand raised pointing at the ringed button, not touching it.
Lots of clean white space, calm, orderly, respectful. Side view, slightly elevated, flat orthographic.
[palette block] [pixel-art constraints] [negative block] no people's faces
```
Midjourney: `--ar 16:9 --style raw --stylize 75`

### 2b. Public school classroom

```
Pixel-art scene, 16:9, a Filipino public school classroom after class: wooden teacher's desk with a laptop,
a stack of test papers, a green chalkboard rendered as one flat deep green #0F7A3D block with no writing,
monobloc chairs, flat afternoon light as hard-edged pale blocks on the floor. On the laptop, a single menu
item wears a thin sun-yellow #FFC83D ring. A small upright green pixel gecko stands on the desk beside the
laptop, pointing up-right at the ring. Calm, warm, unhurried, lots of white space.
[palette block] [pixel-art constraints] [negative block] no people, no readable writing
```

### 2c. Offline laptop, airplane mode

```
Pixel-art still life, 4:5, a closed-network laptop on a plain white desk, the screen shows a minimal white
app window and a small flat airplane-mode icon in the corner, a disconnected ethernet cable coiled beside it
drawn with hard pixel edges, a small upright green pixel gecko sitting on the laptop's palm rest, pointing
at the airplane icon. Communicates "works fully offline, private". Centred, generous margins, flat.
[palette block] [pixel-art constraints] [negative block] no wifi waves, no cloud icons
```
Dark variant: `night ground #121410, laptop body #21241E, screen #191B16, mist #F1F3EC outlines, a 1-pixel mist rim around the gecko`.

---

## 3. Social post visuals

Text is always added afterwards in Figma or Canva, in Bricolage Grotesque or Geist and sentence case. Never let the model render text.

### 3a. Announcement square

```
Flat graphic, 1:1, white #FFFFFF ground with faint 8px pixel grid hairlines #E6E8E3, a large pale-green
#EAFBEF square block occupying the lower right third with a stepped Bayer-dither edge, a small green pixel
gecko standing on the block pointing up-right toward empty space at the top left reserved for a headline.
Bold, simple, poster-like, Swiss layout. [palette block] [pixel-art constraints] [negative block]
```
Midjourney: `--ar 1:1 --style raw`

### 3b. Before/after carousel slide

```
Flat graphic, 4:5, split into two equal vertical panels separated by a 2px #0E0F0C line. Left panel: a
cluttered grey #C9CCC4 software toolbar of many identical small blank buttons. Right panel: the same toolbar
on white with exactly one button ringed in thin sun-yellow #FFC83D and a small green pixel gecko beside it
pointing at it. Clear contrast between confusion and clarity. [palette block] [pixel-art constraints] [negative block]
```
Midjourney: `--ar 4:5 --style raw`

### 3c. Story / reel cover, dark

```
Flat graphic, 9:16, night ground #121410, a vertical column of 24px dot-grid #474C41, one large mist #F1F3EC
square bracket target in the upper third, a green pixel gecko with a 1-pixel mist rim in the lower third
pointing up at the bracket, a stepped dither floor in #2E3229. Empty space at the top for a title.
[palette block] [pixel-art constraints] [negative block]
```
Midjourney: `--ar 9:16 --style raw`

---

## 4. Video b-roll stills

These go between screen recordings in the demo video. Keep them at 1920 x 1080 and shoot them flat. A slow 1.0 to 1.04 punch-in in the edit is the only motion they need.

### 4a. Hands on keyboard, no faces

```
Documentary still, 16:9, overhead flat-lay of hands typing on a plain laptop keyboard on a white desk,
soft even daylight, no visible face, plain sleeves in white or graphite, a printed government form beside
the laptop with blurred-out unreadable lines, muted natural colour, lots of white desk space on the left.
Colour grade: neutral whites, low saturation, ink-black shadows, a single green accent object (a mug or
sticky note in #39D86F). [negative block, but allow photography] no stock-photo smiles, no logos on devices
```
Midjourney: `--ar 16:9 --style raw --stylize 30`

### 4b. Empty desk, night (for the dark section)

```
Documentary still, 16:9, a quiet office desk at night lit only by a laptop screen, deep green-black
shadows close to #121410, the screen a flat white rectangle, one small green #39D86F sticky note, no people,
no city lights, no neon, calm and private. [negative block, but allow photography]
```

### 4c. Pixel transition card

```
Flat pixel-art frame, 16:9, solid white #FFFFFF, a single row of ordered-dither blocks in #E6E8E3 sweeping
across the middle in 6 hard density steps from empty to solid, nothing else. [pixel-art constraints] [negative block]
```
You can usually build this one in code instead with `TEXTURES["dither-fade"]` and GSAP `steps()`.

---

## 5. App icon explorations

The real icon is the sprite head (rows 0 to 10) on a 96px tile with radius 22. Use these prompts only to explore framing, then rebuild the winner from the sprite grid.

```
App icon, 1:1, rounded-square tile, flat near-black #0E0F0C tile, a front-facing pixel-art gecko head in
gecko green #39D86F with big square white eyes and near-black pupils, 1-pixel ink outline, a single pale
#9BF2B6 highlight pixel, a tiny pink #FF9DB0 cheek pixel, centred with 18% padding, crisp at 16px.
[pixel-art constraints] [negative block] no gradient tile, no glossy bevel, no shadow under the head
```

The variants to explore:
- **Light tile:** `white #FFFFFF tile with a 1px #E6E8E3 border`.
- **Pointing:** `the gecko's small hand raised beside the head, pointing up-right`.
- **Target:** `a thin sun-yellow #FFC83D square ring in the top right corner of the tile, the gecko looking at it`.
- **Monochrome:** `single colour, ink #0E0F0C pixels only on white, for print and favicon`.

Midjourney: `--ar 1:1 --style raw --stylize 25`. Reject anything with smooth curves.

---

## 6. Post-processing to fit the palette

Every generated image goes through these steps before it is used.

1. **Upscale pixel art correctly.** Downscale to the true pixel grid first, so each art pixel is 1 px (find the block size by measuring one outline pixel). Then upscale by a whole number with nearest neighbour.
   - ImageMagick: `magick in.png -filter point -resize 12.5% -filter point -resize 800% out.png`
   - Photoshop: Image Size, Resample "Nearest Neighbor (hard edges)".
2. **Snap to the palette.** Remap every pixel to the brand colours with dithering turned off.
   - ImageMagick: make `palette.png`, one pixel per hex (`#FFFFFF #F6F7F4 #E6E8E3 #C9CCC4 #0E0F0C #4A4D46 #39D86F #0F7A3D #EAFBEF #9BF2B6 #D6F8E0 #FF9DB0 #FFC83D`, and add `#121410 #191B16 #21241E #2E3229 #474C41 #F1F3EC` for dark). Then run `magick in.png -dither None -remap palette.png out.png`.
   - If you need tone, use `-ordered-dither o4x4` before the remap. That gives Bayer, which matches the SVG textures. Never use Floyd-Steinberg, because it reads as noise.
3. **Check for banned colours.** After the remap there should be no purple, blue or teal left. If the model sneaked in a gradient sky or glow, crop it out or repaint it flat. Do not "fix" it with a blur.
4. **Replace the gecko.** Delete any model-drawn gecko and paste the real sprite at an integer scale (2, 3, 6, 12 or 16), positioned beside the target and never covering it. On dark grounds, give it the 1-cell mist `#F1F3EC` rim used in the dark plates.
5. **One sun ring at most.** If the image has a target, it gets exactly one `#FFC83D` ring, 3 px at 1x (6 to 8 px at 1080p). Remove any other yellow.
6. **Photos (b-roll).** Pull saturation down 20 to 30%, set white balance neutral (paper should read `#F6F7F4` to `#FFFFFF`), lift blacks only to `#0E0F0C` and keep one green accent object at most. Add no grain in the grade; if you need texture, overlay `grain-light.svg` or `grain-dark.svg` at 100%.
7. **Export.** Save stills as PNG for pixel art (never JPEG, which smears the edges) and as JPEG quality 85 for photos. Video stills are 1920 x 1080. Social sizes are 1080 x 1080, 1080 x 1350 and 1080 x 1920. Name them `gc-<use>-<theme>-<n>.png`.
8. **Run the final check.** Ask: does it look like it came from the same hand as `scripts/brand/preview.html`? If it looks like generic AI art, fall back to an SVG plate plus a screen recording.
