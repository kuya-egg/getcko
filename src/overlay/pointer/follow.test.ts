import { describe, expect, it } from "vitest";
import { initialFollowState, reduceFollow } from "./follow";

const target = { x: 10, y: 20, width: 40, height: 30 };
describe("reduceFollow", () => {
  it("follows a target until the cursor enters and dwells 300 ms", () => {
    const focused = reduceFollow(initialFollowState, { type: "turn-start", target, now: 0 });
    const entered = reduceFollow(focused, { type: "cursor", x: 20, y: 25, now: 100 });
    expect(entered.mode).toBe("dwelling");
    expect(reduceFollow(entered, { type: "tick", now: 399 }).mode).toBe("dwelling");
    expect(reduceFollow(entered, { type: "tick", now: 400 }).mode).toBe("cursor");
  });

  it("returns after eight seconds from the finished turn without cursor movement", () => {
    let state = reduceFollow(initialFollowState, { type: "turn-start", target, now: 0 });
    state = reduceFollow(state, { type: "turn-finished", now: 500 });
    expect(reduceFollow(state, { type: "tick", now: 8_499 }).mode).toBe("target");
    expect(reduceFollow(state, { type: "tick", now: 8_500 }).mode).toBe("cursor");
  });

  it("resets on dismissal or a new turn", () => {
    const focused = reduceFollow(initialFollowState, { type: "turn-start", target, now: 0 });
    expect(reduceFollow(focused, { type: "dismiss" }).mode).toBe("cursor");
    expect(reduceFollow(focused, { type: "turn-start", target: null, now: 1 })).toMatchObject({ mode: "cursor", target: null });
  });

  it("resumes pointing if the cursor leaves during dwell", () => {
    const focused = reduceFollow(initialFollowState, { type: "turn-start", target, now: 0 });
    const entered = reduceFollow(focused, { type: "cursor", x: 20, y: 25, now: 10 });
    expect(reduceFollow(entered, { type: "cursor", x: 100, y: 100, now: 20 }).mode).toBe("target");
  });
});
