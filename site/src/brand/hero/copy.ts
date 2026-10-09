// Hero copy. Every word is a canonical term from docs/brand/lexicon.md, pulled from T / say where a
// key exists. The four strings marked PROPOSED have no lexicon.ts key yet; they use canonical words
// (lexicon §2.1 "point", "source") and should move to T.hero when the lexicon owner adds it.
// Sample content (the question, the answer, the sheet) is data, as in Showcase.tsx.

import { PLACE, T, sourceLabel } from "../lexicon";

export type HeroBeat = "ask" | "point" | "source" | "offline";

export const HERO_BEATS: readonly HeroBeat[] = ["ask", "point", "source", "offline"];

export const HERO_COPY = {
  /** PROPOSED T.hero.headline. 5 words. `mark` is the highlighted word. */
  headline: { before: `Ask out loud. ${T.product.name}`, mark: "points", after: "." },
  /** Support line, 7 words: T.product.descriptor. */
  support: T.product.descriptor,
  /** One keyword per beat. Ask and Offline are lexicon keys; Point and Source are PROPOSED keys. */
  beats: {
    ask: T.actions.ask,
    point: "Point", // PROPOSED T.hero.beats.point (lexicon §2.1: verb "point")
    source: "Source", // PROPOSED T.hero.beats.source (lexicon §2.1: noun "source")
    offline: T.status.offline,
  } satisfies Record<HeroBeat, string>,
  listening: T.status.listening,
  place: PLACE.mac.onThis,
  tagline: T.product.tagline,
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
  question: "Bakit hindi ko ma-click ang Next?",
  /** Answer: action first (the button by name), then the reason; the source chip follows. */
  answer: { before: "I-click mo muna ang", target: "Upload ID", after: ". Kailangan ang valid ID bago ka makapag-Next." },
  source: { doc: "Permit guide", page: 2 },
  sourceText: sourceLabel("Permit guide", 2),
} as const;
