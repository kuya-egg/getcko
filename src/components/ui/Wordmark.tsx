import type { HTMLAttributes } from "react";
import { T } from "../../brand/lexicon";
import { GetCkoHeadMark } from "../../brand/mascot";
import { cn } from "./cn";

export type WordmarkSize = "sm" | "md" | "lg";

export interface WordmarkProps extends HTMLAttributes<HTMLSpanElement> {
  /** sm = sidebar footer / dialogs, md = app sidebar (default), lg = onboarding, about. */
  size?: WordmarkSize;
  /** default = theme text, chrome = on the ink session bar or a tone="ink" Surface. */
  tone?: "default" | "chrome";
}

/** Head-mark tile px per size. Whole-number sprite scale inside (1, 1, 2). */
const MARK: Record<WordmarkSize, number> = { sm: 28, md: 36, lg: 64 };
const TEXT: Record<WordmarkSize, string> = { sm: "text-title", md: "text-h2", lg: "text-h1" };
const GAP: Record<WordmarkSize, string> = { sm: "gap-2", md: "gap-2.5", lg: "gap-4" };

/**
 * The GetcKo lockup: ink head-mark tile + "GetcKo" in Bricolage 800. One per screen, top left.
 * The tile stays ink in both themes; dark mode gives it a 1px border so it does not sink into night.
 */
export function Wordmark({ size = "md", tone = "default", className, ...rest }: WordmarkProps) {
  return (
    <span {...rest} className={cn("inline-flex shrink-0 items-center", GAP[size], className)}>
      <GetCkoHeadMark size={MARK[size]} tile="ink" label="" style={{ border: "1px solid var(--gc-chrome-border)" }} />
      <span
        className={cn(
          "font-display font-extrabold tracking-wordmark",
          TEXT[size],
          tone === "chrome" ? "text-chrome-text" : "text-text",
        )}
      >
        {T.product.name}
      </span>
    </span>
  );
}
