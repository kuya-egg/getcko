# GetcKo demo video: brand guide

For the 1-minute submission video (PRD compliance checklist) and a 90-second cut, built with HyperFrames + GSAP. Brand source: `docs/getcko-design-system.md` (v0.2). Assets: `public/brand/plates/` (1920×1080 `plate-point`, `plate-watermark`, `plate-headmark`, light and dark), `public/brand/textures/`, sprite from `src/brand/mascot/sprites.ts`, motion values from `src/brand/motion.ts`.

**The film in one line:** a teacher asks out loud with Wi-Fi off, the gecko flies to the exact cell, the answer is spoken and cited, and nothing leaves this Mac. *Gets mo na.*

---

## 1. Formats and safe zones

### 16:9, 1920×1080 (primary), 30 fps (60 fps if the screen recording is 60)

| Zone | Inset | Holds |
|---|---|---|
| Action safe | 96 px left/right, 54 px top/bottom | Anything that matters |
| Title safe | 160 px all sides (matches each plate's `titleSafe` in `src/brand/textures.ts` → `PLATES`) | Titles, stats, end-card text |
| Caption band | y 870–1010, x 240–1680 | Subtitles (max 2 lines) |
| Corner stamp | top-left inside title safe | `Offline` chip / scene label, Silkscreen or Geist label |

### 9:16, 1080×1920 (social cut)

| Zone | Inset | Holds |
|---|---|---|
| Platform UI, top | 0–220 px | Nothing important |
| Platform UI, bottom | 1540–1920 px | Nothing important (buttons, description) |
| Side margins | 64 px | |
| Content area | y 220–1540 | Screen recording cropped to the target region (punch-in), gecko, answer card |
| Caption band | y 1260–1480 | Subtitles, max 2 lines, 26 chars/line |

Vertical crops: never squeeze the full desktop. Crop to the region that holds the gecko + target + answer card (roughly 1080×1080 of a 2× retina recording) and stack the title above it.

---

## 2. Color for scenes

| Scene type | Ground | Text | Accents |
|---|---|---|---|
| **Dark** (title, hook, proof, end card) | `night` `#121410` + `grid-cell` or `crosshair` dark texture, or `plate-*-dark` | `mist` `#F1F3EC`, secondary `mist-2` `#B8BDB0` | Green text `gecko-tint` `#6FE598`; halo = 3px night gap + 6px `sun` |
| **Light** (product scenes, agent setup) | `paper` `#FFFFFF` / `canvas` `#F6F7F4`, or the real app in light theme | `ink` `#0E0F0C`, secondary `ink-2` | Green text `gecko-deep` `#0F7A3D`; halo 3px `sun` |
| **Screen recording on dark** | `night` frame, recording inset with window radius 10 and `shadow-overlay`-like soft shadow, 64 px margin | | |

- Rhythm: **dark → light → dark**. Open dark, live product in light (it is how users see it), proof and close dark.
- Sun yellow appears on one element per shot: the target. Green stays small (gecko, live dot, mic).
- No gradients, glows, lens flares, light leaks, glitch, CRT scanlines, chromatic aberration. Transitions between dark and light use a **dither wipe** (`dither-fade` / `dither-mid` stepping across in 4 frames) or a hard cut.
- Optional `grain` texture at 1 on large flat dark grounds only.

---

## 3. Type on screen

| Role | Font | 16:9 size | 9:16 size |
|---|---|---|---|
| Title | Bricolage Grotesque 800, -0.035em | 120–144 px | 96 px |
| Statement / stat | Bricolage 700 | 72 px | 64 px |
| Label / scene stamp | Geist 600, sentence case | 32 px | 36 px |
| Measured numbers | Geist Mono 500, tabular | 48–64 px | 48 px |
| Pixel badge "Gets mo na." | Silkscreen 400 | 32–44 px | 40 px |
| Captions | Geist 600 | 44 px / 56 line | 52 px / 64 line |

Fonts are bundled (fontsource). In a HyperFrames composition load them from local files and wait for them (`fontsReady()` pattern) before the first frame renders. Left-align titles; centered text only on the title card lockup and captions.

---

## 4. Title card recipe (0:00–0:04)

1. `plate-point-dark` (or `night` + dark `grid-cell`). Gecko 16× (352×432) in the left third, facing right.
2. Frame 0: empty ground. 0.0–0.5 s: gecko pops in with `steps(2)` scale, then flies a short arc (`EASE.point`, ~0.6 s at video scale) to land beside a target chip.
3. Target chip gets the halo (draw 0.14 s, two pulses).
4. Title rises 8 px + fades (0.36 s, `EASE.out`): **"Help that sits right next to your cursor."** ≤ 2 lines, `mist`.
5. Silkscreen badge **"Gets mo na."** in `gecko-tint` 32 px below, appears with a 2-step pop.
6. Hold 1.2 s still. Cut.

End card (last 4 s): `plate-headmark-dark`, head mark tile, "GetcKo" in Bricolage 800 96 px, line "Offline. Your documents. Any app." in `mist-2`, repo URL in Geist Mono, `#AppBuildersPH` in Geist Mono `mist-3`. No logos wall, no "Thanks for watching!".

---

## 5. Captions

- Box: `ink` `#0E0F0C` at 100% (on light scenes too), radius 14, padding 12/20, text `mist`. Same shape as GetcKo's chat bubble, so captions feel like GetcKo speaking.
- Max 2 lines, ~32 chars/line (16:9), ~26 (9:16). Sentence case. No emoji.
- **Taglish speech gets an English line below** in Geist 500 at 80% size, `mist-2`. Example:
  - **Saan ko ilalagay ang grade ni Juan, at paano kinukuwenta?**
  - Where do I put Juan's grade, and how is it computed?
- Highlight at most one key word per caption in `gecko-tint` (e.g. the cell name **D7**). No per-word karaoke bounce, no word-by-word pop.
- Captions appear and leave with 80 ms opacity; never typewriter.
- GetcKo's spoken answer captions start with a small 8 px green square (the live dot) to mark "this is GetcKo speaking"; the user's lines don't.

---

## 6. How the gecko moves on camera

- **In screen recordings, the real overlay gecko is the gecko.** Never composite a second gecko on top of footage that already shows it. One per frame, always.
- Graphic scenes use the sprite at 12× or 16×, pixel-snapped, integer scale. Never rotate, blur, motion-blur, add a drop shadow or scale fractionally (scale changes jump between integers on a cut).
- Flight: shallow upward arc, `back.out(1.6)` landing. At video scale use 0.6–0.7 s (UI is 0.52 s); the trail is 3–4 green squares fading in 2 steps.
- Landing: 12 px (× scale) beside the target, facing it. Then halo, then the answer card.
- **Camera follows the point:** after the gecko lands, punch in toward the target (1.0 → 1.6×, 0.6 s, `power2.inOut`), hold through the spoken answer, punch out on the next beat. No slow Ken Burns drift. On 9:16, the punch-in is the default framing.
- Thinking (while STT/LLM run): `thinking` ↔ `idle` frame swap at 400 ms. Speaking: `speaking` ↔ `pointing` at 140–180 ms, synced to the TTS audio.
- Real latency stays real: do not speed-ramp the gap between question and answer. If it is cut for length, show the measured number on screen instead.

---

## 7. Sound feel

Small, warm, close. Like a helpful officemate at the next desk, not a launch trailer.

- **Music:** light, acoustic or soft mallet/lo-fi bed, ~90–100 BPM, no drops, no risers, no epic swells. Under VO at about -24 LUFS integrated, ducked further (−8 dB) under GetcKo's spoken answers.
- **SFX (sparse):**
  - Gecko landing: one short soft square-wave "blip" (~80 ms, single pitch), about −18 dB.
  - Halo draw: a very soft tick, or nothing.
  - Airplane mode toggle: the real macOS sound or a soft click.
  - No whooshes, no glitches, no sci-fi "AI" hums, no typing-sound beds.
- **Voices:** GetcKo's answers use the real on-device TTS output (that is the product). Narration is a human voice, plain and unhurried, English or Taglish. Let the TTS answer play un-ducked and un-processed so judges hear the real thing.
- Silence is allowed: 0.5 s of near-silence right before the gecko lands makes the landing blip land.

---

## 8. Structure, aligned to the PRD demo script

### 60-second cut (submission)

| Time | Beat (PRD step) | Scene | On screen | Audio |
|---|---|---|---|---|
| 0:00–0:04 | Title | Dark | Title card (§4) | Landing blip, music in |
| 0:04–0:12 | 1. Hook | Dark | Statement: "Every office is going digital." Stat in Bricolage 72: "Only ~40% of Filipinos have basic ICT skills." Source in Geist Mono caption (PIDS). Second line: "Cloud AI help means sending your screen to someone else's server." | VO |
| 0:12–0:18 | 2. Airplane mode | Light (real screen) | Wi-Fi off, network monitor at 0; corner `Offline` chip | Toggle click, VO "Naka-off ang Wi-Fi." |
| 0:18–0:26 | 3. Agent | Light | Office Helper template → attach the office manual PDF → Ready chip turns green → Taglish voice | VO, light UI sounds |
| 0:26–0:44 | 4. Screen Help + RAG | Light, punch-in | Hotkey keycap `⌥ Space` overlay; spoken question with Taglish + English captions; gecko thinking → flies to the cell → halo → answer spoken → citation chip **Manual · p. 4** | Real TTS answer, music ducked |
| 0:44–0:52 | 5. Second app | Light | Same style of question in a different app; gecko points again | TTS, quick |
| 0:52–0:56 | 6. Proof | Dark | Measured numbers only, Geist Mono 64: e.g. `{x.x} s` question to speech, `{n} tok/s`, `0 bytes sent`, "measured on M4 Pro" (fill from `docs/MODELS.md`; if not measured, cut the beat) | Music up |
| 0:56–1:00 | 7. Close | Dark | End card (§4): "Gets mo na." | Final blip, music out |

### 90-second cut

Same order with room to breathe: Hook 0:04–0:16 (add the RA 12254 line), Airplane 0:16–0:22, Agent 0:22–0:36 (show the instructions field and "Try this agent"), Screen Help 0:36–1:02 (add a follow-up "next" step: old halo fades, gecko flies to the next element), Second app 1:02–1:14, Proof 1:14–1:22, Close 1:22–1:30 (add "Next: GetcKo Lens for iPhone and an SDK for any app" in `mist-2`).

### 9:16 social cut (~30–45 s)

Title (3 s) → Airplane mode (3 s) → Screen Help punch-in (18 s) → Proof (4 s) → End card (3 s). Captions always on.

---

## 9. Capture checklist (before recording)

- macOS at 2× (Retina), recording at native resolution; hide desktop icons and unrelated menu-bar items; Do Not Disturb on.
- App in light theme for product scenes; overlay theme matches.
- Larger cursor (Accessibility → Pointer size, one step up) so viewers can follow it next to the gecko.
- Network monitor visible in the airplane-mode shot.
- Demo manual PDF and the spreadsheet prepared; the scripted question rehearsed so the gecko lands right on the first take. Keep a pre-recorded backup run (PRD risk mitigation).
- Record clean audio of the TTS output (system audio) separately from narration.

## 10. Don'ts for the video

No stock footage, no AI-generated people, no gradient or aurora backgrounds, no glitch or CRT transitions, no "AI" sparkles or neural-network visuals, no fake UI, no fake numbers, no emoji captions, no second gecko on top of footage, no speed-ramped latency, no music drop on the reveal.
