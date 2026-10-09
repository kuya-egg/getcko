import { describe, expect, it } from "vitest";
import type { Answer } from "../../bindings/Answer";
import type { PointerTarget } from "../../bindings/PointerTarget";
import type { TurnEvent } from "../../bindings/TurnEvent";
import type { TaskStep } from "../../bindings/TaskStep";
import type { OverlayAction, OverlayState } from "../types";
import { geckoPose, initialOverlayState, MAX_TASK_STEPS, nextTaskSteps, reduceOverlay } from "./turn";

const target: PointerTarget = {
  elementId: "e1",
  label: "Save",
  monitor: { x: 0, y: 0, width: 1920, height: 1080, scaleFactor: 1 },
  rect: { x: 10, y: 20, width: 80, height: 24 },
};

function answer(turnId: number, t: PointerTarget | null): Answer {
  return {
    turnId,
    question: "where is save",
    text: "Top left.",
    citations: [],
    target: t,
    confidence: "normal",
    latency: { transcribeMs: null, screenMs: null, retrievalMs: 1, firstTokenMs: 2, totalMs: 3 },
  };
}

const ev = (event: TurnEvent): OverlayAction => ({ type: "event", event });
const run = (actions: OverlayAction[], from: OverlayState = initialOverlayState) =>
  actions.reduce(reduceOverlay, from);
const askText = (question = "where is save", task: TaskStep[] = []): OverlayAction => ({
  type: "asked",
  input: "text",
  screenHelp: true,
  question,
  task,
});

describe("guided task (S5)", () => {
  const finishStep = (from: OverlayState, n: number, task: TaskStep[]) =>
    run(
      [
        askText(`step ${n}`, task),
        { type: "askResolved", turnId: n },
        ev({ type: "target", turnId: n, target }),
        ev({ type: "finished", answer: { ...answer(n, target), question: `step ${n}`, text: `answer ${n}` } }),
      ],
      from,
    );

  it("offers next for steps 1-4, sends earlier steps oldest first, and ends after step 5", () => {
    let s = finishStep(initialOverlayState, 1, []);
    for (let n = 2; n <= MAX_TASK_STEPS; n++) {
      const steps = nextTaskSteps(s);
      expect(steps).toHaveLength(n - 1);
      expect(steps?.[0]).toEqual({ question: "step 1", answer: "answer 1", targetLabel: "Save" });
      expect(steps?.[steps.length - 1]?.question).toBe(`step ${n - 1}`);
      s = finishStep(s, n, steps ?? []);
    }
    expect(s.task).toHaveLength(MAX_TASK_STEPS - 1);
    expect(nextTaskSteps(s)).toBeNull();
  });

  it("a fresh question or dismiss drops the earlier steps", () => {
    const two = finishStep(finishStep(initialOverlayState, 1, []), 2, [
      { question: "step 1", answer: "answer 1", targetLabel: "Save" },
    ]);
    expect(two.task).toHaveLength(1);
    expect(run([askText("unrelated")], two).task).toEqual([]);
    expect(run([{ type: "dismiss" }], two).task).toEqual([]);
  });

  it("does not offer next for answers without screen help or before they finish", () => {
    const noScreen = run([
      { type: "asked", input: "text", screenHelp: false, question: "q", task: [] },
      { type: "askResolved", turnId: 1 },
      ev({ type: "finished", answer: answer(1, null) }),
    ]);
    expect(nextTaskSteps(noScreen)).toBeNull();
    expect(nextTaskSteps(run([askText(), { type: "askResolved", turnId: 1 }]))).toBeNull();
  });
});

describe("reduceOverlay", () => {
  it("ignores events from a superseded turn after a new ask", () => {
    const first = run([askText(), { type: "askResolved", turnId: 1 }, ev({ type: "sentence", turnId: 1, text: "old" })]);
    const s = run(
      [askText("next"), ev({ type: "sentence", turnId: 1, text: "late" }), ev({ type: "phase", turnId: 1, phase: "answering" })],
      first,
    );
    expect(s.sentences).toEqual([]);
    expect(s.status).toBe("thinking");
    expect(s.question).toBe("next");
  });

  it("adopts events that arrive before askResolved and keeps them after", () => {
    const s = run([
      askText(),
      ev({ type: "phase", turnId: 0, phase: "answering" }),
      ev({ type: "sentence", turnId: 0, text: "Top left." }),
      { type: "askResolved", turnId: 0 },
    ]);
    expect(s.turnId).toBe(0);
    expect(s.status).toBe("answering");
    expect(s.sentences).toEqual(["Top left."]);
  });

  it("keeps the typed question when the first event of the turn is a failure", () => {
    const s = run([askText("where is save"), ev({ type: "failed", turnId: 5, message: "no agent" })]);
    expect(s.question).toBe("where is save");
    expect(s.error).toBe("no agent");
    expect(s.cardOpen).toBe(true);
  });

  it("ignores turns it did not start, such as a main-window test chat", () => {
    const done = run([
      askText(),
      { type: "askResolved", turnId: 1 },
      ev({ type: "finished", answer: answer(1, target) }),
    ]);
    const s = run(
      [ev({ type: "phase", turnId: 2, phase: "thinking" }), ev({ type: "sentence", turnId: 2, text: "hi" })],
      done,
    );
    expect(s).toEqual(done);
  });

  it("keeps an explicit null target over the answer's target", () => {
    const s = run([
      askText(),
      { type: "askResolved", turnId: 0 },
      ev({ type: "target", turnId: 0, target: null }),
      ev({ type: "finished", answer: answer(0, target) }),
    ]);
    expect(s.target).toBeNull();
    expect(geckoPose(s)).toBe("idle");
  });

  it("falls back to the answer's target when no target event came", () => {
    const s = run([askText(), { type: "askResolved", turnId: 0 }, ev({ type: "finished", answer: answer(0, target) })]);
    expect(s.target).toEqual(target);
  });

  it("stays closed when cancelled arrives after stop", () => {
    const s = run([
      askText(),
      { type: "askResolved", turnId: 0 },
      ev({ type: "phase", turnId: 0, phase: "answering" }),
      { type: "stop" },
      ev({ type: "sentence", turnId: 0, text: "late" }),
      ev({ type: "cancelled", turnId: 0 }),
    ]);
    expect(s.status).toBe("cancelled");
    expect(s.cardOpen).toBe(false);
    expect(s.sentences).toEqual([]);
    expect(geckoPose(s)).toBe("idle");
  });

  it("drops a stopped turn's events even when stop came before askResolved", () => {
    const s = run([
      askText(),
      { type: "stop" },
      ev({ type: "phase", turnId: 3, phase: "thinking" }),
      { type: "askResolved", turnId: 3 },
      ev({ type: "sentence", turnId: 3, text: "late" }),
      ev({ type: "cancelled", turnId: 3 }),
    ]);
    expect(s.status).toBe("cancelled");
    expect(s.sentences).toEqual([]);
    expect(geckoPose(s)).toBe("idle");
    const next = run([askText("again"), ev({ type: "phase", turnId: 4, phase: "thinking" })], s);
    expect(next.status).toBe("thinking");
    expect(next.cardOpen).toBe(true);
  });

  it("shows the error and opens the card when the turn fails", () => {
    const s = run([
      { type: "openComposer" },
      askText(),
      { type: "askResolved", turnId: 0 },
      ev({ type: "failed", turnId: 0, message: "model crashed" }),
    ]);
    expect(s.status).toBe("failed");
    expect(s.error).toBe("model crashed");
    expect(s.cardOpen).toBe(true);
    expect(s.composerOpen).toBe(false);
  });

  it("shows the error when ask is rejected", () => {
    const s = run([askText(), { type: "askRejected", message: "busy" }]);
    expect(s.status).toBe("failed");
    expect(s.error).toBe("busy");
    expect(s.cardOpen).toBe(true);
  });
});

describe("geckoPose", () => {
  it("follows a full voice turn", () => {
    const steps: OverlayAction[] = [
      { type: "listen" },
      { type: "asked", input: "voice", screenHelp: true, question: null, task: [] },
      ev({ type: "phase", turnId: 0, phase: "thinking" }),
      { type: "askResolved", turnId: 0 },
      ev({ type: "target", turnId: 0, target }),
      ev({ type: "phase", turnId: 0, phase: "answering" }),
      ev({ type: "finished", answer: answer(0, target) }),
      { type: "dismiss" },
    ];
    const poses: string[] = [];
    steps.reduce((s, a) => {
      const next = reduceOverlay(s, a);
      poses.push(geckoPose(next));
      return next;
    }, initialOverlayState);
    expect(poses).toEqual(["idle", "thinking", "thinking", "thinking", "thinking", "speaking", "pointing", "idle"]);
  });
});
