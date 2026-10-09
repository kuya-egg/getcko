import { describe, expect, it } from "vitest";
import { AGENTS_COPY, sampleQuestions, tryGreeting } from "./copy";

describe("sampleQuestions", () => {
  it("asks in the agent's language: English stays English", () => {
    expect(sampleQuestions("teacher", "English")[0]).toBe("Where do I put the final grade?");
  });

  it("Taglish and Filipino agents get the Taglish questions", () => {
    expect(sampleQuestions("teacher", "Taglish")[0]).toBe("Saan ko ilalagay ang final grade?");
    expect(sampleQuestions("teacher", "Filipino")).toEqual(sampleQuestions("teacher", "Taglish"));
  });

  it("a custom agent (no template) still gets two questions", () => {
    expect(sampleQuestions(null, "English")).toHaveLength(2);
    expect(sampleQuestions(null, "Taglish")).toHaveLength(2);
  });

  it("every template has two questions in both languages, sentence case, no emoji", () => {
    for (const id of ["officeHelper", "teacher", "studyBuddy", "taglishExplainer"] as const) {
      for (const lang of ["English", "Taglish"] as const) {
        const qs = sampleQuestions(id, lang);
        expect(qs).toHaveLength(2);
        for (const q of qs) {
          expect(q[0]).toBe(q[0]!.toUpperCase());
          expect(q).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
        }
      }
    }
  });
});

describe("Try it copy", () => {
  it("GetcKo greets in the agent's language (Taglish agents in Taglish)", () => {
    expect(tryGreeting("English")).not.toBe(tryGreeting("Taglish"));
    expect(tryGreeting("Filipino")).toBe(tryGreeting("Taglish"));
  });

  it("the empty list's action names the template it makes", () => {
    expect(AGENTS_COPY.useNamed("Office Helper")).toBe("Use Office Helper");
  });
});
