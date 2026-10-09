import type { Rect } from "../brand/motion";

const INSET = 24;
/** Clearance kept around the target (halo ring plus the 12px gecko gap). */
const CLEAR = 12;

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function inflate(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

function inside(r: Rect, area: Rect): boolean {
  return r.x >= area.x && r.y >= area.y && r.x + r.w <= area.x + area.w && r.y + r.h <= area.y + area.h;
}

function bounds(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * Answer card spot inside `area` (the work area): bottom-right by default, then bottom-left,
 * top-right, top-left, taking the first that keeps clear of `avoid` (target first, then the
 * gecko). If none is clear, the one that covers the least of the target wins.
 */
export function placeCard(card: { w: number; h: number }, area: Rect, avoid: Rect[]): Rect {
  const left = area.x + INSET;
  const right = Math.max(left, area.x + area.w - INSET - card.w);
  const top = area.y + INSET;
  const bottom = Math.max(top, area.y + area.h - INSET - card.h);
  const spots: Rect[] = [
    { x: right, y: bottom, ...card },
    { x: left, y: bottom, ...card },
    { x: right, y: top, ...card },
    { x: left, y: top, ...card },
  ];
  const zones = avoid.map((r) => inflate(r, CLEAR));
  let best = spots[0];
  let bestCost = Infinity;
  for (const s of spots) {
    const cost = zones.reduce((acc, z, i) => acc + overlap(s, z) * (i === 0 ? 1000 : 1), 0);
    if (cost === 0) return s;
    if (cost < bestCost) {
      bestCost = cost;
      best = s;
    }
  }
  return best;
}

/**
 * Answer card next to the gecko and target, so the eye path (GetCko, target, answer) stays short:
 * below them, then right, left, above. Never over the target, the gecko or `avoid`.
 * Falls back to the corners when nothing nearby fits.
 */
export function placeNear(card: { w: number; h: number }, cluster: Rect[], area: Rect, avoid: Rect[]): Rect {
  const c = bounds(cluster);
  const gap = 16;
  const clampX = (x: number) => Math.min(Math.max(x, area.x + INSET), area.x + area.w - INSET - card.w);
  const clampY = (y: number) => Math.min(Math.max(y, area.y + INSET), area.y + area.h - INSET - card.h);
  const spots: Rect[] = [
    { x: clampX(c.x), y: c.y + c.h + gap, ...card },
    { x: c.x + c.w + gap, y: clampY(c.y), ...card },
    { x: c.x - gap - card.w, y: clampY(c.y), ...card },
    { x: clampX(c.x), y: c.y - gap - card.h, ...card },
  ];
  const zones = [...cluster, ...avoid].map((r) => inflate(r, CLEAR));
  for (const s of spots) {
    if (inside(s, area) && zones.every((z) => overlap(s, z) === 0)) return s;
  }
  return placeCard(card, area, [...cluster, ...avoid]);
}
