// "Try it": an unsaved test chat with one agent (PRD A7). Streams sentences from 'turn' events into
// a GetcKo bubble; GetcKo (3x) stands beside the latest answer, thinking, then talking, then done.
// Empty, it teaches: GetcKo points at two questions this agent answers, in the agent's language.
// The only gecko on the agents screen.
import { useEffect, useReducer, useRef, useState } from "react";
import type { AgentId } from "../../bindings/AgentId";
import type { Language } from "../../bindings/Language";
import type { TemplateId } from "../../bindings/TemplateId";
import { GetCkoSprite, MOMENT_POSE, pointPoseFor, speakLoop, thinkingLoop, type Moment, type Pose } from "../../brand";
import { Icon } from "../../brand/icons";
import { T, linesFor } from "../../brand/lexicon";
import { Button, ChatBubble, CitationChip, Composer, ErrorNotice } from "../../components/ui";
import { errorCopy } from "../../app/errors";
import { ask, onTurn, pttStart, stop } from "../../lib/getcko";
import { AGENTS_COPY, sampleQuestions, tryGreeting } from "./copy";
import { citationWhere, languageWord, shortSource } from "./model";
import { TRY_INITIAL, isLive, isModelMissing, isWaiting, lastTurn, momentFor, stopKind, tryReducer, type TryTurn } from "./tryChat";

export interface TryAgentProps {
  /** The saved agent to try. null = not saved yet (the chat is disabled). */
  agentId: AgentId | null;
  agentName: string;
  /** Saved language: GetcKo's own lines follow it. */
  language: Language;
  /** The agent's template: picks the suggested questions. null = a custom agent. */
  templateId?: TemplateId | null;
  /** The editor has unsaved changes: say Try it uses the saved version. */
  dirty: boolean;
  /** Recovery when the chat model is missing: open the Settings screen (the editor guards unsaved work). */
  onOpenSettings?: () => void;
}

/** The turn failed because the chat model is missing: waiting won't fix it. */
const modelMissing = (t: TryTurn | undefined): boolean =>
  !!t && t.stage === "failed" && (isModelMissing(t.error) || errorCopy(t.error).body === T.errors.modelNotLoaded);

export function TryAgent({ agentId, agentName, language, templateId = null, dirty, onOpenSettings }: TryAgentProps) {
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
  // Model missing: the ask box can't work, so it doesn't pretend to be ready (the error names the fix).
  const blocked = modelMissing(current);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4" aria-live="polite">
        {state.turns.length === 0 && !disabled && (
          <EmptyTry
            title={tryGreeting(languageWord(language))}
            body={T.agent.tryNotSaved}
            questions={sampleQuestions(templateId, languageWord(language))}
            onAsk={(q) => void run(false, q)}
          />
        )}
        {state.turns.map((t) => (
          <TurnView
            key={t.key}
            turn={t}
            latest={t === current}
            agentName={agentName}
            lines={lines}
            onStop={() => void stop().catch(() => undefined)}
            onRetry={t.question ? () => void run(false, t.question) : undefined}
            onOpenSettings={onOpenSettings}
          />
        ))}
      </div>

      {/* Ring on any focus, including the programmatic one from "Try this agent" (the Composer only rings on focus-visible). */}
      <div className="flex items-center gap-3 rounded-panel has-[input:focus:not(:focus-visible)]:outline-2 has-[input:focus:not(:focus-visible)]:outline-offset-2 has-[input:focus:not(:focus-visible)]:outline-solid has-[input:focus:not(:focus-visible)]:outline-focus">
        <Composer
          value={text}
          onValueChange={setText}
          disabled={disabled || busy || blocked}
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

/**
 * Before the first question: GetcKo points down at two questions this agent answers (shaped like
 * the question bubble they become) and the ask box under them. One click asks.
 */
function EmptyTry({
  title,
  body,
  questions,
  onAsk,
}: {
  title: string;
  body: string;
  questions: readonly string[];
  onAsk: (q: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <LiveGecko moment={undefined} />
        <div className="flex min-w-0 flex-col gap-1 pb-1">
          <p className="text-row text-text">{title}</p>
          <p className="text-label font-normal text-text-2">{body}</p>
        </div>
      </div>
      {questions.length > 0 && (
        <div className="flex flex-col gap-2 pl-19.5">
          <p id="try-suggest" className="text-caption text-text-2">
            {AGENTS_COPY.trySuggest}
          </p>
          <ul className="flex flex-wrap gap-2" aria-labelledby="try-suggest">
            {questions.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onAsk(q)}
                  className={
                    "inline-flex min-h-11 items-center rounded-bubble rounded-br-code border border-border-strong bg-surface px-4 py-2 text-left text-label text-text " +
                    "transition-[background-color,border-color,translate] hover:border-text-3 hover:bg-surface-2 active:translate-y-px"
                  }
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * GetcKo at 3x, standing on the panel (no box) beside its bubble. Thinking blinks, speaking
 * talks (both reduced-motion aware in brand/motion), other moments hold their MOMENT_POSE.
 * No moment = pointing down-right at what comes next.
 */
function LiveGecko({ moment }: { moment: Moment | undefined }) {
  const still: Pose = moment ? MOMENT_POSE[moment] : pointPoseFor("downRight");
  const [pose, setPose] = useState<Pose>(still);
  useEffect(() => {
    if (moment === "thinking") {
      const tl = thinkingLoop(setPose);
      return () => void tl.kill();
    }
    if (moment === "speaking") {
      const tl = speakLoop(setPose, { restPose: "pointing" });
      return () => void tl.kill();
    }
    setPose(still);
  }, [moment, still]);
  const label = moment ? T.mascot.moment(T.moments[moment]) : T.mascot.pointingAtAction;
  return <GetCkoSprite pose={pose} scale={3} label={label} className="shrink-0" />;
}

/** Same width as GetcKo at 3x (22 cells) so earlier answers line up under the latest one. */
function GeckoSpacer() {
  return <span aria-hidden="true" className="w-16.5 shrink-0" />;
}

function TurnView({
  turn,
  latest,
  agentName,
  lines,
  onStop,
  onRetry,
  onOpenSettings,
}: {
  turn: TryTurn;
  latest: boolean;
  agentName: string;
  lines: ReturnType<typeof linesFor>;
  onStop: () => void;
  /** Ask the same question again (typed turns only). */
  onRetry?: () => void;
  onOpenSettings?: () => void;
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
  const missing = modelMissing(turn);
  const err = !failed
    ? null
    : missing
      ? { ...errorCopy({ kind: "unavailable", message: "model not loaded" }), body: AGENTS_COPY.modelMissingBody }
      : errorCopy(turn.error);
  const stopped = turn.stage === "cancelled";
  const stopAs = latest ? stopKind(turn) : null;

  return (
    <div className="flex flex-col gap-3">
      {turn.question && (
        <ChatBubble from="user" aria-label={T.answerCard.questionLabel}>
          {turn.question}
        </ChatBubble>
      )}
      {err ? (
        // Every error names its recovery. Model missing: Settings first (waiting won't fix it), then try again.
        missing && onOpenSettings ? (
          <ErrorNotice title={err.title} mascot={latest}>
            {err.body}
            <span className="flex flex-wrap items-center gap-4 pt-3">
              <Button variant="secondary" size="sm" icon={Icon.settings} onClick={onOpenSettings}>
                {AGENTS_COPY.openSettings}
              </Button>
              {onRetry && latest && (
                <Button variant="ghost" size="sm" onClick={onRetry}>
                  {T.actions.tryAgain}
                </Button>
              )}
            </span>
          </ErrorNotice>
        ) : (
          <ErrorNotice title={err.title} mascot={latest} onRetry={latest ? onRetry : undefined}>
            {err.body}
          </ErrorNotice>
        )
      ) : (
        words && (
          <div className="flex items-end gap-3">
            {latest ? <LiveGecko moment={moment} /> : <GeckoSpacer />}
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
              {/* "Stop speaking" only once there are words; while GetcKo is still checking, a plain stop. */}
              {stopAs && (
                <div>
                  <Button variant="ghost" size="sm" icon={Icon.stop} onClick={onStop}>
                    {stopAs === "speaking" ? T.actions.stopSpeaking : AGENTS_COPY.stop}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )
      )}
      {/* Stopped before or after the first sentence: say so either way. */}
      {stopped && (
        <p className={`text-caption text-text-3${words ? " pl-19.5" : ""}`}>{AGENTS_COPY.stopped}</p>
      )}
    </div>
  );
}
