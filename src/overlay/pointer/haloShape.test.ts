import { describe, expect, it } from "vitest";
import { GUESS_DIAMETER, RING_GAP, haloShape } from "./haloShape";

const view = { width: 1512, height: 982 };

describe("haloShape", () => {
  it("rings an ordinary control just outside its edges, pill-round when short", () => {
    const s = haloShape({ x: 100, y: 200, width: 80, height: 24 }, false, view);
    expect(s.kind).toBe("ring");
    expect(s.rect).toEqual({ x: 100 - RING_GAP, y: 200 - RING_GAP, width: 80 + 2 * RING_GAP, height: 24 + 2 * RING_GAP });
    if (s.kind === "ring") expect(s.radius).toBe(12);
  });

  it("keeps taller controls gently rounded, not pills", () => {
    const s = haloShape({ x: 100, y: 200, width: 300, height: 120 }, false, view);
    expect(s.kind).toBe("ring");
    if (s.kind === "ring") expect(s.radius).toBeLessThanOrEqual(12);
  });

  it("circles tiny controls around their centre, at least 28 px", () => {
    const s = haloShape({ x: 50, y: 50, width: 12, height: 12 }, false, view);
    expect(s.kind).toBe("circle");
    expect(s.rect.width).toBe(28);
    expect(s.rect.x + s.rect.width / 2).toBe(56);
    expect(s.rect.y + s.rect.height / 2).toBe(56);
  });

  it("marks screen-sized regions with corner brackets, clipped on screen", () => {
    const s = haloShape({ x: -10, y: 40, width: 1600, height: 700 }, false, view);
    expect(s.kind).toBe("brackets");
    expect(s.rect.x).toBe(RING_GAP);
    expect(s.rect.x + s.rect.width).toBe(view.width - RING_GAP);
  });

  it("draws a best guess as the fixed dashed circle on the point", () => {
    const s = haloShape({ x: 488, y: 288, width: 24, height: 24 }, true, view);
    expect(s).toEqual({
      kind: "guess",
      rect: { x: 500 - GUESS_DIAMETER / 2, y: 300 - GUESS_DIAMETER / 2, width: GUESS_DIAMETER, height: GUESS_DIAMETER },
    });
  });
});
