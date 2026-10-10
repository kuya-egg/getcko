import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { ICON_PROPS, Icon, type IconComponent } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { Button, type ButtonVariant } from "./Button";
import { Tag } from "./Chips";
import { cn } from "./cn";

export interface IconTileProps extends HTMLAttributes<HTMLSpanElement> {
  icon: IconComponent;
  /** accent = accent-text icon (selected / active). neutral = text-2 (default). Never a tinted fill. */
  tone?: "accent" | "neutral";
}

/**
 * 44px square that holds one icon on a 1px border, for the rare spot where an icon must stand
 * alone as a picker target. Not decoration: cards and headings carry no icon tile.
 * Never a tinted fill, never a circle.
 */
export function IconTile({ icon: TileIcon, tone = "neutral", className, ...rest }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      {...rest}
      className={cn(
        "inline-grid size-11 shrink-0 place-items-center rounded-tile border border-border",
        tone === "accent" ? "text-accent-text" : "text-text-2",
        className,
      )}
    >
      <TileIcon {...ICON_PROPS} />
    </span>
  );
}

export interface AgentCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  name: string;
  /** One short line; clamps at two lines (full text in the tooltip). */
  description: string;
  /** Optional icon before the name (src/brand/icons). Off by default: the name is the identity. */
  icon?: IconComponent;
  /** Knowledge base names shown as tags. */
  knowledgeBases?: string[];
  /** Start pressed. Omit to hide the button. */
  onStart?: () => void;
  startLabel?: string;
  /** primary by default; use secondary when several cards sit in a row. */
  startVariant?: ButtonVariant;
  /** Extra footer content (right of the tags). */
  footer?: ReactNode;
}

/** Agent card: radius 20, 1px border, p20, surface. Name, one line, tags, Start. No icon tile. */
export function AgentCard({
  name,
  description,
  icon: NameIcon,
  knowledgeBases = [],
  onStart,
  startLabel = T.actions.start,
  startVariant = "primary",
  footer,
  className,
  ...rest
}: AgentCardProps) {
  return (
    <article
      {...rest}
      className={cn("flex flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-card", className)}
    >
      <div className="flex items-start gap-2">
        {NameIcon && <NameIcon {...ICON_PROPS} className="mt-px text-text-2" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-title text-text">{name}</h3>
          <p className="mt-1 line-clamp-2 text-label font-normal text-text-2" title={description}>
            {description}
          </p>
        </div>
      </div>
      {knowledgeBases.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={T.aria.agentTags}>
          {knowledgeBases.map((kb) => (
            <li key={kb}>
              <Tag>{kb}</Tag>
            </li>
          ))}
        </ul>
      )}
      {(onStart || footer) && (
        <div className="mt-auto flex items-center gap-3">
          {onStart && (
            <Button variant={startVariant} size="sm" onClick={onStart} aria-label={startLabel === T.actions.start ? T.aria.startAgent(name) : `${startLabel} ${name}`}>
              {startLabel}
            </Button>
          )}
          {footer}
        </div>
      )}
    </article>
  );
}

export interface NewAgentCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  hint?: string;
}

/** The dashed "New agent" card. The whole card is one button. */
export function NewAgentCard({
  label = T.actions.newAgent,
  hint = T.agent.newAgentHint,
  className,
  type = "button",
  ...rest
}: NewAgentCardProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "flex min-h-11 flex-col items-start gap-4 rounded-panel border-[1.5px] border-dashed border-border-strong bg-transparent p-5 text-left",
        "transition-colors hover:border-text-3 hover:bg-surface-2",
        className,
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-2 font-display text-title text-text">
          <Icon.newAgent {...ICON_PROPS} className="text-text-2" />
          {label}
        </span>
        <span className="text-label font-normal text-text-2">{hint}</span>
      </span>
    </button>
  );
}
