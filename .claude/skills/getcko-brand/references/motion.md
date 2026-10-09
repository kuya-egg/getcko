# Motion and mascot

Spec: `docs/getcko-design-system.md` §5 (motion) and §10 (mascot). Tokens: `src/brand/motion.ts` (GSAP), `--gc-dur-*` / `--gc-ease-*` (CSS).

| | ms | GSAP | Use |
|---|---|---|---|
| instant | 80 | `DUR.instant` | Press, reduced-motion crossfade |
| fast | 140 | `DUR.fast` | Hover, chips, halo draw (Tailwind default transition) |
| base | 220 | `DUR.base` | Panel/card enter, tabs |
| slow | 360 | `DUR.slow` | Overlay answer card, page transition |
| pointer | 520 | `DUR.pointer` | Gecko flight |

Eases: `EASE.out` (enter), `EASE.inOut` (moves), `EASE.point` = `back.out(1.6)` (gecko landing only), `EASE.step` = `steps(2)` (sprite frames, trail). Exits use the next shorter duration. Animate `transform`/`opacity` only.

## Gecko flight (Screen Help)

Use the helpers; never hand-roll a flight. Values live in `src/brand/motion.ts` (code wins over this file).

```ts
import { flyTo, haloIn, answerCardIn, placeBeside, pointPoseFor, MOMENT_POSE } from "../brand";

setPose(MOMENT_POSE.screenHelp);                 // or pointPoseFor("right" | "downRight")
const tl = flyTo(geckoEl, targetRect, {          // arc + landing hop, pixel-snapped
  snap: 2,                                       // sprite scale on the overlay
  onPlace: (p) => setFlip(p.flip),               // face the target; instant frame swap
});
tl.add(haloIn(targetEl)).add(answerCardIn(cardEl), "-=0.06");
```

| Step | Rule |
|---|---|
| Takeoff | Pose from `MOMENT_POSE`, flip toward the target (frame swap, never a mirror tween) |
| Landing | `placeBeside`: hand tip just outside the target's side, never over it or the caret |
| Flight | Short arc, `DUR.pointer`, x/y snapped to whole pixels, integer scale |
| Long flights | `MOMENT_POSE.moving` (walk frames) during the arc, optional |
| Then | Halo, then answer card |

## Halo

- Add `target-halo` to the one target (dark theme gives the two-ring version automatically; on ink chrome use `shadow-halo-dark`).
- Draw 0 → full in 140ms `EASE.out`, then **two** pulses (spread 3 → 6 → 3px, 360ms each, `EASE.inOut`), then still. No infinite pulse, no glow.
- Next step: fade the old halo 80ms before the gecko takes off.

## Entrance choreography

| t | Event |
|---|---|
| 0 | Gecko lands |
| 0–140ms | Halo draws |
| 80–440ms | Answer card: opacity 0→1, y 8→0, `DUR.slow`, `EASE.out` |
| 200ms+ | Answer text by sentence, in sync with TTS (no per-letter typewriter) |
| after text | Citation chips + latency: 140ms, 40ms stagger |

Screens: blocks rise 8px + fade, 220ms, 40ms stagger, max 4 staggered items. Mascot appears with a 2-step pop (`steps(2)` scale 0→1), not a smooth scale.

## Page transitions (in-flight helpers in `src/brand/motion.ts`)

| Change | Helper | Motion |
|---|---|---|
| Route mount | `pageIn(el)` | Rise 8px + fade, `DUR.base` |
| Onboarding step | `stepIn(el, dir)` | Short slide in the step direction (1 forward, -1 back) + fade |
| Nav switch | crossfade | Opacity only, no slide |
| Lists, cards | `staggerIn(els)` | 40ms stagger, max 4 items |

## Sprite states

Pick poses with `MOMENT_POSE[moment]` (31 poses, `docs/brand/mascot-poses.md`); loops: `speakLoop`, `thinkingLoop`, `idleLoop`, `frameLoop(setPose, POSE_CYCLES.wave)`.

- Idle: still; `breathe` frame swap ~1.6s; `blink` for 120ms every 3–6s.
- Thinking: `thinking` ↔ `idle` every 400ms.
- Speaking: `speaking` ↔ `pointing` every 140–180ms while TTS plays.
- Pointing: still.
- Never while the user types. One GetcKo per screen.

## Reduced motion

`prefersReducedMotion()` true → teleport (80ms fade), no arc or trail; halo static; panels 80ms opacity only; sprite state swaps stay at half rate.

## Rendering

Integer scales only (1 menu bar, 2 overlay, 3 inline, 6 empty state, 8 onboarding, 12–16 hero/video). `pixelated`. No rotate, no blur, no shadow, no recolor, never redrawn by an image model.
