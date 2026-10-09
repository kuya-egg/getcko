// "Try this agent" test chat state (PRD A7: nothing here is saved). A pure reducer over ask() and
// the global 'turn' events. Turn events reach every window, so this chat only follows turns it
// started: while its own ask() is in flight it buffers unseen turn ids, then adopts the one ask()
// returns (same rule as the overlay, docs/architecture.md "Turn ownership").
import type { Citation } from "../../bindings/Citation";
import type { TurnEvent } from "../../bindings/TurnEvent";
import type { TurnId } from "../../bindings/TurnId";
import { say } from "../../brand/lexicon";
import type { Moment } from "../../brand/mascot";
import { stripMarkers } from "./model";

export type TryStage = "asking" | "listening" | "thinking" | "answering" | "done" | "cancelled" | "failed";

export interface TryTurn {
  /** Local key, known before the backend turn id. */
  key: number;
  /** The question as typed, or as transcribed (voice). Empty until a voice turn is transcribed. */
  question: string;
  turnId: TurnId | null;
  stage: TryStage;
  /** GetcKo's answer so far, one sentence per entry, without [n] markers. */
  sentences: string[];
  citations: Citation[];
  /** ask() threw, or the turn failed: the thrown value or the backend message. */
  error: unknown;
}

export interface TryState {
  turns: TryTurn[];
  /** Turn events seen while our ask() was in flight, for an id we don't know yet. */
  buffer: TurnEvent[];
}

export type TryAction =
  | { type: "ask"; key: number; question: string; voice?: boolean }
  | { type: "started"; key: number; turnId: TurnId }
  | { type: "event"; event: TurnEvent }
  | { type: "error"; key: number; error: unknown }
  | { type: "reset" };

export const TRY_INITIAL: TryState = { turns: [], buffer: [] };

/** Buffer cap: a few turns' worth of events, so a stray stream can't grow it forever. */
const BUFFER_MAX = 64;

export const turnIdOf = (e: TurnEvent): TurnId => (e.type === "finished" ? e.answer.turnId : e.turnId);

const LIVE: readonly TryStage[] = ["asking", "listening", "thinking", "answering"];
export const isLive = (t: TryTurn | undefined): boolean => !!t && LIVE.includes(t.stage);

/** The turn GetcKo is on now (the last one). */
export const lastTurn = (s: TryState): TryTurn | undefined => s.turns[s.turns.length - 1];

/** A turn is waiting for ask() to return its id. */
const pending = (s: TryState): TryTurn | undefined => s.turns.find((t) => t.turnId === null && isLive(t));

function dedupeCitations(cs: readonly Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of cs) {
    const k = `${c.documentId}|${c.location}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** Apply one event to its turn. Terminal turns ignore everything after their end. */
export function applyEvent(t: TryTurn, e: TurnEvent): TryTurn {
  if (!isLive(t)) return t;
  switch (e.type) {
    case "phase":
      if (e.phase === "listening" || e.phase === "transcribing") return { ...t, stage: "listening" };
      return { ...t, stage: e.phase };
    case "question":
      return t.question ? t : { ...t, question: e.text };
    case "target":
      return t;
    case "sentence": {
      const s = stripMarkers(e.text);
      return s ? { ...t, stage: "answering", sentences: [...t.sentences, s] } : t;
    }
    case "finished": {
      const a = e.answer;
      const sentences = t.sentences.length ? t.sentences : a.text ? [stripMarkers(a.text)] : [];
      return {
        ...t,
        stage: "done",
        question: t.question || a.question,
        sentences,
        citations: dedupeCitations(a.citations),
      };
    }
    case "cancelled":
      return { ...t, stage: "cancelled" };
    case "failed":
      return { ...t, stage: "failed", error: e.message };
  }
}

const mapTurn = (s: TryState, pick: (t: TryTurn) => boolean, f: (t: TryTurn) => TryTurn): TryTurn[] =>
  s.turns.map((t) => (pick(t) ? f(t) : t));

export function tryReducer(s: TryState, a: TryAction): TryState {
  switch (a.type) {
    case "ask": {
      const turn: TryTurn = {
        key: a.key,
        question: a.voice ? "" : a.question,
        turnId: null,
        stage: a.voice ? "listening" : "asking",
        sentences: [],
        citations: [],
        error: undefined,
      };
      return { turns: [...s.turns, turn], buffer: [] };
    }
    case "started": {
      const mine = s.buffer.filter((e) => turnIdOf(e) === a.turnId);
      return {
        turns: mapTurn(
          s,
          (t) => t.key === a.key,
          (t) => mine.reduce(applyEvent, { ...t, turnId: a.turnId }),
        ),
        buffer: [],
      };
    }
    case "event": {
      const id = turnIdOf(a.event);
      if (s.turns.some((t) => t.turnId === id)) {
        return { ...s, turns: mapTurn(s, (t) => t.turnId === id, (t) => applyEvent(t, a.event)) };
      }
      // Unknown id: keep it only while our own ask() is in flight (it may be ours).
      if (pending(s)) return { ...s, buffer: [...s.buffer, a.event].slice(-BUFFER_MAX) };
      return s;
    }
    case "error":
      return {
        turns: mapTurn(s, (t) => t.key === a.key, (t) => ({ ...t, stage: "failed", error: a.error })),
        buffer: [],
      };
    case "reset":
      return TRY_INITIAL;
  }
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim();
const DONT_KNOW = new Set([squash(say.en.dontKnow), squash(say.tl.dontKnow)]);

/** GetcKo said its "I don't know" line (the only no-answer signal a finished turn carries). */
export const saidDontKnow = (t: TryTurn): boolean => DONT_KNOW.has(squash(t.sentences.join(" ")));

/** Answering has started but no sentence has arrived yet: still GetcKo's thinking moment. */
export const isWaiting = (t: TryTurn): boolean =>
  t.stage === "asking" || t.stage === "thinking" || (t.stage === "answering" && t.sentences.length === 0);

/**
 * The real pipeline reports a missing model as a failed turn with a plain message
 * (pipeline.rs: "chat model is not available", "models are loading"), not as a thrown kind.
 */
export const isModelMissing = (error: unknown): boolean => {
  const m = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return /(chat|embedding) model is not available|models are loading/i.test(m);
};

/** GetcKo's moment for the current turn (MOMENT_POSE key). Undefined = no turn yet. */
export function momentFor(t: TryTurn | undefined): Moment | undefined {
  if (!t) return undefined;
  switch (t.stage) {
    case "asking":
    case "thinking":
      return "thinking";
    case "listening":
      return "listening";
    case "answering":
      return t.sentences.length ? "speaking" : "thinking";
    case "done":
      // An answer without sources is still an answer (an agent with no knowledge bases cites nothing).
      return t.sentences.length && !saidDontKnow(t) ? "ready" : "failed";
    case "failed":
      return "failed";
    case "cancelled":
      return undefined;
  }
}
