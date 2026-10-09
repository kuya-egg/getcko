import { useEffect, type HTMLAttributes, type ReactNode } from "react";
import { ICON_PROPS, Icon, type IconComponent } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { GetCkoSprite, MOMENT_POSE, type Moment } from "../../brand/mascot";
import { handTip } from "../../brand/mascot/sprites";
import { injectTextureStyles } from "../../brand/textures";
import { Button } from "./Button";
import { cn } from "./cn";
import { TargetHalo } from "./TargetHalo";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  icon?: IconComponent;
}

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** What is missing, plain: "No documents yet." */
  title: ReactNode;
  /** Why it matters, one line. */
  body?: ReactNode;
  /** The primary action. The gecko points at it and it wears the halo. */
  action?: EmptyStateAction;
  /** Caption under the action: "PDF, TXT or MD · stays on this Mac". */
  caption?: ReactNode;
  /** Show the mascot (default true). */
  mascot?: boolean;
  /**
   * GetcKo's moment (MOMENT_POSE). Default "screenHelp" (pointing at the action) when there is an action,
   * "empty" (clinging to the well) when there is none.
   */
  moment?: Moment;
  /** Integer sprite scale. Default 6. */
  scale?: number;
  /** Pixel-grid texture in the mascot well (default true). */
  texture?: boolean;
  /** Halo on the action (default true). Turn off if another halo is already on screen. */
  halo?: boolean;
}

const WELL_PAD = 16;

/**
 * Empty state: left aligned, max-width 480. Title and body, then the gecko in a 1px-bordered
 * pixel-grid well pointing right at the primary action, which wears the sun halo.
 */
export function EmptyState({
  title,
  body,
  action,
  caption,
  mascot = true,
  moment,
  scale = 6,
  texture = true,
  halo = true,
  className,
  ...rest
}: EmptyStateProps) {
  useEffect(() => {
    if (texture) injectTextureStyles();
  }, [texture]);

  const s = Math.max(3, Math.round(scale));
  const pose = MOMENT_POSE[moment ?? (action ? "screenHelp" : "empty")];
  // Align the button's vertical center with the sprite's hand (pointing poses), else top-align.
  const handY = WELL_PAD + (handTip(false, pose).row + 0.5) * s;
  const buttonTop = Math.max(0, Math.round(handY - 24));

  const button = action ? (
    <Button icon={action.icon} onClick={action.onClick}>
      {action.label}
    </Button>
  ) : null;

  return (
    <section {...rest} className={cn("flex max-w-[480px] flex-col gap-6 text-left", className)}>
      <div className="flex flex-col gap-2">
        <h2 className="text-h2 font-display text-text">{title}</h2>
        {body && <p className="text-body text-text-2">{body}</p>}
      </div>
      <div className="flex items-start gap-3">
        {mascot && (
          <div
            className={cn(
              "shrink-0 rounded-panel border border-border",
              texture && "gc-tex-grid-cell gc-tex-layer",
            )}
            style={{ padding: WELL_PAD }}
          >
            <GetCkoSprite
              pose={pose}
              scale={s}
              label={pose === MOMENT_POSE.screenHelp ? T.mascot.pointingAtAction : T.mascot.name}
            />
          </div>
        )}
        {action && (
          <div className="flex flex-col items-start gap-2" style={{ paddingTop: mascot ? buttonTop : 0 }}>
            {halo ? <TargetHalo>{button}</TargetHalo> : button}
            {caption && <p className="text-caption text-text-3">{caption}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

export interface ErrorNoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** What happened, in danger color: "Hindi ko mabasa ang PDF na ito." */
  title: ReactNode;
  /** What to do, in text color. */
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** Show GetcKo at 3x, posed for the moment. Never a happy GetcKo next to an error. */
  mascot?: boolean;
  /** "failed" (confused, default) or "offline" (holding the unplugged plug). */
  moment?: Extract<Moment, "failed" | "offline">;
}

/** Inline error block: danger-wash, radius 14, p16. Never a full-screen takeover, never "Oops". */
export function ErrorNotice({
  title,
  children,
  onRetry,
  retryLabel = T.actions.tryAgain,
  mascot,
  moment = "failed",
  className,
  ...rest
}: ErrorNoticeProps) {
  return (
    <div role="alert" {...rest} className={cn("flex items-start gap-4 rounded-button bg-danger-wash p-4", className)}>
      {mascot && (
        <GetCkoSprite
          pose={MOMENT_POSE[moment]}
          scale={3}
          label={T.mascot.moment(T.moments[moment])}
          className="shrink-0"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-start gap-2 text-row text-danger">
          {/* The confused gecko already says "failed"; the icon only stands in when he is not shown. */}
          {!mascot && <Icon.failed {...ICON_PROPS} className="-my-0.5" />}
          <span>{title}</span>
        </p>
        {children && <div className={cn("text-body text-text", !mascot && "pl-8")}>{children}</div>}
        {onRetry && (
          <div className={cn("pt-2", !mascot && "pl-8")}>
            <Button variant="secondary" size="sm" icon={Icon.retry} onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
