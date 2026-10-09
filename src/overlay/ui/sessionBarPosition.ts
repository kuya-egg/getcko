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
