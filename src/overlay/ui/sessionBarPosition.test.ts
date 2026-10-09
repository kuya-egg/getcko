import { describe, expect, it } from "vitest";
import { clampBarPosition, composerBesideBar, parseBarPosition, positionFromFractions, positionFractions } from "./sessionBarPosition";

describe("session bar position", () => {
  it("clamps against the viewport work bounds including oversized bars", () => {
    expect(clampBarPosition({ x: 900, y: -2 }, { width: 800, height: 600 }, { width: 200, height: 100 })).toEqual({ x: 600, y: 0 });
    expect(clampBarPosition({ x: 20, y: 20 }, { width: 100, height: 80 }, { width: 200, height: 100 })).toEqual({ x: 0, y: 0 });
  });
  it("parses only finite fractional positions", () => {
    expect(parseBarPosition('{"x":0.5,"y":1}')).toEqual({ x: 0.5, y: 1 });
    for (const invalid of [null, "bad", "{}", '{"x":-0.1,"y":0}', '{"x":null,"y":0}']) expect(parseBarPosition(invalid)).toBeNull();
  });
  it("round-trips viewport fractions across sizes", () => {
    const oldViewport = { width: 1000, height: 800 };
    const bar = { width: 200, height: 100 };
    const fractions = positionFractions({ x: 400, y: 350 }, oldViewport, bar);
    expect(positionFromFractions(fractions, { width: 2000, height: 1600 }, bar)).toEqual({ x: 900, y: 750 });
  });
  it("opens the ask box against the bar: above when it fits, flush with the nearer side, on screen", () => {
    const viewport = { width: 1000, height: 800 };
    const composer = { width: 480, height: 60 };
    // Bottom-right bar: above it, right edges flush.
    expect(composerBesideBar({ x: 700, y: 720, width: 280, height: 60 }, composer, viewport)).toEqual({ x: 500, y: 652 });
    // Top-left bar: no room above, so below it, left edges flush.
    expect(composerBesideBar({ x: 10, y: 20, width: 280, height: 60 }, composer, viewport)).toEqual({ x: 10, y: 88 });
    // A compact bar near the right edge never pushes the box off the left.
    expect(composerBesideBar({ x: 520, y: 400, width: 160, height: 60 }, composer, viewport).x).toBe(200);
    expect(composerBesideBar({ x: 600, y: 400, width: 40, height: 40 }, { width: 1200, height: 60 }, viewport).x).toBe(0);
  });
});
