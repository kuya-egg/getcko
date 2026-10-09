// Right pane: the open knowledge base. Name (rename inline, delete) with its counts, the add strip
// (also the drop target's feedback), its documents with live status chips, and import problems.
// GetcKo shows inline for an empty knowledge base (EmptyDocs); once there are documents, the list
// is the screen. At most one GetcKo: the error, else the row being read, else the empty state's.
import type { ReactNode } from "react";
import type { Document } from "../../bindings/Document";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import { GetCkoSprite, MOMENT_POSE, handTip } from "../../brand";
import { ICON_PROPS, Icon, docIcon } from "../../brand/icons";
import { T, fmtCount, fmtDate } from "../../brand/lexicon";
import {
  Button,
  ErrorNotice,
  IconButton,
  KnowledgeBaseList,
  Notice,
  Panel,
  StatusChip,
  Surface,
  TargetHalo,
  cn,
} from "../../components/ui";
import { documentFailure, errorCopy } from "../../app/errors";
import { PLATFORM } from "../../app/platform";
import { useDelayed } from "../../app/useResource";
import { KB_COPY } from "./copy";
import { docChip, readingDocId, type ImportIssue } from "./logic";
import { NameForm } from "./NameForm";
import { NATIVE_DROP } from "./useDocumentDrop";

/**
 * Say "drop" only where a drop works: the Tauri window. The dev browser mock shows it too, so
 * screenshots match the app (dropping there does nothing).
 */
const CAN_DROP = NATIVE_DROP || import.meta.env.DEV;

/** Something went wrong: import issues (one line per document) or a single error. */
export interface Problem {
  title: string;
  body?: string;
  items?: ImportIssue[];
}

export interface DocumentsPanelProps {
  kb: KnowledgeBase;
  /** undefined while this knowledge base's documents load (or failed to; see docsError). */
  docs: Document[] | undefined;
  /** docList failed for this knowledge base. */
  docsError?: unknown;
  onRetryDocs: () => void;
  otherNames: readonly string[];
  renaming: boolean;
  onRename: () => void;
  onRenameSubmit: (name: string) => Promise<void>;
  onRenameCancel: () => void;
  onDelete: () => void;
  onAdd: () => void;
  onRemoveDoc: (doc: Document) => void;
  /** Failed row's recovery: pick a fixed copy, then the failed one goes. Omit to hide "Replace". */
  onReplaceDoc?: (doc: Document) => void;
  importing: boolean;
  /** Files held over the window (native drop). */
  dragging: boolean;
  problem: Problem | null;
  onDismissProblem: () => void;
  /** Document search model not ready: an info notice at the top. */
  modelNotice: { title: string; body: string } | null;
}

export function DocumentsPanel({
  kb,
  docs,
  docsError,
  onRetryDocs,
  otherNames,
  renaming,
  onRename,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  onAdd,
  onRemoveDoc,
  onReplaceDoc,
  importing,
  dragging,
  problem,
  onDismissProblem,
  modelNotice,
}: DocumentsPanelProps) {
  const failedToLoad = docs === undefined && docsError !== undefined;
  const showLoading = useDelayed(docs === undefined && !failedToLoad);
  const reading = docs ? readingDocId(docs) : null;
  const gecko: "error" | "row" | "empty" = problem || failedToLoad ? "error" : reading ? "row" : "empty";
  const hasDocs = !!docs && docs.length > 0;
  const loadError = failedToLoad ? errorCopy(docsError) : null;

  return (
    <Panel as="section" padding="none" aria-labelledby={`kb-${kb.id}-title`} className="min-w-0 flex-1 p-4">
      {/* The name is the only heading. Renaming happens in its place; the counts stay under it. The
          knowledge base's own actions sit right after its name, away from the rows' delete column. */}
      <header className="mb-4 flex flex-col gap-1 border-b border-border pb-4">
        {renaming ? (
          <>
            <h2 id={`kb-${kb.id}-title`} className="sr-only">
              {kb.name}
            </h2>
            <NameForm
              initial={kb.name}
              label={KB_COPY.nameLabel}
              others={otherNames}
              onSubmit={onRenameSubmit}
              onCancel={onRenameCancel}
              className="max-w-sm"
            />
          </>
        ) : (
          <div className="-my-1 flex min-w-0 items-center gap-1">
            <h2 id={`kb-${kb.id}-title`} className="mr-1 min-w-0 text-h2 font-display wrap-anywhere text-text">
              {kb.name}
            </h2>
            <IconButton icon={Icon.edit} size="sm" label={KB_COPY.rename(kb.name)} onClick={onRename} className="shrink-0" />
            <IconButton icon={Icon.delete} size="sm" label={KB_COPY.remove(kb.name)} onClick={onDelete} className="shrink-0" />
          </div>
        )}
        {hasDocs && (
          <p className="nums text-caption text-text-3">
            {T.knowledgeBase.documentsCount(kb.documentCount)}
            {kb.passageCount > 0 && ` · ${fmtCount(kb.passageCount, "passage")}`}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {modelNotice && (
          <Notice tone="info" title={modelNotice.title}>
            {modelNotice.body}
          </Notice>
        )}

        {problem && (
          <ErrorNotice title={problem.title} mascot>
            <div className="flex flex-col gap-3">
              {problem.body && <p>{problem.body}</p>}
              {problem.items && (
                <ul className="flex flex-col gap-1">
                  {problem.items.map((it, i) => (
                    <li key={`${it.file}-${i}`} className="min-w-0 wrap-anywhere">
                      <span className="font-semibold">{it.file}</span>
                      <span className="text-text-2"> · {it.fix}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <Button variant="ghost" size="sm" onClick={onDismissProblem}>
                  {T.actions.close}
                </Button>
              </div>
            </div>
          </ErrorNotice>
        )}

        {hasDocs && !renaming && <AddStrip onAdd={onAdd} importing={importing} dragging={dragging} />}

        {docs === undefined ? (
          loadError ? (
            <ErrorNotice title={loadError.title} onRetry={onRetryDocs} mascot={!problem}>
              {loadError.body}
            </ErrorNotice>
          ) : (
            showLoading && <Moment>{T.states.knowledgeBases.loading}</Moment>
          )
        ) : docs.length === 0 ? (
          dragging ? <DropWell /> : <EmptyDocs onAdd={onAdd} gecko={gecko === "empty"} />
        ) : (
          <section aria-label={KB_COPY.documentsLabel} aria-busy={importing || undefined}>
            <KnowledgeBaseList>
              {docs.map((d) => (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  reading={gecko === "row" && d.id === reading}
                  onRemove={() => onRemoveDoc(d)}
                  onReplace={onReplaceDoc && !importing ? () => onReplaceDoc(d) : undefined}
                />
              ))}
            </KnowledgeBaseList>
          </section>
        )}
      </div>
    </Panel>
  );
}

/** Pixel-grid well padding around the inline gecko (same well as EmptyState, at the inline size). */
const WELL_PAD = 12;
const WELL_SCALE = 3;

/**
 * Empty knowledge base, composed for a pane (not a full page): one quiet line under the name (the
 * name stays the only heading), then GetcKo at the inline size pointing at the haloed "Add documents",
 * then what files work. Wraps under itself at 900 instead of breaking out of the card.
 */
function EmptyDocs({ onAdd, gecko }: { onAdd: () => void; gecko: boolean }) {
  const pose = MOMENT_POSE.screenHelp;
  // Line the button's center up with GetcKo's hand.
  const handY = WELL_PAD + (handTip(false, pose).row + 0.5) * WELL_SCALE;
  const buttonTop = gecko ? Math.max(0, Math.round(handY - 24)) : 0;
  const button = (
    <Button icon={Icon.addDocuments} onClick={onAdd}>
      {T.actions.addDocuments}
    </Button>
  );
  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex flex-col gap-1">
        <p className="text-row text-text">{T.states.knowledgeBases.empty.title}</p>
        <p className="text-label text-text-2">{T.states.knowledgeBases.empty.body}</p>
      </div>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-4">
        {gecko && (
          <div className="gc-tex-grid-cell gc-tex-layer shrink-0 rounded-panel border border-border" style={{ padding: WELL_PAD }}>
            <GetCkoSprite pose={pose} scale={WELL_SCALE} label={T.mascot.pointingAtAction} />
          </div>
        )}
        <div style={{ paddingTop: buttonTop }}>{gecko ? <TargetHalo>{button}</TargetHalo> : button}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-caption text-text-3">{T.knowledgeBase.fileHint(PLATFORM)}</p>
        {CAN_DROP && (
          <p className="flex items-center gap-2 text-caption text-text-2">
            <Icon.drop {...ICON_PROPS} className="-my-1 shrink-0 text-text-3" />
            {KB_COPY.dropOnWindow}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * One document. Every row shares one fixed leading column (type icon, or GetcKo reading along while
 * it processes), so names line up in every state. The name gets the full width (two lines at most);
 * the chip and the meta share one line under it. Failed rows say why and offer the fix; the chip is
 * the one red signal.
 */
function DocumentRow({
  doc,
  reading,
  onRemove,
  onReplace,
}: {
  doc: Document;
  reading: boolean;
  onRemove: () => void;
  onReplace?: () => void;
}) {
  const status = docChip(doc.status);
  const DocIcon = docIcon(doc.fileName);
  const ready = doc.status === "ready";
  const failed = doc.status === "failed";
  const meta = ready
    ? [doc.pageCount != null ? fmtCount(doc.pageCount, "page") : null, fmtCount(doc.passageCount, "passage")]
        .filter(Boolean)
        .join(" · ")
    : failed
      ? null
      : T.knowledgeBase.added(fmtDate(doc.createdAt));

  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <span className="flex w-12 shrink-0 justify-center">
        {reading ? (
          <GetCkoSprite pose={MOMENT_POSE.processing} scale={2} label={T.mascot.moment(T.moments.processing)} />
        ) : (
          <DocIcon {...ICON_PROPS} className="text-text-2" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-row wrap-anywhere text-text" title={doc.fileName}>
          {doc.fileName}
        </p>
        <div className="flex min-w-0 items-center gap-2.5 whitespace-nowrap">
          <StatusChip status={status} className="shrink-0" />
          {meta && (
            <span className="nums min-w-0 truncate text-caption text-text-3" title={meta}>
              {meta}
            </span>
          )}
        </div>
        {failed && (
          <div className="flex flex-col items-start gap-0.5 pt-0.5">
            <p className="text-label text-text-2">{documentFailure(doc.error)}</p>
            {onReplace && (
              <Button
                variant="ghost"
                size="sm"
                icon={Icon.addDocuments}
                aria-label={KB_COPY.replaceLabel(doc.fileName)}
                onClick={onReplace}
                className="-ml-1"
              >
                {KB_COPY.replace}
              </Button>
            )}
          </div>
        )}
      </div>
      <IconButton
        icon={Icon.delete}
        size="sm"
        label={T.aria.removeDocument(doc.fileName)}
        onClick={onRemove}
        className="-my-2.5 shrink-0"
      />
    </li>
  );
}

/**
 * The add row once a knowledge base has documents: one dashed strip that is the only frame (a ghost
 * button inside it) and, in the app, the drop feedback (files held over the window turn it green).
 */
function AddStrip({ onAdd, importing, dragging }: { onAdd: () => void; importing: boolean; dragging: boolean }) {
  const hint = CAN_DROP ? `${KB_COPY.dropHere} ${KB_COPY.fileTypes}` : KB_COPY.fileTypes;
  return (
    <div
      data-dragging={dragging || undefined}
      className={cn(
        "flex min-h-14 items-center gap-2 rounded-button border-2 border-dashed p-1.5 transition-colors",
        dragging ? "border-accent-text bg-accent-wash" : "border-border-strong",
      )}
    >
      {dragging ? (
        <p className="flex items-center gap-2 px-2 text-label font-semibold text-text">
          <Icon.drop {...ICON_PROPS} className="shrink-0 text-accent-text" />
          {T.knowledgeBase.dropActive}
        </p>
      ) : (
        <>
          <Button variant="ghost" size="sm" icon={Icon.addDocuments} onClick={onAdd} disabled={importing} className="shrink-0">
            {T.actions.addDocuments}
          </Button>
          <p className="min-w-0 flex-1 truncate pr-2 text-caption text-text-2" title={hint}>
            {hint}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Shown in place of the empty state while files are held over the window (the native drop is
 * window-wide, so this is feedback, not the target). Same look as DropZone's drag-over state.
 */
function DropWell() {
  return (
    <Surface
      as="div"
      texture="footprints"
      intensity="subtle"
      tone="green"
      data-dragging
      className="flex flex-col gap-2 rounded-panel border-2 border-dashed border-accent-text px-8 py-10"
    >
      <p className="flex items-center gap-2 text-row text-text">
        <Icon.drop {...ICON_PROPS} className="text-accent-text" />
        {T.knowledgeBase.dropActive}
      </p>
      <p className="text-caption text-text-2">{T.knowledgeBase.fileHint(PLATFORM)}</p>
    </Surface>
  );
}


/** Loading = GetcKo's moment, never a spinner block. */
export function Moment({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-4 py-2">
      <GetCkoSprite pose={MOMENT_POSE.processing} scale={3} label={T.mascot.moment(T.moments.processing)} />
      <p className="text-body text-text-2">{children}</p>
    </div>
  );
}
