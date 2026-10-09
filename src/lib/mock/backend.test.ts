import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../bindings/Agent";
import type { Document } from "../../bindings/Document";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { SetupStatus } from "../../bindings/SetupStatus";
import type { TurnEvent } from "../../bindings/TurnEvent";
import { needsSetup } from "../../app/setup";
import { createMockBackend, MOCK_TIMING } from "./backend";
import { DEFAULT_OPTIONS, readMockOptions, type MockOptions } from "./params";

function backend(over: Partial<MockOptions> = {}) {
  const events: { event: string; payload: unknown }[] = [];
  const call = createMockBackend({ ...DEFAULT_OPTIONS, ...over }, (event, payload) => events.push({ event, payload }));
  return { call, events };
}

describe("mock backend", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads URL params", () => {
    expect(readMockOptions("?setup=denied&empty=1")).toEqual({ setup: "denied", empty: true, slow: false });
    expect(readMockOptions("?setup=nope").setup).toBe("ready");
  });

  it("gates onboarding on Accessibility and missing models, not on loading", async () => {
    for (const [setup, gate] of [["ready", false], ["denied", true], ["missing", true], ["loading", false]] as const) {
      const status = (await backend({ setup }).call("setup_status")) as SetupStatus;
      expect(needsSetup(status), setup).toBe(gate);
    }
  });

  it("seeds data, and empty=1 seeds none", async () => {
    const full = backend();
    expect(((await full.call("kb_list")) as KnowledgeBase[]).length).toBe(3);
    expect(((await full.call("agent_active")) as Agent).name).toBe("Office Helper");
    const empty = backend({ empty: true });
    expect(await empty.call("kb_list")).toEqual([]);
    expect(await empty.call("agent_active")).toBeNull();
  });

  it("imports: queued → processing → ready events; scan fails; bad type and duplicates throw", async () => {
    const { call, events } = backend({ empty: true });
    const kb = (await call("kb_create", { name: " Manuals " })) as KnowledgeBase;
    expect(kb.name).toBe("Manuals");
    const doc = (await call("doc_import", { knowledgeBaseId: kb.id, path: "/Users/ana/Office manual.pdf" })) as Document;
    expect(doc.status).toBe("queued");
    vi.advanceTimersByTime(MOCK_TIMING.docDone);
    const statuses = events.filter((e) => e.event === "document").map((e) => (e.payload as Document).status);
    expect(statuses).toEqual(["queued", "processing", "ready"]);
    expect(((await call("kb_list")) as KnowledgeBase[])[0].status).toBe("ready");

    await call("doc_import", { knowledgeBaseId: kb.id, path: "C:\\docs\\Scanned memo.pdf" });
    vi.advanceTimersByTime(MOCK_TIMING.docDone);
    const last = events[events.length - 1].payload as Document;
    expect([last.fileName, last.status, last.error]).toEqual(["Scanned memo.pdf", "failed", "no text found (scanned PDF?)"]);

    await expect(call("doc_import", { knowledgeBaseId: kb.id, path: "/x/Org chart.xlsx" })).rejects.toMatchObject({ kind: "invalid" });
    await expect(call("doc_import", { knowledgeBaseId: kb.id, path: "/y/Office manual.pdf" })).rejects.toMatchObject({ kind: "duplicate" });
    await expect(call("kb_create", { name: "  " })).rejects.toMatchObject({ kind: "invalid" });
  });

  it("agents: template create, five-KB limit, duplicate, delete moves active", async () => {
    const { call } = backend({ empty: true });
    const a = (await call("agent_create_from_template", { templateId: "teacher" })) as Agent;
    expect([a.name, a.templateId]).toEqual(["Teacher", "teacher"]);
    expect(((await call("agent_active")) as Agent).id).toBe(a.id);
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) ids.push(((await call("kb_create", { name: `kb ${i}` })) as KnowledgeBase).id);
    const { id: _i, templateId: _t, createdAt: _c, updatedAt: _u, ...draft } = a;
    await expect(call("agent_update", { id: a.id, draft: { ...draft, knowledgeBaseIds: ids } })).rejects.toMatchObject({ kind: "invalid" });
    const copy = (await call("agent_duplicate", { id: a.id })) as Agent;
    expect(copy.name).toBe("Teacher copy");
    await call("agent_delete", { id: a.id });
    expect(((await call("agent_active")) as Agent).id).toBe(copy.id);
  });

  it("ask: grounded turn ends finished with a source; stop cancels", async () => {
    const { call, events } = backend();
    const turnId = (await call("ask", { request: { input: { type: "text", text: "How do I add a record?" }, screenHelp: false, agentId: null } })) as number;
    vi.advanceTimersByTime(MOCK_TIMING.turnStep * 20);
    const turn = events.filter((e) => e.event === "turn").map((e) => e.payload as TurnEvent);
    expect(turn.map((e) => e.type)).toEqual(["question", "phase", "phase", "sentence", "sentence", "finished"]);
    const fin = turn[turn.length - 1];
    expect(fin.type === "finished" && fin.answer.turnId === turnId && fin.answer.citations.length === 1).toBe(true);

    events.length = 0;
    await call("ask", { request: { input: { type: "text", text: "Again" }, screenHelp: false, agentId: null } });
    await call("stop");
    vi.advanceTimersByTime(MOCK_TIMING.turnStep * 20);
    expect(events.map((e) => (e.payload as TurnEvent).type)).toEqual(["cancelled"]);
  });

  it("ask without documents says it doesn't know, with no sources", async () => {
    const { call, events } = backend({ empty: true });
    const a = (await call("agent_create_from_template", { templateId: "officeHelper" })) as Agent;
    await call("ask", { request: { input: { type: "text", text: "Where is Save?" }, screenHelp: false, agentId: a.id } });
    vi.advanceTimersByTime(MOCK_TIMING.turnStep * 20);
    const fin = events[events.length - 1].payload as TurnEvent;
    expect(fin.type === "finished" && fin.answer.citations.length === 0 && fin.answer.text.startsWith("I don't know")).toBe(true);
  });

  it("denied permission turns on at the second ask; dialog returns absolute paths", async () => {
    const { call } = backend({ setup: "denied" });
    expect(await call("permission_request", { kind: "accessibility" })).toBe("denied");
    expect(await call("permission_request", { kind: "accessibility" })).toBe("granted");
    const files = (await call("plugin:dialog|open", { options: { multiple: true } })) as string[];
    expect(files.length).toBe(2);
    expect(files.every((f) => /^(\/|[A-Z]:\\)/.test(f))).toBe(true);
  });
});
