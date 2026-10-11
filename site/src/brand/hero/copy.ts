// Hero copy. Every word is a canonical term from docs/brand/lexicon.md, pulled from T / say where a
// key exists. The four strings marked PROPOSED have no lexicon.ts key yet; they use canonical words
// (lexicon §2.1 "point", "source") and should move to T.hero when the lexicon owner adds it.
// Sample content (the question, the answer, the sheet) is data, as in Showcase.tsx.

import { T, sourceLabel } from "../lexicon";

export type HeroBeat = "ask" | "point" | "source" | "offline";

export const HERO_BEATS: readonly HeroBeat[] = ["ask", "point", "source", "offline"];

export const HERO_COPY = {
  /**
   * PROPOSED T.hero.headline. 6 words, the user's own question. `lead` is its own line (the question),
   * then `before` + highlighted `mark` + `after`.
   */
  headline: { lead: "Where do I click?", before: "Just", mark: "ask", after: "." },
  /** PROPOSED T.hero.support. Says what the headline leaves to the animation: the pointing, the why, offline. */
  support: `${T.product.name} points at the button and tells you why. Works offline.`,
  /** One keyword per beat. Ask and Offline are lexicon keys; Point and Source are PROPOSED keys. */
  beats: {
    ask: T.actions.ask,
    point: "Point", // PROPOSED T.hero.beats.point (lexicon §2.1: verb "point")
    source: "Source", // PROPOSED T.hero.beats.source (lexicon §2.1: noun "source")
    offline: T.status.offline,
  } satisfies Record<HeroBeat, string>,
  listening: T.status.listening,
  /** English-only landing: the tagline's English gloss. */
  tagline: T.product.taglineGloss,
  agent: T.templates.officeHelper.name,
} as const;

/**
 * Sample data for the mock e-service form (site edit: was a grade sheet). An LGU business permit
 * renewal, step 2 of 4: name and TIN are filled, the valid ID is missing, so Next stays disabled.
 * GetcKo points at Upload ID. All names and numbers are synthetic.
 */
export const HERO_SAMPLE = {
  windowTitle: "eServices · Business Permit Renewal",
  stepLabel: "Owner details",
  step: 2,
  steps: 4,
  fields: [
    { label: "Owner name", value: "Juan dela Cruz" },
    { label: "TIN", value: "123-456-789-000", mono: true },
  ],
  idLabel: "Valid ID",
  idEmpty: "No file chosen",
  /** The target: the one button GetcKo points at. */
  target: "Upload ID",
  back: "Back",
  next: "Next",
  question: "Why can't I click Next?",
  /** Answer: action first (the button by name), then the reason; the source chip follows. */
  answer: { before: "Click", target: "Upload ID", after: " first. A valid ID is required before you can continue." },
  source: { doc: "Permit guide", page: 2 },
  sourceText: sourceLabel("Permit guide", 2),
} as const;
