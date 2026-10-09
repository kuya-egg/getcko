import type { Rect } from "../../bindings/Rect";

export type FollowMode = "cursor" | "target" | "dwelling";
export interface FollowState {
  mode: FollowMode;
  target: Rect | null;
  cursorX: number | null;
  cursorY: number | null;
  lastMovementAt: number;
  enteredAt: number | null;
  turnFinishedAt: number | null;
}
export type FollowAction =
  | { type: "turn-start"; target: Rect | null; now: number }
  | { type: "turn-finished"; now: number }
  | { type: "cursor"; x: number; y: number; now: number }
  | { type: "dismiss" }
  | { type: "tick"; now: number };

export const initialFollowState: FollowState = {
  mode: "cursor", target: null, cursorX: null, cursorY: null, lastMovementAt: 0, enteredAt: null, turnFinishedAt: null,
};
const DWELL_MS = 300;
const RETURN_MS = 8_000;

export function reduceFollow(state: FollowState, action: FollowAction): FollowState {
  switch (action.type) {
    case "turn-start":
      return { ...initialFollowState, mode: action.target ? "target" : "cursor", target: action.target, lastMovementAt: action.now };
    case "turn-finished":
      return { ...state, turnFinishedAt: action.now };
    case "dismiss":
      return initialFollowState;
    case "cursor": {
      const moved = action.x !== state.cursorX || action.y !== state.cursorY;
      const inside = state.target !== null && action.x >= state.target.x && action.x <= state.target.x + state.target.width && action.y >= state.target.y && action.y <= state.target.y + state.target.height;
      const base = { ...state, cursorX: action.x, cursorY: action.y, lastMovementAt: moved ? action.now : state.lastMovementAt };
      if (state.mode === "target" && inside) return { ...base, mode: "dwelling", enteredAt: action.now };
      if (state.mode === "dwelling" && !inside) return { ...base, mode: "target", enteredAt: null };
      return base;
    }
    case "tick":
      if ((state.mode === "dwelling" && state.enteredAt !== null && action.now - state.enteredAt >= DWELL_MS) ||
          (state.mode === "target" && state.turnFinishedAt !== null && action.now - state.turnFinishedAt >= RETURN_MS)) {
        return { ...initialFollowState, cursorX: state.cursorX, cursorY: state.cursorY };
      }
      return state;
  }
}
