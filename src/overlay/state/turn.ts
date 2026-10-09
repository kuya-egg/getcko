import type { TurnEvent } from "../../bindings/TurnEvent";
import type { TurnId } from "../../bindings/TurnId";
import type { GeckoPose, OverlayAction, OverlayState } from "../types";

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
};

export function turnIdOf(event: TurnEvent): TurnId {
  return event.type === "finished" ? event.answer.turnId : event.turnId;
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
      return { ...state, ...freshTurn, status: "idle", awaiting: false, cardOpen: false };
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
