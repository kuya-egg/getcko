// Agents list (design system §9.3): your agent cards first, then one row of four templates.
// With no agents yet, the empty state and the templates lead.
import type { Agent } from "../../bindings/Agent";
import type { AgentId } from "../../bindings/AgentId";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { Template } from "../../bindings/Template";
import type { TemplateId } from "../../bindings/TemplateId";
import { Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { AgentCard, Button, EmptyState, NewAgentCard, Panel, Surface } from "../../components/ui";
import { AGENTS_COPY } from "./copy";
import { InUse } from "./AgentEditor";
import { cardLine, languageWord, templateCopy } from "./model";

export interface AgentListProps {
  agents: Agent[];
  activeId: AgentId | null;
  knowledgeBases: KnowledgeBase[];
  templates: Template[];
  /** A template or a Start is in flight: its buttons are disabled. */
  busy: boolean;
  onUseTemplate: (id: TemplateId) => void;
  onNew: () => void;
  onEdit: (id: AgentId) => void;
  onStart: (id: AgentId) => void;
}

export function AgentList({ agents, activeId, knowledgeBases, templates, busy, onUseTemplate, onNew, onEdit, onStart }: AgentListProps) {
  const kbName = new Map(knowledgeBases.map((k) => [k.id, k.name]));
  // The agent in use first, then newest edits.
  const sorted = [...agents].sort(
    (a, b) => Number(b.id === activeId) - Number(a.id === activeId) || b.updatedAt - a.updatedAt || b.id - a.id,
  );

  const templatesSection = (
    <Surface texture="footprints" intensity="subtle" className="flex flex-col gap-4 rounded-panel p-6">
      <p className="eyebrow">{T.agent.templates}</p>
      <ul className="grid grid-cols-2 gap-3">
        {templates.map((t) => {
          const c = templateCopy(t.id);
          return (
            <li key={t.id} className="flex">
              <Panel as="article" padding="none" className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                <h3 className="truncate font-display text-title text-text" title={c.name}>
                  {c.name}
                </h3>
                <p className="line-clamp-2 text-pretty text-label font-normal text-text-2">{c.line}</p>
                <div className="mt-auto pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onUseTemplate(t.id)}
                    aria-label={`${T.actions.useTemplate}: ${c.name}`}
                  >
                    {T.actions.useTemplate}
                  </Button>
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
    </Surface>
  );

  if (agents.length === 0) {
    return (
      <div className="flex flex-col gap-12">
        <EmptyState
          title={T.states.agents.empty.title}
          body={T.states.agents.empty.body}
          action={{
            label: T.actions.useTemplate,
            icon: Icon.template,
            // One click makes an agent (PRD P0-3): the first template, opened in the editor.
            onClick: () => {
              if (!busy && templates[0]) onUseTemplate(templates[0].id);
            },
          }}
        />
        {templatesSection}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4" aria-labelledby="agents-yours">
        <p id="agents-yours" className="eyebrow">
          {AGENTS_COPY.yourAgents}
        </p>
        <ul className="grid grid-cols-2 gap-4">
          {sorted.map((a) => {
            const active = a.id === activeId;
            return (
              <li key={a.id} className="flex">
                <AgentCard
                  className="flex-1"
                  name={a.name}
                  description={cardLine(a)}
                  knowledgeBases={a.knowledgeBaseIds.flatMap((id) => kbName.get(id) ?? [])}
                  language={T.languages[languageWord(a.language)]}
                  onStart={active ? undefined : () => { if (!busy) onStart(a.id); }}
                  startVariant="secondary"
                  footer={
                    <>
                      {active && <InUse />}
                      <Button variant="ghost" size="sm" icon={Icon.edit} className="ml-auto" onClick={() => onEdit(a.id)} aria-label={`${T.actions.edit} ${a.name}`}>
                        {T.actions.edit}
                      </Button>
                    </>
                  }
                />
              </li>
            );
          })}
          <li className="flex">
            <NewAgentCard className="flex-1" onClick={onNew} />
          </li>
        </ul>
      </section>
      {templatesSection}
    </div>
  );
}
