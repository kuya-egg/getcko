import type { PointerTarget } from "../../bindings/PointerTarget";
import type { TaskStep } from "../../bindings/TaskStep";
import type { TurnEvent } from "../../bindings/TurnEvent";
import type { TurnId } from "../../bindings/TurnId";
import type { GeckoPose, OverlayAction, OverlayState } from "../types";

/** PRD S5: a guided task keeps context for at most this many steps (core `MAX_TASK_STEPS`). */
export const MAX_TASK_STEPS = 5;

type TurnFields = Pick<OverlayState, "question" | "target" | "sentences" | "answer" | "error">;

const freshTurn: TurnFields = {
  question: null,
  target: undefined,
  sentences: [],
  answer: null,
  error: null,
};

export const initialOverlayState: OverlayState = {
  status: "idle",
  turnId: null,
  minTurnId: 0,
  awaiting: false,
  screenHelp: false,
  ...freshTurn,
  cardOpen: false,
  composerOpen: false,
  task: [],
};

export function turnIdOf(event: TurnEvent): TurnId {
  return event.type === "finished" ? event.answer.turnId : event.turnId;
}

/**
 * Earlier steps to send when the user asks for the next step, or `null` when this answer cannot
 * be continued: it is not a finished screen-help answer, or the task already has MAX_TASK_STEPS.
 */
export function nextTaskSteps(state: OverlayState): TaskStep[] | null {
  if (state.status !== "finished" || !state.screenHelp || state.answer === null) return null;
  if (state.task.length + 1 >= MAX_TASK_STEPS) return null;
  const step: TaskStep = {
    question: state.answer.question,
    answer: state.answer.text,
    // A best-guess point has no element name to carry into the next step's prompt.
    targetLabel: state.target && !isBestGuess(state.target) ? state.target.label : null,
  };
  return [...state.task, step];
}

/** A tier-3 point read from a screenshot, not an element (known from the target event). */
export function isBestGuess(target: PointerTarget): boolean {
  return target.elementId === null;
}

function nextMinTurnId(state: OverlayState): TurnId {
  return state.turnId === null ? 0 : state.turnId + 1;
}

function applyEvent(state: OverlayState, event: TurnEvent): OverlayState {
  const id = turnIdOf(event);
  if (id < state.minTurnId) return state;
  let s = state;
  if (id !== state.turnId) {
    // Not ours unless a local ask is waiting for its id (main-window turns, stopped asks).
    if (!state.awaiting) return state;
    s = { ...state, turnId: id, awaiting: false };
  } else if (state.status === "cancelled" || state.status === "idle") {
    // Stopped or dismissed turn: its trailing events must not revive the card or the gecko.
    return state;
  }

  switch (event.type) {
    case "phase":
      return { ...s, status: event.phase };
    case "question":
      return { ...s, question: event.text };
    case "target":
      return { ...s, target: event.target };
    case "sentence":
      return { ...s, sentences: [...s.sentences, event.text] };
    case "finished":
      return {
        ...s,
        status: "finished",
        answer: event.answer,
        target: s.target === undefined ? event.answer.target : s.target,
      };
    case "cancelled":
      return { ...s, status: "cancelled", cardOpen: false };
    case "failed":
      return { ...s, status: "failed", error: event.message, cardOpen: true };
  }
}

export function reduceOverlay(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case "event":
      return applyEvent(state, action.event);
    case "listen":
      return {
        ...state,
        ...freshTurn,
        status: "listening",
        minTurnId: nextMinTurnId(state),
        awaiting: true,
        cardOpen: true,
        composerOpen: false,
      };
    case "asked": {
      const voice = action.input === "voice";
      return {
        ...state,
        ...freshTurn,
        status: voice ? "transcribing" : "thinking",
        question: voice ? null : action.question,
        screenHelp: action.screenHelp,
        minTurnId: nextMinTurnId(state),
        awaiting: true,
        cardOpen: true,
        composerOpen: false,
        task: action.task,
      };
    }
    case "askResolved":
      // Events for this id may already have been adopted. After a stop the status stays
      // `cancelled`, so the stopped turn's events keep being dropped.
      return { ...state, turnId: action.turnId, awaiting: false };
    case "askRejected":
      return { ...state, status: "failed", error: action.message, awaiting: false, cardOpen: true };
    case "stop":
      return { ...state, status: "cancelled", awaiting: false, cardOpen: false, composerOpen: false };
    case "dismiss":
      return { ...state, ...freshTurn, status: "idle", awaiting: false, cardOpen: false, task: [] };
    case "openComposer":
      return { ...state, composerOpen: true };
    case "closeComposer":
      return { ...state, composerOpen: false };
  }
}

export function geckoPose(state: OverlayState): GeckoPose {
  switch (state.status) {
    case "transcribing":
    case "thinking":
      return "thinking";
    case "answering":
      return "speaking";
    case "finished":
      return state.target ? "pointing" : "idle";
    default:
      return "idle";
  }
}
