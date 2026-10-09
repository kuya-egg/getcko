// Knowledge bases (frontend-app.md P0-2, design system §9.4): the list on the left, the open
// knowledge base's documents on the right. Imports take absolute paths from the native picker (or a
// native drop) and pass each to docImport; status chips follow 'document' events, no polling.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Document } from "../../bindings/Document";
import type { DocumentId } from "../../bindings/DocumentId";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { KnowledgeBaseId } from "../../bindings/KnowledgeBaseId";
import { GetCkoSprite, MOMENT_POSE } from "../../brand";
import { Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { Button, Dialog, EmptyState, ErrorNotice, PageHeader, Panel, Surface, Toast, useToast } from "../../components/ui";
import { errorCopy } from "../../app/errors";
import { PLATFORM } from "../../app/platform";
import { componentOf, isLoadingModels, useSetup } from "../../app/setup";
import { useDelayed, useResource } from "../../app/useResource";
import { pickDocuments } from "../../lib/dialog";
import { GetckoError } from "../../lib/getcko";
import { docDelete, docImport, docList, kbCreate, kbDelete, kbList, kbRename, onDocument } from "../../lib/getcko";
import { KB_COPY } from "./copy";
import { DocumentsPanel, type Problem } from "./Documents";
import { KbList } from "./KbList";
import { importIssue, nextSelection, removeDoc, sortDocs, summarizeKb, upsertDoc, type ImportIssue } from "./logic";
import { NameForm } from "./NameForm";
import { useDocumentDrop } from "./useDocumentDrop";

interface DocsFor {
  kbId: KnowledgeBaseId;
  docs: Document[];
}

/** A problem belongs to the knowledge base it happened in; another one never shows it. */
type KbProblem = Problem & { kbId: KnowledgeBaseId | null };

const isKbGone = (e: unknown) => e instanceof GetckoError && e.kind === "notFound";

export function KnowledgeBasesScreen() {
  const kbs = useResource(kbList, []);
  const [picked, setPicked] = useState<KnowledgeBaseId | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeBase | null>(null);
  const [importing, setImporting] = useState(false);
  const [kbProblem, setProblem] = useState<KbProblem | null>(null);
  const [confirmDoc, setConfirmDoc] = useState<Document | null>(null);
  const toast = useToast();

  const list = kbs.data ?? [];
  const selected = picked && list.some((k) => k.id === picked) ? picked : (list[0]?.id ?? null);
  const kb = list.find((k) => k.id === selected) ?? null;

  const docs = useResource<DocsFor | null>(
    async () => (selected ? { kbId: selected, docs: sortDocs(await docList(selected)) } : null),
    [selected],
  );
  const currentDocs = docs.data && docs.data.kbId === selected ? docs.data.docs : undefined;
  const problem = kbProblem && kbProblem.kbId === selected ? kbProblem : null;
  const { setData: setDocsData } = docs;
  const { setData: setKbs, reload: reloadKbs } = kbs;

  const patchDocs = useCallback(
    (kbId: KnowledgeBaseId, fn: (d: Document[]) => Document[]) =>
      setDocsData((prev) => (prev && prev.kbId === kbId ? { kbId, docs: fn(prev.docs) } : (prev ?? null))),
    [setDocsData],
  );

  // Keep the list's counts and status in step with the open knowledge base's documents.
  useEffect(() => {
    const d = docs.data;
    if (!d) return;
    setKbs((prev) => (prev ?? []).map((k) => (k.id === d.kbId ? summarizeKb(k, d.docs) : k)));
  }, [docs.data, setKbs]);

  // Live status chips: 'document' events update the open list; other knowledge bases re-read counts.
  // Events that land while the open knowledge base's list is still loading wait in `pending` and are
  // merged once docList answers (upsertDoc never moves a document backwards). Documents deleted here
  // stay deleted even if a late event for them arrives (events and command results aren't ordered).
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const loadedRef = useRef<KnowledgeBaseId | null>(null);
  loadedRef.current = docs.data?.kbId ?? null;
  const pending = useRef(new Map<KnowledgeBaseId, Map<DocumentId, Document>>());
  const deleted = useRef(new Set<DocumentId>());
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    void onDocument((d) => {
      if (deleted.current.has(d.id)) return;
      const kbId = d.knowledgeBaseId;
      if (kbId !== selectedRef.current) {
        void reloadKbs();
        return;
      }
      if (loadedRef.current === kbId) {
        patchDocs(kbId, (ds) => upsertDoc(ds, d));
        return;
      }
      const held = pending.current.get(kbId) ?? new Map<DocumentId, Document>();
      const prev = held.get(d.id);
      held.set(d.id, prev ? upsertDoc([prev], d)[0] : d);
      pending.current.set(kbId, held);
    }).then((u) => {
      if (dead) u();
      else off = u;
    });
    return () => {
      dead = true;
      off?.();
    };
  }, [patchDocs, reloadKbs]);

  useEffect(() => {
    const kbId = docs.data?.kbId;
    const held = kbId ? pending.current.get(kbId) : undefined;
    if (!kbId || !held) return;
    pending.current.delete(kbId);
    const late = [...held.values()].filter((d) => !deleted.current.has(d.id));
    patchDocs(kbId, (ds) => late.reduce<Document[]>((acc, d) => upsertDoc(acc, d), ds));
  }, [docs.data, patchDocs]);

  // ---- actions ------------------------------------------------------------------------------

  const select = (id: KnowledgeBaseId) => {
    setPicked(id);
    setRenaming(false);
    setProblem(null);
  };

  const create = async (name: string) => {
    const k = await kbCreate(name);
    setKbs((prev) => [...(prev ?? []), k]);
    setCreating(false);
    select(k.id);
    toast.show(T.toast.saved);
  };

  const rename = async (name: string) => {
    if (!kb) return;
    const k = await kbRename(kb.id, name);
    setKbs((prev) => (prev ?? []).map((x) => (x.id === k.id ? { ...x, name: k.name } : x)));
    setRenaming(false);
    toast.show(T.toast.saved);
  };

  const remove = async (target: KnowledgeBase) => {
    setConfirmDelete(null);
    try {
      await kbDelete(target.id);
      const next = nextSelection(list, target.id);
      setKbs((prev) => (prev ?? []).filter((k) => k.id !== target.id));
      setPicked(next);
      setRenaming(false);
      setProblem(null);
      toast.show(T.toast.deleted);
    } catch (e) {
      const c = errorCopy(e);
      setProblem({ kbId: target.id, title: c.title, body: c.body });
    }
  };

  const importPaths = useCallback(
    async (kbId: KnowledgeBaseId, paths: string[]) => {
      setProblem(null);
      setImporting(true);
      const issues: ImportIssue[] = [];
      let added = 0;
      for (const path of paths) {
        try {
          const d = await docImport(kbId, path);
          if (!deleted.current.has(d.id)) patchDocs(kbId, (ds) => upsertDoc(ds, d));
          added++;
        } catch (e) {
          // The knowledge base went away mid-import: the rest would fail the same way.
          if (isKbGone(e)) break;
          issues.push(importIssue(path, e));
        }
      }
      setImporting(false);
      if (added) toast.show(T.toast.added(added));
      // Keyed to kbId: if another knowledge base was opened meanwhile, the problem stays with this one.
      if (issues.length) setProblem({ kbId, title: KB_COPY.issues.title(issues.length), items: issues });
    },
    [patchDocs, toast.show],
  );

  const add = async () => {
    if (!selected || importing) return;
    try {
      const paths = await pickDocuments();
      if (paths.length) await importPaths(selected, paths);
    } catch (e) {
      const c = errorCopy(e);
      setProblem({ kbId: selected, title: c.title, body: c.body });
    }
  };

  const removeDocument = async (d: Document) => {
    setConfirmDoc(null);
    try {
      await docDelete(d.id);
      deleted.current.add(d.id);
      patchDocs(d.knowledgeBaseId, (ds) => removeDoc(ds, d.id));
      toast.show(T.toast.deleted);
    } catch (e) {
      const c = errorCopy(e);
      setProblem({ kbId: d.knowledgeBaseId, title: c.title, body: c.body });
    }
  };

  const dragging = useDocumentDrop((paths) => {
    if (selected && !importing) void importPaths(selected, paths);
  }, !!selected);

  const modelNotice = useModelNotice();
  const showLoading = useDelayed(kbs.loading && !kbs.data);

  // ---- render -------------------------------------------------------------------------------

  // One solid primary at a time: when the open knowledge base is empty, its haloed "Add documents"
  // is the next step, so "New knowledge base" steps back to secondary.
  const haloOnScreen = !!kb && currentDocs?.length === 0 && !problem;
  const header = (
    <PageHeader
      className="min-h-12"
      title={T.nav.knowledgeBases}
      action={
        list.length > 0 && (
          <Button variant={haloOnScreen ? "secondary" : "primary"} icon={Icon.add} onClick={() => setCreating(true)}>
            {T.actions.newKnowledgeBase}
          </Button>
        )
      }
    />
  );

  if (!kbs.data) {
    return (
      <>
        {header}
        {kbs.error !== undefined ? (
          <ErrorNotice title={errorCopy(kbs.error).title} onRetry={() => void kbs.reload()}>
            {errorCopy(kbs.error).body}
          </ErrorNotice>
        ) : (
          showLoading && (
            <div role="status" className="flex items-center gap-4">
              <GetCkoSprite pose={MOMENT_POSE.thinking} scale={3} label={T.mascot.moment(T.moments.thinking)} />
              <p className="text-body text-text-2">{T.states.knowledgeBases.loading}</p>
            </div>
          )
        )}
      </>
    );
  }

  return (
    <>
      {header}
      {list.length === 0 || !kb ? (
        // No knowledge bases: EmptyState sits on the page (its mascot well carries the texture).
        creating ? (
          <Panel title={T.actions.newKnowledgeBase} className="max-w-md">
            <NameForm others={[]} onSubmit={create} onCancel={() => setCreating(false)} />
          </Panel>
        ) : (
          <EmptyState
            title={KB_COPY.empty.title}
            body={KB_COPY.empty.body}
            action={{ label: T.actions.newKnowledgeBase, icon: Icon.add, onClick: () => setCreating(true) }}
            caption={T.offline.nothingLeaves(PLATFORM)}
          />
        )
      ) : (
        <Surface texture="footprints" intensity="subtle" className="rounded-panel border border-border p-4">
          <div className="flex items-start gap-4">
            <KbList
              kbs={list}
              selected={selected}
              onSelect={select}
              creating={creating}
              onCreate={create}
              onCancelCreate={() => setCreating(false)}
            />
            <DocumentsPanel
              key={kb.id}
              kb={kb}
              docs={currentDocs}
              docsError={currentDocs === undefined && !docs.loading ? docs.error : undefined}
              onRetryDocs={() => void docs.reload()}
              otherNames={list.filter((k) => k.id !== kb.id).map((k) => k.name)}
              renaming={renaming}
              onRename={() => setRenaming(true)}
              onRenameSubmit={rename}
              onRenameCancel={() => setRenaming(false)}
              onDelete={() => setConfirmDelete(kb)}
              onAdd={() => void add()}
              onRemoveDoc={setConfirmDoc}
              importing={importing}
              dragging={dragging}
              problem={problem}
              onDismissProblem={() => setProblem(null)}
              modelNotice={modelNotice}
            />
          </div>
        </Surface>
      )}

      {confirmDelete && <DeleteDialog kb={confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={remove} />}
      {confirmDoc && (
        <DeleteDocumentDialog doc={confirmDoc} onClose={() => setConfirmDoc(null)} onConfirm={(d) => void removeDocument(d)} />
      )}
      {/* Bottom right of the main column: bottom left would cover the sidebar's offline badge. */}
      <Toast {...toast.props} className="left-auto! right-8" />
    </>
  );
}

function DeleteDialog({ kb, onClose, onConfirm }: { kb: KnowledgeBase; onClose: () => void; onConfirm: (kb: KnowledgeBase) => void }) {
  const c = T.confirm.deleteKnowledgeBase(kb.name);
  return (
    <Dialog
      open
      onClose={onClose}
      title={c.title}
      body={c.body}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {c.cancel}
          </Button>
          <Button size="sm" icon={Icon.delete} onClick={() => onConfirm(kb)}>
            {c.confirm}
          </Button>
        </>
      }
    />
  );
}

function DeleteDocumentDialog({ doc, onClose, onConfirm }: { doc: Document; onClose: () => void; onConfirm: (d: Document) => void }) {
  const c = KB_COPY.deleteDocument(doc.fileName);
  return (
    <Dialog
      open
      onClose={onClose}
      title={c.title}
      body={c.body}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {c.cancel}
          </Button>
          <Button size="sm" icon={Icon.delete} onClick={() => onConfirm(doc)}>
            {c.confirm}
          </Button>
        </>
      }
    />
  );
}

/** Imports need the document search model (embeddings). Say so while it loads or if it's missing. */
function useModelNotice(): { title: string; body: string } | null {
  const { status } = useSetup();
  const c = componentOf(status, "embeddings");
  if (!c || c.ready) return null;
  return isLoadingModels(c) ? KB_COPY.model.loading : KB_COPY.model.missing(PLATFORM);
}
