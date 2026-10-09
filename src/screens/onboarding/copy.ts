// Onboarding and setup strings with no key in src/brand/lexicon.ts yet. Same voice rules as T:
// sentence case, headline ≤ 6 words, body one line, no emoji, "on this Mac" / "on this PC" for place.
import type { Platform } from "../../brand/lexicon";
import { PLACE } from "../../brand/lexicon";
import type { ComponentProblem, OffFeature } from "./flow";

export const ONBOARDING_COPY = {
  /** Screen Recording step: why it is optional (architecture: tier 1 still works without it). */
  optional: {
    title: "Optional",
    body: "GetcKo still points without it. No screenshots.",
  },

  /** What is off while a permission is off. Title says what, body what still works. */
  off: {
    screenHelp: { title: "Screen Help is off.", body: "Questions about your documents still work." },
    screenshots: { title: "No screenshots on hard screens.", body: "GetcKo still points from the app's buttons." },
    holdToTalk: { title: "Hold to talk is off.", body: "Typing a question still works." },
  } satisfies Record<OffFeature, { title: string; body: string }>,

  /** Last step, while models load or when some are missing. */
  loading: {
    title: "Getting the models ready.",
    body: "GetcKo loads them each time it opens.",
  },
  missing: {
    title: "Some models are missing.",
    body: "GetcKo can't answer without them. Nothing downloads.",
  },

  /** Component row reasons, shown as the row's one red chip ("Missing"). */
  problem: (p: ComponentProblem, platform: Platform): string =>
    p === "missing" ? "Missing" : p === "notHere" ? `Not ${PLACE[platform].onThis}` : "Not available",

  /** Screen Recording on macOS only applies after GetcKo opens again (preflight stays false until then). */
  reopen: "Turned it on? Quit and reopen GetcKo.",

  /**
   * Windows: the microphone only gets a step once Windows refused it. Nothing pops up there, so the
   * person flips it in Windows Settings and checks again.
   */
  win: {
    micBody: "Windows has it off. Turn it on in Windows Settings.",
    waiting: "Off in Windows Settings",
  },

  /** The OS settings pane drawn on the permission steps (a picture of where to go, not a link). */
  settingsWindow: {
    mac: { app: "System Settings", pane: "Privacy & Security" },
    win: { app: "Settings", pane: "Privacy & security" },
  } satisfies Record<Platform, { app: string; pane: string }>,

  /** Chip on a model that is still loading (Processing is the document-import word). */
  loadingTag: "Loading",

  /** Small labels in the status lists. */
  optionalTag: "Optional",
  turnedOff: "Off",
  modelFile: (file: string) => `Model file ${file}`,
} as const;
