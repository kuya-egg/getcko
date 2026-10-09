import { describe, expect, it } from "vitest";
import { AGENTS_COPY, sampleQuestions, tryGreeting } from "./copy";

describe("sampleQuestions", () => {
  it("asks the template's questions", () => {
    expect(sampleQuestions("teacher")[0]).toBe("Where do I put the final grade?");
  });

  it("a custom agent (no template) still gets two questions", () => {
    expect(sampleQuestions(null)).toHaveLength(2);
  });

  it("every template has two questions, sentence case, no emoji", () => {
    for (const id of ["officeHelper", "teacher", "studyBuddy"] as const) {
      const qs = sampleQuestions(id);
      expect(qs).toHaveLength(2);
      for (const q of qs) {
        expect(q[0]).toBe(q[0]!.toUpperCase());
        expect(q).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      }
    }
  });
});

describe("Try it copy", () => {
  it("GetcKo greets in plain English", () => {
    expect(tryGreeting()).toBe("Ask me. I'll check your documents.");
  });

  it("the empty list's action names the template it makes", () => {
    expect(AGENTS_COPY.useNamed("Office Helper")).toBe("Use Office Helper");
  });
});
