import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface ChatBubbleProps extends HTMLAttributes<HTMLDivElement> {
  /** getcko = inverse bubble (tail toward the mascot). user = surface-2, right aligned. */
  from: "getcko" | "user";
  /** Which bottom corner is the tail. Default: left for GetcKo, right for the user. */
  tail?: "left" | "right";
  children: ReactNode;
}

/** Chat bubble. GetcKo: inverse bg, text-answer (16/1.55), radius 18 18 18 4. User: surface-2, 18 18 4 18. */
export function ChatBubble({ from, tail, className, children, ...rest }: ChatBubbleProps) {
  const t = tail ?? (from === "getcko" ? "left" : "right");
  return (
    <div
      {...rest}
      className={cn(
        "w-fit max-w-[60ch] px-4 py-3 text-answer",
        t === "left" ? "rounded-bubble rounded-bl-code" : "rounded-bubble rounded-br-code",
        from === "getcko" ? "bg-inverse text-inverse-text" : "self-end bg-surface-2 text-text",
        className,
      )}
    >
      {children}
    </div>
  );
}
