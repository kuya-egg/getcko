import { describe, expect, it } from "vitest";
import { buildPose, type Moment } from "../../brand";
import { SPRITE_H } from "../../brand/mascot/sprites";
import { CLEAR, HALO_RING, STAGE_SCALE, rightEdgeBeside, stageGeometry } from "./stageGeometry";

const MOMENTS: Moment[] = ["screenHelp", "listening", "ready", "processing", "offline"];
const s = STAGE_SCALE;

describe("stageGeometry", () => {
  it("keeps the target in one spot whatever the pose", () => {
    const spots = MOMENTS.map((m) => {
      const g = stageGeometry(m);
      return `${g.left},${g.below}`;
    });
    expect(new Set(spots).size).toBe(1);
  });

  it("never puts a sprite cell beside the target closer than CLEAR px", () => {
    for (const [m, grounded] of MOMENTS.flatMap((m) => [[m, false], [m, true]] as const)) {
      const g = stageGeometry(m, s, grounded);
      const rows = buildPose(g.pose);
      const targetBottom = g.below - HALO_RING; // ring included
      rows.forEach((row, r) => {
        const cellBottom = (SPRITE_H - r - 1) * s; // from the feet
        if (cellBottom + s <= targetBottom) return; // fully below the target and its ring
        const last = row.search(/[^.][.]*$/);
        if (last < 0) return;
        const right = (last + 1) * s - g.shift;
        expect(g.left - right, `${m} ${grounded} row ${r}`).toBeGreaterThanOrEqual(CLEAR);
      });
    }
  });

  it("points without stepping back; a raised hand steps back", () => {
    expect(stageGeometry("screenHelp").shift).toBe(0);
    expect(stageGeometry("listening").shift).toBeGreaterThan(0);
  });

  it("hand tip sits just below and left of the target's corner", () => {
    const g = stageGeometry("screenHelp");
    expect(g.left).toBeGreaterThanOrEqual(22 * s); // tip col 21 ends at 22 cells
    expect(rightEdgeBeside("pointing", 9) * s).toBeLessThan(g.left);
  });
});
