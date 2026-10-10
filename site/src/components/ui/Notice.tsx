import type { HTMLAttributes, ReactNode } from "react";
import { ICON_PROPS, Icon } from "../../brand/icons";
import { cn } from "./cn";

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** neutral = a plain fact on surface-2; info = something to know before acting (info icon, green wash). */
  tone?: "neutral" | "info";
  /** Optional bold first line. */
  title?: ReactNode;
  /** One line. */
  children?: ReactNode;
  /** A trailing ghost button, if the notice has a fix. */
  action?: ReactNode;
}

/**
 * Inline notice, not an error (that is ErrorNotice). Radius 14, no side stripe, no shadow.
 * Use for constraints the user should know: "An agent can use up to 5 knowledge bases."
 */
export function Notice({ tone = "neutral", title, children, action, className, ...rest }: NoticeProps) {
  return (
    <div
      role="note"
      {...rest}
      className={cn(
        "flex items-start gap-3 rounded-button px-4 py-3",
        tone === "info" ? "bg-accent-wash text-text" : "border border-border bg-surface-2 text-text",
        className,
      )}
    >
      {tone === "info" && <Icon.info {...ICON_PROPS} className="shrink-0 text-accent-text" />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        {title && <p className="text-label font-semibold text-text">{title}</p>}
        {children && <p className="text-label text-text-2">{children}</p>}
      </div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </div>
  );
}
