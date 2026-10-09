// Knowledge-base screen strings that have no key in src/brand/lexicon.ts yet.
// Same voice as T: sentence case, short, no emoji, plain words. Move into lexicon.ts when it opens up.
import { PLACE, type Platform } from "../../brand/lexicon";

export const KB_COPY = {
  /** aria-label for the list of knowledge bases. */
  listLabel: "Your knowledge bases",
  documentsLabel: "Documents",

  /** No knowledge bases at all. */
  empty: {
    title: "No knowledge bases yet.",
    body: "Make one, then add your office manual to it.",
  },

  /** Name field (create and rename). */
  nameLabel: "Name",
  namePlaceholder: "e.g. Business permits",
  nameTooLong: (max: number) => `Keep it under ${max} characters.`,
  nameTaken: "You already have one with this name.",

  /** aria-labels for icon-only buttons. */
  rename: (name: string) => `Rename ${name}`,
  remove: (name: string) => `Delete ${name}`,
  select: (name: string) => `Open ${name}`,

  /** Summary under the knowledge base name. Counts only, never a speed. */
  processingSuffix: "Processing",

  /** No knowledge bases yet: what one is for, in three words-not-sentences steps. */
  steps: {
    label: "How a knowledge base works",
    name: "Name it",
    add: "Add documents",
    attach: "Attach to an agent",
  },

  /** Empty knowledge base: the window-wide native drop, said once under the action. */
  dropOnWindow: "Or drop them anywhere on this window.",
  /** Beside "Add documents" once there are documents. */
  dropHere: "Or drop them here.",
  /** The add strip's hint: types only (the sidebar's Offline badge already says where they stay). */
  fileTypes: "PDF, DOCX, PPTX, TXT or MD",

  /** Failed row: pick a fixed copy; the failed one goes once the new one is in. */
  replace: "Replace",
  replaceLabel: (name: string) => `Replace ${name}`,

  /** Import problems, one line per document. */
  issues: {
    title: (n: number) => (n === 1 ? "1 document wasn't added." : `${n} documents weren't added.`),
    /** Fallback when the backend doesn't say which stored document matched. */
    duplicate: "Already here. Delete the old one to add it again.",
  },

  /** Confirm before a document goes (same shape as T.confirm). */
  deleteDocument: (fileName: string) => ({
    title: `Delete ${fileName}?`,
    body: "Agents stop using it. Your file stays.",
    confirm: "Delete document",
    cancel: "Keep",
  }),

  /** Document search model (embeddings) not ready: imports wait or fail. */
  model: {
    loading: {
      title: "The document search model is loading.",
      body: "New documents start once it's ready.",
    },
    missing: (p: Platform) => ({
      title: "The document search model isn't loaded.",
      body: `GetcKo can't read new documents ${PLACE[p].onThis} until it is.`,
    }),
  },
} as const;
