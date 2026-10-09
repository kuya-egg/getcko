// One onboarding page, full window (design system §9.2). Same frame as <OnboardingStep> (pointer
// texture, 6-col text and 6-col well, or 5/7 when the visual is a list with GetcKo 8x facing the visual), plus the two things that
// component has no room for: a notice under the state line and the offline badge top right.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { GetCkoSprite, MOMENT_POSE, pointPoseFor, stepIn, type Moment, type Pose } from "../../brand";
import { handTip } from "../../brand/mascot/sprites";
import { T } from "../../brand/lexicon";
import { OfflineBadge, StepSquares, Surface, cn } from "../../components/ui";
import { place } from "../../app/platform";

export interface StepFrameProps {
  /** Changes on every step; drives stepIn and moves focus to the H1. */
  stepKey: string;
  dir: 1 | -1;
  /** 1-based. Progress is hidden when there is only one step. */
  step: number;
  total: number;
  title: ReactNode;
  body: ReactNode;
  /** State line under the body (aria-live). */
  status?: ReactNode;
  /** A Notice or ErrorNotice under the state line. */
  notice?: ReactNode;
  /** One primary <Button>, then at most one ghost. */
  actions: ReactNode;
  /** GetcKo's moment. "screenHelp" points right at the visual. */
  moment: Moment;
  /** The thing GetcKo faces (MockToggle, Keycap, a status list). */
  visual: ReactNode;
  /** Height of the visual in px, to put its middle at the hand. Default 56 (MockToggle). */
  visualHeight?: number;
  /** GetcKo's pixel scale. 8 by default; 6 when the visual is a list that needs the room. */
  scale?: 6 | 8;
  /** "even": 6/6 columns (one-line body). "visual": 5/7, when the visual is a list that needs width. */
  split?: "even" | "visual";
}

const SPLIT = {
  even: { text: "col-span-6", well: "col-span-6" },
  visual: { text: "col-span-5", well: "col-span-7" },
} as const;

const WELL_PAD = 24;

export function StepFrame({
  stepKey,
  dir,
  step,
  total,
  title,
  body,
  status,
  notice,
  actions,
  moment,
  visual,
  visualHeight = 56,
  scale = 8,
  split = "even",
}: StepFrameProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    titleRef.current?.focus({ preventScroll: true });
    const tl = stepIn(el, dir);
    return () => {
      // Never leave the page half faded when a step changes mid-tween.
      tl.kill();
      gsap.set(el, { autoAlpha: 1, x: 0 });
    };
    // Only on step change; dir is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const pointing = moment === "screenHelp";
  const pose: Pose = pointing ? pointPoseFor("right") : MOMENT_POSE[moment];
  const handY = (handTip(false, pose).row + 0.5) * scale;
  const label = pointing ? T.mascot.pointingAtAction : T.mascot.moment(T.moments[moment]);

  return (
    <Surface
      texture="pointer"
      intensity="subtle"
      tone="canvas"
      className="flex h-full min-h-0 flex-col gap-6 overflow-auto p-8"
    >
      <header className="flex min-h-8 items-center justify-between gap-4">
        {total > 1 ? (
          <div className="flex items-center gap-3">
            <StepSquares step={step} total={total} />
            <span className="font-mono text-keys nums text-text-2">{T.onboarding.progress(step, total)}</span>
          </div>
        ) : (
          <span />
        )}
        <OfflineBadge detail={place.onThis} />
      </header>

      <div ref={pageRef} className="grid min-h-0 flex-1 grid-cols-12 gap-6">
        <div className={cn(SPLIT[split].text, "flex min-w-0 flex-col justify-center")}>
          <h1 ref={titleRef} tabIndex={-1} className="text-h1 font-display text-text outline-none">
            {title}
          </h1>
          <p className="mt-4 max-w-copy text-pretty text-body text-text-2">{body}</p>
          <div aria-live="polite" className="mt-4 flex min-h-6 items-center gap-2 text-label empty:hidden">
            {status}
          </div>
          {notice && <div className="mt-4">{notice}</div>}
          <div className="mt-6 flex flex-wrap items-center gap-4">{actions}</div>
        </div>

        <div
          className={cn(
            SPLIT[split].well,
            "flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-panel border border-border bg-surface",
          )}
          style={{ padding: WELL_PAD }}
        >
          <div className={cn("flex min-w-0 max-w-full", pointing ? "items-start gap-3" : "items-center gap-4")}>
            <GetCkoSprite pose={pose} scale={scale} label={label} className="shrink-0" />
            <div
              className="flex min-w-0 items-center"
              style={pointing ? { marginTop: Math.max(0, Math.round(handY - visualHeight / 2)) } : undefined}
            >
              {visual}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}
