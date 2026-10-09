// Agents screen (PRD A1–A7, design system §9.3): templates and agent cards, then one agent's editor.
// State routing inside the screen: list ↔ editor. Everything persists through src/lib/getcko.ts.
import { useState } from "react";
import type { AgentDraft } from "../../bindings/AgentDraft";
import type { AgentId } from "../../bindings/AgentId";
import type { TemplateId } from "../../bindings/TemplateId";
import type { Voice } from "../../bindings/Voice";
import { GetCkoSprite, MOMENT_POSE } from "../../brand";
import { Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { Button, ErrorNotice, PageHeader, Toast, useToast } from "../../components/ui";
import { errorCopy } from "../../app/errors";
import { useDelayed, useResource } from "../../app/useResource";
import {
  agentActive,
  agentCreate,
  agentCreateFromTemplate,
  agentDelete,
  agentDuplicate,
  agentList,
  agentSetActive,
  agentUpdate,
  kbList,
  templateList,
  voiceList,
} from "../../lib/getcko";
import { AgentEditor } from "./AgentEditor";
import { AgentList } from "./AgentList";
import { created, removeAgent, upsertAgent, type AgentsData } from "./data";

/** One read for the whole screen. Voices are optional: no TTS still lets you edit agents. */
async function loadAgents(): Promise<AgentsData> {
  const [agents, active, knowledgeBases, templates, voices] = await Promise.all([
    agentList(),
    agentActive(),
    kbList(),
    templateList(),
    voiceList().catch((): Voice[] => []),
  ]);
  return { agents, activeId: active?.id ?? null, knowledgeBases, templates, voices };
}

type View = { kind: "list" } | { kind: "edit"; id: AgentId | null };

/** Dev-only start view for screenshots and the browser mock: ?agent=<id>|new opens the editor. */
function initialView(): View {
  if (!import.meta.env.DEV) return { kind: "list" };
  const q = new URLSearchParams(window.location.search).get("agent");
  if (q === "new") return { kind: "edit", id: null };
  const id = Number(q);
  return q && Number.isInteger(id) ? { kind: "edit", id } : { kind: "list" };
}

export function AgentsScreen() {
  const res = useResource(loadAgents, []);
  const { data, setData } = res;
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState<unknown>(undefined);
  const toast = useToast();
  const showLoading = useDelayed(res.loading && !data);

  /** Apply a successful command to the loaded data (no reload). */
  const patch = (f: (d: AgentsData) => AgentsData) =>
    setData((d) => (d ? f(d) : { agents: [], activeId: null, knowledgeBases: [], templates: [], voices: [] }));

  /** List actions share one busy flag and one error line. */
  const act = async (f: () => Promise<void>) => {
    setBusy(true);
    setListError(undefined);
    try {
      await f();
    } catch (e) {
      setListError(e);
    } finally {
      setBusy(false);
    }
  };

  const fromTemplate = (id: TemplateId) =>
    act(async () => {
      const a = await agentCreateFromTemplate(id);
      patch((d) => created(d, a));
      setView({ kind: "edit", id: a.id });
    });

  const start = async (id: AgentId) => {
    const a = await agentSetActive(id);
    patch((d) => ({ ...upsertAgent(d, a), activeId: a.id }));
  };

  if (!data) {
    if (res.error !== undefined) {
      const c = errorCopy(res.error);
      return (
        <>
          <PageHeader className="min-h-12" title={T.nav.agents} />
          <ErrorNotice title={c.title} mascot onRetry={() => void res.reload()}>
            {c.body}
          </ErrorNotice>
        </>
      );
    }
    return (
      <>
        <PageHeader className="min-h-12" title={T.nav.agents} />
        {showLoading && (
          <div className="flex items-center gap-4" role="status">
            <GetCkoSprite pose={MOMENT_POSE.thinking} scale={3} label={T.mascot.moment(T.moments.thinking)} />
            <p className="text-body text-text-2">{T.states.agents.loading}</p>
          </div>
        )}
      </>
    );
  }

  // An id that matches no agent (deleted elsewhere, or a stale dev link) is the list, never a blank form.
  const agent = view.kind === "edit" && view.id != null ? data.agents.find((a) => a.id === view.id) : undefined;
  if (view.kind === "edit" && (view.id == null || agent)) {
    return (
      <>
        <AgentEditor
          key={view.id ?? "new"}
          agent={agent ?? null}
          active={agent !== undefined && agent.id === data.activeId}
          knowledgeBases={data.knowledgeBases}
          voices={data.voices}
          onBack={() => setView({ kind: "list" })}
          onSave={async (draft: AgentDraft) => {
            const stored = agent ? await agentUpdate(agent.id, draft) : await agentCreate(draft);
            patch((d) => (agent ? upsertAgent(d, stored) : created(d, stored)));
            if (!agent) setView({ kind: "edit", id: stored.id });
            toast.show(T.toast.saved);
            return stored;
          }}
          onDuplicate={async () => {
            if (!agent) return;
            const copy = await agentDuplicate(agent.id);
            patch((d) => created(d, copy));
            setView({ kind: "edit", id: copy.id });
            toast.show(T.toast.duplicated);
          }}
          onDelete={async () => {
            if (!agent) return;
            await agentDelete(agent.id);
            // The backend picks another agent when the active one goes; read it back.
            const next = await agentActive().catch(() => null);
            patch((d) => ({ ...removeAgent(d, agent.id), activeId: next?.id ?? null }));
            setView({ kind: "list" });
            toast.show(T.toast.deleted);
          }}
          onStart={async () => {
            if (agent) await start(agent.id);
          }}
        />
        <Toast {...toast.props} />
      </>
    );
  }

  const listErr = listError === undefined ? null : errorCopy(listError);
  return (
    <>
      <PageHeader
        className="min-h-12"
        title={T.nav.agents}
        action={
          // The empty state's "Use template" is the one primary while there are no agents.
          <Button
            variant={data.agents.length === 0 ? "secondary" : "primary"}
            icon={Icon.newAgent}
            onClick={() => setView({ kind: "edit", id: null })}
          >
            {T.actions.newAgent}
          </Button>
        }
      />
      {listErr && (
        <ErrorNotice title={listErr.title} className="mb-6">
          {listErr.body}
        </ErrorNotice>
      )}
      <AgentList
        agents={data.agents}
        activeId={data.activeId}
        knowledgeBases={data.knowledgeBases}
        templates={data.templates}
        busy={busy}
        onUseTemplate={(id) => void fromTemplate(id)}
        onNew={() => setView({ kind: "edit", id: null })}
        onEdit={(id) => setView({ kind: "edit", id })}
        onStart={(id) => void act(() => start(id))}
      />
      <Toast {...toast.props} />
    </>
  );
}

