// Right pane: the open knowledge base. Name (rename inline, delete, add documents), its documents
// with live status chips, and import problems. The big drop well only shows for an empty knowledge
// base (EmptyState) or while files are held over the window; once there are documents, the list is
// the screen. At most one GetcKo: the error, else the row being read, else the empty state's.
import type { ReactNode } from "react";
import type { Document } from "../../bindings/Document";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import { GetCkoSprite, MOMENT_POSE } from "../../brand";
import { ICON_PROPS, Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import {
  Button,
  EmptyState,
  ErrorNotice,
  IconButton,
  KnowledgeBaseList,
  KnowledgeBaseRow,
  Notice,
  Panel,
  Surface,
} from "../../components/ui";
import { documentFailure, errorCopy } from "../../app/errors";
import { PLATFORM } from "../../app/platform";
import { useDelayed } from "../../app/useResource";
import { KB_COPY } from "./copy";
import { docChip, readingDocId, type ImportIssue } from "./logic";
import { NameForm } from "./NameForm";

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
    <Panel
      className="min-w-0 flex-1"
      title={kb.name}
      actions={
        renaming ? undefined : (
          <>
            <IconButton icon={Icon.edit} size="sm" label={KB_COPY.rename(kb.name)} onClick={onRename} />
            <IconButton icon={Icon.delete} size="sm" label={KB_COPY.remove(kb.name)} onClick={onDelete} />
          </>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {renaming && (
          <NameForm
            initial={kb.name}
            label={KB_COPY.rename(kb.name)}
            others={otherNames}
            onSubmit={onRenameSubmit}
            onCancel={onRenameCancel}
            className="max-w-sm"
          />
        )}

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
                    <li key={`${it.file}-${i}`} className="min-w-0">
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

        {hasDocs && !renaming &&
          (dragging ? (
            <DropWell />
          ) : (
            // Compact add row once the knowledge base has documents: the list is the screen.
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant="secondary" size="sm" icon={Icon.addDocuments} onClick={onAdd} disabled={importing}>
                {T.actions.addDocuments}
              </Button>
              <p className="text-caption text-text-2">{T.knowledgeBase.fileHint(PLATFORM)}</p>
            </div>
          ))}

        {docs === undefined ? (
          loadError ? (
            <ErrorNotice title={loadError.title} onRetry={onRetryDocs} mascot={!problem}>
              {loadError.body}
            </ErrorNotice>
          ) : (
            showLoading && <Moment>{T.states.knowledgeBases.loading}</Moment>
          )
        ) : docs.length === 0 ? (
          dragging ? (
            <DropWell />
          ) : (
            <EmptyState
              title={T.states.knowledgeBases.empty.title}
              body={T.states.knowledgeBases.empty.body}
              action={{ label: T.actions.addDocuments, icon: Icon.addDocuments, onClick: onAdd }}
              caption={T.knowledgeBase.fileHint(PLATFORM)}
              mascot={gecko === "empty"}
              halo={gecko === "empty"}
              scale={5}
            />
          )
        ) : (
          <section aria-label={KB_COPY.documentsLabel} aria-busy={importing || undefined}>
            <KnowledgeBaseList>
              {docs.map((d) => (
                <KnowledgeBaseRow
                  key={d.id}
                  name={d.fileName}
                  status={docChip(d.status)}
                  mascot={gecko === "row" && d.id === reading}
                  pages={d.status === "ready" ? (d.pageCount ?? undefined) : undefined}
                  passages={d.status === "ready" ? d.passageCount : undefined}
                  addedAt={d.status === "ready" ? undefined : d.createdAt}
                  meta={d.status === "failed" ? <span className="text-danger">{documentFailure(d.error)}</span> : undefined}
                  actions={
                    <IconButton icon={Icon.delete} size="sm" label={T.aria.removeDocument(d.fileName)} onClick={() => onRemoveDoc(d)} />
                  }
                />
              ))}
            </KnowledgeBaseList>
          </section>
        )}
      </div>
    </Panel>
  );
}

/**
 * Shown only while files are held over the window (the native drop is window-wide, so this is
 * feedback, not the target). Same look as DropZone's drag-over state, with the right platform line.
 */
function DropWell() {
  return (
    <Surface
      as="div"
      texture="footprints"
      intensity="subtle"
      tone="green"
      data-dragging
      className="flex flex-col gap-2 rounded-panel border-2 border-dashed border-accent-text px-8 py-6"
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
