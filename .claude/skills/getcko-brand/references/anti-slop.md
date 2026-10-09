# Anti-slop: DO / DON'T

Spec: `docs/getcko-design-system.md` §14. GetcKo must look like one specific product made by people. If a screen could belong to any AI startup, it is wrong.

| DON'T | DO instead |
|---|---|
| Plain white page, section after section of flat paper (the #1 slop tell since v0.3) | Every section wears one `<Surface>` texture from the gecko's world; content on solid cards on top (`docs/brand/textures.md`) |
| Grey-noise textures on light: `lamellae`, `skin`, `weave`, `dither-*` as full light sections; the `hero` ghost plate on light | Light: `footprints`, `canopy*`, `pointer`, `how`, `footer`. Weave/skin only as narrow bands or in `tone="ink"` |
| Centered hero with gradient blob / mesh / aurora background | Left-aligned hero: `footprints` + a `canopy-corner` branch (or an ink hero); gecko pointing at a real screenshot with one sun halo |
| Paragraphs explaining the product, a headline that runs two lines, body copy that wraps three times | **Show, don't tell**: headline ≤ 6 words, body ≤ 1 line in app / 2 in marketing; the rest becomes `Kw` chips (max 3), `Steps` 1→2→3, a diagram or motion |
| 3-card feature grid with icons in colored circles | One worked example per feature: the real question, the gecko, the target, the cited answer. Alternating text + screenshot rows |
| Glass cards, backdrop blur, frosted overlays | `bg-surface border border-border`, `shadow-card` or `shadow-overlay` at most |
| Purple / blue "AI" palette, neon glows, glowing borders | Ink, paper (night, mist), one green, one yellow ring |
| Sparkles, wand, stars, robot, brain, lightning, rocket icons | The gecko is the only AI signifier. Pixel icons from `Icon` for actions only |
| Emoji anywhere in UI, headings, buttons | Words; the Silkscreen badge "Gets mo na." beside the mascot |
| Gradient text, gradient buttons, shiny hover sweeps | Solid ink type; solid `bg-inverse` primary; 140ms color/opacity hover |
| Badge soup ("New", "Beta", "AI", "Pro") | Chips only for real state: Ready, Processing, Failed, Offline, citations |
| Title Case Marketing Headlines | Sentence case, plain words, Taglish where it fits |
| Typewriter per-letter text, bouncing three-dot loader, skeleton shimmer | Sentence-by-sentence text with TTS; `thinking` / `processing` pose + its line while waiting |
| "10x faster", "99% accurate", fake logos, testimonials, avatars, a "—" where a number is missing | `MEASURED` values in mono with "on this Mac"; `<Stat value={null}>` renders nothing |
| Mascot as a corner sticker, waving at nothing, multiple mascots, mascot with no target, a pose picked by hand | One gecko facing and pointing at the next thing, 12px beside it |
| Blurry, smoothed or fractional-scaled pixel art; sprite redrawn in 3D or by an image model | Integer scales, `pixelated`, the real sprite from `src/brand/mascot` |
| Everything centered and symmetric | Text column + asymmetric visual; eye path ask → gecko → target → source |
| Infinite pulsing / glowing indicators | Static live dot; halo pulses twice, then holds |
| CRT scanlines, glitch, VHS, chromatic aberration "retro" | Clean sprite pixels on clean paper; dither only as a fade |
| Dark mode = `#000` + neon green | `night` `#121410`, mist text, same single green, `gecko-tint` for green text |
| Stock photos of smiling diverse teams at computers, holograms, circuit brains | Real software on real screens; Filipino context through content (DepEd grade sheet, barangay form) |
| Giant rounded "bento" dashboards of fake metrics | Calm lists and rows; real status chips |
| Off-lexicon words: assistant, library, response, citation, Retry, Send, Upload, hotkey, local | Canonical terms from `T` / `say` (`references/lexicon.md`) |
| Two concepts sharing one icon, icons imported straight from an icon package | `Icon.<concept>` from `src/brand/icons.ts`, one icon per concept |
| Smooth line-icon packages (the npm defaults) = slop for GetcKo: they clash with the pixel gecko and are the default look of generated apps | The pixel set in `src/brand/icons.ts`: 24 grid, 2-unit strokes, crisp edges, same cell as the mascot at 2x (`docs/brand/icons.md`) |
| Icons in tinted circles or tinted tiles, an icon on every list row, a decorative icon beside every heading | Bare icons only where they add meaning (action, status, file type, source), colored with a text token |
| "Your AI-powered assistant to supercharge productivity" | "Help that sits right next to your cursor." / "Gets mo na." |
| Auto-doing things for the user ("Fix it for me") | It points, never clicks |

## Quick smell test

1. Squint: is there exactly one yellow thing, and is the gecko looking at it?
2. Count colors: ink, paper/night, green (small), yellow (one). Anything else? Remove it.
3. Squint again: does every section have a texture, and does any light section read as grey noise?
4. Search the JSX for `gradient`, `blur`, `backdrop`, `shadow-[0_0`, `rounded-[`, `text-[`, `lg:`, `purple`, `violet`, `indigo`, `Sparkles`, `Wand`, emoji. Should be zero hits.
5. Count words: any headline over 6, any body over 1 line (app)? Turn it into chips, steps or a picture.
6. Read every heading aloud. Would a teacher in a DepEd office say it? If it sounds like a pitch deck, rewrite.
