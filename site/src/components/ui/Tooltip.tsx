import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

export interface TooltipProps {
  /** Short text, one line. Extra info only: never the only place a label lives. */
  content: ReactNode;
  /** One focusable element (a button, a link). It gets aria-describedby. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  /** Above (default) or below the trigger. */
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Simple CSS tooltip: shows on hover and on keyboard focus, hides on Esc. The trigger points at it
 * with aria-describedby, so screen readers read it after the name. Ink chip in both themes.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const [hidden, setHidden] = useState(false);
  const trigger = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" "),
      })
    : children;
  return (
    <span
      className={cn("group/tip relative inline-flex", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setHidden(true);
      }}
      onMouseLeave={() => setHidden(false)}
      onBlur={() => setHidden(false)}
    >
      {trigger}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute left-1/2 z-raised w-max max-w-64 -translate-x-1/2 rounded-input border border-chrome-border bg-chrome px-2.5 py-1.5 text-caption text-chrome-text shadow-card",
          "invisible opacity-0 transition-opacity duration-150",
          !hidden && "group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
      </span>
    </span>
  );
}
