// GetcKo brand: JS entry. CSS entry is ./index.css (import it once per window).
export { useTheme, setTheme, getTheme, initTheme, resolveTheme } from "./theme";
export type { ThemePref, ResolvedTheme } from "./theme";
export { FONT_FAMILIES, canvasFont, fontsReady } from "./fonts";
export type { FontRole } from "./fonts";
export { DUR, EASE, CSS_EASE, prefersReducedMotion } from "./motion";
export * from "./mascot";
export * from "./textures";
export {
  flyTo,
  haloIn,
  haloOut,
  answerCardIn,
  answerCardOut,
  pageIn,
  stepIn,
  staggerIn,
  speakLoop,
  thinkingLoop,
  idleLoop,
  frameLoop,
  placeBeside,
  geckoLand,
  geckoHop,
} from "./motion";
export type {
  Rect,
  Placement,
  PoseSetter,
  PlaceOptions,
  FlyToOptions,
  HaloOptions,
  CardOptions,
  PageOptions,
  StaggerOptions,
  FrameLoopOptions,
  SpeakOptions,
  ThinkingOptions,
} from "./motion";
