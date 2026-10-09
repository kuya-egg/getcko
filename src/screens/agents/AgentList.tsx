// Agents list (design system §9.3). The agent GetcKo uses now leads on an ink card with GetcKo
// pointing at it; the others sit in one calm list, each with Edit and Start; templates follow,
// each showing the question it answers. With no agents yet, the empty state and templates lead.
import type { Agent } from "../../bindings/Agent";
import type { AgentId } from "../../bindings/AgentId";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { Template } from "../../bindings/Template";
import type { TemplateId } from "../../bindings/TemplateId";
import { GetCkoSprite, handTip, pointPoseFor } from "../../brand";
import { Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { Button, EmptyState, GeckoDot, IconButton, Panel, Surface, Tag } from "../../components/ui";
import { AGENTS_COPY, sampleQuestions } from "./copy";
import { cardLine, templateCopy } from "./model";

/** The hero gecko: 3x, pointing right at the agent name. */
const HERO_POSE = pointPoseFor("right");
const HERO_SCALE = 3;
/** Center of the name line in the text column: "In use" (20) + gap (4) + half the h2 line (15). */
const NAME_CENTER_Y = 39;
/** Nudge the sprite so its hand tip sits level with the name, never on the description. */
const HERO_NUDGE = Math.max(0, Math.round(NAME_CENTER_Y - (handTip(false, HERO_POSE).row + 0.5) * HERO_SCALE));

export interface AgentListProps {
  agents: Agent[];
  activeId: AgentId | null;
  knowledgeBases: KnowledgeBase[];
  templates: Template[];
  /** A template or a Start is in flight: its buttons are disabled. */
  busy: boolean;
  onUseTemplate: (id: TemplateId) => void;
  /** New agent (the page header owns the button; kept for callers). */
  onNew: () => void;
  onEdit: (id: AgentId) => void;
  onStart: (id: AgentId) => void;
  /** Open the editor at Try it. Defaults to onEdit. */
  onTry?: (id: AgentId) => void;
}

export function AgentList({ agents, activeId, knowledgeBases, templates, busy, onUseTemplate, onEdit, onStart, onTry }: AgentListProps) {
  const kbName = new Map(knowledgeBases.map((k) => [k.id, k.name]));
  const kbsOf = (a: Agent) => a.knowledgeBaseIds.flatMap((id) => kbName.get(id) ?? []);
  const active = agents.find((a) => a.id === activeId);
  // Newest edits first.
  const others = agents
    .filter((a) => a !== active)
    .sort((a, b) => b.updatedAt - a.updatedAt || b.id - a.id);

  const empty = agents.length === 0;
  const templatesSection = (
    <Surface
      texture="footprints"
      intensity="subtle"
      // Bleeds 24px into the page gutter so its contents line up with the page column (H1, list).
      className="-mx-6 flex flex-col gap-5 rounded-panel p-6"
      aria-labelledby="agents-templates"
    >
      <div className="flex flex-col gap-1">
        <p id="agents-templates" className="eyebrow">
          {T.agent.templates}
        </p>
        {/* Empty, the empty state above already says it. */}
        {!empty && <p className="text-label text-text-2">{AGENTS_COPY.templatesHint}</p>}
      </div>
      <ul className="grid grid-cols-3 gap-4">
        {templates.map((t) => (
          <li key={t.id} className="flex">
            <TemplateCard template={t} disabled={busy} onUse={() => onUseTemplate(t.id)} />
          </li>
        ))}
      </ul>
    </Surface>
  );

  if (empty) {
    const first = templates[0];
    return (
      <div className="flex flex-col gap-12">
        <EmptyState
          title={T.states.agents.empty.title}
          body={T.states.agents.empty.body}
          action={{
            // Name the template this click makes, so nothing happens blind.
            label: first ? AGENTS_COPY.useNamed(templateCopy(first.id).name) : T.actions.useTemplate,
            icon: Icon.template,
            // One click makes an agent (PRD P0-3): the first template, opened in the editor.
            onClick: () => {
              if (!busy && first) onUseTemplate(first.id);
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
        {active && (
          <ActiveAgent
            agent={active}
            line={cardLine(active)}
            knowledgeBases={kbsOf(active)}
            onEdit={() => onEdit(active.id)}
            onTry={() => (onTry ?? onEdit)(active.id)}
          />
        )}
        {others.length > 0 && (
          <Panel padding="none" elevation={1}>
            <ul className="flex flex-col divide-y divide-border">
              {others.map((a) => (
                <li key={a.id}>
                  <AgentRow
                    agent={a}
                    line={cardLine(a)}
                    knowledgeBases={kbsOf(a)}
                    busy={busy}
                    onEdit={() => onEdit(a.id)}
                    onStart={() => {
                      if (!busy) onStart(a.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
      {templatesSection}
    </div>
  );
}

/** Knowledge base names. */
function AgentTags({ knowledgeBases }: { knowledgeBases: string[] }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={T.aria.agentTags}>
      {knowledgeBases.map((kb) => (
        <li key={kb}>
          <Tag>{kb}</Tag>
        </li>
      ))}
    </ul>
  );
}

/**
 * The agent GetcKo uses now: an ink island (dark in both themes, like the session bar), with GetcKo
 * 3x pointing right at its name. The screen's one gecko. Primary: try it.
 */
function ActiveAgent({
  agent,
  line,
  knowledgeBases,
  onEdit,
  onTry,
}: {
  agent: Agent;
  line: string;
  knowledgeBases: string[];
  onEdit: () => void;
  onTry: () => void;
}) {
  return (
    <Surface
      as="article"
      tone="ink"
      texture="footprints"
      intensity="subtle"
      aria-labelledby="agents-active-name"
      // border-strong + overlay shadow: the ink island still lifts off the night page in dark.
      className="flex items-start gap-6 rounded-panel border border-border-strong p-6 shadow-overlay"
    >
      <GetCkoSprite
        pose={HERO_POSE}
        scale={HERO_SCALE}
        label={T.mascot.pointingAt(agent.name)}
        className="shrink-0"
        style={HERO_NUDGE ? { marginTop: HERO_NUDGE } : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="inline-flex items-center gap-2 text-label text-text-2">
            <GeckoDot />
            {AGENTS_COPY.inUse}
          </p>
          <h3 id="agents-active-name" className="truncate font-display text-h2 text-text" title={agent.name}>
            {agent.name}
          </h3>
          <p className="line-clamp-1 text-body text-text-2" title={line}>
            {line}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <AgentTags knowledgeBases={knowledgeBases} />
          </div>
          <IconButton icon={Icon.edit} label={AGENTS_COPY.editAria(agent.name)} size="sm" onClick={onEdit} />
          <Button size="sm" icon={Icon.tryThisAgent} onClick={onTry} aria-label={AGENTS_COPY.tryAria(agent.name)}>
            {T.actions.tryThisAgent}
          </Button>
        </div>
      </div>
    </Surface>
  );
}

/** One agent not in use: name and line, tags, then Edit (icon) and Start, same order on every row. */
function AgentRow({
  agent,
  line,
  knowledgeBases,
  busy,
  onEdit,
  onStart,
}: {
  agent: Agent;
  line: string;
  knowledgeBases: string[];
  busy: boolean;
  onEdit: () => void;
  onStart: () => void;
}) {
  return (
    <article className="flex items-center gap-4 px-5 py-4" aria-label={agent.name}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-title text-text" title={agent.name}>
            {agent.name}
          </h3>
          <p className="truncate text-label font-normal text-text-2" title={line}>
            {line}
          </p>
        </div>
        <AgentTags knowledgeBases={knowledgeBases} />
      </div>
      <IconButton icon={Icon.edit} label={AGENTS_COPY.editAria(agent.name)} size="sm" onClick={onEdit} />
      <Button variant="secondary" size="sm" icon={Icon.start} disabled={busy} onClick={onStart} aria-label={T.aria.startAgent(agent.name)}>
        {T.actions.start}
      </Button>
    </article>
  );
}

/**
 * A template: name, then the first question it answers (up to two lines at 900px).
 * The whole card is the "Use template" hit area, so the button itself stays a quiet text link.
 */
function TemplateCard({ template, disabled, onUse }: { template: Template; disabled: boolean; onUse: () => void }) {
  const c = templateCopy(template.id);
  const [sample] = sampleQuestions(template.id);
  return (
    <article
      className={
        "group relative flex min-w-0 flex-1 flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-card " +
        "transition-[border-color,translate,box-shadow] duration-200 ease-gc-out " +
        "has-[button:hover]:-translate-y-0.5 has-[button:hover]:border-border-strong has-[button:hover]:shadow-overlay " +
        "has-[button:active]:translate-y-0 has-[button:focus-visible]:border-focus has-[button:disabled]:opacity-60"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate font-display text-title text-text" title={`${c.name}: ${c.line}`}>
          {c.name}
        </h3>
      </div>
      {sample && (
        <p
          aria-label={`${AGENTS_COPY.sampleAria}: ${sample}`}
          title={sample}
          className="max-w-full self-end line-clamp-2 rounded-bubble rounded-br-code bg-surface-2 px-3 py-2 text-label font-normal text-text"
        >
          {sample}
        </p>
      )}
      <div className="mt-auto">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onUse}
          aria-label={`${T.actions.useTemplate}: ${c.name}`}
          // Stretch the hit area over the whole card (the card stays an <article>, the button stays the one control).
          className="after:absolute after:inset-0 after:rounded-panel"
        >
          {T.actions.useTemplate}
        </Button>
      </div>
    </article>
  );
}
