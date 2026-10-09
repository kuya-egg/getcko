// Pure state helpers for the knowledge-base screen (tested in logic.test.ts). No React, no IPC.
import type { Document } from "../../bindings/Document";
import type { DocumentStatus } from "../../bindings/DocumentStatus";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { KnowledgeBaseStatus } from "../../bindings/KnowledgeBaseStatus";
import type { Status } from "../../brand/lexicon";
import { T } from "../../brand/lexicon";
import { APP_COPY } from "../../app/copy";
import { errorCopy } from "../../app/errors";
import { KB_COPY } from "./copy";

/** Longest knowledge-base name we accept (fits the list column without a second line). */
export const NAME_MAX = 60;

/**
 * Client-side check before kb_create / kb_rename. Returns the error line, or null when fine.
 * `others` are the names already in use (exclude the one being renamed).
 */
export function validateName(name: string, others: readonly string[] = []): string | null {
  const n = name.trim();
  if (!n) return APP_COPY.errors.emptyName.title;
  if (n.length > NAME_MAX) return KB_COPY.nameTooLong(NAME_MAX);
  const key = n.toLocaleLowerCase();
  if (others.some((o) => o.trim().toLocaleLowerCase() === key)) return KB_COPY.nameTaken;
  return null;
}

const RANK: Record<DocumentStatus, number> = { queued: 0, processing: 1, ready: 2, failed: 2 };

/**
 * Insert or update a document from doc_import or a 'document' event. Never moves a document back
 * in its life (a late "queued" from doc_import must not undo a "processing" event that beat it).
 */
export function upsertDoc(docs: readonly Document[], doc: Document): Document[] {
  const i = docs.findIndex((d) => d.id === doc.id);
  if (i < 0) return sortDocs([...docs, doc]);
  if (RANK[docs[i].status] > RANK[doc.status]) return [...docs];
  const next = [...docs];
  next[i] = doc;
  return next;
}

export function removeDoc(docs: readonly Document[], id: Document["id"]): Document[] {
  return docs.filter((d) => d.id !== id);
}

/** Newest first, so a fresh import shows at the top, next to the drop well. */
export function sortDocs(docs: readonly Document[]): Document[] {
  return [...docs].sort((a, b) => b.createdAt - a.createdAt);
}

/** Same rule as the store (src-tauri/src/store): in flight > any ready > empty > failed. */
export function kbStatusOf(docs: readonly Document[]): KnowledgeBaseStatus {
  if (docs.some((d) => d.status === "queued" || d.status === "processing")) return "processing";
  if (docs.some((d) => d.status === "ready")) return "ready";
  return docs.length === 0 ? "empty" : "failed";
}

/** Recompute a knowledge base's counts and status from its full document list. */
export function summarizeKb(kb: KnowledgeBase, docs: readonly Document[]): KnowledgeBase {
  return {
    ...kb,
    documentCount: docs.length,
    passageCount: docs.reduce((n, d) => n + d.passageCount, 0),
    status: kbStatusOf(docs),
  };
}

/** Status chip for a document row. Queued reads as Processing (it is next in line). */
export function docChip(status: DocumentStatus): Exclude<Status, "offline"> {
  return status === "queued" ? "processing" : status;
}

/** Caption under a knowledge base in the list: "3 documents" or "3 documents · Processing". */
export function kbCaption(kb: KnowledgeBase): string {
  const count = T.knowledgeBase.documentsCount(kb.documentCount);
  return kb.status === "processing" ? `${count} · ${KB_COPY.processingSuffix}` : count;
}

/** "C:\\Users\\me\\Manual.pdf" or "/Users/me/Manual.pdf" → "Manual.pdf". */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export interface ImportIssue {
  file: string;
  /** What to do, one line. */
  fix: string;
}

/** One line per document that doc_import refused: duplicate, unsupported type, or anything else. */
export function importIssue(path: string, error: unknown): ImportIssue {
  const file = baseName(path);
  const c = errorCopy(error);
  if (c.kind === "duplicate") {
    // The store matches by content, so the stored copy can have another name. Name it when it does.
    const stored = duplicateOf(error);
    return { file, fix: stored && stored !== file ? c.body : KB_COPY.issues.duplicate };
  }
  if (c.title === T.states.unsupportedFile.title) return { file, fix: T.errors.unsupportedFile };
  return { file, fix: `${c.title} ${c.body}` };
}

/** "Report.pdf is already in this knowledge base" → "Report.pdf" (the stored document's name). */
export function duplicateOf(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const m = /^(.+?) is already in this knowledge base/i.exec(msg.trim());
  return m ? m[1].trim() : null;
}

/** Pick the next selection after a knowledge base is removed: the one below, else the one above. */
export function nextSelection(kbs: readonly KnowledgeBase[], removedId: KnowledgeBase["id"]): KnowledgeBase["id"] | null {
  const i = kbs.findIndex((k) => k.id === removedId);
  const rest = kbs.filter((k) => k.id !== removedId);
  if (!rest.length) return null;
  return rest[Math.min(Math.max(i, 0), rest.length - 1)].id;
}

/** At most one GetcKo on screen: the first in-flight row reads along, else none. */
export function readingDocId(docs: readonly Document[]): Document["id"] | null {
  return docs.find((d) => d.status === "queued" || d.status === "processing")?.id ?? null;
}
