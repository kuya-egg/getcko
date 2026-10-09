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

/** Sample data for the mock spreadsheet and answer. */
export const HERO_SAMPLE = {
  fileName: "Grade 6 Sampaguita.xlsx",
  question: "Where do I put Juan's final grade?",
  /** Answer, split so the cell and the formula can be styled. Action first, then the source chip. */
  answer: { before: "Click", cell: "E5", middle: "and type", formula: "=AVERAGE(B5:D5)", after: "." },
  source: { doc: "Manual", page: 4 },
  sourceText: sourceLabel("Manual", 4),
  columns: ["Learner", "Q1", "Q2", "Q3", "Final"],
  rows: [
    ["Andrea Bautista", 88, 91, 90],
    ["Carlo Reyes", 84, 86, 89],
    ["Daniela Santos", 92, 94, 95],
    ["Juan dela Cruz", 85, 87, 90],
    ["Kristine Lim", 87, 89, 92],
  ] as [string, number, number, number][],
  /** Index into rows of the target row (Juan). Sheet row = index + 2. */
  targetRow: 3,
} as const;
