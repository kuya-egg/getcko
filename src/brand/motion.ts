// Motion tokens + GSAP helpers. Mirrors --gc-dur-* / --gc-ease-* in tokens.css.
// GetcKo motion is quick and calm: UI moves fast, the gecko flies a short arc, hops once, settles.
// Rules:
//  - Never animate the mascot while the user types. It points, never clicks. Never covers the target.
//  - Every helper respects prefers-reduced-motion (instant set) and returns its timeline (call .kill()).
//  - Seek-safe: no Math.random, no wall-clock reads. All values are computed at build time or from
//    the tween's own progress, so the same code can drive a HyperFrames / paused master timeline.
//    Pass { paused: true } and add the returned timeline to your master timeline.

import { gsap } from "gsap";
import type { Pose } from "./mascot/sprites";
import { SPRITE_H, SPRITE_W, handTip } from "./mascot/sprites";
import { resolveTheme } from "./theme";

/** Seconds (GSAP units). */
export const DUR = {
  instant: 0.08,
  fast: 0.14,
  base: 0.22,
  slow: 0.36,
  pointer: 0.52,
} as const;

/** GSAP ease strings matching the CSS cubic-beziers, plus the registered gecko eases. */
export const EASE = {
  out: "power3.out", // --gc-ease-out
  inOut: "power2.inOut", // --gc-ease-in-out
  point: "back.out(1.6)", // --gc-ease-point, gecko lands on target
  step: "steps(2)", // pixel sprite frame swaps
  land: "geckoLand", // flight progress: fast start, ~9% overshoot, damped settle (ends at 1)
  hop: "geckoHop", // 0 -> 1 -> 0 with a small rebound (ends at 0); use for "-=px" hops
} as const;

/** CSS equivalents, for inline style transitions. */
export const CSS_EASE = {
  out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  point: "cubic-bezier(0.34, 1.32, 0.64, 1)",
} as const;

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Custom eases (pure functions of progress, deterministic)

/** Damped landing: power-out start, one small overshoot, settles exactly at 1. */
export function geckoLand(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - Math.pow(1 - p, 4) * Math.cos(p * Math.PI * 2.2);
}

/** Hop: up and down (62% of the time), then a tiny rebound (18% height). Starts and ends at 0. */
export function geckoHop(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  if (p < 0.62) return Math.sin((Math.PI * p) / 0.62);
  return 0.18 * Math.sin((Math.PI * (p - 0.62)) / 0.38);
}

gsap.registerEase("geckoLand", geckoLand);
gsap.registerEase("geckoHop", geckoHop);

// ---------------------------------------------------------------------------
// Shared types

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placement {
  x: number;
  y: number;
  /** true = gecko sits right of the target, facing left. Pass to <GetCkoSprite flip>. */
  flip: boolean;
}

export type PoseSetter = (pose: Pose) => void;

interface BaseOpts {
  /** Build paused (for a master / HyperFrames timeline). Default false. */
  paused?: boolean;
  /** Force reduced motion on/off. Default: the OS setting. */
  reduced?: boolean;
}

const isReduced = (o?: BaseOpts) => o?.reduced ?? prefersReducedMotion();

function viewport(): Rect {
  try {
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  } catch {
    return { x: 0, y: 0, w: 1920, h: 1080 };
  }
}

// ---------------------------------------------------------------------------
// Placement: beside the target, never covering it

export interface PlaceOptions {
  /** auto = left of target if it fits, else right. */
  side?: "auto" | "left" | "right";
  /** Space between hand tip and target edge, px. Default 8. */
  gap?: number;
  /** Area the gecko must stay inside. Default: viewport. */
  bounds?: Rect;
}

/**
 * Where to put a gecko of `size` so its pointing hand sits just outside the target's side,
 * at the target's vertical middle. Only y is clamped to bounds; x never moves onto the target.
 */
export function placeBeside(target: Rect, size: { w: number; h: number }, opts: PlaceOptions = {}): Placement {
  const { side = "auto", gap = 8 } = opts;
  const b = opts.bounds ?? viewport();
  const leftX = target.x - gap - size.w;
  const rightX = target.x + target.w + gap;
  let flip: boolean;
  if (side === "left") flip = false;
  else if (side === "right") flip = true;
  else if (leftX >= b.x) flip = false;
  else if (rightX + size.w <= b.x + b.w) flip = true;
  else flip = target.x - b.x < b.x + b.w - (target.x + target.w); // more room on the right
  const tipRow = handTip(flip).row + 0.5;
  const tipY = target.y + target.h / 2;
  let y = tipY - (size.h * tipRow) / SPRITE_H + gap / 2; // hand points up-right: sit a touch low
  y = Math.min(Math.max(y, b.y), b.y + b.h - size.h);
  return { x: Math.round(flip ? rightX : leftX), y: Math.round(y), flip };
}

// ---------------------------------------------------------------------------
// flyTo

export interface FlyToOptions extends BaseOpts, PlaceOptions {
  /** Gecko box size in px. Default: el.offsetWidth/Height, else 22x27 * 2. */
  size?: { w: number; h: number };
  /** Start position (translate px). Default: el's current GSAP x/y. */
  from?: { x: number; y: number };
  /** Flight seconds. Default DUR.pointer. */
  duration?: number;
  /** Arc height px. Default: 22% of distance, clamped 12..72. */
  lift?: number;
  /** Landing hop height px; 0 disables. Default: one sprite cell * 2 (or 6). */
  hop?: number;
  /** Snap x/y to multiples of this many px (use the sprite scale for a pixel feel). Default 1. */
  snap?: number;
  /** Quantize flight progress into N steps (e.g. 8) for a stop-motion feel. Default off. */
  steps?: number;
  /** Called once at build time with the computed placement (set flip on the sprite here). */
  onPlace?: (p: Placement) => void;
}

/**
 * Moves `el` (positioned at left/top 0, moved by transform x/y) beside `target` along a short arc,
 * then a little hop-and-settle. Returns the timeline; tl.data is the Placement.
 */
export function flyTo(el: HTMLElement, target: Rect, opts: FlyToOptions = {}): gsap.core.Timeline {
  const size = opts.size ?? {
    w: el.offsetWidth || SPRITE_W * 2,
    h: el.offsetHeight || SPRITE_H * 2,
  };
  const place = placeBeside(target, size, opts);
  opts.onPlace?.(place);
  const tl = gsap.timeline({ paused: opts.paused, data: place });

  if (isReduced(opts)) {
    tl.set(el, { x: place.x, y: place.y });
    return tl;
  }

  const fx = opts.from?.x ?? (Number(gsap.getProperty(el, "x")) || 0);
  const fy = opts.from?.y ?? (Number(gsap.getProperty(el, "y")) || 0);
  const dist = Math.hypot(place.x - fx, place.y - fy);
  const lift = opts.lift ?? Math.min(72, Math.max(12, dist * 0.22));
  const snapPx = Math.max(1, opts.snap ?? 1);
  const cell = size.w / SPRITE_W;
  const hop = opts.hop ?? Math.max(4, Math.round(cell * 2));
  const steps = opts.steps && opts.steps > 1 ? Math.round(opts.steps) : 0;
  const snap = (v: number) => Math.round(v / snapPx) * snapPx;

  tl.set(el, { x: snap(fx), y: snap(fy) });

  const flight = { t: 0 };
  tl.to(flight, {
    t: 1,
    duration: opts.duration ?? DUR.pointer,
    ease: "none",
    onUpdate: () => {
      let q = flight.t;
      if (steps) q = Math.round(q * steps) / steps;
      const p = geckoLand(q);
      const arc = Math.max(0, 4 * q * (1 - q)); // lift follows time, not the overshoot
      gsap.set(el, {
        x: snap(fx + (place.x - fx) * p),
        y: snap(fy + (place.y - fy) * p - lift * arc),
      });
    },
  });

  if (hop > 0) {
    const h = { t: 0 };
    tl.to(h, {
      t: 1,
      duration: DUR.slow,
      ease: "none",
      onUpdate: () => {
        const q = steps ? Math.round(h.t * steps) / steps : h.t;
        gsap.set(el, { x: place.x, y: snap(place.y - hop * geckoHop(q)) });
      },
    });
  }
  tl.set(el, { x: place.x, y: place.y });
  return tl;
}

// ---------------------------------------------------------------------------
// Target halo (sun ring). Box-shadow spread only: no blur, no glow.

export interface HaloOptions extends BaseOpts {
  /** Ring width px. Default 3. */
  width?: number;
  /** Gap ring (in --gc-bg) between element and halo, px. Default 0 light / 3 dark (matches --gc-halo). */
  gap?: number;
  /** Extra box-shadow to keep after the halo (e.g. var(--gc-shadow-1)). */
  keep?: string;
  /** haloIn only: pulses after the draw (ring 3 -> 6 -> 3px, 360ms each). Default 2. 0 = draw and hold. */
  pulses?: number;
}

/**
 * Mirrors --gc-halo. Light (gap 0): sun ring + 1px ink keyline, since sun alone is 1.55:1 on paper.
 * Dark (gap > 0): bg-colored gap, then the sun ring. `k` scales everything (draw-in), `p` widens
 * only the sun ring (pulse).
 */
function haloShadow(k: number, width: number, gap: number, keep?: string, p = 1): string {
  const s = Math.max(0, k);
  const ring = width * s * p;
  const parts =
    gap > 0
      ? [`0 0 0 ${gap * s}px var(--gc-bg)`, `0 0 0 ${gap * s + ring}px var(--gc-target)`]
      : [`0 0 0 ${ring}px var(--gc-target)`, `0 0 0 ${ring + s}px var(--gc-ink)`];
  if (keep) parts.push(keep);
  return parts.join(", ");
}

function haloDefaults(o: HaloOptions) {
  let dark = false;
  try {
    dark = resolveTheme() === "dark";
  } catch {
    dark = false;
  }
  return { width: o.width ?? 3, gap: o.gap ?? (dark ? 3 : 0) };
}

/**
 * Sun ring draws in (140ms, EASE.out, no overshoot: UI stays calm), pulses twice
 * (ring 3 -> 6 -> 3px, 360ms each), then holds. Use on ONE element at a time.
 * Reduced motion: static ring, no pulse.
 */
export function haloIn(el: HTMLElement, opts: HaloOptions = {}): gsap.core.Timeline {
  const { width, gap } = haloDefaults(opts);
  const tl = gsap.timeline({ paused: opts.paused });
  if (isReduced(opts)) {
    tl.set(el, { boxShadow: haloShadow(1, width, gap, opts.keep) });
    return tl;
  }
  const s = { v: 0, p: 1 };
  const paint = () => {
    el.style.boxShadow = haloShadow(s.v, width, gap, opts.keep, s.p);
  };
  tl.to(s, { v: 1, duration: DUR.fast, ease: EASE.out, onUpdate: paint });
  const pulses = Math.max(0, Math.round(opts.pulses ?? 2));
  if (pulses > 0) {
    tl.to(s, {
      p: 2,
      duration: DUR.slow / 2,
      ease: EASE.inOut,
      yoyo: true,
      repeat: pulses * 2 - 1,
      onUpdate: paint,
    });
  }
  tl.set(s, { p: 1, onComplete: paint });
  return tl;
}

/** Ring tightens away. Leaves `keep` (or no shadow). */
export function haloOut(el: HTMLElement, opts: HaloOptions = {}): gsap.core.Timeline {
  const { width, gap } = haloDefaults(opts);
  const tl = gsap.timeline({ paused: opts.paused });
  const end = opts.keep ?? "none";
  if (isReduced(opts)) {
    tl.set(el, { boxShadow: end });
    return tl;
  }
  const s = { v: 1 };
  tl.to(s, {
    v: 0,
    duration: DUR.fast,
    ease: "power2.in",
    onUpdate: () => {
      el.style.boxShadow = s.v <= 0 ? end : haloShadow(s.v, width, gap, opts.keep);
    },
  });
  return tl;
}

// ---------------------------------------------------------------------------
// Answer card

export interface CardOptions extends BaseOpts {
  /** Rise distance px. Default 8. */
  rise?: number;
  delay?: number;
}

export function answerCardIn(el: HTMLElement, opts: CardOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: opts.paused, delay: opts.delay });
  if (isReduced(opts)) {
    tl.set(el, { autoAlpha: 1, y: 0 });
    return tl;
  }
  tl.fromTo(
    el,
    { autoAlpha: 0, y: opts.rise ?? 8 },
    { autoAlpha: 1, y: 0, duration: DUR.base, ease: EASE.out, immediateRender: true },
  );
  return tl;
}

export function answerCardOut(el: HTMLElement, opts: CardOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: opts.paused, delay: opts.delay });
  if (isReduced(opts)) {
    tl.set(el, { autoAlpha: 0 });
    return tl;
  }
  tl.to(el, { autoAlpha: 0, y: -(opts.rise ?? 4), duration: DUR.fast, ease: "power2.in" });
  return tl;
}

// ---------------------------------------------------------------------------
// Screen transitions (main window). Calm UI: opacity + a few px, EASE.out, no overshoot.
// Reduced motion: an 80ms opacity fade, no movement.

export interface PageOptions extends BaseOpts {
  delay?: number;
}

/** A screen (or a pane's content) arrives: fade in and rise 8px, 220ms. Reduced: 80ms fade. */
export function pageIn(el: HTMLElement, opts: PageOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: opts.paused, delay: opts.delay });
  if (isReduced(opts)) {
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: DUR.instant, ease: "none", immediateRender: true });
    return tl;
  }
  tl.fromTo(
    el,
    { autoAlpha: 0, y: 8 },
    { autoAlpha: 1, y: 0, duration: DUR.base, ease: EASE.out, immediateRender: true },
  );
  return tl;
}

/**
 * Onboarding / wizard step change. dir 1 = forward (content enters from the right, x 16 -> 0),
 * dir -1 = back (from the left). Reduced: 80ms fade.
 */
export function stepIn(el: HTMLElement, dir: 1 | -1 = 1, opts: PageOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: opts.paused, delay: opts.delay });
  if (isReduced(opts)) {
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: DUR.instant, ease: "none", immediateRender: true });
    return tl;
  }
  tl.fromTo(
    el,
    { autoAlpha: 0, x: 16 * dir },
    { autoAlpha: 1, x: 0, duration: DUR.base, ease: EASE.out, immediateRender: true },
  );
  return tl;
}

export interface StaggerOptions extends PageOptions {
  /** Seconds between items. Default 0.04 (40ms). */
  each?: number;
  /** Rise distance px. Default 8. */
  rise?: number;
}

/** A list arrives item by item (rows, cards): 8px rise, 40ms apart. Reduced: one 80ms fade for all. */
export function staggerIn(els: ArrayLike<Element> | Element[], opts: StaggerOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: opts.paused, delay: opts.delay });
  const targets = Array.from(els);
  if (!targets.length) return tl;
  if (isReduced(opts)) {
    tl.fromTo(targets, { autoAlpha: 0 }, { autoAlpha: 1, duration: DUR.instant, ease: "none", immediateRender: true });
    return tl;
  }
  tl.fromTo(
    targets,
    { autoAlpha: 0, y: opts.rise ?? 8 },
    {
      autoAlpha: 1,
      y: 0,
      duration: DUR.base,
      ease: EASE.out,
      stagger: opts.each ?? 0.04,
      immediateRender: true,

    },
  );
  return tl;
}

// ---------------------------------------------------------------------------
// Sprite frame loops (pose swaps are inherently stepped, so they read as pixel animation)

export interface FrameLoopOptions extends BaseOpts {
  /** -1 = forever (default). Otherwise number of extra cycles. */
  repeat?: number;
  /** Pose to set when a finite loop completes. */
  endPose?: Pose;
}

/**
 * Plays a pose sequence [[pose, seconds], ...]. The pose is derived from the playhead time,
 * so seeking anywhere gives the same frame. setPose is called only when the frame changes.
 */
export function frameLoop(
  setPose: PoseSetter,
  frames: ReadonlyArray<readonly [Pose, number]>,
  opts: FrameLoopOptions = {},
): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: opts.paused });
  if (frames.length === 0) return tl;
  const total = frames.reduce((a, [, d]) => a + d, 0);
  let last: Pose | null = null;
  const show = (p: Pose) => {
    if (p !== last) {
      last = p;
      setPose(p);
    }
  };
  const poseAt = (t: number): Pose => {
    let acc = 0;
    for (const [p, d] of frames) {
      acc += d;
      if (t < acc) return p;
    }
    return frames[frames.length - 1][0];
  };
  const clock = { t: 0 };
  tl.to(clock, {
    t: total,
    duration: total,
    ease: "none",
    repeat: opts.repeat ?? -1,
    onStart: () => show(poseAt(0)),
    onUpdate: () => show(poseAt(clock.t)),
    onComplete: () => {
      if (opts.endPose) show(opts.endPose);
    },
  });
  return tl;
}

export interface SpeakOptions extends BaseOpts {
  /** Mouth flaps per second. Default 6. */
  fps?: number;
  /** Seconds of speech (e.g. TTS length). Omit to loop until you kill it. */
  duration?: number;
  /** Pose between mouth-open frames. Default "pointing". */
  restPose?: Pose;
}

/** Toggles speaking/pointing at ~6 fps while TTS plays. On kill, set your rest pose yourself. */
export function speakLoop(setPose: PoseSetter, opts: SpeakOptions = {}): gsap.core.Timeline {
  const rest = opts.restPose ?? "pointing";
  if (isReduced(opts)) {
    const tl = gsap.timeline({ paused: opts.paused });
    tl.call(() => setPose("speaking"), [], 0);
    if (opts.duration) tl.call(() => setPose(rest), [], opts.duration);
    return tl;
  }
  const f = 1 / Math.max(1, opts.fps ?? 6);
  const cycles = opts.duration ? Math.max(1, Math.round(opts.duration / (2 * f))) : 0;
  return frameLoop(
    setPose,
    [
      ["speaking", f],
      [rest, f],
    ],
    { paused: opts.paused, repeat: cycles ? cycles - 1 : -1, endPose: cycles ? rest : undefined },
  );
}

export interface ThinkingOptions extends BaseOpts {
  /**
   * Optional element to bob 1 cell up/down in two hard steps. Pass an INNER wrapper of the sprite,
   * not the element flyTo moves (both use y).
   */
  bobEl?: HTMLElement;
  /** Sprite scale (bob distance in px = scale). Default 2. */
  scale?: number;
}

/** Thinking pose with a slow blink, plus an optional stepped bob. Loops until killed. */
export function thinkingLoop(setPose: PoseSetter, opts: ThinkingOptions = {}): gsap.core.Timeline {
  if (isReduced(opts)) {
    const tl = gsap.timeline({ paused: opts.paused });
    tl.call(() => setPose("thinking"), [], 0);
    return tl;
  }
  const tl = frameLoop(
    setPose,
    [
      ["thinking", 1.6],
      ["blink", 0.12],
      ["thinking", 2.2],
      ["blink", 0.12],
    ],
    { paused: opts.paused },
  );
  if (opts.bobEl) {
    tl.to(
      opts.bobEl,
      { y: -(opts.scale ?? 2), duration: 0.5, ease: "steps(1)", repeat: -1, yoyo: true },
      0,
    );
  }
  return tl;
}

/** Idle: slow breathe with an occasional blink. Pause it while the user types. */
export function idleLoop(setPose: PoseSetter, opts: BaseOpts = {}): gsap.core.Timeline {
  if (isReduced(opts)) {
    const tl = gsap.timeline({ paused: opts.paused });
    tl.call(() => setPose("pointing"), [], 0);
    return tl;
  }
  return frameLoop(
    setPose,
    [
      ["pointing", 1.1],
      ["breathe", 1.1],
      ["pointing", 1.1],
      ["breathe", 0.9],
      ["blink", 0.12],
      ["breathe", 0.2],
    ],
    { paused: opts.paused },
  );
}
