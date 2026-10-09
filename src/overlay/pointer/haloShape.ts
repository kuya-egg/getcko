// Fits the target halo to what it marks (design system §5.3: one sun ring, drawn in, two
// pulses). A ring hugs ordinary controls with corners that follow their height; tiny
// controls get a findable circle; regions too big to ring (a document, a table) get four
// corner brackets; a tier-3 best guess (no element box) stays a dashed circle.
import type { Rect } from "../../bindings/Rect";
import type { Size } from "../types";

export type HaloShape =
  | { kind: "ring"; rect: Rect; radius: number }
  | { kind: "circle"; rect: Rect }
  | { kind: "brackets"; rect: Rect; arm: number }
  | { kind: "guess"; rect: Rect };

/** Gap between the element's edge and the ring, CSS px. */
export const RING_GAP = 3;
/** Controls this small (both sides) are circled instead: an icon, a checkbox. */
const TINY = 32;
/** Smallest circle diameter, so a 12 px checkbox still gets a visible ring. */
const MIN_CIRCLE = 28;
/** Regions wider than this share of the screen, or taller than this share, get brackets. */
const HUGE_WIDTH = 0.5;
const HUGE_HEIGHT = 0.4;
/** Best-guess circle diameter (unchanged from the overlay spec). */
export const GUESS_DIAMETER = 36;

/** Keeps `r` on screen (with `margin` so the ring itself stays visible). */
function clip(r: Rect, view: Size, margin: number): Rect {
  const x = Math.max(margin, r.x);
  const y = Math.max(margin, r.y);
  const right = Math.min(view.width - margin, r.x + r.width);
  const bottom = Math.min(view.height - margin, r.y + r.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

export function haloShape(target: Rect, bestGuess: boolean, view: Size): HaloShape {
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  if (bestGuess) {
    const d = GUESS_DIAMETER;
    return { kind: "guess", rect: { x: cx - d / 2, y: cy - d / 2, width: d, height: d } };
  }
  if (target.width <= TINY && target.height <= TINY) {
    const d = Math.max(MIN_CIRCLE, Math.max(target.width, target.height) + 2 * RING_GAP + 4);
    return { kind: "circle", rect: { x: cx - d / 2, y: cy - d / 2, width: d, height: d } };
  }
  const padded = {
    x: target.x - RING_GAP,
    y: target.y - RING_GAP,
    width: target.width + 2 * RING_GAP,
    height: target.height + 2 * RING_GAP,
  };
  const rect = clip(padded, view, RING_GAP);
  if (target.width > view.width * HUGE_WIDTH || target.height > view.height * HUGE_HEIGHT) {
    const arm = Math.round(Math.min(32, Math.max(14, Math.min(rect.width, rect.height) * 0.12)));
    return { kind: "brackets", rect, arm };
  }
  // Short controls (buttons, fields, menu items) read as pills; taller ones stay gently rounded.
  const radius = Math.round(rect.height <= 40 ? Math.min(rect.height / 2, 12) : Math.min(12, rect.height * 0.15));
  return { kind: "ring", rect, radius: Math.max(4, radius) };
}
