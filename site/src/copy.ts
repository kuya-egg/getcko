// Landing-page copy. Every word is a canonical term from the brand lexicon (src/brand/lexicon.ts),
// pulled from T / say where a key exists. Strings marked PROPOSED have no lexicon key yet; they use
// canonical words and should move to T.site when the lexicon owner adds them (same practice as
// src/brand/hero/copy.ts). Sample content (names, files, answers) is data.

import { PLACE, T, say, sourceLabel } from "./brand/lexicon";

export const SITE = {
  /** PROPOSED T.site.watchDemo: the page's one primary action. */
  watchDemo: "Watch the 1-min demo",
  /** PROPOSED T.site.watchDemoShort: nav-sized label. */
  watchDemoShort: "Watch the demo",
  /** PROPOSED T.site.demoRecording: until DEMO_VIDEO_URL exists. */
  demoRecording: { title: "The demo is being recorded.", body: "Wi-Fi off: ask out loud, GetcKo points at the cell and cites the manual." },
  readCode: "Read the code",
  /** PROPOSED T.site.demoTitle: the demo poster title (≤ 6 words). */
  demoTitle: "GetcKo in one minute",
  nav: {
    how: T.board.how.eyebrow,
    knowledgeBases: T.nav.knowledgeBases,
    agents: T.nav.agents,
    offline: T.status.offline,
  },

  /** Screen Help section: the D3 window, "It points. You click." (T.keywords Pointing). */
  how: {
    eyebrow: T.board.how.eyebrow,
    /** PROPOSED: from T.keywords[1].line "GetcKo shows the way. You click." 4 words. */
    title: "It points. You click.",
    steps: T.board.how.steps,
    window: "Student Record",
    student: "Learner",
    studentName: "Juan dela Cruz",
    finalGrade: "Final",
  },

  knowledge: {
    eyebrow: T.nav.knowledgeBases,
    title: T.board.knowledge.title,
    listTitle: T.board.knowledge.listTitle,
    passagesLabel: "passages · on this Mac",
    /** The passage behind Juan's answer. */
    answerSource: sourceLabel("Manual", 4),
    docs: [
      { name: "Office Grading Manual.pdf", pages: 24, passages: 61 },
      { name: "DepEd Forms Guide.docx", pages: 18, passages: 44 },
      { name: "Records Notes.md", pages: 3, passages: 9 },
    ],
  },

  voice: {
    eyebrow: "Taglish",
    /** PROPOSED: "Ask" is T.actions.ask. 3 words. */
    title: "Ask out loud.",
    question: "Saan ko ilalagay ang final grade ni Juan?",
    answer: "Ilagay mo sa cell E5 ang final grade ni Juan. Average ito ng tatlong quarter.",
    answerOutLoud: T.settings.answerOutLoud,
    stop: T.actions.stopSpeaking,
    /** Browser speech stands in for the app's OS voices on this page. */
    voiceNote: "Plays with this browser's voice. Esc stops it.",
  },

  agents: {
    eyebrow: T.agent.templates,
    /** PROPOSED: "template" is canonical. 4 words. */
    title: "Start from a template.",
  },

  keywords: { eyebrow: T.board.keywords.eyebrow, list: T.keywords },

  offline: {
    eyebrow: T.status.offline,
    title: T.offline.proof,
    nothingLeaves: T.offline.nothingLeaves("mac"),
    runsOn: PLACE.mac.onThis,
    stackTitle: T.settings.models,
    stackHelp: T.settings.modelsHelp,
    /** Model stack, docs/architecture.md "Local models and runtime". */
    stack: [
      ["Answers and pointing", "Gemma 4 E2B"],
      ["Hearing your question", "Gemma 4 E2B audio"],
      ["Search your documents", "EmbeddingGemma 300M · sqlite-vector"],
      [T.settings.voice, "This Mac's voices"],
    ] as const,
  },

  closing: {
    title: T.product.tagline,
    gloss: T.product.taglineGloss,
    line: T.product.line,
  },

  footer: {
    /** The hackathon's own name. */
    event: "AppBuildersPH 2026 · Local AI challenge",
  },

  close: say.tl.close,
} as const;
