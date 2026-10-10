// Shared overlay contract. Every module under src/overlay/ builds against these types;
// change them only together with all consumers.
import type { Answer } from "../bindings/Answer";
import type { PointerTarget } from "../bindings/PointerTarget";
import type { TurnEvent } from "../bindings/TurnEvent";
import type { TaskStep } from "../bindings/TaskStep";
import type { TurnId } from "../bindings/TurnId";

/** Mascot pose, design system §6. */
export type GeckoPose = "idle" | "thinking" | "pointing" | "speaking";

/**
 * Overlay view of the current turn. `listening` is local (mic held, `ask` not sent yet);
 * the rest mirror `TurnPhase` plus the three terminal `TurnEvent`s.
 */
export type TurnStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "answering"
  | "finished"
  | "cancelled"
  | "failed";

export type InputMode = "text" | "voice";


export interface OverlayState {
  status: TurnStatus;
  /** Turn the overlay is showing; `null` before the first ask. */
  turnId: TurnId | null;
  /**
   * Events with `turnId < minTurnId` belong to superseded turns and are ignored.
   * Set to `turnId + 1` on a new local ask, because `turn` events can arrive before `ask()` resolves.
   */
  minTurnId: TurnId;
  /**
   * A local ask is in flight and its turn id is not known yet. Only then may an unseen turn id be
   * adopted; other ids are turns started elsewhere (e.g. the main window's "Try this agent").
   */
  awaiting: boolean;
  screenHelp: boolean;
  question: string | null;
  /** `undefined` until the turn's single `target` event; `null` = answer has no on-screen target. */
  target: PointerTarget | null | undefined;
  sentences: string[];
  /** Set by `finished`; carries citations, confidence and measured latency. */
  answer: Answer | null;
  error: string | null;
  /** Answer card visible. While true, global Esc is registered and means stop + dismiss. */
  cardOpen: boolean;
  /** Text composer visible and focused (window interactive). */
  composerOpen: boolean;
  /**
   * Earlier steps of the guided task this turn continues (S5), oldest first; empty for a fresh
   * question. The current turn is step `task.length + 1`.
   */
  task: TaskStep[];
  /** This turn's step of the guided-task plan (core `step` event); `null` without a plan. */
  planStep: { number: number; total: number } | null;
}

export type OverlayAction =
  | { type: "event"; event: TurnEvent }
  /** Mic held (`pttStart(screenHelp)` called). */
  | { type: "listen" }
  /**
   * Local ask about to be sent; `question` is known for text input only. `task` holds the earlier
   * steps sent with it (`[]` starts a fresh question and ends any guided task).
   */
  | { type: "asked"; input: InputMode; screenHelp: boolean; question: string | null; task: TaskStep[] }
  | { type: "askResolved"; turnId: TurnId }
  | { type: "askRejected"; message: string }
  /** User pressed stop; core will follow with `cancelled`. */
  | { type: "stop" }
  /** Close the answer card and return to idle. */
  | { type: "dismiss" }
  | { type: "openComposer" }
  | { type: "closeComposer" };

/** Size in CSS pixels. */
export interface Size {
  width: number;
  height: number;
}

/** Gecko sprite placement in overlay CSS pixels (monitor-relative). */
export interface GeckoPlacement {
  x: number;
  y: number;
  /** Sprite faces this way so the pointing hand aims at the target. */
  facing: "left" | "right";
  /** Whole-number pixel scale (design system §6 rendering rules). */
  scale: number;
}

/** OS-adapted labels and shortcuts (design system §8). */
export interface PlatformInfo {
  os: "macos" | "windows";
  /** Accelerator for tauri-plugin-global-shortcut, e.g. `Alt+Space`. */
  askShortcut: string;
  /** Keycap label, e.g. `⌥ Space`. */
  askLabel: string;
  /** Latency suffix, e.g. `on this Mac`. */
  hostLabel: string;
}
