// One onboarding page, full window (design system §9.2). The words sit on clear canvas with GetcKo's
// footprints walking along the bottom (the walk through setup); the stage is a quiet pointer field
// ("it points"), where GetcKo 8x stands beside "your screen" and points at the one thing with the halo.
// Same frame on every step, so only the content moves when the step changes.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { haloIn, stepIn, useTheme, type Moment } from "../../brand";
import { T } from "../../brand/lexicon";
import { OfflineBadge, Surface, cn } from "../../components/ui";
import { place } from "../../app/platform";
import { Stage } from "./Stage";

export interface StepFrameProps {
  /** Changes on every step; drives stepIn, the halo draw and moves focus to the H1. */
  stepKey: string;
  dir: 1 | -1;
  /** 1-based. Progress is hidden when there is only one step. */
  step: number;
  total: number;
  /** Name of this step in the progress line ("Accessibility", "Shortcut"). */
  stepLabel: string;
  title: ReactNode;
  body: ReactNode;
  /** State line under the body (aria-live). */
  status?: ReactNode;
  /** A Notice or ErrorNotice under the state line. */
  notice?: ReactNode;
  /** One primary <Button>, then at most one ghost. */
  actions: ReactNode;
  /** "Back", bottom left, out of the way of the decision. */
  back?: ReactNode;
  /** GetcKo's moment. "screenHelp" points up-right at the visual. */
  moment: Moment;
  /** The target GetcKo faces (MockSettingsWindow, ShortcutKeys, a StageCard). */
  visual: ReactNode;
  /** Something for the stage's empty lower right (the "Gets mo na." badge on the last step). */
  aside?: ReactNode;
  /** Stage ground. "ink" makes the last step a dark island, like the session bar. */
  stageTone?: "paper" | "ink";
  /** The visual stands on the floor beside GetcKo instead of up by its hand (a step with no pointing). */
  grounded?: boolean;
}

/** Display type only while the title fits in two lines (64 px each); H1 otherwise (the 900 px minimum). */
const DISPLAY_MAX_LINES = 2;

/**
 * The walk band starts on whole prints: in the 384px footprints tile, 111px down is the first row
 * after a clear gap, so no print is cut along the band's top edge.
 */
const WALK_START = { backgroundPosition: "0 -111px" } as const;

/** Keep the card shadow under the halo while it draws (MockToggle wears shadow-card). */
const HALO_KEEP = "var(--gc-shadow-1)";

/** Progress as pixel cells (never a bar): done and current are gecko fills, the current one twice as wide. */
function Progress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <span aria-hidden="true" className="flex items-center gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 shrink-0",
              i === step - 1 ? "w-6" : "w-3",
              i < step ? "bg-accent" : "bg-border-strong",
            )}
          />
        ))}
      </span>
      <p className="text-label text-text-2">
        {T.onboarding.progress(step, total)}
        <span aria-hidden="true"> · </span>
        <span className="sr-only">: </span>
        <span className="font-semibold text-text">{label}</span>
      </p>
    </div>
  );
}

export function StepFrame({
  stepKey,
  dir,
  step,
  total,
  stepLabel,
  title,
  body,
  status,
  notice,
  actions,
  back,
  moment,
  visual,
  aside,
  stageTone = "paper",
  grounded = false,
}: StepFrameProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const halo = useRef<{ el: HTMLElement | null; key: string; tl?: gsap.core.Timeline }>({ el: null, key: "" });
  const [display, setDisplay] = useState(true);

  // An invisible copy of the title, set in display type at the column's width, says whether it fits.
  useLayoutEffect(() => {
    const m = measureRef.current;
    if (!m) return;
    const fit = () => {
      const line = parseFloat(getComputedStyle(m).lineHeight) || 64;
      setDisplay(m.offsetHeight <= line * DISPLAY_MAX_LINES + 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(m);
    return () => ro.disconnect();
  }, [stepKey]);

  // Order on every step: GetcKo and the target arrive, then the words.
  useLayoutEffect(() => {
    const text = textRef.current;
    const stage = stageRef.current;
    if (!text || !stage) return;
    titleRef.current?.focus({ preventScroll: true });
    const tl = gsap.timeline();
    tl.add(stepIn(stage, dir), 0);
    tl.add(stepIn(text, dir), 0.06);
    return () => {
      // Never leave a page half faded when a step changes mid-tween.
      tl.kill();
      gsap.set([text, stage], { autoAlpha: 1, x: 0 });
    };
    // Only on step change; dir is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  // The halo draws and pulses twice when a target gets it (new step, or a switch turned back off),
  // and lets go the moment the target loses it (permission turned on). Runs after every render; cheap.
  useLayoutEffect(() => {
    const el = stageRef.current?.querySelector<HTMLElement>(".target-halo") ?? null;
    const cur = halo.current;
    if (cur.el === el && cur.key === stepKey) return;
    cur.tl?.kill();
    if (cur.el) cur.el.style.boxShadow = "";
    const tl = el ? gsap.timeline({ delay: 0.12 }).add(haloIn(el, { keep: HALO_KEEP })) : undefined;
    halo.current = { el, key: stepKey, tl };
  });
  useLayoutEffect(
    () => () => {
      halo.current.tl?.kill();
      if (halo.current.el) halo.current.el.style.boxShadow = "";
    },
    [],
  );

  // Dark: the ink island would sink into night, so the last step turns to the green night ground.
  const { resolved } = useTheme();
  const tone = stageTone === "ink" ? (resolved === "dark" ? "green" : "ink") : "paper";

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Words on clear canvas; GetcKo's footprints walk along the bottom, under "Back". */}
      <Surface texture="none" tone="canvas" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <Surface
          aria-hidden="true"
          texture="footprints"
          intensity="subtle"
          tone="canvas"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44"
          style={WALK_START}
        />
        <div className="relative flex min-h-0 flex-1 flex-col gap-6 px-8 pt-8">
          {total > 1 ? <Progress step={step} total={total} label={stepLabel} /> : <span className="min-h-8" />}

          {/* Anchored from the top: a state line or notice grows down toward the buttons, never moving the headline. */}
          <div ref={textRef} className="relative flex min-w-0 flex-1 flex-col">
            <span aria-hidden="true" className="h-16 min-h-0 shrink" />
            <div className="relative">
              <span
                ref={measureRef}
                aria-hidden="true"
                className="invisible pointer-events-none absolute inset-x-0 top-0 font-display text-display text-balance"
              >
                {title}
              </span>
              <h1
                ref={titleRef}
                tabIndex={-1}
                className={cn("font-display text-balance text-text outline-none", display ? "text-display" : "text-h1")}
              >
                {title}
              </h1>
            </div>
            <p className="mt-4 max-w-copy text-pretty text-body text-text-2">{body}</p>
            <div aria-live="polite" className="mt-4 flex min-h-6 items-center gap-2 text-label empty:hidden">
              {status}
            </div>
            {notice && <div className="mt-4 max-w-copy">{notice}</div>}
            <div className="mt-8 flex flex-wrap items-center gap-4 pb-6">{actions}</div>
          </div>
        </div>

        <div className="relative flex shrink-0 px-8 pb-6">
          {back ? <div className="-ml-1 flex min-h-11 items-center">{back}</div> : <span className="min-h-11" />}
        </div>
      </Surface>

      <Surface
        as="aside"
        texture="pointer"
        // Quiet field: only the window, GetcKo and the halo should register. The ink island keeps its marks.
        intensity={tone === "ink" ? "standard" : "subtle"}
        tone={tone}
        className="relative flex min-h-0 max-w-130 min-w-96 shrink basis-1/2 items-center justify-center overflow-hidden border-l border-border px-8 py-8"
      >
        <OfflineBadge detail={place.onThis} className="absolute top-8 right-8" />
        <div ref={stageRef} className="min-w-0 pt-12">
          <Stage moment={moment} aside={aside} grounded={grounded}>
            {visual}
          </Stage>
        </div>
      </Surface>
    </div>
  );
}
