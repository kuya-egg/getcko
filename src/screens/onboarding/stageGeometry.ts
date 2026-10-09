// Where GetcKo stands next to the onboarding target, worked out from the sprite cells (pure, tested).
// Brand rule 7: beside the target, never on it. The target's lower-left corner sits just up and to the
// right of the pointing hand tip; every other pose steps back until no cell beside the target is
// closer than CLEAR px to it (halo ring included).
import { MOMENT_POSE, buildPose, handTip, pointPoseFor, type Moment, type Pose } from "../../brand";
import { SPRITE_H } from "../../brand/mascot/sprites";

/** Onboarding scale (brand rule 7). One size for every step, so GetcKo never jumps between steps. */
export const STAGE_SCALE = 8;

/** Gap between the hand tip's right edge and the target's left edge, px (the hand points at the corner). */
export const TIP_GAP_X = 4;
/** Gap between the hand tip's top and the target's bottom edge, px (clears the halo ring). */
export const TIP_GAP_Y = 16;
/** Brand "beside" spacing: no sprite cell that sits beside the target comes closer than this, px. */
export const CLEAR = 12;
/** Widest halo ring (the dark-island one: 3px night + 3px sun), px. */
export const HALO_RING = 6;

export interface StageGeometry {
  pose: Pose;
  pointing: boolean;
  /** Target's left edge from the sprite box's left edge, px. */
  left: number;
  /** Target's bottom edge above the sprite's feet, px. */
  below: number;
  /** How far the sprite steps left of its pointing spot so its raised hand clears the target, px. */
  shift: number;
}

/** Rightmost opaque column (exclusive, in cells) over the rows that sit beside the target. */
export function rightEdgeBeside(pose: Pose, rowsAbove: number): number {
  const rows = buildPose(pose);
  let right = 0;
  for (let r = 0; r < Math.min(rowsAbove, rows.length); r++) {
    const row = rows[r];
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c] !== ".") {
        right = Math.max(right, c + 1);
        break;
      }
    }
  }
  return right;
}

/**
 * `grounded`: the target stands on the floor beside GetcKo instead of up by its hand (a step where
 * GetcKo doesn't point, like the models list): every row is then beside the target.
 */
export function stageGeometry(moment: Moment, s: number = STAGE_SCALE, grounded = false): StageGeometry {
  const pointing = moment === "screenHelp";
  const pose: Pose = pointing ? pointPoseFor("upRight") : MOMENT_POSE[moment];
  const tip = handTip(false, "pointing");
  // Fixed for every pose, so the target never moves when GetcKo changes pose.
  const left = (tip.col + 1) * s + TIP_GAP_X;
  const below = grounded ? 0 : (SPRITE_H - tip.row) * s + TIP_GAP_Y;
  // Rows whose cells are level with the target or its halo ring.
  const beside = Math.ceil((SPRITE_H * s - below + HALO_RING) / s);
  const reach = rightEdgeBeside(pose, beside) * s;
  const shift = Math.max(0, reach + CLEAR - left);
  return { pose, pointing, left, below, shift };
}

/** The moments the onboarding stage shows. */
export const STAGE_MOMENTS: readonly Moment[] = ["screenHelp", "listening", "ready", "processing", "offline"];

/**
 * Room kept left of GetcKo for stepping back (the largest shift of any stage moment), px. Reserved on
 * every step, so the target stays put and only GetcKo moves when the pose changes.
 */
export const STEP_ROOM = Math.max(...STAGE_MOMENTS.flatMap((m) => [stageGeometry(m).shift, stageGeometry(m, STAGE_SCALE, true).shift]));
