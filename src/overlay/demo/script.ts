// Dev-only practice script: scripted questions about the practice sheet (demo.html).
// Sample content, like the brand board's: it stands in for the AI until the backend lands.
// Answers use **bold** for the element to click and `code` for formulas.

import { T, say } from "../../brand/lexicon";
import type { OverlayAnswer } from "../bridge";

export const DEMO_LABEL = "demo";
export const DEMO_EVENTS = {
  ready: "demo:ready",
  locate: "demo:locate",
} as const;

/** Dev chrome strings. Dev-only, so they live here, not in the lexicon. */
export const DEV = {
  practice: "Practice",
  practiceHint: "Ask about the practice sheet",
  openSheet: "Open practice sheet",
  sheetTitle: "Grade 6 Sampaguita, Q1 to Q3.xlsx",
};

export type TargetId = "finalE7" | "save" | "export" | "q3Kristine";

export interface PracticeItem {
  id: string;
  question: string;
  /** Element on the practice sheet; null = not on screen, GetCko says it doesn't know. */
  target: TargetId | null;
  /** Side for GetCko, chosen like the backend would: away from content the answer mentions. */
  side?: "left" | "right";
  answer: OverlayAnswer;
}

const agent = T.templates.officeHelper.name;

export const PRACTICE: PracticeItem[] = [
  {
    id: "final",
    question: "Saan ko ilalagay ang final grade ni Juan?",
    target: "finalE7",
    side: "right", // keep Juan's Q1 to Q3 (B7:D7) visible: the answer averages them
    answer: {
      agent,
      question: "“Saan ko ilalagay ang final grade ni Juan?”",
      answer: "I-type mo sa cell **E7** ang `=AVERAGE(B7:D7)`. Ito ang final grade ni Juan, average ng tatlong quarter.",
      citations: [{ source: "Grading guide", page: 4 }],
    },
  },
  {
    id: "missing",
    question: "Kulang ang Q3 ni Kristine. Saan ko ilalagay?",
    target: "q3Kristine",
    side: "left", // E8, where her final appears, stays visible
    answer: {
      agent,
      question: "“Kulang ang Q3 ni Kristine. Saan ko ilalagay?”",
      answer: "Sa cell **D8**, sa ilalim ng Q3. Kapag may grade na, lalabas na rin ang final niya sa E8.",
      citations: [{ source: "Grading guide", page: 3 }],
    },
  },
  {
    id: "save",
    question: "How do I keep my changes?",
    target: "save",
    answer: {
      agent,
      question: "“How do I keep my changes?”",
      answer: "Click **Save** at the top. Your grade sheet stays on this computer until you submit it.",
      citations: [{ source: "Office manual", page: 12 }],
    },
  },
  {
    id: "export",
    question: "Where do I make a PDF for the principal?",
    target: "export",
    answer: {
      agent,
      question: "“Where do I make a PDF for the principal?”",
      answer: "Click **Export as PDF** beside Save. Give the principal the PDF, not the spreadsheet.",
      citations: [{ source: "Office manual", page: 14 }],
    },
  },
  {
    id: "unknown",
    question: "Paano i-print ang report card?",
    target: null,
    answer: {
      agent,
      question: "“Paano i-print ang report card?”",
      answer: say.tl.dontKnow,
      failed: true,
    },
  },
];
