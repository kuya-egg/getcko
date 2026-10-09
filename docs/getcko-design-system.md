# GetCko Design System (v0.1)

> Source of truth for agents building GetCko's UI (Tauri 2 + React + Tailwind, macOS first, Windows second).
> Canvas: "GetCko Design System" (Claude Design artifact). When this file and the canvas disagree, this file wins for code.

## 1. Principles

1. **White space first.** Calm white ground and ink type. The user's own screen stays the hero; GetCko never competes with it.
2. **One green, on purpose.** Gecko green marks the helper (mascot, live dot). **Sun yellow marks the target** GetCko points at. Nothing else is colorful.
3. **It points, never clicks.** GetCko shows the way and explains; the user stays in control. Never auto-click or auto-type.
4. **Native on both.** It should feel at home on macOS and Windows 11. Use flat white instead of vibrancy or Mica.
5. **Local and honest.** Show "Offline" and real measured latency. Never fake numbers.

## 2. Color tokens

| Token | Hex | Use | Rules |
|---|---|---|---|
| `paper` | `#FFFFFF` | Every surface | Default background |
| `canvas` | `#F6F7F4` | Wells, hover, secondary panels | |
| `line` | `#E6E8E3` | Borders, dividers | 1px |
| `line-strong` | `#C9CCC4` | Input borders, keycap edges | |
| `ink` | `#0E0F0C` | Text, primary button, chat bubble, session bar | |
| `ink-2` | `#4A4D46` | Secondary text | |
| `ink-3` | `#73776E` | Captions only | 4.5:1 on white; never lighter |
| `gecko` | `#39D86F` | Mascot, live dot, icon-button fill | **Fills only. Never text on white** (fails contrast) |
| `gecko-deep` | `#0F7A3D` | Links, citations, green text, focus border | |
| `gecko-wash` | `#EAFBEF` | Success/Ready chips, tints, focus outline | |
| `sun` | `#FFC83D` | **Target halo only** (the element GetCko points at) | Never decorative |
| `alert` | `#B3321D` on `#FDECEA` | Errors, Failed status | |

There are no gradients, glows or gradient washes. Dark surfaces are `ink` only: the session bar, chat bubbles and the app icon.

```css
:root {
  --gc-paper:#FFFFFF; --gc-canvas:#F6F7F4; --gc-line:#E6E8E3; --gc-line-strong:#C9CCC4;
  --gc-ink:#0E0F0C; --gc-ink-2:#4A4D46; --gc-ink-3:#73776E;
  --gc-gecko:#39D86F; --gc-gecko-deep:#0F7A3D; --gc-gecko-wash:#EAFBEF;
  --gc-sun:#FFC83D; --gc-alert:#B3321D; --gc-alert-wash:#FDECEA;
  --gc-font-display:'Bricolage Grotesque', system-ui, sans-serif;
  --gc-font-ui:'Geist', system-ui, sans-serif;
  --gc-font-mono:'Geist Mono', ui-monospace, monospace;
  --gc-font-pixel:'Silkscreen', ui-monospace, monospace;
  --gc-r-input:8px; --gc-r-button:14px; --gc-r-panel:20px; --gc-r-pill:999px;
  --gc-shadow-1:0 1px 2px rgba(14,15,12,.06), 0 4px 12px rgba(14,15,12,.06);
  --gc-shadow-2:0 2px 4px rgba(14,15,12,.06), 0 16px 40px rgba(14,15,12,.12);
  --gc-halo:0 0 0 3px var(--gc-sun);
}
```

### Tailwind (`theme.extend`)

```js
colors: {
  paper:'#FFFFFF', canvas:'#F6F7F4', line:'#E6E8E3', 'line-strong':'#C9CCC4',
  ink:{ DEFAULT:'#0E0F0C', 2:'#4A4D46', 3:'#73776E' },
  gecko:{ DEFAULT:'#39D86F', deep:'#0F7A3D', wash:'#EAFBEF' },
  sun:'#FFC83D', alert:{ DEFAULT:'#B3321D', wash:'#FDECEA' },
},
fontFamily: {
  display:['"Bricolage Grotesque"','system-ui','sans-serif'],
  sans:['Geist','system-ui','sans-serif'],
  mono:['"Geist Mono"','ui-monospace','monospace'],
  pixel:['Silkscreen','ui-monospace','monospace'],
},
borderRadius: { input:'8px', button:'14px', panel:'20px' },
boxShadow: {
  card:'0 1px 2px rgba(14,15,12,.06), 0 4px 12px rgba(14,15,12,.06)',
  overlay:'0 2px 4px rgba(14,15,12,.06), 0 16px 40px rgba(14,15,12,.12)',
  halo:'0 0 0 3px #FFC83D',
},
```

## 3. Typography

Fonts come from Google Fonts: Bricolage Grotesque (500/700/800), Geist (400/500/600), Geist Mono (500), Silkscreen (400/700). **Bundle them locally in the app** so they work offline. Do not use Inter, Roboto or Arial.

| Style | Font | Size/line | Weight | Tracking | Use |
|---|---|---|---|---|---|
| Display | Bricolage Grotesque | 64/64 (hero 84/82) | 800 | -0.035em | Marketing and onboarding only |
| H1 | Bricolage Grotesque | 36/40 | 700 | -0.02em | Page titles |
| H2 | Bricolage Grotesque | 24/30 | 700 | 0 | Section and card titles |
| Body | Geist | 16/24 | 400 | 0 | Answers, settings |
| Label | Geist | 14/20 | 500 | 0 | Buttons, tabs, chips |
| Eyebrow | Geist | 13/16 | 600 | 0.08em, UPPERCASE | Section labels (`ink-2`) |
| Caption | Geist | 12/16 | 400 | 0 | Sources, timestamps (`ink-3`) |
| Keys | Geist Mono | 13 | 500 | 0 | Shortcuts, measured numbers |
| Pixel | Silkscreen | 22 | 400 | 0 | Mascot badge ("Gets mo na.") only |

## 4. Spacing, radius, elevation

- **Spacing:** 4px base, using the scale 4, 8, 12, 16, 24, 32, 48, 64. Lay out with flex or grid plus `gap`.
- **Radius:** 8 for inputs, 14 for buttons, 20 for panels and cards, pill for chips. Window chrome follows the OS: 10 on macOS, 8 on Windows.
- **Elevation:** 0 = 1px `line` border; 1 = `shadow-1` (cards); 2 = `shadow-2` (overlay panels, answer card). Nothing higher.
- **Touch and click targets:** at least 44px.

## 5. Components

| Component | Spec |
|---|---|
| **Primary button** | h48 (hero h52), px20, `ink` bg, white text, 2px `ink` border, radius 14, Label 16/600. It can hold a keycap (`#2A2C27` bg, mono 13). |
| **Secondary button** | Same size, white bg, `ink` text, 2px `ink` border. |
| **Ghost button** | No bg or border, underlined text with 4px offset. |
| **Icon button** | 48×48 (44 in dense UI), radius 14, `aria-label` required. Accent variant: `gecko` bg with `ink` icon. Icons are 2px-stroke line icons, 20–22px. |
| **Disabled** | `canvas` bg, `line` border, `ink-3` text. |
| **Text input** | h44, radius 8, 1.5px `line-strong` border. Focus: `gecko-deep` border plus 3px `gecko-wash` outline. Always has a visible `<label>`, plus helper text in Caption. |
| **Composer** | Pill row, radius 20, 1.5px `line-strong`: text input, then mic button (hold to talk), then point-on-screen button, then `Ask` (ink). |
| **Checkbox / toggle** | Native input with `accent-color: #0F7A3D` and a label. |
| **Status chip** | Pill, Label 13/500. Processing = `canvas`/`ink-2` with a spinner ring. Ready = `gecko-wash`/`gecko-deep` with a gecko dot. Failed = `alert-wash`/`alert` with the reason. Offline = `ink`/white. |
| **Citation chip** | Pill, 1.5px `gecko-deep` border, `gecko-deep` text, e.g. `Manual · p. 4`. Every grounded answer shows at least one. |
| **Keycap** | Mono 13, white bg, 1px `line-strong`, inset bottom shadow `inset 0 -2px 0 #E6E8E3`, radius 7. macOS `⌥ Space`, Windows `Ctrl Space`. |
| **Agent card** | Radius 20, 1px `line`, p20. 44px icon tile (`gecko-wash`, `gecko-deep` icon), H2 name, one-line description, chips (knowledge bases, language), primary Start. The "New agent" card has a dashed `line-strong` border. |
| **Knowledge-base row** | File icon, name (15/600), meta (`12 ink-3`: pages, passages), status chip on the right. Rows are separated by `line`. |
| **Answer card** | Elevation 2, radius 20. The question strip is on `canvas`. Header: gecko dot plus "GetCko · {agent}". Body 16/1.55. Footer: citation chips plus measured latency in mono (`0.9 s · on this Mac`). |
| **Session bar** | `ink` pill, p10. Agent chip (`#1E201B`), mic (gecko fill), screen help, stop, hotkey hint in `#C9CCC4`. |
| **Chat bubble (GetCko)** | `ink` bg, white 16/1.45, radius `18 18 18 4` (tail corner toward the mascot). |
| **Target halo** | The element GetCko points at gets `box-shadow: 0 0 0 3px #FFC83D` (on dark surfaces `0 0 0 6px #FFF, 0 0 0 10px #FFC83D`). Only one at a time. |

### Overlay window

- Transparent, frameless, always-on-top, click-through when unfocused.
- Panels are white, elevation 2, radius 20. An "Offline" chip shows in the header.
- The overlay panel sits bottom-right by default and never covers the target element.
- **Not hidden from screen share.** GetCko is a visible helper; there is no stealth mode.

## 6. Mascot: GetCko (pixel sprite)

The mascot is named **GetCko**, after the product: "gecko" plus the Filipino slang "gets ko" ("I get it"). It's a 2D pixel sprite, 22 × 27 cells, drawn in a standing pose and pointing up-right with one hand.

### Palette

| Key | Hex | Meaning |
|---|---|---|
| `.` | transparent | Empty |
| `K` | `#0E0F0C` | Ink outline |
| `G` | `#39D86F` | Body (the accent; can follow theme) |
| `L` | `#9BF2B6` | Highlight |
| `B` | `#D6F8E0` | Belly |
| `W` | `#FFFFFF` | Eye white |
| `P` | `#FF9DB0` | Cheek |
| `D` | `#0E5E2E` | Open mouth (speaking) |

### Sprite map (pointing, faces right)

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
.....KGGBBBBGGGGK.....
....KGKGBBBBGGGK......
...KGK.KGBBBBGGK......
..KGGK.KGBBBBGGK......
..KKK..KGBBBBGGK......
.......KGGBBBGGK......
.KK....KGGGGGGGK......
KGK...KGGGGGGGGGK.....
KGK..KGGGGGGGGGGK.....
KGGKKGGGGGGGGGGK......
.KKKKKKGGK..KGGK......
......KGGGK.KGGGK.....
......KKKKK.KKKKK.....
```

### Pose overrides (replace these rows by index, 0-based)

- **Thinking** (eyes up-left, flat mouth): row 2 → `.....KKKWWKKKKWWK.....`, row 3 → `.....KWWWWKKWWWWK.....`, row 7 → `...KGGGGGGGGGGGGGGK...`, row 8 → `...KGGGGKKKKKGGGGGK...`
- **Speaking** (open mouth): row 8 → `...KGGGKDDDDDDKGGGK...`, row 9 → `....KGGGKKKKKKGGGK..KK`
- **Facing left:** reverse every row string.
- **Head mark / app icon:** rows 0–10 only. Show it on an `ink` tile (dark icon) or a `paper` tile with a `line` border (light icon), radius 22, at 96px.

### States and when to show them

| State | Pose | Trigger |
|---|---|---|
| Idle | Pointing pose, small, near the cursor or menu bar | App running |
| Thinking | Thinking | Running STT, retrieval or LLM |
| Pointing | Pointing, nose and hand aimed at the target, placed **beside** it | Screen Help answer with a target element |
| Speaking | Speaking | TTS playing |

### Rendering rules

- Scale by **whole numbers only**: 1×, 2× (pointer), 3× (icons), 6× (cards), 12–16× (hero). Never fractional scales.
- No smoothing: `image-rendering: pixelated;` on canvas or `<img>`. With a CSS grid of cells, use integer px cells.
- Don't recolor it outside the green family, cover the target, animate it while the user types, or show more than one GetCko per screen.

### Reference renderer (React)

```tsx
const PAL: Record<string,string> = { '.':'transparent', K:'#0E0F0C', G:'#39D86F', L:'#9BF2B6', B:'#D6F8E0', W:'#FFFFFF', P:'#FF9DB0', D:'#0E5E2E' };

export function GetCkoSprite({ rows, px = 4, flip = false, label = 'GetCko' }:
  { rows: string[]; px?: number; flip?: boolean; label?: string }) {
  const r = flip ? rows.map(s => [...s].reverse().join('')) : rows;
  return (
    <div role="img" aria-label={label}
      style={{ display:'grid', gridTemplateColumns:`repeat(${r[0].length}, ${px}px)`, gridAutoRows:`${px}px` }}>
      {r.flatMap((s, y) => [...s].map((ch, x) =>
        <div key={`${x}-${y}`} style={{ background: PAL[ch] ?? 'transparent' }} />))}
    </div>
  );
}
```

For the overlay pointer, draw the sprite once to an offscreen `<canvas>` (1 px per cell). Then draw it scaled with `ctx.imageSmoothingEnabled = false` for performance.

## 7. Voice and copy

- **Tone:** friendly, short, specific. Taglish is welcome when the agent's language is set to Taglish.
- **Tagline:** "Gets mo na." ("Now you get it.") Product line: "Help that sits right next to your cursor."
- Answers lead with the action, then the reason, then the source: "Tap **Upload ID** next. Your TIN is on page 1 of the manual you added."
- Say what runs locally ("on this Mac", "Offline"). Never claim a source that isn't in the retrieved passages; say "I don't know" instead.
- Don't use emoji in the UI. Use sentence case for buttons and titles.

## 8. Platform adaptations

| | macOS | Windows 11 |
|---|---|---|
| Global hotkey | `⌥ Space` | `Ctrl Space` (configurable) |
| Window corners | 10px, traffic lights left | 8px, caption buttons right |
| Material | Flat white (no vibrancy behind text) | Flat white (no Mica) |
| Screen reading | AX API (Accessibility permission) | UI Automation |
| Menu presence | Menu bar head mark (rows 0–10, 1×) | Taskbar/tray head mark |

## 9. Accessibility checklist

- Text contrast is at least 4.5:1 (3:1 at 24px and up). `gecko` is never used as text on white; use `gecko-deep`.
- Use real `<button>`, `<a href>`, `<input>` plus `<label>`. Icon-only buttons need an `aria-label`.
- Colors that must be told apart also differ in lightness, not only hue.
- Focus is visible on every control (`gecko-deep` border plus `gecko-wash` outline).
- TTS can always be stopped with Esc. Never autoplay speech without the agent's "Answer out loud" setting on.
