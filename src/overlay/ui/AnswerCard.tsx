import type { CSSProperties, Ref } from "react";
import type { Answer } from "../../bindings/Answer";
import type { PointerTarget } from "../../bindings/PointerTarget";
import { isBestGuess } from "../state/turn";
import type { TurnStatus } from "../types";
import { CitationChip } from "./CitationChip";
import { formatLatency, latencyBreakdown } from "./latency";
import { CloseIcon, StopIcon } from "./SessionBar";

export interface AnswerCardProps {
  question: string | null;
  sentences: string[];
  answer: Answer | null;
  status: TurnStatus;
  error: string | null;
  agentName: string | null;
  hostLabel: string;
  screenHelp: boolean;
  target: PointerTarget | null | undefined;
  onStop(): void;
  onDismiss(): void;
  /** Shown as "Next step" once the answer finished; absent when the guided task cannot continue. */
  onNext?: () => void;
  /** 1-based step of the guided task (S5) and, with a plan, its step count; `null` for a stand-alone question. */
  step: { number: number; total: number | null } | null;
  /** The guided task just finished its last step. */
  taskEnded: boolean;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

const PENDING: Partial<Record<TurnStatus, string>> = {
  transcribing: "Listening back…",
  thinking: "Thinking…",
};

const STOPPABLE: TurnStatus[] = ["transcribing", "thinking", "answering"];

function Body({ status, sentences, answer, error }: Pick<AnswerCardProps, "status" | "sentences" | "answer" | "error">) {
  if (status === "failed") {
    return (
      <p className="gc-answer-error" role="alert">
        {error ?? "Something went wrong."}
      </p>
    );
  }
  const pending = PENDING[status];
  if (pending) {
    return (
      <p className="gc-answer-pending" aria-live="polite">
        {pending}
      </p>
    );
  }
  const text = status === "finished" && answer ? answer.text : sentences.join(" ");
  return <p className="gc-answer-text">{text}</p>;
}

export function AnswerCard(props: AnswerCardProps) {
  const { answer, status } = props;
  const answered = status === "answering" || status === "finished";
  return (
    <div ref={props.ref} className="gc-answer-card" style={props.style} role="region" aria-label="GetCko answer">
      {props.question && <p className="gc-answer-question">{props.question}</p>}
      <div className="gc-answer-header">
        <span className="gc-dot" aria-hidden="true" />
        <span className="gc-answer-title">GetCko{props.agentName ? ` · ${props.agentName}` : ""}</span>
        {props.step !== null && (
          <span className="gc-chip gc-chip--guess">
            Step {props.step.number}
            {props.step.total !== null && ` of ${props.step.total}`}
          </span>
        )}
        {(answer?.confidence === "bestGuess" || (props.target && isBestGuess(props.target))) && (
          <span className="gc-chip gc-chip--guess">Best guess</span>
        )}
        <span className="gc-chip gc-chip--offline">Offline</span>
        <span className="gc-answer-actions">
          {STOPPABLE.includes(status) && (
            <button type="button" className="gc-icon-btn" aria-label="Stop" onClick={props.onStop}>
              <StopIcon />
            </button>
          )}
          <button type="button" className="gc-icon-btn" aria-label="Close" onClick={props.onDismiss}>
            <CloseIcon />
          </button>
        </span>
      </div>
      <div className="gc-answer-body">
        <Body status={status} sentences={props.sentences} answer={answer} error={props.error} />
        {props.screenHelp && answered && props.target === null && (
          <p className="gc-caption">
            {answer !== null && answer.screenMode === null
              ? "I can't read this app's screen, so I can't point at anything here."
              : "I couldn't point at anything on this screen."}
          </p>
        )}
        {props.taskEnded && (
          <p className="gc-caption">
            That was the last step, so this guided task is done. Ask a new question to start another.
          </p>
        )}
      </div>
      {answer && (
        <div className="gc-answer-footer">
          {answer.citations.map((c) => (
            <CitationChip key={c.passageId} citation={c} />
          ))}
          <span className="gc-latency" title={latencyBreakdown(answer.latency)}>
            {formatLatency(answer.latency.totalMs, props.hostLabel)}
          </span>
          {props.onNext && status === "finished" && (
            <button type="button" className="gc-btn gc-btn--secondary" onClick={props.onNext}>
              Next step
            </button>
          )}
        </div>
      )}
    </div>
  );
}
