import { describe, expect, it } from "vitest";
import { T } from "../brand/lexicon";
import { GetckoError } from "../lib/getcko";
import { documentFailure, errorCopy } from "./errors";

describe("errorCopy", () => {
  it("maps every ErrorKind to a title and a one-line body", () => {
    for (const kind of ["notFound", "invalid", "duplicate", "unavailable", "permissionDenied", "storage", "engine", "platform", "io"] as const) {
      const c = errorCopy(new GetckoError(kind, ""), "mac");
      expect(c.kind).toBe(kind);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeLessThanOrEqual(70);
    }
  });

  it("uses specific words for known backend messages", () => {
    expect(errorCopy(new GetckoError("invalid", ".xlsx files are not supported yet")).title).toBe(T.states.unsupportedFile.title);
    expect(errorCopy(new GetckoError("duplicate", "Manual.pdf is already in this knowledge base")).body).toBe(
      "Manual.pdf is already in this knowledge base.",
    );
    expect(errorCopy({ kind: "invalid", message: "agent may attach at most five knowledge bases" }).title).toMatch(/5/);
    expect(errorCopy(new Error("boom")).kind).toBe("unknown");
  });

  it("says 'on this PC' on Windows", () => {
    expect(errorCopy(new GetckoError("storage", ""), "win").body).toContain("on this PC");
  });

  it("turns document failure reasons into lexicon words", () => {
    expect(documentFailure("no text found (scanned PDF?)")).toBe(T.errors.scannedPdf);
    expect(documentFailure("import interrupted")).toMatch(/Add it again/);
  });
});
