// In-memory GetcKo backend for the browser. Same command names, argument names, return types,
// error kinds and events as src-tauri (commands.rs, store/mod.rs, pipeline.rs), so screens behave
// the same against it. Pure: events go out through `emit`, timers through setTimeout.
import type { Agent } from "../../bindings/Agent";
import type { AgentDraft } from "../../bindings/AgentDraft";
import type { Answer } from "../../bindings/Answer";
import type { AppError } from "../../bindings/AppError";
import type { AskRequest } from "../../bindings/AskRequest";
import type { Citation } from "../../bindings/Citation";
import type { ComponentStatus } from "../../bindings/ComponentStatus";
import type { Document } from "../../bindings/Document";
import type { DocumentKind } from "../../bindings/DocumentKind";
import type { ErrorKind } from "../../bindings/ErrorKind";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { PermissionKind } from "../../bindings/PermissionKind";
import type { PermissionState } from "../../bindings/PermissionState";
import type { PermissionStatus } from "../../bindings/PermissionStatus";
import type { ScreenSnapshot } from "../../bindings/ScreenSnapshot";
import type { SetupStatus } from "../../bindings/SetupStatus";
import type { TemplateId } from "../../bindings/TemplateId";
import type { TurnEvent } from "../../bindings/TurnEvent";
import { say } from "../../brand/lexicon";
import type { MockOptions } from "./params";
import * as seed from "./seed";

/** Event names: the same strings src/lib/getcko.ts listens to. */
export const MOCK_EVENTS = { turn: "turn", document: "document", engine: "engine" } as const;

export type Emit = (event: string, payload: unknown) => void;
export type Handler = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

const MAX_KBS = 5;
const DAY = 86_400_000;

const fail = (kind: ErrorKind, message: string): AppError => ({ kind, message });

interface DocRow extends Document {
  /** Stand-in for the content fingerprint: the file's base name. */
  fingerprint: string;
}

interface KbRow {
  id: number;
  name: string;
  createdAt: number;
}

/** Timing of the fake pipeline, ms. Short enough to watch, long enough to see Processing. */
export const MOCK_TIMING = { docProcessing: 300, docDone: 2200, turnStep: 350 } as const;

function kindFromPath(path: string): { name: string; kind: DocumentKind | null; ext: string } {
  const name = path.split(/[\\/]/).pop() || "document";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const map: Record<string, DocumentKind> = { md: "markdown", markdown: "markdown", txt: "text", pdf: "pdf", docx: "docx", pptx: "pptx" };
  return { name, kind: map[ext] ?? null, ext };
}

export function createMockBackend(opts: MockOptions, emit: Emit, now: () => number = Date.now): Handler {
  let nextId = 1;
  const id = () => nextId++;
  const t0 = now();

  const kbs: KbRow[] = [];
  const docs: DocRow[] = [];
  const agents: Agent[] = [];
  let activeAgentId: number | null = null;
  let permissions: PermissionState[] = seed.permissions(opts.setup);
  let components: ComponentStatus[] = seed.components(opts.setup);
  const voices = seed.voices();
  /** Requests per permission; a denied one turns on at the second ask ("Check again" after System Settings). */
  const asks = new Map<PermissionKind, number>();

  // ---- seed --------------------------------------------------------------------------------
  if (!opts.empty) {
    const kbIds: number[] = [];
    for (const k of seed.KNOWLEDGE_BASES) {
      const kb: KbRow = { id: id(), name: k.name, createdAt: t0 - k.age * DAY };
      kbs.push(kb);
      kbIds.push(kb.id);
      for (const d of k.docs) {
        docs.push({
          id: id(),
          knowledgeBaseId: kb.id,
          fileName: d.fileName,
          kind: d.kind,
          pageCount: d.pageCount,
          passageCount: d.passageCount,
          status: d.status,
          error: d.error ?? null,
          createdAt: t0 - d.age * DAY,
          fingerprint: d.fileName,
        });
      }
    }
    seed.AGENTS.forEach((a, i) => {
      const tpl = seed.TEMPLATES.find((t) => t.id === a.template)!;
      const voiceOk = a.voiceId && voices.some((v) => v.id === a.voiceId);
      agents.push({
        ...tpl.draft,
        id: id(),
        templateId: a.template,
        createdAt: t0 - (10 - i) * DAY,
        updatedAt: t0 - (10 - i) * DAY,
        knowledgeBaseIds: a.kbs.map((n) => kbIds[n]),
        voiceId: voiceOk ? a.voiceId! : null,
      });
    });
    activeAgentId = agents[0]?.id ?? null;
  }

  if (opts.setup === "loading") {
    setTimeout(() => {
      components = seed.readyComponents();
      emit(MOCK_EVENTS.engine, components);
    }, 2500);
  }

  // ---- helpers -----------------------------------------------------------------------------
  const kbView = (k: KbRow): KnowledgeBase => {
    const mine = docs.filter((d) => d.knowledgeBaseId === k.id);
    const inflight = mine.some((d) => d.status === "queued" || d.status === "processing");
    const ready = mine.some((d) => d.status === "ready");
    return {
      id: k.id,
      name: k.name,
      createdAt: k.createdAt,
      documentCount: mine.length,
      passageCount: mine.reduce((n, d) => n + d.passageCount, 0),
      status: inflight ? "processing" : ready ? "ready" : mine.length === 0 ? "empty" : "failed",
    };
  };
  const docView = ({ fingerprint: _f, ...d }: DocRow): Document => ({ ...d });
  const kbRow = (kbId: unknown): KbRow => {
    const k = kbs.find((x) => x.id === kbId);
    if (!k) throw fail("notFound", "knowledge base not found");
    return k;
  };
  const agentRow = (agentId: unknown): Agent => {
    const a = agents.find((x) => x.id === agentId);
    if (!a) throw fail("notFound", "agent not found");
    return a;
  };
  const nameOf = (n: unknown, what: string): string => {
    const s = typeof n === "string" ? n.trim() : "";
    if (!s) throw fail("invalid", `${what} name must not be empty`);
    return s;
  };
  const validate = (d: AgentDraft): number[] => {
    nameOf(d.name, "agent");
    if (!(d.speechRate >= 0.5 && d.speechRate <= 2.0)) throw fail("invalid", "speech rate must be between 0.5 and 2.0");
    const ids = [...new Set(d.knowledgeBaseIds)].sort((a, b) => a - b);
    if (ids.length > MAX_KBS) throw fail("invalid", "agent may attach at most five knowledge bases");
    ids.forEach(kbRow);
    return ids;
  };
  const insertAgent = (d: AgentDraft, templateId: TemplateId | null): Agent => {
    const ids = validate(d);
    const ts = now();
    const a: Agent = { ...d, name: d.name.trim(), knowledgeBaseIds: ids, id: id(), templateId, createdAt: ts, updatedAt: ts };
    agents.push(a);
    if (activeAgentId === null) activeAgentId = a.id;
    return { ...a };
  };
  const setDoc = (docId: number, patch: Partial<DocRow>) => {
    const d = docs.find((x) => x.id === docId);
    if (!d) return; // deleted mid-import
    Object.assign(d, patch);
    emit(MOCK_EVENTS.document, docView(d));
  };

  // ---- turns -------------------------------------------------------------------------------
  let turnSeq = 0;
  let live: { turnId: number; timers: ReturnType<typeof setTimeout>[] } | null = null;

  const cancelLive = () => {
    if (!live) return;
    live.timers.forEach((t) => clearTimeout(t));
    const ev: TurnEvent = { type: "cancelled", turnId: live.turnId };
    live = null;
    emit(MOCK_EVENTS.turn, ev);
  };

  const ask = (req: AskRequest): number => {
    const agent = req.agentId != null ? agentRow(req.agentId) : agents.find((a) => a.id === activeAgentId);
    if (!agent) throw fail("invalid", "no agent — pick a template first");
    const question =
      req.input.type === "text" ? req.input.text.trim() : canned(agent.templateId).voiceQuestion;
    if (!question) throw fail("invalid", "question must not be empty");
    if (!components.find((c) => c.component === "chat")?.ready) throw fail("unavailable", "chat model not loaded");

    cancelLive();
    const turnId = ++turnSeq;
    const ready = docs.filter((d) => agent.knowledgeBaseIds.includes(d.knowledgeBaseId) && d.status === "ready");
    const c = canned(agent.templateId);
    const grounded = ready.length > 0;
    const sentences = grounded ? c.sentences : [say.en.dontKnow];
    const citations: Citation[] = grounded
      ? [{ marker: 1, passageId: 1000 + ready[0].id, documentId: ready[0].id, documentName: ready[0].fileName, location: ready[0].pageCount ? "p. 4" : "Overview" }]
      : [];

    const steps: TurnEvent[] = [];
    if (req.input.type === "voice") {
      steps.push({ type: "phase", turnId, phase: "listening" }, { type: "phase", turnId, phase: "transcribing" });
    }
    steps.push({ type: "question", turnId, text: question }, { type: "phase", turnId, phase: "thinking" });
    if (req.screenHelp) steps.push({ type: "target", turnId, target: null });
    steps.push({ type: "phase", turnId, phase: "answering" });
    for (const s of sentences) steps.push({ type: "sentence", turnId, text: s });

    const timers: ReturnType<typeof setTimeout>[] = [];
    live = { turnId, timers };
    steps.forEach((ev, i) => {
      timers.push(setTimeout(() => emit(MOCK_EVENTS.turn, ev), (i + 1) * MOCK_TIMING.turnStep));
    });
    timers.push(
      setTimeout(() => {
        const answer: Answer = {
          turnId,
          question,
          text: sentences.join(" "),
          citations,
          target: null,
          confidence: "normal",
          screenMode: null,
          // Not a measurement. The mock fills the required fields with 0; screens must never show latency from the mock.
          latency: { transcribeMs: null, screenMs: null, captureMs: null, retrievalMs: 0, firstTokenMs: null, totalMs: 0 },
        };
        if (live?.turnId === turnId) live = null;
        emit(MOCK_EVENTS.turn, { type: "finished", answer } satisfies TurnEvent);
      }, (steps.length + 1) * MOCK_TIMING.turnStep),
    );
    return turnId;
  };

  // ---- dialog ------------------------------------------------------------------------------
  let picks = 0;
  const mac = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);
  const dir = mac ? "/Users/ana/Documents/" : "C:\\Users\\ana\\Documents\\";
  const PICKS = [
    ["Leave application guide.pdf", "HR memo 2026-14.docx"],
    ["Scanned payslip.pdf"],
    ["Org chart.xlsx"],
  ];

  // ---- commands ----------------------------------------------------------------------------
  const commands: Record<string, (a: Record<string, unknown>) => unknown> = {
    setup_status: (): SetupStatus => ({ permissions: permissions.map((p) => ({ ...p })), components: components.map((c) => ({ ...c })) }),
    permission_request: (a): PermissionStatus => {
      const kind = a.kind as PermissionKind;
      const n = (asks.get(kind) ?? 0) + 1;
      asks.set(kind, n);
      const cur = permissions.find((p) => p.kind === kind)?.status ?? "notAsked";
      const next: PermissionStatus = cur === "denied" && n < 2 ? "denied" : cur === "notRequired" ? cur : "granted";
      permissions = permissions.map((p) => (p.kind === kind ? { kind, status: next } : p));
      return next;
    },
    voice_list: () => voices.map((v) => ({ ...v })),

    kb_list: () => kbs.map(kbView),
    kb_create: (a) => {
      const k: KbRow = { id: id(), name: nameOf(a.name, "knowledge base"), createdAt: now() };
      kbs.push(k);
      return kbView(k);
    },
    kb_rename: (a) => {
      const k = kbRow(a.id);
      k.name = nameOf(a.name, "knowledge base");
      return kbView(k);
    },
    kb_delete: (a) => {
      const k = kbRow(a.id);
      kbs.splice(kbs.indexOf(k), 1);
      for (let i = docs.length - 1; i >= 0; i--) if (docs[i].knowledgeBaseId === k.id) docs.splice(i, 1);
      agents.forEach((ag) => (ag.knowledgeBaseIds = ag.knowledgeBaseIds.filter((x) => x !== k.id)));
      return null;
    },

    doc_list: (a) => {
      const k = kbRow(a.knowledgeBaseId);
      return docs.filter((d) => d.knowledgeBaseId === k.id).map(docView);
    },
    doc_import: (a) => {
      const path = String(a.path ?? "");
      const { name, kind, ext } = kindFromPath(path);
      if (!kind) throw fail("invalid", `.${ext} files are not supported yet`);
      const k = kbRow(a.knowledgeBaseId);
      const dup = docs.find((d) => d.knowledgeBaseId === k.id && d.fingerprint === name);
      if (dup) throw fail("duplicate", `${dup.fileName} is already in this knowledge base`);
      const d: DocRow = {
        id: id(),
        knowledgeBaseId: k.id,
        fileName: name,
        kind,
        pageCount: null,
        passageCount: 0,
        status: "queued",
        error: null,
        createdAt: now(),
        fingerprint: name,
      };
      docs.push(d);
      emit(MOCK_EVENTS.document, docView(d));
      const scanned = /scan/i.test(name);
      const pages = kind === "pdf" || kind === "docx" || kind === "pptx" ? 6 + (name.length % 18) : null;
      setTimeout(() => setDoc(d.id, { status: "processing" }), MOCK_TIMING.docProcessing);
      setTimeout(
        () =>
          scanned
            ? setDoc(d.id, { status: "failed", error: "no text found (scanned PDF?)" })
            : setDoc(d.id, { status: "ready", pageCount: pages, passageCount: (pages ?? 3) * 4 + (name.length % 7) }),
        MOCK_TIMING.docDone,
      );
      return docView(d);
    },
    doc_delete: (a) => {
      const i = docs.findIndex((d) => d.id === a.id);
      if (i < 0) throw fail("notFound", "document not found");
      docs.splice(i, 1);
      return null;
    },

    template_list: () => structuredClone(seed.TEMPLATES),
    agent_list: () => agents.map((a) => ({ ...a, knowledgeBaseIds: [...a.knowledgeBaseIds] })),
    agent_get: (a) => ({ ...agentRow(a.id) }),
    agent_create: (a) => insertAgent(a.draft as AgentDraft, null),
    agent_create_from_template: (a) => {
      const tpl = seed.TEMPLATES.find((t) => t.id === a.templateId);
      if (!tpl) throw fail("notFound", "template not found");
      return insertAgent(structuredClone(tpl.draft), tpl.id);
    },
    agent_update: (a) => {
      const ag = agentRow(a.id);
      const d = a.draft as AgentDraft;
      const ids = validate(d);
      Object.assign(ag, d, { name: d.name.trim(), knowledgeBaseIds: ids, updatedAt: now() });
      return { ...ag };
    },
    agent_duplicate: (a) => {
      const { id: _i, templateId, createdAt: _c, updatedAt: _u, ...d } = agentRow(a.id);
      return insertAgent({ ...d, name: `${d.name} copy` }, templateId);
    },
    agent_delete: (a) => {
      const ag = agentRow(a.id);
      agents.splice(agents.indexOf(ag), 1);
      if (activeAgentId === ag.id) {
        const next = [...agents].sort((x, y) => y.updatedAt - x.updatedAt || y.id - x.id)[0];
        activeAgentId = next?.id ?? null;
      }
      return null;
    },
    agent_active: () => {
      const a = agents.find((x) => x.id === activeAgentId);
      return a ? { ...a } : null;
    },
    agent_set_active: (a) => {
      const ag = agentRow(a.id);
      activeAgentId = ag.id;
      return { ...ag };
    },

    ptt_start: () => null,
    ask: (a) => ask(a.request as AskRequest),
    stop: () => {
      cancelLive();
      return null;
    },
    screen_snapshot: (): ScreenSnapshot => ({
      appName: "eRecords",
      windowTitle: "New record",
      elements: [
        { id: "e1", role: "button", label: "New entry", value: null, bounds: { x: 120, y: 160, width: 96, height: 28 } },
        { id: "e2", role: "textField", label: "Last name", value: "", bounds: { x: 120, y: 220, width: 240, height: 28 } },
        { id: "e3", role: "button", label: "Save", value: null, bounds: { x: 620, y: 520, width: 72, height: 28 } },
      ],
    }),

    "plugin:dialog|open": (a) => {
      const files = PICKS[picks++ % PICKS.length].map((f) => dir + f);
      const multiple = (a.options as { multiple?: boolean } | undefined)?.multiple;
      return multiple ? files : files[0];
    },
  };

  return async (cmd, args) => {
    if (opts.slow) await new Promise((r) => setTimeout(r, 600));
    const run = commands[cmd];
    if (!run) {
      console.warn(`[getcko mock] no handler for "${cmd}"`);
      throw fail("unavailable", `mock: no handler for ${cmd}`);
    }
    return run(args ?? {});
  };
}

/** Short grounded answers per template, action → reason → source marker. */
function canned(templateId: TemplateId | null) {
  switch (templateId) {
    case "teacher":
      return {
        voiceQuestion: "Where do I put the final grade?",
        sentences: ["Put the final grade in cell D7.", "It's the average of the three quarters, per the guide [1]."],
      };
    case "studyBuddy":
      return {
        voiceQuestion: "What does the mitochondria do?",
        sentences: ["The mitochondria makes most of the cell's energy.", "Your notes call it the powerhouse of the cell [1]."],
      };
    default:
      return {
        voiceQuestion: "How do I add a new record?",
        sentences: ["Click New entry at the top left.", "That starts a new record, per the office manual [1]."],
      };
  }
}
