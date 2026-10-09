import type { HTMLAttributes, ReactNode } from "react";
import { PLACE } from "../../brand/lexicon";
import { cn } from "./cn";

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  /** What was measured (T.stats.*). */
  label: ReactNode;
  /** The measured value from MEASURED. null renders NOTHING: no "TBD", no dash, no placeholder. */
  value: number | null;
  /** Unit after the number: "s", "tokens/s", "bytes" (T.stats.unit*). */
  unit: string;
  /** Where it was measured. Default "on this Mac". */
  where?: string;
  /** Decimals shown. Default: 1 for values under 10, else 0. */
  digits?: number;
}

/**
 * One honest number: mono, tabular, with its unit and where it ran. Reads MEASURED (lexicon.ts);
 * returns null until docs/MODELS.md has the figure, so a screen can list every Stat safely.
 */
export function Stat({ label, value, unit, where = PLACE.mac.onThis, digits, className, ...rest }: StatProps) {
  if (value == null || !Number.isFinite(value)) return null;
  const d = digits ?? (Math.abs(value) < 10 && !Number.isInteger(value) ? 1 : 0);
  const shown = value.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  return (
    <div {...rest} className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className="text-caption text-text-2">{label}</p>
      <p className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-mono text-h2 nums text-text">{shown}</span>
        <span className="font-mono text-keys text-text-2">{unit}</span>
      </p>
      <p className="font-mono text-caption text-text-3">{where}</p>
    </div>
  );
}

export interface ProofLineProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Parts joined with " · ". Falsy parts (an unmeasured number) are dropped, never shown as TBD. */
  items: Array<ReactNode | null | undefined | false>;
}

/**
 * The quiet proof under a claim, in mono: "Wi-Fi off · 0 bytes sent · on this Mac".
 * Build number parts from MEASURED: `MEASURED.bytesSent != null && T.proof.bytesSent(MEASURED.bytesSent)`.
 */
export function ProofLine({ items, className, ...rest }: ProofLineProps) {
  const parts = items.filter((p): p is Exclude<typeof p, null | undefined | false> => p != null && p !== false && p !== "");
  if (!parts.length) return null;
  return (
    <p {...rest} className={cn("font-mono text-keys nums text-text-2", className)}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="px-1.5 text-text-3">·</span>}
          {p}
        </span>
      ))}
    </p>
  );
}
