// GetckoError → words a person can act on. Use with <ErrorNotice title={c.title}>{c.body}</ErrorNotice>
// or a failed row's reason (errorReason). Never show the raw backend message on its own.
import type { ErrorKind } from "../bindings/ErrorKind";
import { T } from "../brand/lexicon";
import type { Platform } from "../components/ui/platform";
import { GetckoError, isAppError } from "../lib/getcko";
import { APP_COPY } from "./copy";
import { PLATFORM } from "./platform";

export interface ErrorCopy {
  /** What happened, ≤ 6 words. */
  title: string;
  /** What to do, one line. */
  body: string;
  /** The backend kind, when there was one ("unknown" for plain JS errors). */
  kind: ErrorKind | "unknown";
}

const E = APP_COPY.errors;

function kindOf(error: unknown): ErrorKind | "unknown" {
  if (error instanceof GetckoError) return error.kind;
  if (isAppError(error)) return error.kind;
  return "unknown";
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isAppError(error)) return error.message;
  return typeof error === "string" ? error : "";
}

/** "x is already in this knowledge base" → "x is already in this knowledge base." */
function sentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const cap = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}

/**
 * Map any thrown value (GetckoError from src/lib/getcko.ts, AppError, Error) to copy.
 * Known backend messages get specific words; everything else falls back to the ErrorKind.
 */
export function errorCopy(error: unknown, platform: Platform = PLATFORM): ErrorCopy {
  const kind = kindOf(error);
  const msg = messageOf(error).toLowerCase();

  // Specific messages first (src-tauri/src/store, pipeline, ingest).
  if (msg.includes("not supported")) return { kind, ...T.states.unsupportedFile };
  if (msg.includes("scanned") || msg.includes("no text found")) return { kind, ...T.states.scannedPdf };
  if (msg.includes("at most five") || msg.includes("at most 5")) return { kind, ...E.tooManyKnowledgeBases };
  if (msg.includes("name must not be empty")) return { kind, ...E.emptyName };
  if (msg.includes("question must not be empty")) return { kind, ...E.emptyQuestion };
  if (msg.includes("no active agent") || msg.includes("no agent")) return { kind, ...E.noAgent };
  if (msg.includes("embedding model not available") || msg.includes("not loaded")) {
    return { kind, title: E.unavailable.title, body: T.errors.modelNotLoaded };
  }

  switch (kind) {
    case "duplicate":
      // Backend says "{file} is already in this knowledge base": specific and already plain.
      return { kind, title: E.duplicate.title, body: msg ? sentence(messageOf(error)) : E.duplicate.body };
    case "notFound":
      return { kind, ...E.notFound };
    case "invalid":
      return { kind, ...E.invalid };
    case "unavailable":
      return { kind, ...E.unavailable };
    case "permissionDenied":
      return { kind, ...E.permissionDenied };
    case "storage":
      return { kind, ...E.storage(platform) };
    case "engine":
      return { kind, ...E.engine };
    case "platform":
      return { kind, ...E.platform(platform) };
    case "io":
      return { kind, ...E.io };
    default:
      return { kind, ...E.unknown };
  }
}

/** One-line reason for a failed row or chip: "Failed: {reason}". Uses the body when the title is generic. */
export function errorReason(error: unknown): string {
  const c = errorCopy(error);
  return c.kind === "duplicate" ? c.body : c.title.replace(/\.$/, "");
}

/**
 * Reason words for a document whose status is "failed" (Document.error is a backend string).
 * "no text found (scanned PDF?)" → T.errors.scannedPdf.
 */
export function documentFailure(reason: string | null): string {
  if (!reason) return E.unknown.title.replace(/\.$/, "");
  const r = reason.toLowerCase();
  if (r.includes("scanned") || r.includes("no text found")) return T.errors.scannedPdf;
  if (r.includes("not supported")) return T.errors.unsupportedFile;
  if (r.includes("interrupted")) return E.importInterrupted;
  if (r.includes("embedding model not available")) return T.errors.modelNotLoaded;
  return sentence(reason);
}
