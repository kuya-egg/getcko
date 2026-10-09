export interface BarPosition { x: number; y: number }
export interface BarViewport { width: number; height: number }
export function clampBarPosition(position: BarPosition, viewport: BarViewport, bar: BarViewport): BarPosition {
  return {
    x: Math.max(0, Math.min(position.x, Math.max(0, viewport.width - bar.width))),
    y: Math.max(0, Math.min(position.y, Math.max(0, viewport.height - bar.height))),
  };
}
export function parseBarPosition(value: string | null): BarPosition | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { x, y } = parsed as Record<string, unknown>;
    return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1 && typeof y === "number" && Number.isFinite(y) && y >= 0 && y <= 1 ? { x, y } : null;
  } catch {
    return null;
  }
}
export function positionFromFractions(fractions: BarPosition, viewport: BarViewport, bar: BarViewport): BarPosition {
  return clampBarPosition({ x: fractions.x * Math.max(0, viewport.width - bar.width), y: fractions.y * Math.max(0, viewport.height - bar.height) }, viewport, bar);
}
export function positionFractions(position: BarPosition, viewport: BarViewport, bar: BarViewport): BarPosition {
  const bounded = clampBarPosition(position, viewport, bar);
  return {
    x: bounded.x / Math.max(1, viewport.width - bar.width),
    y: bounded.y / Math.max(1, viewport.height - bar.height),
  };
}

/** Gap between the session bar and the ask box it opens, CSS px. */
export const COMPOSER_GAP = 8;

/**
 * Where the ask box opens: attached to the session bar, above it when it fits there,
 * else below; flush with the bar's edge nearer the screen side, kept on screen.
 */
export function composerBesideBar(bar: BarPosition & BarViewport, composer: BarViewport, viewport: BarViewport): BarPosition {
  const above = bar.y - COMPOSER_GAP - composer.height;
  const y = above >= 0 ? above : bar.y + bar.height + COMPOSER_GAP;
  const leftHalf = bar.x + bar.width / 2 < viewport.width / 2;
  const x = leftHalf ? bar.x : bar.x + bar.width - composer.width;
  return clampBarPosition({ x, y }, viewport, composer);
}
