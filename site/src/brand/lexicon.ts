// GetcKo controlled vocabulary: the canonical UI strings.
// Spec and rationale: docs/brand/lexicon.md. Agent short version:
// .claude/skills/getcko-brand/references/lexicon.md.
//
// Two layers:
//   T      UI chrome. English only (design system §11: "UI chrome stays English by default").
//   say    GetcKo's own lines (status lines, answers' fixed phrases, empty and error
//          messages). These follow the agent language, so they exist in `en` and `tl`
//          (Taglish). `tl` is typed against `en`, so a missing or extra key is a type error.
//
// Rules baked in: sentence case, verbs on buttons, no emoji, no exclamation marks
// (except `say.*.onboardingDone`), numbers as "0.9 s", location as "on this Mac".
// Do not add "AI-powered", "magic", "smart", "seamless", "Oops", "Something went wrong".

import type { Moment } from "./mascot/moments";

export type Platform = "mac" | "win";
/** Agent answer language as stored on the agent (PRD A5). */
export type AgentLanguage = "English" | "Filipino" | "Taglish";
/** Status chip states (design system §8). */
export type Status = "processing" | "ready" | "failed" | "offline";
/** Knowledge-base file types (PRD R1, R6). */
export type DocType = "pdf" | "txt" | "md" | "docx" | "pptx";

/** Where things run, per platform. "on this Mac" is the canonical phrase. */
export const PLACE: Record<Platform, { onThis: string; thisDevice: string }> = {
  mac: { onThis: "on this Mac", thisDevice: "this Mac" },
  win: { onThis: "on this PC", thisDevice: "this PC" },
};

/** Seconds with one decimal and a space: 0.9 → "0.9 s". Measured values only (docs/MODELS.md). */
export const fmtSeconds = (s: number): string => `${s.toFixed(1)} s`;

/** Thousands with commas: 1312 → "1,312". */
const num = (n: number): string => n.toLocaleString("en-US");

/** Count with a unit word: fmtCount(48, "page") → "48 pages", fmtCount(1, "passage") → "1 passage". */
export const fmtCount = (n: number, one: string, many: string = `${one}s`): string => `${num(n)} ${n === 1 ? one : many}`;

/** File size, base 1024, one decimal above KB: 812 → "812 B", 2_400_000 → "2.3 MB". */
export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Date in words, never numeric (10/9 reads as Sept 10 to half the room): "Oct 9" this year,
 * "Oct 9, 2026" otherwise. Pass `now` for deterministic output (tests, video frames).
 */
export function fmtDate(d: Date | number | string, now: Date = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const md = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? md : `${md}, ${date.getFullYear()}`;
}

/** Speaking speed multiplier: 1 → "1.0×", 1.25 → "1.25×". */
export const fmtSpeed = (rate: number): string =>
  `${Math.abs(rate * 10 - Math.round(rate * 10)) < 1e-9 ? rate.toFixed(1) : rate.toFixed(2)}×`;

/**
 * Measured numbers (docs/MODELS.md, M4 Pro). Every value stays null until the benchmark script fills
 * MODELS.md; a null renders nothing (see <Stat> and <ProofLine>). Never type a guess here.
 */
export const MEASURED: {
  /** Question to first spoken word, seconds. */
  firstSpokenWord: number | null;
  /** Chat tokens per second. */
  tokensPerSecond: number | null;
  /** Time to first token, seconds. */
  timeToFirstToken: number | null;
  /** 20-page PDF to Ready, seconds. */
  pdfToReady: number | null;
  /** Bytes sent over the network during a session, measured with a monitor. */
  bytesSent: number | null;
} = {
  // docs/MODELS.md (dev, 2026-10-09, M4 Pro): end of speech → first spoken word, Taglish demo median 1494 ms.
  firstSpokenWord: 1.5,
  tokensPerSecond: null,
  timeToFirstToken: null,
  pdfToReady: null,
  bytesSent: null,
};

/** Speed figure line: "0.9 s · on this Mac". */
export const latencyLine = (seconds: number, platform: Platform = "mac"): string =>
  `${fmtSeconds(seconds)} · ${PLACE[platform].onThis}`;

/** Throughput line: "42 tokens/s · on this Mac". Whole numbers. */
export const tokensLine = (perSecond: number, platform: Platform = "mac"): string =>
  `${Math.round(perSecond)} tokens/s · ${PLACE[platform].onThis}`;

/** Source chip text: "Manual · p. 4" or "Manual · Grading". */
export const sourceLabel = (doc: string, where: number | string): string =>
  typeof where === "number" ? `${doc} · p. ${where}` : `${doc} · ${where}`;

/** UI chrome strings. English. Components import these instead of hardcoding. */
export const T = {
  product: {
    name: "GetcKo",
    tagline: "Gets mo na.",
    taglineGloss: "Now you get it.",
    line: "Help that sits right next to your cursor.",
    descriptor: "A private desktop helper that works offline.",
  },

  nav: {
    /** aria-label for the sidebar <nav>. */
    label: "Main",
    agents: "Agents",
    knowledgeBases: "Knowledge bases",
    ask: "Ask",
    try: "Try it",
    benchmark: "Speed",
    settings: "Settings",
    about: "About",
  },

  actions: {
    ask: "Ask",
    start: "Start",
    newAgent: "New agent",
    addDocuments: "Add documents",
    newKnowledgeBase: "New knowledge base",
    tryThisAgent: "Try this agent",
    useTemplate: "Use template",
    stopSpeaking: "Stop speaking",
    nextStep: "Next step",
    tryAgain: "Try again",
    close: "Close",
    closeAnswer: "Close answer",
    more: "More",
    less: "Less",
    edit: "Edit",
    duplicate: "Duplicate",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    openSystemSettings: "Open System Settings",
    notNow: "Not now",
    continue: "Continue",
    holdToTalk: "Hold to talk",
    screenHelp: "Screen Help",
    back: "Back",
    checkAgain: "Check again",
    finish: "Finish",
    playSample: "Play sample",
    keep: "Keep",
    chooseFiles: "Choose files",
  },

  /** aria-labels for icon-only buttons. */
  aria: {
    holdToTalk: "Hold to talk",
    listening: "Listening, release to stop",
    screenHelp: "Screen Help: point on screen",
    stopSpeaking: "Stop speaking",
    closeAnswer: "Close answer",
    session: "GetcKo session",
    startAgent: (agent: string) => `Start ${agent}`,
    removeDocument: (doc: string) => `Remove ${doc}`,
    answerFrom: (agent: string) => `Answer from GetcKo, ${agent}`,
    openSource: (source: string) => `Open source: ${source}`,
    agentTags: "Knowledge bases and answer language",
    theme: "Theme",
    back: "Back",
    playSample: (voice: string) => `Play a sample of ${voice}`,
    stopSample: "Stop the sample",
    dismiss: "Dismiss",
    search: "Search",
    moreInfo: "More info",
    importProgress: "Reading the document",
    switchAgent: (agent: string) => `Switch agent, now ${agent}`,
  },

  status: {
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
    offline: "Offline",
    failedWith: (reason: string) => `Failed: ${reason}`,
    listening: "Listening",
    bestGuess: "Best guess",
    notOnScreen: "Not on this screen",
  } as const,

  composer: {
    placeholder: "Ask about your screen or your documents",
    placeholderFor: (agent: string) => `Ask ${agent} about your screen or your documents`,
    listeningPlaceholder: "Listening. Let go to ask.",
    label: "Question",
  },

  answerCard: {
    header: (agent: string) => `GetcKo · ${agent}`,
    questionLabel: "Your question",
    sourcesLabel: "Sources",
    step: (n: number, total: number) => `Step ${n} of ${total}`,
  },

  sessionBar: {
    shortcutHint: "to ask",
    stopHint: "Esc to stop",
  },

  agent: {
    sectionInstructions: "Instructions",
    sectionKnowledgeBases: "Knowledge bases",
    sectionVoice: "Voice and language",
    sectionTry: "Try it",
    templates: "Templates",
    nameLabel: "Name",
    instructionsLabel: "Instructions",
    instructionsHelp: "Tell GetcKo how to help. Plain sentences work best.",
    baseRulesLabel: "Include GetcKo's base rules",
    baseRulesHelp: "Turn off to use only your instructions.",
    knowledgeBasesHelp: "Attach up to 5. Answers come only from these.",
    languageLabel: "Answer language",
    lengthLabel: "Answer length",
    lengthShort: "Short",
    lengthMedium: "Medium",
    lengthLong: "Long",
    voiceLabel: "Voice",
    speedLabel: "Speaking speed",
    answerOutLoudLabel: "Answer out loud",
    answerOutLoudHelp: "GetcKo speaks each answer. Esc stops it.",
    noFilipinoVoice: "No Filipino voice on this Mac. GetcKo uses an English one.",
    tryNotSaved: "This test chat is not saved.",
    newAgentHint: "Start from instructions and your own documents.",
    maxKnowledgeBases: "An agent can use up to 5 knowledge bases.",
  },

  templates: {
    officeHelper: { name: "Office Helper", line: "Learn new office software, step by step." },
    teacher: { name: "Teacher", line: "DepEd forms and grade sheets." },
    studyBuddy: { name: "Study Buddy", line: "Answers from your own notes." },
    taglishExplainer: { name: "Taglish Explainer", line: "Explains in Taglish, like an officemate." },
  },

  knowledgeBase: {
    emptyTitle: "No documents yet.",
    emptyBody: "Add your office manual and GetcKo can cite it.",
    fileHint: (platform: Platform = "mac") => `PDF, DOCX, PPTX, TXT or MD · stays ${PLACE[platform].onThis}`,
    /** Drop zone headline. */
    drop: "Drop documents here",
    /** Drop zone while files are held over it. */
    dropActive: "Let go to add them",
    /** Between the drop line and the button. */
    dropOr: "or",
    /** Import progress line: "Reading 12 / 48 pages". */
    reading: (page: number, total: number) => `Reading ${num(page)} / ${num(total)} pages`,
    /** Mono counter beside the pixel squares: "12 / 48 pages". */
    pagesProgress: (page: number, total: number) => `${num(page)} / ${num(total)} ${total === 1 ? "page" : "pages"}`,
    meta: (pages: number, passages: number) => `${fmtCount(pages, "page")} · ${fmtCount(passages, "passage")}`,
    documentsCount: (n: number) => fmtCount(n, "document"),
    added: (date: string) => `Added ${date}`,
  },

  agentsEmpty: {
    title: "No agents yet.",
    body: "Start from a template. You can change everything later.",
  },

  errors: {
    scannedPdf: "This PDF is a scanned image. Try a text PDF.",
    unsupportedFile: "Can't read this file type. Use PDF, DOCX, PPTX, TXT or MD.",
    modelNotLoaded: "The model isn't loaded yet. Try again in a moment.",
    micBlocked: "GetcKo can't hear you. Allow the microphone.",
    noScreenAccess: "GetcKo can't read this screen. Turn on Accessibility.",
    noTarget: "Can't find that here. Ask with the button's name.",
  },

  /**
   * Empty, loading and error copy for every PRD screen. Headline ≤ 6 words, body one line (~60 ch).
   * Blocks are { title, body }; single status lines are strings.
   */
  states: {
    agents: {
      empty: { title: "No agents yet.", body: "Start from a template. You can change it later." },
      loading: "Loading your agents...",
    },
    agentNoKnowledgeBases: {
      title: "No knowledge bases attached.",
      body: "Attach one so answers come from your documents.",
    },
    knowledgeBases: {
      empty: { title: "No documents yet.", body: "Add your office manual and GetcKo can cite it." },
      loading: "Loading your documents...",
    },
    unsupportedFile: {
      title: "Can't read this file type.",
      body: "Use PDF, DOCX, PPTX, TXT or MD.",
    },
    scannedPdf: {
      title: "This PDF is a scanned image.",
      body: "Export it again as a text PDF, then add it back.",
    },
    chat: {
      empty: { title: "Ask about your documents.", body: "Type or hold to talk. Answers cite the page." },
      loading: "Checking your documents...",
      error: { title: "No answer this time.", body: "The model stopped. Ask again in a moment." },
    },
    try: {
      empty: { title: "Try this agent.", body: "Ask what a coworker would ask. This chat isn't saved." },
      loading: "Looking at your screen...",
    },
    overlay: {
      axRevoked: { title: "Accessibility is off.", body: "Turn it back on so GetcKo can read this app." },
      screenRecordingOff: { title: "Screen Recording is off.", body: "Turn it on for best-guess screenshots." },
      micBlocked: { title: "Microphone is off.", body: "Allow it, or type your question instead." },
    },
    models: {
      notLoaded: { title: "Models not loaded.", body: "Keep GetcKo open while they load. Then it works offline." },
      loading: "Loading models on this Mac...",
      ready: "Models ready",
    },
    benchmark: {
      empty: { title: "No measurements yet.", body: "Run the speed test to see real numbers from this Mac." },
      running: "Measuring on this Mac...",
    },
  },

  /** Confirmations. Title asks, body says what goes and what stays, confirm names the action. */
  confirm: {
    deleteAgent: (name: string) => ({
      title: `Delete ${name}?`,
      body: "Its instructions go. Your documents stay.",
      confirm: "Delete agent",
      cancel: "Keep",
    }),
    deleteKnowledgeBase: (name: string) => ({
      title: `Delete ${name}?`,
      body: "Agents lose these answers. Your files stay where they are.",
      confirm: "Delete knowledge base",
      cancel: "Keep",
    }),
  },

  /** Toasts: past tense, one or two words, no period. */
  toast: {
    saved: "Saved",
    duplicated: "Duplicated",
    deleted: "Deleted",
    added: (n: number) => `${fmtCount(n, "document")} added`,
  },

  /** Answer languages (agent setting). Also the LanguagePicker options. */
  languages: {
    English: "English",
    Filipino: "Filipino",
    Taglish: "Taglish",
  } as const satisfies Record<AgentLanguage, string>,

  /** Proof line parts: "Wi-Fi off · 0 bytes sent · on this Mac". Numbers only from MEASURED. */
  proof: {
    wifiOff: "Wi-Fi off",
    bytesSent: (n: number) => `${num(n)} bytes sent`,
    measuredOn: "measured on M4 Pro",
  },

  /** Measured-number labels for <Stat>. Values come from MEASURED only. */
  stats: {
    firstSpokenWord: "Question to first spoken word",
    tokensPerSecond: "Chat speed",
    timeToFirstToken: "Time to first word",
    pdfToReady: "20-page PDF to Ready",
    bytesSent: "Sent over the network",
    unitSeconds: "s",
    unitTokens: "tokens/s",
    unitBytes: "bytes",
  },

  onboarding: {
    progress: (step: number, total: number) => `Step ${step} of ${total}`,
    /** Step order. Accessibility first: Screen Help needs it most. */
    order: ["accessibility", "screenRecording", "mic", "shortcut"] as const,
    accessibilityTitle: "Let GetcKo read this app.",
    accessibilityBody: "macOS asks once. GetcKo reads buttons to point at them.",
    screenRecordingTitle: "Let GetcKo see your screen.",
    screenRecordingBody: "macOS asks once. Used for best-guess screenshots.",
    micTitle: "Let GetcKo hear you.",
    micBody: "macOS asks once. Used only while you hold to talk.",
    permissionAccessibility: "Accessibility",
    permissionScreenRecording: "Screen Recording",
    permissionMic: "Microphone",
    shortcutTitle: "Ask from any app.",
    shortcutBody: "Press the shortcut, then ask out loud or type.",
    /** Permission state line under the body. */
    granted: "Turned on",
    off: "Off",
    waiting: "Waiting for macOS…",
    checkAgain: "Check again",
    /** Last step's primary button. The finish headline is GetcKo's line: linesFor(lang).onboardingDone. */
    finish: "Finish",
    nothingLeaves: "Nothing leaves this Mac.",
  },

  settings: {
    title: "Settings",
    shortcut: "Shortcut",
    shortcutHelp: "Press it in any app to ask GetcKo.",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "Match system",
    permissions: "Permissions",
    models: "Models",
    modelsHelp: "Downloaded once. Everything runs on this Mac.",
    modelsReady: "Models ready",
    modelsNotLoaded: "Models not loaded",
    mic: "Microphone",
    micHelp: "Used only while you hold to talk.",
    voice: "Voice",
    answerOutLoud: "Answer out loud",
    answerOutLoudHelp: "GetcKo speaks each answer. Esc stops it.",
    speakingSpeed: "Speaking speed",
    licenses: "Licenses",
    licensesHelp: "Models, fonts and icons GetcKo uses.",
  },

  /** Sprite aria-labels. "GetcKo" is the mascot's only name. */
  mascot: {
    name: "GetcKo",
    pointingAtAction: "GetcKo pointing at the next step",
    pointingAt: (what: string) => `GetcKo pointing at ${what}`,
    moment: (word: string) => `GetcKo, ${word.replace(/\.+$/, "").toLowerCase()}`,
  },

  /**
   * One word or line per GetcKo moment (src/brand/mascot/moments.ts), shown next to the pose.
   * Uses the canonical status words where one exists.
   */
  moments: {
    idle: "Paused",
    onboarding: "You're ready.",
    listening: "Listening",
    thinking: "Looking at your screen...",
    processing: "Processing",
    screenHelp: "Screen Help",
    speaking: "Speaking",
    ready: "Ready",
    failed: "I don't know",
    offline: "Offline",
    empty: "No documents yet.",
    moving: "Next step",
    endCard: "Gets mo na.",
  } as const satisfies Record<Moment, string>,

  /** Brand keywords (docs/brand/lexicon.md §1): what GetcKo is, one line each. */
  keywords: [
    { word: "Beside", line: "Help sits next to the work, never on top of it." },
    { word: "Pointing", line: "GetcKo shows the way. You click." },
    { word: "On this Mac", line: "Everything runs on this Mac." },
    { word: "Honest", line: "Measured numbers, real sources, or I don't know." },
    { word: "Patient", line: "A calm officemate for people new to computers." },
    { word: "Pinoy", line: "Taglish is first-class." },
    { word: "Pixel-plain", line: "Paper, ink, one green creature, one yellow ring." },
  ],

  /**
   * Brand board (src/brand/Showcase.tsx) copy. Internal page, same vocabulary rules as the product.
   * Sample content (learner names, file names, answers) stays in the board as data.
   */
  board: {
    version: "Brand board v0.3",
    replay: "Replay",
    sample: "Sample content. Latency and counts are placeholders until measured.",
    stillHint: "Add ?still to the URL for a static capture.",
    hero: {
      eyebrow: "Screen Help",
      body: "Ask out loud. GetcKo lands beside the exact cell, button or menu, rings it in yellow, and answers from your own documents. It points. You click.",
    },
    how: {
      eyebrow: "How it works",
      title: "Ask. GetcKo lands. One ring. One source.",
      steps: [
        { n: "01", label: "Ask", line: "Hold to talk, or type. Your words." },
        { n: "02", label: "GetcKo", line: "Lands beside the answer and faces it." },
        { n: "03", label: "One ring", line: "Yellow, on the one thing to click." },
        { n: "04", label: "Source", line: "Your document, with the page." },
      ],
    },
    agents: {
      eyebrow: "Main window",
      title: "An agent, set up in one screen.",
      body: "Templates on top, one editor below. GetcKo shows up once, in Try it, facing its own answer.",
      roleOfficeHelper: "Helps the records section find the right form, field and step.",
      sampleInstructions:
        "Explain the records section steps. Answer in Taglish. Always say which document you used, and point at the exact button.",
      sourcesAlwaysOn: "Show the source of every answer",
      sourcesAlwaysOnHelp: "Always on. GetcKo never answers without a source.",
    },
    moments: {
      eyebrow: "GetcKo moments",
      title: "One creature, thirteen moments.",
      body: "Every surface picks its pose from MOMENT_POSE. The word under each pose is the word the UI says.",
    },
    knowledge: {
      eyebrow: "Knowledge bases",
      title: "Your documents, read on this Mac.",
      body: "Each document gets its own icon by type. While one is Processing, GetcKo reads along.",
      listTitle: "Records office",
    },
    keywords: { eyebrow: "Brand keywords" },
    session: {
      eyebrow: "Session bar",
      title: "The session bar stays ink, day and night.",
      body: "It floats above any app. Hold to talk, or press the shortcut from anywhere.",
      ready: "Ready · macOS shortcut",
      listening: "Listening · mic held, GetcKo leans in",
      speaking: "Speaking · Esc stops it too",
    },
    states: {
      eyebrow: "States",
      title: "When there is nothing yet, and when it breaks.",
      body: "Empty states point at the next step. Errors say what happened and what to do, next to a GetcKo that is not sure.",
      nameError: "Add a name so you can find this agent later.",
      scannedFix: "Export it again as a text PDF, then add it back.",
    },
    parts: {
      eyebrow: "Parts",
      title: "The pieces, each with one job.",
      buttons: "Buttons",
      iconButtons: "Icon buttons",
      statusAndSources: "Status and sources",
      shortcuts: "Shortcuts",
      fields: "Fields",
      choices: "Choices",
      stopsSpeech: "stops speaking",
      startWithComputer: "Open GetcKo when this Mac starts",
      showSpeed: "Show the measured speed",
      icons: "Pixel icons",
      iconsNote: "Drawn on a 24 grid with a 2px cell, the same cell as GetcKo at 2×.",
    },
    type: { eyebrow: "Type", title: "Bricolage to speak up, Geist to explain." },
    color: {
      eyebrow: "Color",
      title: "Ink, paper, one green, one ring.",
      note: "Green under 3% of any screen. Yellow on one element, or none.",
    },
    footer: { title: "Gets mo na.", line: "Help that sits right next to your cursor, and never leaves this Mac." },
  },

  offline: {
    chip: "Offline",
    proof: "Works with Wi-Fi off.",
    nothingLeaves: (platform: Platform = "mac") => `Nothing leaves ${PLACE[platform].thisDevice}.`,
  },
} as const;

/** GetcKo's own lines in English. The shape every other language must match. */
const sayEn = {
  listening: "Listening...",
  thinking: "Looking at your screen...",
  searching: "Checking your documents...",
  dontKnow: "I don't know. It's not in your documents.",
  bestGuess: "Best guess from a screenshot.",
  emptyDocuments: "No documents yet. Add your office manual.",
  scannedPdf: "I can't read this PDF. It looks like a scanned image.",
  noTarget: "I can't find that on this screen.",
  nextStep: (what: string) => `Next, ${what}.`,
  pointClick: (element: string, where: string) => `Click ${element} at the ${where}.`,
  offlineProof: "Works with Wi-Fi off.",
  permission: "macOS asks once. Nothing leaves this Mac.",
  onboardingDone: "You're ready.",
  close: "Now you get it.",
};

type Lines = typeof sayEn;
/** Same keys as English; functions keep their parameters. Missing keys fail to compile. */
type LinesLike = { [K in keyof Lines]: Lines[K] extends (...a: infer A) => string ? (...a: A) => string : string };

const sayTl: LinesLike = {
  listening: "Nakikinig ako...",
  thinking: "Tinitingnan ko ang screen mo...",
  searching: "Hinahanap ko sa mga document mo...",
  dontKnow: "Hindi ko alam. Wala ito sa mga document mo.",
  bestGuess: "Best guess ito mula sa screenshot.",
  emptyDocuments: "Wala pang document. I-add mo ang office manual ninyo.",
  scannedPdf: "Hindi ko mabasa ang PDF na ito. Mukhang scanned image siya.",
  noTarget: "Hindi ko makita iyan sa screen na ito.",
  nextStep: (what) => `Sunod, ${what}.`,
  pointClick: (element, where) => `I-click mo ang ${element} sa ${where}.`,
  offlineProof: "Gumagana kahit naka-off ang Wi-Fi.",
  permission: "Isang beses lang magtatanong ang macOS. Walang lalabas sa Mac na ito.",
  onboardingDone: "Ready ka na!",
  close: "Gets mo na.",
};

export const say: { en: LinesLike; tl: LinesLike } = { en: sayEn, tl: sayTl };

/**
 * GetcKo's lines for an agent language. Filipino uses the Taglish lines until a
 * Filipino set is written (UI nouns like "document" and "screen" stay English either way).
 */
export function linesFor(language: AgentLanguage): LinesLike {
  return language === "English" ? say.en : say.tl;
}

/** Short status label for a chip. */
export const statusLabel = (s: Status): string => T.status[s];
