import { describe, expect, it } from "vitest";
import type { Document } from "../../bindings/Document";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import { APP_COPY } from "../../app/copy";
import { T } from "../../brand/lexicon";
import { GetckoError } from "../../lib/getcko";
import { KB_COPY } from "./copy";
import {
  NAME_MAX,
  baseName,
  docChip,
  importIssue,
  kbCaption,
  kbStatusOf,
  nextSelection,
  readingDocId,
  removeDoc,
  summarizeKb,
  upsertDoc,
  validateName,
} from "./logic";

const ID: Record<string, number> = { a: 1, b: 2, c: 3, kb1: 1, k: 9 };

const doc = (name: string, patch: Partial<Document> = {}): Document => ({
  id: ID[name],
  knowledgeBaseId: 1,
  fileName: `${name}.pdf`,
  kind: "pdf",
  pageCount: null,
  passageCount: 0,
  status: "queued",
  error: null,
  createdAt: 1,
  ...patch,
});

const kb = (name: string, patch: Partial<KnowledgeBase> = {}): KnowledgeBase => ({
  id: ID[name],
  name,
  status: "empty",
  documentCount: 0,
  passageCount: 0,
  createdAt: 1,
  ...patch,
});

describe("validateName", () => {
  it("asks for a name when blank", () => {
    expect(validateName("   ")).toBe(APP_COPY.errors.emptyName.title);
  });
  it("caps the length", () => {
    expect(validateName("x".repeat(NAME_MAX))).toBeNull();
    expect(validateName("x".repeat(NAME_MAX + 1))).toBe(KB_COPY.nameTooLong(NAME_MAX));
  });
  it("catches a name already in use, ignoring case and spaces", () => {
    expect(validateName(" records OFFICE ", ["Records office"])).toBe(KB_COPY.nameTaken);
    expect(validateName("Records office", ["Grade 7 class"])).toBeNull();
  });
});

describe("upsertDoc", () => {
  it("adds a new document newest first", () => {
    const out = upsertDoc([doc("a", { createdAt: 1 })], doc("b", { createdAt: 2 }));
    expect(out.map((d) => d.fileName)).toEqual(["b.pdf", "a.pdf"]);
  });
  it("updates status from events", () => {
    const out = upsertDoc([doc("a")], doc("a", { status: "ready", passageCount: 12 }));
    expect(out[0].status).toBe("ready");
    expect(out[0].passageCount).toBe(12);
  });
  it("never moves a document back to queued", () => {
    const out = upsertDoc([doc("a", { status: "processing" })], doc("a", { status: "queued" }));
    expect(out[0].status).toBe("processing");
  });
  it("lets a finished document fail or turn ready", () => {
    expect(upsertDoc([doc("a", { status: "processing" })], doc("a", { status: "failed" }))[0].status).toBe("failed");
  });
  it("removes by id", () => {
    expect(removeDoc([doc("a"), doc("b")], ID.a).map((d) => d.id)).toEqual([ID.b]);
  });
});

describe("knowledge base summary", () => {
  it("follows the store's status rule", () => {
    expect(kbStatusOf([])).toBe("empty");
    expect(kbStatusOf([doc("a", { status: "failed" })])).toBe("failed");
    expect(kbStatusOf([doc("a", { status: "failed" }), doc("b", { status: "ready" })])).toBe("ready");
    expect(kbStatusOf([doc("a", { status: "ready" }), doc("b", { status: "queued" })])).toBe("processing");
  });
  it("recounts documents and passages", () => {
    const s = summarizeKb(kb("kb1"), [doc("a", { status: "ready", passageCount: 10 }), doc("b", { status: "ready", passageCount: 5 })]);
    expect(s).toMatchObject({ documentCount: 2, passageCount: 15, status: "ready" });
  });
  it("captions counts, plus Processing while in flight", () => {
    expect(kbCaption(kb("k", { documentCount: 1, status: "ready" }))).toBe("1 document");
    expect(kbCaption(kb("k", { documentCount: 3, status: "processing" }))).toBe("3 documents · Processing");
  });
});

describe("rows", () => {
  it("shows queued as Processing", () => {
    expect(docChip("queued")).toBe("processing");
    expect(docChip("failed")).toBe("failed");
  });
  it("puts GetcKo on the first in-flight row only", () => {
    expect(readingDocId([doc("a", { status: "ready" }), doc("b", { status: "processing" }), doc("c")])).toBe(ID.b);
    expect(readingDocId([doc("a", { status: "ready" })])).toBeNull();
  });
});

describe("import issues", () => {
  it("takes the file name from Mac and Windows paths", () => {
    expect(baseName("/Users/ana/Docs/Manual.pdf")).toBe("Manual.pdf");
    expect(baseName("C:\\Users\\ana\\Manual.pdf")).toBe("Manual.pdf");
  });
  it("says how to fix a duplicate", () => {
    const i = importIssue("/x/Manual.pdf", new GetckoError("duplicate", "Manual.pdf is already in this knowledge base"));
    expect(i).toEqual({ file: "Manual.pdf", fix: KB_COPY.issues.duplicate });
  });

  it("names the stored document when a duplicate has another name", () => {
    const i = importIssue("/x/Report v2.pdf", new GetckoError("duplicate", "Report.pdf is already in this knowledge base"));
    expect(i).toEqual({ file: "Report v2.pdf", fix: "Report.pdf is already in this knowledge base." });
  });
  it("lists the readable types for an unsupported file", () => {
    const i = importIssue("C:\\x\\Org chart.xlsx", new GetckoError("invalid", ".xlsx files are not supported yet"));
    expect(i).toEqual({ file: "Org chart.xlsx", fix: T.errors.unsupportedFile });
  });
  it("falls back to the error kind's words", () => {
    const i = importIssue("/x/a.pdf", new GetckoError("io", "permission denied"));
    expect(i.fix).toBe(`${APP_COPY.errors.io.title} ${APP_COPY.errors.io.body}`);
  });
});

describe("nextSelection", () => {
  const list = [kb("a"), kb("b"), kb("c")];
  it("selects the one below, else above, else none", () => {
    expect(nextSelection(list, ID.a)).toBe(ID.b);
    expect(nextSelection(list, ID.c)).toBe(ID.b);
    expect(nextSelection([kb("a")], ID.a)).toBeNull();
  });
});
