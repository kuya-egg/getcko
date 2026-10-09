import { describe, expect, it } from "vitest";
import type { Answer } from "../../bindings/Answer";
import type { Citation } from "../../bindings/Citation";
import type { TurnEvent } from "../../bindings/TurnEvent";
import {
  TRY_INITIAL,
  isLive,
  isModelMissing,
  isWaiting,
  lastTurn,
  momentFor,
  tryReducer,
  type TryAction,
  type TryState,
} from "./tryChat";

const run = (actions: TryAction[], from: TryState = TRY_INITIAL) => actions.reduce(tryReducer, from);
const ev = (event: TurnEvent): TryAction => ({ type: "event", event });

const cite: Citation = { marker: 1, passageId: 1, documentId: 3, documentName: "Manual.pdf", location: "p. 4" };
const answer = (turnId: number, over: Partial<Answer> = {}): Answer => ({
  turnId,
  question: "Where?",
  text: "Click New entry [1].",
  citations: [cite],
  target: null,
  confidence: "normal",
  screenMode: null,
  latency: {} as Answer["latency"],
  ...over,
});

describe("tryReducer", () => {
  it("streams one turn: thinking → sentences → finished with sources", () => {
    const s = run([
      { type: "ask", key: 1, question: "Where?" },
      { type: "started", key: 1, turnId: 5 },
      ev({ type: "question", turnId: 5, text: "Where?" }),
      ev({ type: "phase", turnId: 5, phase: "thinking" }),
      ev({ type: "phase", turnId: 5, phase: "answering" }),
      ev({ type: "sentence", turnId: 5, text: "Click New entry at the top left." }),
      ev({ type: "sentence", turnId: 5, text: "That starts a record [1]." }),
      ev({ type: "finished", answer: answer(5, { citations: [cite, cite] }) }),
    ]);
    const t = lastTurn(s)!;
    expect(t.stage).toBe("done");
    expect(t.sentences).toEqual(["Click New entry at the top left.", "That starts a record."]);
    expect(t.citations).toHaveLength(1); // deduped
    expect(isLive(t)).toBe(false);
    expect(momentFor(t)).toBe("ready");
  });

  it("buffers events that arrive before ask() returns, then adopts them", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      ev({ type: "phase", turnId: 9, phase: "thinking" }),
      ev({ type: "sentence", turnId: 9, text: "Early." }),
      { type: "started", key: 1, turnId: 9 },
    ]);
    expect(lastTurn(s)).toMatchObject({ turnId: 9, stage: "answering", sentences: ["Early."] });
    expect(s.buffer).toEqual([]);
  });

  it("ignores turns it did not start (the overlay's) when nothing is in flight", () => {
    const done = run([
      { type: "ask", key: 1, question: "Q" },
      { type: "started", key: 1, turnId: 1 },
      ev({ type: "finished", answer: answer(1) }),
    ]);
    const after = run([ev({ type: "sentence", turnId: 42, text: "Not mine." })], done);
    expect(after).toBe(done);
  });

  it("buffered events of another turn are dropped on adoption", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      ev({ type: "sentence", turnId: 42, text: "Overlay's." }),
      { type: "started", key: 1, turnId: 3 },
    ]);
    expect(lastTurn(s)!.sentences).toEqual([]);
    expect(s.buffer).toEqual([]);
  });

  it("an answer with no sources is the don't-know moment", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      { type: "started", key: 1, turnId: 2 },
      ev({ type: "sentence", turnId: 2, text: "I don't know. It's not in your documents." }),
      ev({ type: "finished", answer: answer(2, { citations: [] }) }),
    ]);
    expect(momentFor(lastTurn(s))).toBe("failed");
  });

  it("an answer with no sources but real words is still ready (agent with no knowledge bases)", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      { type: "started", key: 1, turnId: 2 },
      ev({ type: "sentence", turnId: 2, text: "Open the File menu first." }),
      ev({ type: "finished", answer: answer(2, { citations: [], text: "Open the File menu first." }) }),
    ]);
    expect(momentFor(lastTurn(s))).toBe("ready");
  });

  it("answering before the first sentence is still waiting", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      { type: "started", key: 1, turnId: 2 },
      ev({ type: "phase", turnId: 2, phase: "answering" }),
    ]);
    expect(isWaiting(lastTurn(s)!)).toBe(true);
    expect(momentFor(lastTurn(s))).toBe("thinking");
    const s2 = run([ev({ type: "sentence", turnId: 2, text: "One." })], s);
    expect(isWaiting(lastTurn(s2)!)).toBe(false);
    expect(momentFor(lastTurn(s2))).toBe("speaking");
  });

  it("knows the backend's missing-model messages", () => {
    expect(isModelMissing("chat model is not available")).toBe(true);
    expect(isModelMissing("embedding model is not available")).toBe(true);
    expect(isModelMissing("models are loading")).toBe(true);
    expect(isModelMissing("engine stopped")).toBe(false);
  });

  it("uses the answer text when no sentences were streamed", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      { type: "started", key: 1, turnId: 2 },
      ev({ type: "finished", answer: answer(2) }),
    ]);
    expect(lastTurn(s)!.sentences).toEqual(["Click New entry."]);
  });

  it("ask() throwing marks the turn failed with the error", () => {
    const err = { kind: "unavailable", message: "chat model not loaded" };
    const s = run([{ type: "ask", key: 1, question: "Q" }, { type: "error", key: 1, error: err }]);
    expect(lastTurn(s)).toMatchObject({ stage: "failed", error: err });
    expect(momentFor(lastTurn(s))).toBe("failed");
  });

  it("a backend failure keeps its message; later events are ignored", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      { type: "started", key: 1, turnId: 4 },
      ev({ type: "failed", turnId: 4, message: "engine stopped" }),
      ev({ type: "sentence", turnId: 4, text: "late" }),
    ]);
    expect(lastTurn(s)).toMatchObject({ stage: "failed", error: "engine stopped", sentences: [] });
  });

  it("stop → cancelled keeps the words said so far", () => {
    const s = run([
      { type: "ask", key: 1, question: "Q" },
      { type: "started", key: 1, turnId: 4 },
      ev({ type: "sentence", turnId: 4, text: "First." }),
      ev({ type: "cancelled", turnId: 4 }),
    ]);
    expect(lastTurn(s)).toMatchObject({ stage: "cancelled", sentences: ["First."] });
    expect(momentFor(lastTurn(s))).toBeUndefined();
  });

  it("a voice turn listens, then takes the transcribed question", () => {
    const s = run([
      { type: "ask", key: 1, question: "", voice: true },
      { type: "started", key: 1, turnId: 8 },
      ev({ type: "phase", turnId: 8, phase: "transcribing" }),
    ]);
    expect(lastTurn(s)).toMatchObject({ stage: "listening", question: "" });
    expect(momentFor(lastTurn(s))).toBe("listening");
    const t = run([ev({ type: "question", turnId: 8, text: "Saan ang grade?" })], s);
    expect(lastTurn(t)!.question).toBe("Saan ang grade?");
  });

  it("reset clears the chat (nothing is kept, PRD A7)", () => {
    const s = run([{ type: "ask", key: 1, question: "Q" }, { type: "reset" }]);
    expect(s).toEqual(TRY_INITIAL);
  });
});
