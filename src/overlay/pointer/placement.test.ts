import { describe, expect, it } from "vitest";
import type { Rect } from "../../bindings/Rect";
import { placeGecko, placePanel, rectsIntersect } from "./placement";
import { SPRITE_COLS, SPRITE_ROWS } from "./sprite";

const viewport = { width: 1440, height: 900 };
const panel = { width: 360, height: 240 };

function geckoBox(target: Rect, scale = 2): Rect {
  const p = placeGecko(target, viewport, scale);
  return { x: p.x, y: p.y, width: SPRITE_COLS * p.scale, height: SPRITE_ROWS * p.scale };
}

function inside(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height;
}

const targets: Record<string, Rect> = {
  centre: { x: 700, y: 430, width: 80, height: 32 },
  topLeft: { x: 0, y: 0, width: 60, height: 24 },
  topRight: { x: 1380, y: 0, width: 60, height: 24 },
  bottomLeft: { x: 0, y: 876, width: 60, height: 24 },
  bottomRight: { x: 1380, y: 876, width: 60, height: 24 },
  leftEdge: { x: 0, y: 400, width: 40, height: 40 },
  rightEdge: { x: 1400, y: 400, width: 40, height: 40 },
  fullWidth: { x: 0, y: 400, width: 1440, height: 40 },
};

describe("placeGecko", () => {
  for (const [name, target] of Object.entries(targets)) {
    it(`never covers the target and stays on screen: ${name}`, () => {
      const box = geckoBox(target);
      expect(rectsIntersect(box, target)).toBe(false);
      expect(inside(box)).toBe(true);
    });
  }

  it("sits left of the target facing right when there is room", () => {
    const p = placeGecko(targets.centre, viewport);
    expect(p.facing).toBe("right");
    expect(p.x + SPRITE_COLS * p.scale).toBeLessThanOrEqual(targets.centre.x - 8);
  });

  it("flips to the right side facing left near the left edge", () => {
    const p = placeGecko(targets.leftEdge, viewport);
    expect(p.facing).toBe("left");
    expect(p.x).toBeGreaterThanOrEqual(targets.leftEdge.x + targets.leftEdge.width + 8);
  });

  it("only uses whole-number scales", () => {
    expect(placeGecko(targets.centre, viewport, 2.6).scale).toBe(3);
    expect(placeGecko(targets.centre, viewport, 0.2).scale).toBe(1);
  });
});

describe("placePanel", () => {
  const box = (p: { x: number; y: number }): Rect => ({ ...p, ...panel });

  it("defaults to bottom-right with no target", () => {
    expect(placePanel(null, viewport, panel)).toEqual({ x: 1056, y: 636 });
  });

  for (const name of ["bottomRight", "bottomLeft", "topRight", "topLeft", "centre"]) {
    it(`does not cover a target at ${name}`, () => {
      expect(rectsIntersect(box(placePanel(targets[name], viewport, panel)), targets[name])).toBe(false);
    });
  }

  it("also avoids the gecko box", () => {
    const target = targets.bottomRight;
    const gecko = geckoBox(target);
    const p = box(placePanel(target, viewport, panel, 24, [gecko, { x: 0, y: 600, width: 400, height: 300 }]));
    expect(rectsIntersect(p, target)).toBe(false);
    expect(rectsIntersect(p, gecko)).toBe(false);
    expect(p.y).toBe(24);
  });

  it("picks the least-covered corner when every corner is blocked", () => {
    const blockers: Rect[] = [
      { x: 1100, y: 700, width: 300, height: 150 },
      { x: 30, y: 650, width: 300, height: 200 },
      { x: 1100, y: 30, width: 20, height: 20 },
      { x: 30, y: 30, width: 300, height: 200 },
    ];
    expect(placePanel(null, viewport, panel, 24, blockers)).toEqual({ x: 1056, y: 24 });
  });
});
