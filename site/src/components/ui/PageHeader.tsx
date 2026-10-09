import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Optional section label (T.nav.*). Skip it when the title already says where you are. */
  eyebrow?: ReactNode;
  /** H1, sentence case, ≤ 6 words. */
  title: ReactNode;
  /** The screen's one primary action (a <Button>), top right. */
  action?: ReactNode;
  /** One line under the title. Truncates; never wraps to a second line. */
  hint?: ReactNode;
}

/** Screen header for the main pane: title left, primary action right, 24px to the content. */
export function PageHeader({ eyebrow, title, action, hint, className, ...rest }: PageHeaderProps) {
  return (
    <header {...rest} className={cn("mb-6 flex items-end justify-between gap-6", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-h1 font-display text-text">{title}</h1>
        {hint && <p className="truncate text-body text-text-2">{hint}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </header>
  );
}
