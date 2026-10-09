// The agents screen's loaded data and the local updates applied after a command succeeds.
import type { Agent } from "../../bindings/Agent";
import type { AgentId } from "../../bindings/AgentId";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { Template } from "../../bindings/Template";
import type { Voice } from "../../bindings/Voice";

export interface AgentsData {
  agents: Agent[];
  /** The agent GetcKo uses now (agentActive). */
  activeId: AgentId | null;
  knowledgeBases: KnowledgeBase[];
  templates: Template[];
  voices: Voice[];
}

/** Replace the agent with the same id, or add it. */
export function upsertAgent(d: AgentsData, a: Agent): AgentsData {
  const i = d.agents.findIndex((x) => x.id === a.id);
  const agents = i < 0 ? [...d.agents, a] : d.agents.map((x) => (x.id === a.id ? a : x));
  return { ...d, agents };
}

/** Drop an agent; the active id clears if it was that one (the caller re-reads agentActive). */
export function removeAgent(d: AgentsData, id: AgentId): AgentsData {
  return { ...d, agents: d.agents.filter((x) => x.id !== id), activeId: d.activeId === id ? null : d.activeId };
}

/**
 * A new agent (create, from template, duplicate). The backend makes it the one in use when none is
 * (store::insert_agent), so mirror that here instead of reading agentActive back.
 */
export function created(d: AgentsData, a: Agent): AgentsData {
  return { ...upsertAgent(d, a), activeId: d.activeId ?? a.id };
}
