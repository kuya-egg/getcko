import { Fragment, type HTMLAttributes, type ReactNode } from "react";
import { ICON_PROPS, type IconComponent } from "../../brand/icons";
import { GetCkoSprite, MOMENT_POSE, type Moment } from "../../brand/mascot";
import { T } from "../../brand/lexicon";
import { cn } from "./cn";

export interface KwProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

/**
 * Keyword highlight inside explanatory copy: "Press <Kw>⌥ Space</Kw>, then ask."
 * Green wash pill, accent text. At most 3 per block, never in headings, never in answers.
 */
export function Kw({ className, children, ...rest }: KwProps) {
  return (
    <mark
      {...rest}
      className={cn(
        "rounded-pill bg-accent-wash px-2 font-medium text-accent-text [box-decoration-break:clone]",
        className,
      )}
    >
      {children}
    </mark>
  );
}

export interface StepItem {
  /** A pixel icon for the step. */
  icon?: IconComponent;
  /** Or a GetcKo moment (one step at most: one GetcKo per screen). Drawn at 2x. */
  pose?: Moment;
  /** One or two words, not a sentence: "Ask", "GetcKo points", "You click". */
  label: string;
}

export interface StepsProps extends HTMLAttributes<HTMLOListElement> {
  items: StepItem[];
}

/** A row of 4 pixel squares between steps, stepping toward the next one. */
function Connector() {
  return (
    <li aria-hidden="true" className="flex shrink-0 items-center gap-1 self-center px-1 pb-6">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("size-1", i === 2 ? "bg-text-3" : "bg-border-strong")} />
      ))}
    </li>
  );
}

/**
 * Numbered 1 → 2 → 3 row for explaining a flow in words, not sentences. Each step: a pixel icon or
 * GetcKo at 2x, a mono number and a label. Pixel-square connectors, no arrows or lines.
 */
export function Steps({ items, className, ...rest }: StepsProps) {
  return (
    <ol {...rest} className={cn("flex flex-wrap items-start gap-x-3 gap-y-4", className)}>
      {items.map((it, i) => {
        const Glyph = it.icon;
        return (
          <Fragment key={`${it.label}-${i}`}>
            {i > 0 && <Connector />}
            <li className="flex min-w-16 flex-col items-center gap-2 text-center">
              <span className="grid h-14 place-items-end">
                {it.pose ? (
                  <GetCkoSprite pose={MOMENT_POSE[it.pose]} scale={2} label={T.mascot.moment(T.moments[it.pose])} />
                ) : Glyph ? (
                  <Glyph {...ICON_PROPS} className="text-text" />
                ) : null}
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-mono text-keys nums text-text-3">{i + 1}</span>
                <span className="text-label font-semibold text-text">{it.label}</span>
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
