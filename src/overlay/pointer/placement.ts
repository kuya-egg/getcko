import type { Rect } from "../../bindings/Rect";
import type { GeckoPlacement, Size } from "../types";
import { SPRITE_COLS, SPRITE_ROWS } from "./sprite";

const GAP = 8;
/** Pointing hand tip row in the right-facing sprite (design system §6 map). */
const HAND_ROW = 9;

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** Places the gecko beside `target` (never over it), hand aimed at the target's near edge. */
export function placeGecko(target: Rect, viewport: Size, scale = 2): GeckoPlacement {
  const s = Math.max(1, Math.round(scale));
  const w = SPRITE_COLS * s;
  const h = SPRITE_ROWS * s;
  const maxX = Math.max(0, viewport.width - w);
  const maxY = Math.max(0, viewport.height - h);
  const handY = clamp(target.y + target.height / 2 - (HAND_ROW + 0.5) * s, 0, maxY);

  const leftX = target.x - GAP - w;
  if (leftX >= 0) return { x: leftX, y: handY, facing: "right", scale: s };
  const rightX = target.x + target.width + GAP;
  if (rightX + w <= viewport.width) return { x: rightX, y: handY, facing: "left", scale: s };

  // Target too wide for either side: sit above it, else below.
  const x = clamp(target.x, 0, maxX);
  const aboveY = target.y - GAP - h;
  if (aboveY >= 0) return { x, y: aboveY, facing: "right", scale: s };
  return { x, y: clamp(target.y + target.height + GAP, 0, maxY), facing: "right", scale: s };
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Panel corner: bottom-right unless it would cover the target or an `avoid` rect. */
export function placePanel(
  target: Rect | null,
  viewport: Size,
  panel: Size,
  margin = 24,
  avoid: readonly Rect[] = [],
): { x: number; y: number } {
  const obstacles = target ? [target, ...avoid] : avoid;
  const right = Math.max(0, viewport.width - panel.width - margin);
  const bottom = Math.max(0, viewport.height - panel.height - margin);
  const corners = [
    { x: right, y: bottom },
    { x: margin, y: bottom },
    { x: right, y: margin },
    { x: margin, y: margin },
  ];
  const overlap = (c: { x: number; y: number }) =>
    obstacles.reduce((sum, o) => sum + overlapArea({ ...c, ...panel }, o), 0);
  return corners.find((c) => overlap(c) === 0) ?? corners.reduce((a, b) => (overlap(b) < overlap(a) ? b : a));
}
