import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "./cn";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: "section" | "div" | "article" | "aside";
  /** Uppercase section label above the title. */
  eyebrow?: ReactNode;
  /** H2 title. */
  title?: ReactNode;
  /** Right side of the header row (buttons). */
  actions?: ReactNode;
  /** 0 = border only, 1 = shadow-card (default), 2 = shadow-overlay. Dark keeps the 1px border always. */
  elevation?: 0 | 1 | 2;
  /** none, md = p-5 (default), lg = p-8. */
  padding?: "none" | "md" | "lg";
  /** surface (default) or surface-2 well. */
  tone?: "surface" | "well";
  ref?: Ref<HTMLElement>;
}

/** Card / panel: radius 20, 1px border, flat surface. No glass, no blur. */
export function Panel({
  as: Tag = "section",
  eyebrow,
  title,
  actions,
  elevation = 1,
  padding = "md",
  tone = "surface",
  className,
  children,
  ref,
  ...rest
}: PanelProps) {
  const hasHeader = eyebrow || title || actions;
  return (
    <Tag
      ref={ref as Ref<HTMLElement & HTMLDivElement>}
      {...rest}
      className={cn(
        "rounded-panel border border-border text-text",
        tone === "surface" ? "bg-surface" : "bg-surface-2",
        elevation === 1 && "shadow-card",
        elevation === 2 && "shadow-overlay",
        padding === "md" && "p-5",
        padding === "lg" && "p-8",
        className,
      )}
    >
      {hasHeader && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="text-h2 font-display text-text">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
