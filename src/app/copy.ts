// Main-window strings that have no key in src/brand/lexicon.ts yet. Same voice rules as T:
// sentence case, short, no emoji, "on this Mac" for place. Move into lexicon.ts when it opens up.
import type { EngineComponent } from "../bindings/EngineComponent";
import { PLACE, type Platform } from "../brand/lexicon";

export const APP_COPY = {
  shell: {
    /** Shown beside GetcKo while the first setup check runs (only after 300ms). */
    checking: "Checking this computer...",
  },

  settings: {
    setup: "Setup",
    themeHelp: "Match system follows your computer.",
  },

  /** Plain names for engine components (setup panel, error copy). */
  components: {
    chat: "Answer model",
    embeddings: "Document search model",
    speechToText: "Hold to talk",
    textToSpeech: "Answer out loud",
    microphone: "Microphone",
  } satisfies Record<EngineComponent, string>,

  /** ErrorKind → copy. Title says what happened, body what to do. One line each. */
  errors: {
    notFound: { title: "That's gone.", body: "It may have been deleted. Refresh and try again." },
    invalid: { title: "That didn't work.", body: "Check what you entered, then try again." },
    duplicate: { title: "Already added.", body: "This knowledge base has that document." },
    unavailable: { title: "Not ready yet.", body: "The model isn't loaded yet. Try again in a moment." },
    permissionDenied: { title: "GetcKo needs a permission.", body: "Open Settings and turn it on." },
    storage: (p: Platform) => ({
      title: "Couldn't save that.",
      body: `GetcKo couldn't write to its data ${PLACE[p].onThis}. Try again.`,
    }),
    engine: { title: "No answer this time.", body: "The model stopped. Ask again in a moment." },
    platform: (p: Platform) => ({
      title: "Not available here.",
      body: `This part doesn't work ${PLACE[p].onThis} yet.`,
    }),
    io: { title: "Can't open that file.", body: "Check it still exists, then add it again." },
    unknown: { title: "That didn't work.", body: "Try again in a moment." },
    /** Specific backend messages worth their own words. */
    emptyName: { title: "Add a name first.", body: "A name helps you find it later." },
    tooManyKnowledgeBases: { title: "Up to 5 knowledge bases.", body: "Remove one to attach another." },
    noAgent: { title: "Pick an agent first.", body: "Start from a template on the Agents page." },
    emptyQuestion: { title: "Type a question first.", body: "Or hold to talk." },
    /** Document.error "import interrupted" (the app closed mid-import). */
    importInterrupted: "Import stopped. Add it again.",
  },
} as const;
