// The hero's choreography as one GSAP timeline, independent of React and of three.js, so the demo
// video (HyperFrames) can reuse it: build it paused and add it to the master timeline.
//
//   Ask      0.15 s  shortcut pill + "Listening", then the English question
//   Point    1.90 s  GetCko hops to the target cell, the sun halo draws in (haloIn)
//   Source   2.90 s  answer line, GetCko speaks, source chip "Manual · p. 4"
//   Offline  4.10 s  "Offline · on this Mac", then the tagline beside GetCko
//   hold to 6.0 s, reset 6.0 to 6.6 s, loop.
//
// Seek-safe: no Math.random, no wall clock, no tl.call. Everything GetCko does (position, pose,
// yaw) is a pure function of the playhead, evaluated in one clock tween; DOM beats are plain tweens
// after tl.set() initial states at 0. The DOM contract is a set of data attributes (see HeroDom).

import { gsap } from "gsap";
import { BLINK_OF, SPRITE_H, SPRITE_W, type Pose } from "../mascot/sprites";
import { MOMENT_POSE } from "../mascot/moments";
import { DUR, EASE, geckoHop, geckoLand, haloIn, haloOut, placeBeside, prefersReducedMotion, type Rect } from "../motion";
import { HERO_BEATS, type HeroBeat } from "./copy";

/** Beat start times (s). */
export const HERO_TIMING = {
  ask: 0.15,
  question: 0.75,
  think: 1.55,
  point: 1.9,
  land: 2.42,
  settle: 2.78,
  source: 2.9,
  sourceChip: 3.25,
  speakEnd: 4.4,
  offline: 4.1,
  tagline: 4.6,
  /** The story is complete here: the static (reduced-motion) frame. */
  end: 5.0,
  reset: 6.0,
  homeAt: 6.5,
  total: 6.6,
} as const;

/** One frame of GetCko, in stage px. x/y = top-left of the sprite box. */
export interface GeckoFrame {
  x: number;
  y: number;
  pose: Pose;
  flip: boolean;
  /** Body turn in degrees (3D only; 2D ignores it). */
  yaw: number;
  /** Cell size in px (sprite box = 22 x 27 cells). */
  cell: number;
}

export type GeckoDriver = (frame: GeckoFrame) => void;

export interface HeroTimelineOptions {
  /** Receives every GetCko frame. Default: moves [data-hero="gecko"] with a CSS transform (no pose). */
  gecko?: GeckoDriver;
  /** Sprite cell size in stage px. Default 10 (220 x 270 box). */
  cell?: number;
  /** Static final frame, no loop. Default: prefers-reduced-motion. */
  reduced?: boolean;
  /** Build paused (for a master / HyperFrames timeline). Default false. */
  paused?: boolean;
  /** Repeat forever. Default true (ignored when reduced). */
  loop?: boolean;
  /** Halo style: dark adds the bg-colored gap ring. Default: the app theme (resolveTheme). */
  dark?: boolean;
}

/**
 * DOM contract, all inside `root`:
 *   [data-hero="stage"]     coordinate space for GetCko (may be CSS-scaled; rects are unscaled)
 *   [data-hero="target"]    the one element that wears the halo
 *   [data-hero="ask"] [data-hero="question"] [data-hero="answer"] [data-hero="speaking"] [data-hero="source"]
 *   [data-hero="offline"] [data-hero="tagline"]   revealed in that order (each optional)
 *   [data-hero-beat="ask|point|source|offline"]   keyword rail words, each with a [data-hero-mark] child
 *   [data-hero="gecko"]     optional; moved by the default driver
 */
export type HeroDom =
  | "stage"
  | "target"
  | "ask"
  | "question"
  | "answer"
  | "speaking"
  | "source"
  | "offline"
  | "tagline"
  | "gecko";

interface Layout {
  cell: number;
  size: { w: number; h: number };
  home: { x: number; y: number };
  land: { x: number; y: number };
  flip: boolean;
}

/** Target and stage geometry in unscaled stage px. */
export function measureHero(root: HTMLElement, cell = 10): Layout | null {
  const stage = root.querySelector<HTMLElement>('[data-hero="stage"]');
  const target = root.querySelector<HTMLElement>('[data-hero="target"]');
  if (!stage || !target) return null;
  const s = stage.getBoundingClientRect();
  const k = stage.offsetWidth > 0 ? s.width / stage.offsetWidth : 1;
  const c = target.getBoundingClientRect();
  const W = stage.offsetWidth;
  const H = stage.offsetHeight;
  const rect: Rect = { x: (c.left - s.left) / k, y: (c.top - s.top) / k, w: c.width / k, h: c.height / k };
  const size = { w: SPRITE_W * cell, h: SPRITE_H * cell };
  const place = placeBeside(rect, size, { side: "right", gap: cell, bounds: { x: 0, y: 0, w: W, h: H } });
  // Home: bottom-right corner of the stage, a short hop down and away from the landing spot.
  const home = { x: Math.round(W - size.w), y: Math.round(H - size.h) };
  return { cell, size, home, land: { x: place.x, y: place.y }, flip: place.flip };
}

// ---------------------------------------------------------------------------
// GetCko as a pure function of time

const TM = HERO_TIMING;
const LOOP = TM.total;
const BASE_YAW = 26;
const blink = (p: Pose) => BLINK_OF[p] ?? p;
const snap = (v: number, step: number) => Math.round(v / step) * step;

/** Short arc between two points (as flyTo): geckoLand progress, lift follows time, cell-snapped. */
function arc(from: { x: number; y: number }, to: { x: number; y: number }, q: number, cell: number) {
  const p = geckoLand(q);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.min(72, Math.max(24, dist * 0.35));
  const a = Math.max(0, 4 * q * (1 - q));
  const step = Math.max(1, Math.round(cell / 2));
  return { x: snap(from.x + (to.x - from.x) * p, step), y: snap(from.y + (to.y - from.y) * p - lift * a, step) };
}

function poseAt(t: number): Pose {
  const listen = MOMENT_POSE.listening;
  const point = MOMENT_POSE.screenHelp;
  const walk = (t0: number) => (Math.floor((t - t0) / 0.13) % 2 === 0 ? "walk1" : "walk2");
  if (t < TM.think) return t > 1.0 && t < 1.12 ? blink(listen) : listen;
  if (t < TM.point) return MOMENT_POSE.thinking;
  if (t < TM.land) return walk(TM.point);
  if (t < TM.source) return point;
  if (t < TM.speakEnd) return Math.floor((t - TM.source) * 6) % 2 === 0 ? MOMENT_POSE.speaking : point;
  if (t < TM.reset) {
    // Idle: breathe, one blink.
    const u = t - TM.speakEnd;
    if (u > 1.1 && u < 1.22) return blink(point);
    return Math.floor(u / 0.55) % 2 === 1 ? "breathe" : point;
  }
  if (t < TM.homeAt) return walk(TM.reset);
  return listen;
}

export function geckoAt(t: number, L: Layout): GeckoFrame {
  const tt = Math.min(Math.max(t, 0), LOOP);
  let pos = L.home;
  if (tt >= TM.point && tt < TM.land) pos = arc(L.home, L.land, (tt - TM.point) / (TM.land - TM.point), L.cell);
  else if (tt >= TM.land && tt < TM.settle) {
    const h = geckoHop((tt - TM.land) / (TM.settle - TM.land));
    pos = { x: L.land.x, y: snap(L.land.y - h * L.cell * 2, Math.max(1, L.cell / 2)) };
  } else if (tt >= TM.settle && tt < TM.reset) pos = L.land;
  else if (tt >= TM.reset && tt < TM.homeAt) pos = arc(L.land, L.home, (tt - TM.reset) / (TM.homeAt - TM.reset), L.cell);
  // Slow sway of a few degrees, one full period per loop (seamless at the wrap).
  const yaw = BASE_YAW + 4 * Math.sin((tt / LOOP) * Math.PI * 2);
  return { x: pos.x, y: pos.y, pose: poseAt(tt), flip: L.flip, yaw, cell: L.cell };
}

// ---------------------------------------------------------------------------
// Timeline

function cssDriver(root: HTMLElement): GeckoDriver {
  const el = root.querySelector<HTMLElement>('[data-hero="gecko"]');
  return (f) => {
    if (el) el.style.transform = `translate(${f.x}px, ${f.y}px)`;
  };
}

/**
 * Builds the hero story on the DOM inside `root`. Returns the timeline (tl.data = layout).
 * Rebuild it when the layout or theme changes (the halo reads the theme at build time); keep the
 * time with `next.time(prev.time())`.
 */
export function buildHeroTimeline(root: HTMLElement, opts: HeroTimelineOptions = {}): gsap.core.Timeline {
  const reduced = opts.reduced ?? prefersReducedMotion();
  const loop = !reduced && (opts.loop ?? true);
  const L = measureHero(root, opts.cell ?? 10);
  const tl = gsap.timeline({ paused: true, repeat: loop ? -1 : 0, data: L });
  if (!L) return tl;

  const q = (k: HeroDom) => root.querySelector<HTMLElement>(`[data-hero="${k}"]`);
  const drive = opts.gecko ?? cssDriver(root);
  const target = q("target");

  // GetCko: one clock tween over the whole loop.
  const clock = { t: 0 };
  drive(geckoAt(0, L));
  tl.to(clock, { t: LOOP, duration: LOOP, ease: "none", onUpdate: () => drive(geckoAt(clock.t, L)) }, 0);

  // Reveals: autoAlpha + 8px rise (answerCardIn values), reset together at TM.reset.
  const reveals: [HeroDom, number][] = [
    ["ask", TM.ask],
    ["question", TM.question],
    ["answer", TM.source],
    ["speaking", TM.source + 0.1],
    ["source", TM.sourceChip],
    ["offline", TM.offline],
    ["tagline", TM.tagline],
  ];
  for (const [key, at] of reveals) {
    const el = q(key);
    if (!el) continue;
    tl.set(el, { autoAlpha: 0, y: 8 }, 0);
    tl.to(el, { autoAlpha: 1, y: 0, duration: DUR.base, ease: EASE.out }, at);
    // "Listening" ends when the question is in; "Speaking" lasts as long as the mouth moves.
    const out = key === "speaking" ? TM.speakEnd : key === "ask" ? TM.think : TM.reset;
    tl.to(el, { autoAlpha: 0, y: key === "speaking" ? 0 : -4, duration: DUR.fast, ease: "power2.in" }, out);
  }

  // Halo: GetCko first, then the ring (haloIn: 140 ms draw, two pulses, hold).
  if (target) {
    target.style.boxShadow = "";
    const gap = opts.dark == null ? undefined : opts.dark ? 3 : 0;
    tl.add(haloIn(target, { reduced: false, gap }), TM.land);
    tl.add(haloOut(target, { reduced: false, gap }), TM.reset);
  }

  // Keyword rail: one highlighted word per beat. Future words dim, past words full ink, no marker.
  const beatAt: Record<HeroBeat, number> = { ask: TM.ask, point: TM.point, source: TM.source, offline: TM.offline };
  HERO_BEATS.forEach((beat, i) => {
    const word = root.querySelector<HTMLElement>(`[data-hero-beat="${beat}"]`);
    if (!word) return;
    const mark = word.querySelector<HTMLElement>("[data-hero-mark]");
    const next = HERO_BEATS[i + 1];
    tl.set(word, { opacity: 0.42 }, 0);
    tl.to(word, { opacity: 1, duration: DUR.base, ease: EASE.out }, beatAt[beat]);
    tl.to(word, { opacity: 0.42, duration: DUR.slow, ease: EASE.out }, TM.reset);
    if (mark) {
      tl.set(mark, { scaleX: 0, transformOrigin: "0% 50%" }, 0);
      tl.to(mark, { scaleX: 1, duration: DUR.base, ease: EASE.out }, beatAt[beat]);
      tl.to(mark, { scaleX: 0, duration: DUR.fast, ease: EASE.out }, next ? beatAt[next] : TM.reset);
    }
  });

  if (reduced) {
    tl.progress(TM.end / LOOP, false);
    // Leave the halo static (no pulse mid-frame): draw it fully.
    if (target) haloIn(target, { reduced: true, gap: opts.dark == null ? undefined : opts.dark ? 3 : 0 });
    tl.pause();
    return tl;
  }
  if (!opts.paused) tl.play(0);
  return tl;
}
