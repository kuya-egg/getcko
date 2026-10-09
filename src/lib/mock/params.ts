// URL switches for the browser mock (see README.md). Read once at install time.

export type MockSetup = "ready" | "missing" | "denied" | "loading";

export interface MockOptions {
  /** ?setup=ready (default) | missing | denied | loading */
  setup: MockSetup;
  /** ?empty=1: no agents, no knowledge bases. */
  empty: boolean;
  /** ?slow=1: every command waits ~600ms (to see loading moments). */
  slow: boolean;
}

export const DEFAULT_OPTIONS: MockOptions = { setup: "ready", empty: false, slow: false };

export function readMockOptions(search: string): MockOptions {
  const q = new URLSearchParams(search);
  const setup = q.get("setup");
  return {
    setup: setup === "missing" || setup === "denied" || setup === "loading" ? setup : "ready",
    empty: q.get("empty") === "1",
    slow: q.get("slow") === "1",
  };
}
