import type { HTMLAttributes, ReactNode, Ref } from "react";
import { ICON_PROPS, Icon, type IconComponent } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { GetCkoSprite, MOMENT_POSE, pointPoseFor, type Moment, type Pose } from "../../brand/mascot";
import { handTip } from "../../brand/mascot/sprites";
import { Button } from "./Button";
import { cn } from "./cn";
import { Surface } from "./Surface";

// ---------------------------------------------------------------------------
// StepSquares: progress as pixel squares, never a bar.

export interface StepSquaresProps extends HTMLAttributes<HTMLDivElement> {
  /** 1-based current step. */
  step: number;
  total: number;
}

/**
 * One 8px square per step: done and current are gecko fills, the rest border-strong.
 * The current square blinks in two hard steps (static under reduced motion).
 */
export function StepSquares({ step, total, className, ...rest }: StepSquaresProps) {
  return (
    <div
      role="img"
      aria-label={T.onboarding.progress(step, total)}
      {...rest}
      className={cn("flex items-center gap-1", className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("size-2 shrink-0", i < step ? "bg-accent" : "bg-border-strong", i === step - 1 && "gc-cell-blink")}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MockToggle: a drawing of the macOS System Settings row the user is about to flip.

export interface MockToggleProps extends HTMLAttributes<HTMLDivElement> {
  on: boolean;
  /** The app name in the row. Default "GetcKo". */
  label?: string;
  /** The permission it stands for, read out with the state ("Accessibility"). */
  permission?: string;
  /** Wear the target halo (the one element GetcKo points at). Default true while off. */
  halo?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A picture of a System Settings switch, drawn from tokens (not interactive: the real one lives in
 * macOS). Track is the gecko fill when on, border-strong when off; the thumb is a surface square-ish pill.
 */
export function MockToggle({ on, label = T.product.name, permission, halo, className, ref, ...rest }: MockToggleProps) {
  const ring = halo ?? !on;
  return (
    <div
      ref={ref}
      role="img"
      aria-label={[permission, label, on ? T.onboarding.granted : T.onboarding.off].filter(Boolean).join(", ")}
      {...rest}
      className={cn(
        "flex h-14 w-64 shrink-0 items-center gap-3 rounded-tile border border-border bg-surface px-3 shadow-card",
        ring && "target-halo",
        className,
      )}
    >
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-input bg-chrome">
        <span className="size-2 bg-accent" />
      </span>
      <span aria-hidden="true" className="min-w-0 flex-1 truncate text-label font-semibold text-text">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-pill transition-colors",
          on ? "bg-accent" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-pill bg-surface shadow-card transition-[translate]",
            on && "translate-x-4",
          )}
        />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OnboardingStep

export type PermissionState = "idle" | "waiting" | "granted";

export interface OnboardingAction {
  label: string;
  onClick?: () => void;
  icon?: IconComponent;
}

export interface OnboardingStepProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  step: number;
  total: number;
  /** ≤ 6 words, sentence case (T.onboarding.*Title). */
  title: ReactNode;
  /** One line (T.onboarding.*Body). */
  body: ReactNode;
  /** GetcKo's moment. Default "screenHelp": pointing right at the visual. */
  moment?: Moment;
  /** The thing GetcKo points at: usually <MockToggle/> or a <Keycap hotkey/>. */
  visual: ReactNode;
  /** The one primary action ("Open System Settings", "Continue", "Finish"). */
  primary: OnboardingAction;
  /** Ghost action ("Not now", "Check again", "Back"). */
  secondary?: OnboardingAction;
  /** Permission state line: idle shows nothing, waiting a stepping spinner, granted a ready line. */
  state?: PermissionState;
  /** Sprite scale. Default 8 (onboarding). */
  scale?: number;
  ref?: Ref<HTMLElement>;
}

const WELL_PAD = 24;

/**
 * Onboarding page for a 1040 x 680 window (min 900 x 600): text column left (5/12), a solid well
 * right (7/12) with GetcKo at 8x facing the visual, which sits at the height of its hand.
 * The page wears the pointer texture (subtle); content stays on solid ground.
 */
export function OnboardingStep({
  step,
  total,
  title,
  body,
  moment = "screenHelp",
  visual,
  primary,
  secondary,
  state = "idle",
  scale = 8,
  className,
  ref,
  ...rest
}: OnboardingStepProps) {
  const pose: Pose = moment === "screenHelp" ? pointPoseFor("right") : MOMENT_POSE[moment];
  const s = Math.max(2, Math.round(scale));
  // Put the visual's center at the hand's row (pointing poses); other poses center it.
  const tip = handTip(false, pose);
  const handY = (tip.row + 0.5) * s;

  return (
    <Surface
      ref={ref}
      texture="pointer"
      intensity="subtle"
      tone="canvas"
      {...rest}
      className={cn("grid h-full min-h-0 grid-cols-12 gap-6 p-8", className)}
    >
      <div className="col-span-5 flex min-w-0 flex-col justify-center">
        <div className="mb-6 flex items-center gap-3">
          <StepSquares step={step} total={total} />
          <span className="font-mono text-keys nums text-text-2">{T.onboarding.progress(step, total)}</span>
        </div>
        <h1 className="text-h1 font-display text-text">{title}</h1>
        <p className="mt-4 max-w-copy text-body text-text-2">{body}</p>

        <p aria-live="polite" className="mt-4 flex min-h-6 items-center gap-2 text-label">
          {state === "waiting" && (
            <span className="inline-flex items-center gap-2 text-text-2">
              <Icon.processing {...ICON_PROPS} className="gc-icon-spin" />
              {T.onboarding.waiting}
            </span>
          )}
          {state === "granted" && (
            <span className="inline-flex items-center gap-2 font-semibold text-accent-text">
              <Icon.ready {...ICON_PROPS} />
              {T.onboarding.granted}
            </span>
          )}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button icon={primary.icon} onClick={primary.onClick}>
            {primary.label}
          </Button>
          {secondary && (
            <Button variant="ghost" icon={secondary.icon} onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
        </div>
      </div>

      <div
        className="col-span-7 flex min-w-0 items-center justify-center overflow-hidden rounded-panel border border-border bg-surface"
        style={{ padding: WELL_PAD }}
      >
        <div className="flex items-start gap-3">
          <GetCkoSprite pose={pose} scale={s} label={moment === "screenHelp" ? T.mascot.pointingAtAction : T.mascot.moment(T.moments[moment])} className="shrink-0" />
          <div
            className="flex h-14 min-w-0 items-center"
            style={moment === "screenHelp" ? { marginTop: Math.max(0, Math.round(handY - 28)) } : { alignSelf: "center" }}
          >
            {visual}
          </div>
        </div>
      </div>
    </Surface>
  );
}
