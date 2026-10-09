// GetcKo mascot: sprite data + React renderers. Motion helpers live in ../motion.
export {
  SPRITE_W,
  SPRITE_H,
  HEAD_ROWS,
  PALETTE,
  POINTING,
  POSE_OVERRIDES,
  POSE_MAPS,
  POSE_DERIVED,
  POSES,
  BLINK_OF,
  POSE_CYCLES,
  POSE_TIP,
  buildPose,
  buildHeadMark,
  poseSize,
  handTip,
  pointPoseFor,
  validateSprites,
} from "./sprites";
export type { Pose, CellKey, SpritePalette, BuildPoseOptions } from "./sprites";
export { MOMENT_POSE } from "./moments";
export type { Moment } from "./moments";
export { GetCkoSprite, GetCkoHeadMark } from "./GetCkoSprite";
export type { GetCkoSpriteProps, GetCkoHeadMarkProps } from "./GetCkoSprite";
