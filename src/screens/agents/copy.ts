// Agents screen strings that have no key in src/brand/lexicon.ts yet. Same voice rules as T:
// sentence case, short, verbs on buttons, no emoji, "on this Mac" / "on this PC" for place.
import type { TemplateId } from "../../bindings/TemplateId";
import { T } from "../../brand/lexicon";
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

} as const;

/** Questions a coworker would ask each template. First one is the card sample. Answers are English only. */
const QUESTIONS: Record<TemplateId | "custom", readonly string[]> = {
  officeHelper: ["How do I add a new record?", "Where is the Save button?"],
  teacher: ["Where do I put the final grade?", "How is the quarterly grade computed?"],
  studyBuddy: ["What does the mitochondria do?", "Quiz me on the parts of a cell."],
  custom: ["What can you help me with?", "Where do I start?"],
};

/** Suggested questions for an agent: its template's, or a general pair for a custom agent. */
export function sampleQuestions(templateId: TemplateId | null): readonly string[] {
  return QUESTIONS[templateId ?? "custom"];
}

/** GetcKo's own first line in an empty Try it. */
export function tryGreeting(): string {
  return "Ask me. I'll check your documents.";
}
