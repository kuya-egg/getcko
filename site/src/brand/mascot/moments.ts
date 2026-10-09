import type { Pose } from "./sprites";

// Product moment -> GetcKo pose. One source of truth for every surface (overlay, app, onboarding,
// video). See docs/brand/mascot-poses.md for frames, timing and scale rules.

export type Moment =
  | "idle"
  | "onboarding"
  | "listening"
  | "thinking"
  | "processing"
  | "screenHelp"
  | "speaking"
  | "ready"
  | "failed"
  | "offline"
  | "empty"
  | "moving"
  | "endCard";

export const MOMENT_POSE = {
  /** App idle / paused (alternate sleeping and sleeping2). */
  idle: "sleeping",
  /** Onboarding welcome (alternate wave and wave2). */
  onboarding: "wave",
  /** Push-to-talk held. */
  listening: "listening",
  /** STT, retrieval, LLM running. */
  thinking: "thinking",
  /** Knowledge base import, indexing a document. */
  processing: "reading",
  /** Screen Help answer: up-right by default; use pointPoseFor() for right / down-right targets. */
  screenHelp: "pointing",
  /** TTS playing (swap with the rest pose via speakLoop). */
  speaking: "speaking",
  /** Import done, answer found. */
  ready: "success",
  /** "Hindi ko alam", failed import, no source found. */
  failed: "confused",
  /** Offline badge, model not loaded, no network needed but a service is down. */
  offline: "offline",
  /** Empty states and panel edges (clingSide on horizontal edges). */
  empty: "cling",
  /** Hopping between targets (alternate walk1 and walk2 during the flight). */
  moving: "walk1",
  /** Demo end card (alternate celebrate and celebrate2). */
  endCard: "celebrate",
} as const satisfies Record<Moment, Pose>;
