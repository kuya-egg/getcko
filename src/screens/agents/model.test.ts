import { describe, expect, it } from "vitest";
import type { Agent } from "../../bindings/Agent";
import { T } from "../../brand/lexicon";
import { removeAgent, upsertAgent, type AgentsData } from "./data";
import { AGENTS_COPY } from "./copy";
import {
  MAX_KNOWLEDGE_BASES,
  blankDraft,
  cardLine,
  citationWhere,
  clampSpeed,
  draftOf,
  hasProblems,
  isDirty,
  isFilipinoVoice,
  languageOf,
  languageWord,
  liveKnowledgeBases,
  normalizeDraft,
  sameDraft,
  shortSource,
  stripMarkers,
  toggleKnowledgeBase,
  validateDraft,
} from "./model";

const agent = (over: Partial<Agent> = {}): Agent => ({
  id: 7,
  templateId: "teacher",
  createdAt: 1,
  updatedAt: 2,
  ...blankDraft(),
  name: "Teacher",
  instructions: "Help with DepEd forms.",
  knowledgeBaseIds: [2, 1],
  language: "taglish",
  ...over,
});

describe("language mapping", () => {
  it("round-trips every backend language through the lexicon word", () => {
    for (const l of ["english", "filipino", "taglish"] as const) expect(languageOf(languageWord(l))).toBe(l);
    expect(languageWord("taglish")).toBe("Taglish");
  });
});

describe("drafts and dirty check", () => {
  it("a saved agent's own draft is clean", () => {
    const a = agent();
    expect(isDirty(draftOf(a), draftOf(a))).toBe(false);
  });

  it("knowledge base order does not make a draft dirty", () => {
    const a = agent();
    expect(sameDraft({ ...draftOf(a), knowledgeBaseIds: [1, 2] }, draftOf(a))).toBe(true);
  });

  it("any field change is dirty, including the base rules toggle", () => {
    const d = draftOf(agent());
    expect(isDirty({ ...d, baseRules: "replace" }, d)).toBe(true);
    expect(isDirty({ ...d, speechRate: 1.25 }, d)).toBe(true);
    expect(isDirty({ ...d, voiceId: "x" }, d)).toBe(true);
  });

  it("a new agent is clean until something is typed", () => {
    expect(isDirty(blankDraft(), null)).toBe(false);
    expect(isDirty({ ...blankDraft(), name: "R" }, null)).toBe(true);
  });

  it("draftOf copies the id list (editing it never mutates the agent)", () => {
    const a = agent();
    const d = draftOf(a);
    d.knowledgeBaseIds.push(9);
    expect(a.knowledgeBaseIds).toEqual([2, 1]);
  });

  it("normalize trims name and description only", () => {
    const d = normalizeDraft({ ...blankDraft(), name: "  Rosa  ", description: " x ", instructions: " keep " });
    expect(d.name).toBe("Rosa");
    expect(d.description).toBe("x");
    expect(d.instructions).toBe(" keep ");
  });
});

describe("validation", () => {
  it("an empty or blank name is a problem", () => {
    expect(validateDraft({ ...blankDraft(), name: "   " }).name).toBeDefined();
    expect(hasProblems(validateDraft({ ...blankDraft(), name: "Ok" }))).toBe(false);
  });

  it("more than five knowledge bases is a problem", () => {
    const ids = [1, 2, 3, 4, 5, 6];
    expect(validateDraft({ ...blankDraft(), name: "A", knowledgeBaseIds: ids }).knowledgeBases).toBeDefined();
    expect(hasProblems(validateDraft({ ...blankDraft(), name: "A", knowledgeBaseIds: ids.slice(0, 5) }))).toBe(false);
  });
});

describe("toggleKnowledgeBase (max 5, PRD A3)", () => {
  it("attaches and detaches", () => {
    expect(toggleKnowledgeBase([1], 2)).toEqual([1, 2]);
    expect(toggleKnowledgeBase([1, 2], 1)).toEqual([2]);
  });

  it("refuses a sixth and returns the same array", () => {
    const five = [1, 2, 3, 4, 5];
    expect(MAX_KNOWLEDGE_BASES).toBe(5);
    expect(toggleKnowledgeBase(five, 6)).toBe(five);
  });

  it("still detaches when full", () => {
    expect(toggleKnowledgeBase([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 4, 5]);
  });

  it("drops ids of deleted knowledge bases", () => {
    expect(liveKnowledgeBases([1, 2, 3], [{ id: 3 }, { id: 1 }])).toEqual([1, 3]);
  });
});

describe("cardLine", () => {
  it("prefers the description, then the template line, then the first sentence", () => {
    expect(cardLine(agent({ description: "Grade sheets." }))).toBe("Grade sheets.");
    expect(cardLine(agent())).toBe(T.templates.teacher.line);
    expect(cardLine(agent({ templateId: null, instructions: "Answer short. Cite the page." }))).toBe("Answer short.");
    expect(cardLine(agent({ templateId: null, instructions: "" }))).toBe(T.agent.newAgentHint);
  });
});

describe("answer text and sources", () => {
  it("strips [n] markers and the space before punctuation", () => {
    expect(stripMarkers("It's the average, per the guide [1].")).toBe("It's the average, per the guide.");
    expect(stripMarkers("See [1] and [12] here")).toBe("See and here");
  });

  it("reads page locations as numbers and keeps headings", () => {
    expect(citationWhere("p. 4")).toBe(4);
    expect(citationWhere("page 12")).toBe(12);
    expect(citationWhere("Grading > Final")).toBe("Grading > Final");
  });

  it("short source drops the extension", () => {
    expect(shortSource("Office manual 2026.pdf")).toBe("Office manual 2026");
    expect(shortSource("notes")).toBe("notes");
  });
});

describe("voice and speed", () => {
  it("snaps and clamps speaking speed to the slider", () => {
    expect(clampSpeed(1)).toBe(1);
    expect(clampSpeed(1.1)).toBe(1);
    expect(clampSpeed(3)).toBe(1.5);
    expect(clampSpeed(0.1)).toBe(0.75);
    expect(clampSpeed(Number.NaN)).toBe(1);
  });

  it("knows Filipino voices by BCP-47 tag", () => {
    expect(isFilipinoVoice("fil-PH")).toBe(true);
    expect(isFilipinoVoice("tl-PH")).toBe(true);
    expect(isFilipinoVoice("en-US")).toBe(false);
  });

  it("no-Filipino-voice line names the right computer", () => {
    expect(AGENTS_COPY.noFilipinoVoice("win")).toContain("this PC");
    expect(AGENTS_COPY.noFilipinoVoice("mac")).toBe(T.agent.noFilipinoVoice);
  });
});

describe("screen data updates", () => {
  const base: AgentsData = { agents: [agent()], activeId: 7, knowledgeBases: [], templates: [], voices: [] };

  it("upsert replaces by id or appends", () => {
    expect(upsertAgent(base, agent({ name: "Guro" })).agents.map((a) => a.name)).toEqual(["Guro"]);
    expect(upsertAgent(base, agent({ id: 8 })).agents).toHaveLength(2);
  });

  it("removing the active agent clears the active id", () => {
    expect(removeAgent(base, 7)).toMatchObject({ agents: [], activeId: null });
    expect(removeAgent({ ...base, activeId: 3 }, 7).activeId).toBe(3);
  });
});
