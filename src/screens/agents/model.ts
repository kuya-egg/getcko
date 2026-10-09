// Pure agent-editor logic: drafts, dirty check, validation, the 5-knowledge-base limit, labels.
import type { Agent } from "../../bindings/Agent";
import type { AgentDraft } from "../../bindings/AgentDraft";
import type { KnowledgeBaseId } from "../../bindings/KnowledgeBaseId";
import type { TemplateId } from "../../bindings/TemplateId";
import { T } from "../../brand/lexicon";

/** MAX_AGENT_KNOWLEDGE_BASES in the backend (PRD A3). */
export const MAX_KNOWLEDGE_BASES = 5;

/** Speaking speed range on the slider. 1.0 is normal. */
export const SPEED = { min: 0.75, max: 1.5, step: 0.25 } as const;

/** Template line from the lexicon (T.templates.*). */
export function templateCopy(id: TemplateId): { name: string; line: string } {
  return T.templates[id];
}

/** Editable fields of a saved agent. */
export function draftOf(a: Agent): AgentDraft {
  return {
    name: a.name,
    description: a.description,
    instructions: a.instructions,
    baseRules: a.baseRules,
    knowledgeBaseIds: [...a.knowledgeBaseIds],
    answerLength: a.answerLength,
    voiceId: a.voiceId,
    speechRate: a.speechRate,
  };
}

/** A new agent before its first save. */
export function blankDraft(): AgentDraft {
  return {
    name: "",
    description: "",
    instructions: "",
    baseRules: "include",
    knowledgeBaseIds: [],
    answerLength: "short",
    voiceId: null,
    speechRate: 1,
  };
}

/** What the backend will store: trimmed name and description. */
export function normalizeDraft(d: AgentDraft): AgentDraft {
  return { ...d, name: d.name.trim(), description: d.description.trim() };
}

/** Field-by-field compare; knowledge base order does not matter. */
export function sameDraft(a: AgentDraft, b: AgentDraft): boolean {
  const ids = (x: AgentDraft) => [...x.knowledgeBaseIds].sort((p, q) => p - q).join(",");
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.instructions === b.instructions &&
    a.baseRules === b.baseRules &&
    ids(a) === ids(b) &&
    a.answerLength === b.answerLength &&
    a.voiceId === b.voiceId &&
    Math.abs(a.speechRate - b.speechRate) < 1e-9
  );
}

/** Unsaved changes? A new agent (no saved version) counts as dirty once anything is typed. */
export function isDirty(draft: AgentDraft, saved: AgentDraft | null): boolean {
  return !sameDraft(draft, saved ?? blankDraft());
}

export interface DraftProblems {
  name?: string;
  knowledgeBases?: string;
}

/** Checks the backend would fail on, caught before Save. Empty object = OK. */
export function validateDraft(d: AgentDraft): DraftProblems {
  const p: DraftProblems = {};
  if (!d.name.trim()) p.name = "empty";
  if (d.knowledgeBaseIds.length > MAX_KNOWLEDGE_BASES) p.knowledgeBases = "tooMany";
  return p;
}

export const hasProblems = (p: DraftProblems): boolean => Object.keys(p).length > 0;

/**
 * Attach or detach a knowledge base. Attaching a sixth is refused (returns the same array), so the
 * caller can tell by identity. Order of first attachment is kept.
 */
export function toggleKnowledgeBase(ids: readonly KnowledgeBaseId[], id: KnowledgeBaseId, max = MAX_KNOWLEDGE_BASES): KnowledgeBaseId[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= max) return ids as KnowledgeBaseId[];
  return [...ids, id];
}

/** Drop ids of knowledge bases that no longer exist (deleted elsewhere). */
export function liveKnowledgeBases(ids: readonly KnowledgeBaseId[], existing: readonly { id: KnowledgeBaseId }[]): KnowledgeBaseId[] {
  const set = new Set(existing.map((k) => k.id));
  return ids.filter((id) => set.has(id));
}

/** One line for the agent card: its description, else the template line, else its first sentence. */
export function cardLine(a: Pick<Agent, "description" | "templateId" | "instructions">): string {
  if (a.description.trim()) return a.description.trim();
  if (a.templateId) return templateCopy(a.templateId).line;
  const first = a.instructions.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return first || T.agent.newAgentHint;
}

/** Answer text without the [n] source markers (sources show as chips instead). */
export function stripMarkers(text: string): string {
  return text
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

/** Speaking speed snapped to the slider steps and range. */
export function clampSpeed(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  const snapped = Math.round(rate / SPEED.step) * SPEED.step;
  return Math.min(SPEED.max, Math.max(SPEED.min, snapped));
}

/** Citation.location → CitationChip page: "p. 4" → 4, a heading stays text. */
export function citationWhere(location: string): number | string {
  const m = /^p(?:age|\.)?\s*(\d+)$/i.exec(location.trim());
  return m ? Number(m[1]) : location.trim();
}

/** Short source name for a chip: the file name without its extension. */
export const shortSource = (fileName: string): string => fileName.replace(/\.[a-z0-9]{1,5}$/i, "").trim() || fileName;
