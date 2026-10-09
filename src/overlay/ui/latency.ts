import type { Latency } from "../../bindings/Latency";

/** `0.9 s · on this Mac`. Rounds half up on tenths of a second. */
export function formatLatency(ms: number, hostLabel: string): string {
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds.toFixed(1)} s · ${hostLabel}`;
}

/** Measured parts only; `null` means the stage did not run and is omitted. */
export function latencyBreakdown(l: Latency): string {
  const parts: [string, number | null][] = [
    ["speech-to-text", l.transcribeMs],
    ["screen", l.screenMs],
    ["search", l.retrievalMs],
    ["first word", l.firstTokenMs],
    ["total", l.totalMs],
  ];
  return parts
    .filter((p): p is [string, number] => p[1] !== null)
    .map(([label, ms]) => `${label} ${Math.round(ms)} ms`)
    .join(" · ");
}
