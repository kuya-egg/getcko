// Agents screen strings that have no key in src/brand/lexicon.ts yet. Same voice rules as T:
// sentence case, short, verbs on buttons, no emoji, "on this Mac" / "on this PC" for place.
import type { TemplateId } from "../../bindings/TemplateId";
import { PLACE, T, type AgentLanguage, type Platform } from "../../brand/lexicon";
import { APP_COPY } from "../../app/copy";

export const AGENTS_COPY = {
  /** Eyebrow over the agent cards. */
  yourAgents: "Your agents",
  /** Beside the live dot on the agent GetcKo uses now. */
  inUse: "In use",
  /** Icon button on every agent: opens the editor. */
  editAria: (name: string) => `Edit ${name}`,
  /** Hero action: open the editor at Try it. */
  tryAria: (name: string) => `Try ${name}`,
  /** Empty list: the halo button names the template it makes ("Use Office Helper"). */
  useNamed: (template: string) => `Use ${template}`,
  /** Under the Templates label. */
  templatesHint: "One click makes an agent. Change anything later.",
  /** Template card: the sample question, labelled for screen readers. */
  sampleAria: "Sample question",
  /** Editor title while the name field is still empty. */
  untitled: T.actions.newAgent,
  /** Back link from the editor to the list. */
  back: T.nav.agents,
  backAria: "Back to all agents",

  descriptionLabel: "Short description",
  descriptionHelp: "One line on the agent card.",

  /** AnswerLength is short | normal in the backend. */
  lengthNormal: "Normal",

  /** First voice option: voiceId null. */
  systemVoice: "System voice",

  /** "2 of 5" beside the knowledge base list. */
  attached: (n: number, max: number) => `${n} of ${max}`,
  attachedAria: (n: number, max: number) => `${n} of ${max} knowledge bases attached`,

  /** Footer bar. */
  duplicateSaveFirst: "Save your changes to duplicate this agent.",
  unsaved: "Not saved yet",

  /** Try it. This chat sends typed questions; screen help is the icon beside Ask. */
  tryPlaceholder: (name: string) => `Ask ${name} a question`,
  tryPlaceholderIdle: "Ask a question",
  trySaveFirst: "Save this agent to try it.",
  tryUsesSaved: "Try it uses the last saved version. Save to test your changes.",
  stopped: "Stopped.",
  /** While GetcKo is still checking documents (nothing spoken yet): stop the whole turn. */
  stop: "Stop",
  /** Try it failed because the chat model is missing: waiting won't fix it, Settings will. */
  modelMissingBody: "The chat model isn't set up. Check it in Settings.",
  /** The model-missing recovery: go to the Settings screen (models live there). */
  openSettings: `Open ${T.nav.settings}`,
  /** Short description field: a hint, never a value that looks filled in. */
  descriptionPlaceholder: "One line, like: Learn new office software",
  /** Over the suggested questions in an empty Try it. */
  trySuggest: "Ask one of these",

  /** Leaving the editor with changes. */
  discard: {
    title: "Leave without saving?",
    body: "Your changes to this agent go.",
    confirm: "Leave",
    cancel: T.actions.keep,
  },

  /** Name is empty on Save. */
  nameRequired: APP_COPY.errors.emptyName.title,

  /** T.agent.noFilipinoVoice with the right place for this computer. */
  noFilipinoVoice: (p: Platform) => T.agent.noFilipinoVoice.replace("this Mac", PLACE[p].thisDevice),
} as const;

/**
 * Questions a coworker would ask each template, in the agent's answer language. GetcKo's
 * world, not UI chrome, so Taglish agents get Taglish questions. First one is the card sample.
 */
const QUESTIONS: Record<TemplateId | "custom", { en: readonly string[]; tl: readonly string[] }> = {
  officeHelper: {
    en: ["How do I add a new record?", "Where is the Save button?"],
    tl: ["Paano mag-add ng bagong record?", "Nasaan ang Save button?"],
  },
  teacher: {
    en: ["Where do I put the final grade?", "How is the quarterly grade computed?"],
    tl: ["Saan ko ilalagay ang final grade?", "Paano kinukuwenta ang quarterly grade?"],
  },
  studyBuddy: {
    en: ["What does the mitochondria do?", "Quiz me on the parts of a cell."],
    tl: ["Ano ang ginagawa ng mitochondria?", "I-quiz mo ako sa parts ng cell."],
  },
  taglishExplainer: {
    en: ["What does this button do?", "Where do I click to print?"],
    tl: ["Ano ang ginagawa ng button na ito?", "Saan ako magki-click para mag-print?"],
  },
  custom: {
    en: ["What can you help me with?", "Where do I start?"],
    tl: ["Ano ang kaya mong itulong sa akin?", "Saan ako magsisimula?"],
  },
};

/** Suggested questions for an agent: its template's, in its language (Filipino uses the Taglish set). */
export function sampleQuestions(templateId: TemplateId | null, language: AgentLanguage): readonly string[] {
  const set = QUESTIONS[templateId ?? "custom"];
  return language === "English" ? set.en : set.tl;
}

/**
 * GetcKo's own first line in an empty Try it, in the agent's language (GetcKo's world, so Taglish
 * agents greet in Taglish). Filipino uses the Taglish line, like linesFor().
 */
export function tryGreeting(language: AgentLanguage): string {
  return language === "English" ? "Ask me. I'll check your documents." : "Itanong mo lang. Hahanapin ko sa mga document mo.";
}
