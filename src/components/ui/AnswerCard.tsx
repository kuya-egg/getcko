import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { ICON_PROPS, Icon } from "../../brand/icons";
import { PLACE, T, fmtSeconds } from "../../brand/lexicon";
import { GetCkoSprite, MOMENT_POSE } from "../../brand/mascot";
import { Button, IconButton } from "./Button";
import { CitationChip, GeckoDot, OfflineBadge } from "./Chips";
import { cn } from "./cn";

export interface Citation {
  source: string;
  page?: number | string;
  onClick?: () => void;
}

/**
 * answer    grounded answer, the gecko points at the target, sources below.
 * bestGuess answer from the screenshot fallback: "Best guess" chip in the header.
 * dontKnow  nothing relevant was retrieved: GetcKo confused (3x) beside "I don't know", no source chip.
 * noTarget  answer found, but the element is not on this screen: "Not on this screen" chip, no halo.
 */
export type AnswerVariant = "answer" | "bestGuess" | "dontKnow" | "noTarget";

export interface AnswerStep {
  /** 1-based step number. */
  n: number;
  total: number;
  /** Advances to the next step. Becomes the card's one primary button. */
  onNext?: () => void;
}

export interface AnswerCardProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Default "answer". */
  variant?: AnswerVariant;
  /** Multi-step guidance: "Step 2 of 4" + the primary "Next step" button in the footer. */
  step?: AnswerStep;
  /** Agent name in the header: "GetcKo · {agent}". */
  agent: string;
  /** The user's question, shown in the strip on surface-2. */
  question?: ReactNode;
  /** The answer: action first, reason second. Plain text or nodes. */
  children?: ReactNode;
  citations?: Citation[];
  /** Measured latency. Number = seconds ("0.9 s"); string is shown as-is. Only real numbers. */
  latency?: number | string;
  /** Where it ran. Default "on this Mac". */
  where?: string;
  /** Show the Offline chip in the header. Default true. */
  offline?: boolean;
  /** Lines of answer before "More". Default 4; 0 disables clamping. */
  clampLines?: number;
  /** Thinking state: replaces the body with a status line. */
  thinking?: ReactNode;
  /** Shows a Stop button in the header (TTS playing). */
  onStopSpeaking?: () => void;
  onClose?: () => void;
  ref?: Ref<HTMLElement>;
}

/**
 * Overlay answer card. Elevation 2, radius 20, width 380.
 * Order inside: header (gecko dot + agent + Offline) → question strip → answer → sources + latency.
 * Parts carry data-gc attributes ("header", "question", "body", "footer") for GSAP choreography.
 */
export function AnswerCard({
  agent,
  variant = "answer",
  step,
  question,
  children,
  citations = [],
  latency,
  where = PLACE.mac.onThis,
  offline = true,
  clampLines = 4,
  thinking,
  onStopSpeaking,
  onClose,
  className,
  ref,
  ...rest
}: AnswerCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded || !clampLines) return;
    setOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [children, expanded, clampLines]);

  const dontKnow = variant === "dontKnow";
  // "I don't know" never shows a source: there is none.
  const shownCitations = dontKnow ? [] : citations;
  const lat = latency == null ? null : typeof latency === "number" ? fmtSeconds(latency) : latency;

  return (
    <section
      ref={ref}
      aria-label={T.aria.answerFrom(agent)}
      {...rest}
      className={cn(
        "flex w-[380px] max-w-full flex-col overflow-hidden rounded-panel border border-border bg-surface text-text shadow-overlay",
        className,
      )}
    >
      <header data-gc="header" className="flex min-h-11 items-center gap-2 py-1.5 pr-1.5 pl-5">
        <GeckoDot />
        <p className="min-w-0 flex-1 truncate text-label text-text">
          {/* With a variant chip the row is tight: the agent name alone (the dot already says GetcKo). */}
          {variant === "bestGuess" || variant === "noTarget" ? (
            agent
          ) : (
            <>
              {T.product.name} <span className="text-text-3">·</span> {agent}
            </>
          )}
        </p>
        {variant === "bestGuess" && (
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 text-keys font-medium whitespace-nowrap text-text-2">
            <Icon.bestGuess {...ICON_PROPS} className="-my-0.5 -ml-1" />
            {T.status.bestGuess}
          </span>
        )}
        {variant === "noTarget" && (
          <span className="inline-flex h-7 shrink-0 items-center rounded-pill bg-surface-2 px-2.5 text-keys font-medium whitespace-nowrap text-text-2">
            {T.status.notOnScreen}
          </span>
        )}
        {offline && <OfflineBadge />}
        {onStopSpeaking && <IconButton icon={Icon.stop} label={T.aria.stopSpeaking} size="sm" onClick={onStopSpeaking} />}
        {onClose && <IconButton icon={Icon.close} label={T.aria.closeAnswer} size="sm" onClick={onClose} />}
      </header>

      {question && (
        <p data-gc="question" className="border-y border-border bg-surface-2 px-5 py-2.5 text-caption text-text-2">
          {question}
        </p>
      )}

      <div data-gc="body" className="px-5 pt-4" aria-live="polite">
        {thinking ? (
          <p className="text-answer text-text-2">{thinking}</p>
        ) : dontKnow ? (
          <div className="flex items-start gap-3">
            <GetCkoSprite pose={MOMENT_POSE.failed} scale={3} label={T.mascot.moment(T.moments.failed)} className="shrink-0" />
            <div className="text-answer min-w-0 pt-1 text-text">{children}</div>
          </div>
        ) : (
          <div
            ref={bodyRef}
            className="text-answer max-w-answer text-text"
            style={
              clampLines && !expanded
                ? { display: "-webkit-box", WebkitLineClamp: clampLines, WebkitBoxOrient: "vertical", overflow: "hidden" }
                : undefined
            }
          >
            {children}
          </div>
        )}
        {!thinking && !dontKnow && (overflows || expanded) && (
          <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            {expanded ? T.actions.less : T.actions.more}
          </Button>
        )}
      </div>

      {(shownCitations.length > 0 || lat) && !thinking && (
        <footer data-gc="footer" className={cn("flex flex-wrap items-center gap-2 px-5 pt-3", step ? "pb-3" : "pb-5")}>
          {shownCitations.map((c, i) => (
            <CitationChip key={`${c.source}-${c.page ?? i}`} source={c.source} page={c.page} onClick={c.onClick} />
          ))}
          {lat && (
            <span className="ml-auto font-mono text-caption nums whitespace-nowrap text-text-3">
              {lat} · {where}
            </span>
          )}
        </footer>
      )}
      {step && !thinking && (
        <div data-gc="step" className="flex items-center gap-3 border-t border-border px-5 py-3">
          <span className="flex-1 font-mono text-keys nums text-text-2">{T.answerCard.step(step.n, step.total)}</span>
          {step.onNext && step.n < step.total && (
            <Button size="sm" icon={Icon.next} onClick={step.onNext}>
              {T.actions.nextStep}
            </Button>
          )}
        </div>
      )}
      {!step && (thinking || (shownCitations.length === 0 && !lat)) && <div className="h-5" />}
    </section>
  );
}
