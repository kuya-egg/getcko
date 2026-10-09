// "Try it": an unsaved test chat with one agent (PRD A7). Streams sentences from 'turn' events into
// a GetcKo bubble; GetcKo (3x) stands beside the latest answer. The only gecko on the agents screen.
import { useEffect, useReducer, useRef, useState } from "react";
import type { AgentId } from "../../bindings/AgentId";
import type { Language } from "../../bindings/Language";
import { GetCkoSprite, MOMENT_POSE, pointPoseFor, type Moment } from "../../brand";
import { Icon } from "../../brand/icons";
import { T, linesFor } from "../../brand/lexicon";
import { Button, ChatBubble, CitationChip, Composer, ErrorNotice } from "../../components/ui";
import { errorCopy } from "../../app/errors";
import { ask, onTurn, pttStart, stop } from "../../lib/getcko";
import { AGENTS_COPY } from "./copy";
import { citationWhere, languageWord, shortSource } from "./model";
import { TRY_INITIAL, isLive, isModelMissing, isWaiting, lastTurn, momentFor, tryReducer, type TryTurn } from "./tryChat";

export interface TryAgentProps {
  /** The saved agent to try. null = not saved yet (the chat is disabled). */
  agentId: AgentId | null;
  agentName: string;
  /** Saved language: GetcKo's own lines follow it. */
  language: Language;
  /** The editor has unsaved changes: say Try it uses the saved version. */
  dirty: boolean;
}

export function TryAgent({ agentId, agentName, language, dirty }: TryAgentProps) {
  const [state, dispatch] = useReducer(tryReducer, TRY_INITIAL);
  const [text, setText] = useState("");
  const keySeq = useRef(0);
  const liveRef = useRef(false);
  /** Hold to talk could not start (mic blocked): the release asks nothing. */
  const talkFailed = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lines = linesFor(languageWord(language));
  const current = lastTurn(state);
  const busy = isLive(current);
  liveRef.current = busy;

  // One subscription for the life of the panel.
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    void onTurn((event) => dispatch({ type: "event", event })).then((u) => {
      if (dead) u();
      else off = u;
    });
    return () => {
      dead = true;
      off?.();
    };
  }, []);

  // A different agent starts a fresh chat; leaving stops whatever GetcKo is saying.
  useEffect(() => {
    dispatch({ type: "reset" });
    return () => {
      if (liveRef.current) void stop().catch(() => undefined);
    };
  }, [agentId]);

  // Keep the newest words in view as they stream in.
  const sentenceCount = current?.sentences.length ?? 0;
  useEffect(() => {
    if (state.turns.length > 0) endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [state.turns.length, sentenceCount, current?.stage]);

  const run = async (voice: boolean, question: string, screenHelp = false) => {
    if (agentId == null) return;
    const key = ++keySeq.current;
    dispatch({ type: "ask", key, question, voice });
    try {
      const turnId = await ask({
        input: voice ? { type: "voice" } : { type: "text", text: question },
        screenHelp,
        agentId,
      });
      dispatch({ type: "started", key, turnId });
    } catch (error) {
      dispatch({ type: "error", key, error });
    }
  };

  // Dev-only: ?try=<question> asks once on open (screenshots of the streamed answer).
  useEffect(() => {
    if (!import.meta.env.DEV || agentId == null) return;
    const q = new URLSearchParams(window.location.search).get("try");
    if (q) void run(false, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const disabled = agentId == null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4" aria-live="polite">
        {state.turns.length === 0 && !disabled && (
          <EmptyTry title={T.states.try.empty.title} body={T.states.try.empty.body} />
        )}
        {state.turns.map((t) => (
          <TurnView
            key={t.key}
            turn={t}
            latest={t === current}
            agentName={agentName}
            lines={lines}
            onStop={() => void stop().catch(() => undefined)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Composer
          value={text}
          onValueChange={setText}
          disabled={disabled || busy}
          placeholder={disabled ? AGENTS_COPY.tryPlaceholderIdle : AGENTS_COPY.tryPlaceholder(agentName)}
          onSubmit={(q) => {
            setText("");
            void run(false, q);
          }}
          onTalkStart={() => {
            if (agentId == null) return;
            talkFailed.current = false;
            void pttStart().catch((error) => {
              talkFailed.current = true;
              const key = ++keySeq.current;
              dispatch({ type: "ask", key, question: "", voice: true });
              dispatch({ type: "error", key, error });
            });
          }}
          onTalkEnd={() => {
            if (!talkFailed.current) void run(true, "");
          }}
          onScreenHelp={() => {
            // Same as the overlay's screen help: the question plus what is on screen now.
            const q = text.trim();
            if (!q || agentId == null) return;
            setText("");
            void run(false, q, true);
          }}
        />
      </div>
      {/* PRD A7: say it plainly, every time. The empty state's body already says it. */}
      {(disabled || dirty || state.turns.length > 0) && (
        <p className="text-caption text-text-3">
          {disabled ? AGENTS_COPY.trySaveFirst : dirty ? AGENTS_COPY.tryUsesSaved : T.agent.tryNotSaved}
        </p>
      )}
      {/* Scroll target: keeps the ask box in view above the editor's sticky save bar. */}
      <div ref={endRef} aria-hidden="true" className="scroll-mb-28" />
    </div>
  );
}

/** Before the first question: GetcKo points down at the ask box. */
function EmptyTry({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-end gap-3">
      <GeckoWell moment={undefined} />
      <div className="flex flex-col gap-1 pb-3">
        <p className="text-row text-text">{title}</p>
        <p className="text-label text-text-2">{body}</p>
      </div>
    </div>
  );
}

/** Integer 3x sprite in a small surface-2 well, the same frame Composer uses for its listening gecko. */
function GeckoWell({ moment }: { moment: Moment | undefined }) {
  const pose = moment ? MOMENT_POSE[moment] : pointPoseFor("downRight");
  const label = moment ? T.mascot.moment(T.moments[moment]) : T.mascot.pointingAtAction;
  return (
    <span className="shrink-0 rounded-tile bg-surface-2 p-2">
      <GetCkoSprite pose={pose} scale={3} label={label} />
    </span>
  );
}

/** Same footprint as GeckoWell so earlier answers line up under the latest one. */
function GeckoSpacer() {
  return <span aria-hidden="true" className="w-20.5 shrink-0" />;
}

function TurnView({
  turn,
  latest,
  agentName,
  lines,
  onStop,
}: {
  turn: TryTurn;
  latest: boolean;
  agentName: string;
  lines: ReturnType<typeof linesFor>;
  onStop: () => void;
}) {
  const moment = momentFor(turn);
  const waiting = isWaiting(turn);
  const listening = turn.stage === "listening";
  const failed = turn.stage === "failed";
  const noSource = turn.stage === "done" && turn.citations.length === 0;

  let words: string | null = null;
  if (turn.sentences.length) words = turn.sentences.join(" ");
  else if (listening) words = lines.listening;
  else if (waiting) words = lines.searching;
  else if (noSource) words = lines.dontKnow;

  // A missing model arrives as a failed turn with a plain message: say which fix applies.
  const err = !failed
    ? null
    : isModelMissing(turn.error)
      ? errorCopy({ kind: "unavailable", message: "model not loaded" })
      : errorCopy(turn.error);
  const stopped = turn.stage === "cancelled";

  return (
    <div className="flex flex-col gap-3">
      {turn.question && (
        <ChatBubble from="user" aria-label={T.answerCard.questionLabel}>
          {turn.question}
        </ChatBubble>
      )}
      {err ? (
        <ErrorNotice title={err.title} mascot={latest}>
          {err.body}
        </ErrorNotice>
      ) : (
        words && (
          <div className="flex items-end gap-3">
            {latest ? <GeckoWell moment={moment} /> : <GeckoSpacer />}
            <div className="flex min-w-0 flex-col gap-2">
              <ChatBubble
                from="getcko"
                aria-label={T.aria.answerFrom(agentName)}
                className={waiting || listening ? "text-inverse-text/80" : undefined}
              >
                {words}
              </ChatBubble>
              {turn.citations.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={T.answerCard.sourcesLabel}>
                  {turn.citations.map((c) => (
                    <li key={`${c.documentId}-${c.location}`}>
                      <CitationChip source={shortSource(c.documentName)} page={citationWhere(c.location)} />
                    </li>
                  ))}
                </ul>
              )}
              {latest && isLive(turn) && turn.turnId !== null && (
                <div>
                  <Button variant="ghost" size="sm" icon={Icon.stop} onClick={onStop}>
                    {T.actions.stopSpeaking}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )
      )}
      {/* Stopped before or after the first sentence: say so either way. */}
      {stopped && (
        <p className={`text-caption text-text-3${words ? " pl-23.5" : ""}`}>{AGENTS_COPY.stopped}</p>
      )}
    </div>
  );
}
