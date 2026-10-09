// Agents screen strings that have no key in src/brand/lexicon.ts yet. Same voice rules as T:
// sentence case, short, verbs on buttons, no emoji, "on this Mac" / "on this PC" for place.
import { PLACE, T, type Platform } from "../../brand/lexicon";
import { APP_COPY } from "../../app/copy";

export const AGENTS_COPY = {
  /** Eyebrow over the agent cards. */
  yourAgents: "Your agents",
  /** Beside the live dot on the agent GetcKo uses now. */
  inUse: "In use",
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
