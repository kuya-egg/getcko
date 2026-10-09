import type { ReactNode } from "react";
import { cn } from "./ui";

/** Eyebrow + display headline (≤ 6 words) + at most two lines of body. Left-aligned over the texture. */
export function SectionHead({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string;
  eyebrow: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-copy flex-col gap-4", className)}>
      <p className="eyebrow text-text-2">{eyebrow}</p>
      <h2 id={id} className="font-display text-h1 text-balance text-text md:text-display">
        {title}
      </h2>
      {children && <p className="text-title font-sans font-normal text-text-2">{children}</p>}
    </div>
  );
}
