// Realistic GetcKo sample data for the browser mock. Mirrors src-tauri/src/templates.rs for templates.
import type { AgentDraft } from "../../bindings/AgentDraft";
import type { ComponentStatus } from "../../bindings/ComponentStatus";
import type { DocumentKind } from "../../bindings/DocumentKind";
import type { PermissionState } from "../../bindings/PermissionState";
import type { Template } from "../../bindings/Template";
import type { TemplateId } from "../../bindings/TemplateId";
import type { Voice } from "../../bindings/Voice";
import type { MockSetup } from "./params";

const draft = (name: string, instructions: string, answerLength: AgentDraft["answerLength"]): AgentDraft => ({
  name,
  description: "",
  instructions,
  baseRules: "include",
  knowledgeBaseIds: [],
  answerLength,
  voiceId: null,
  speechRate: 1.0,
});

/** Same three as the Rust templates, same order. */
export const TEMPLATES: Template[] = [
  {
    id: "officeHelper",
    draft: draft(
      "Office Helper",
      "Help me use new software at work by explaining where to click and why. Cite the office manual when relevant.",
      "short",
    ),
  },
  {
    id: "teacher",
    draft: draft(
      "Teacher",
      "Help with DepEd forms and grading. Explain forms clearly and show grade computations step by step, citing the guide.",
      "normal",
    ),
  },
  {
    id: "studyBuddy",
    draft: draft(
      "Study Buddy",
      "Answer using my notes when available. Quiz me when I ask, and explain concepts clearly.",
      "normal",
    ),
  },
];

export function voices(): Voice[] {
  return [
    { id: "com.apple.voice.compact.en-US.Samantha", name: "Samantha", language: "en-US" },
    { id: "com.apple.voice.compact.en-GB.Daniel", name: "Daniel", language: "en-GB" },
    { id: "com.apple.voice.compact.en-AU.Karen", name: "Karen", language: "en-AU" },
  ];
}

export interface SeedDoc {
  fileName: string;
  kind: DocumentKind;
  pageCount: number | null;
  passageCount: number;
  status: "ready" | "failed";
  error?: string;
  /** Days before now. */
  age: number;
}

export interface SeedKb {
  name: string;
  age: number;
  docs: SeedDoc[];
}

export const KNOWLEDGE_BASES: SeedKb[] = [
  {
    name: "Records office",
    age: 12,
    docs: [
      { fileName: "Office manual 2026.pdf", kind: "pdf", pageCount: 48, passageCount: 212, status: "ready", age: 12 },
      { fileName: "eRecords encoding steps.md", kind: "markdown", pageCount: null, passageCount: 18, status: "ready", age: 11 },
      { fileName: "Barangay clearance form.docx", kind: "docx", pageCount: 3, passageCount: 9, status: "ready", age: 9 },
    ],
  },
  {
    name: "Grade 7 class",
    age: 8,
    docs: [
      { fileName: "DepEd Order 8 s. 2015 grading.pdf", kind: "pdf", pageCount: 64, passageCount: 301, status: "ready", age: 8 },
      { fileName: "SF9 report card guide.pptx", kind: "pptx", pageCount: 22, passageCount: 41, status: "ready", age: 7 },
      {
        fileName: "Scanned memo 0412.pdf",
        kind: "pdf",
        pageCount: null,
        passageCount: 0,
        status: "failed",
        error: "no text found (scanned PDF?)",
        age: 6,
      },
    ],
  },
  {
    name: "Biology reviewer",
    age: 3,
    docs: [{ fileName: "Cell structure notes.txt", kind: "text", pageCount: null, passageCount: 27, status: "ready", age: 3 }],
  },
];

/** Agents made from templates, attached to KBs by index into KNOWLEDGE_BASES. First one is active. */
export const AGENTS: { template: TemplateId; kbs: number[]; voiceId?: string }[] = [
  { template: "officeHelper", kbs: [0] },
  { template: "teacher", kbs: [1], voiceId: "com.apple.voice.compact.en-GB.Daniel" },
  { template: "studyBuddy", kbs: [2] },
];

export function permissions(setup: MockSetup): PermissionState[] {
  if (setup === "denied") {
    return [
      { kind: "accessibility", status: "denied" },
      { kind: "screenRecording", status: "denied" },
      { kind: "microphone", status: "notAsked" },
    ];
  }
  if (setup === "missing") {
    return [
      { kind: "accessibility", status: "notAsked" },
      { kind: "screenRecording", status: "notAsked" },
      { kind: "microphone", status: "notAsked" },
    ];
  }
  return [
    { kind: "accessibility", status: "granted" },
    { kind: "screenRecording", status: "granted" },
    { kind: "microphone", status: "granted" },
  ];
}

const ALL: ComponentStatus["component"][] = ["chat", "embeddings", "speechToText", "textToSpeech", "microphone"];

export const readyComponents = (): ComponentStatus[] => ALL.map((component) => ({ component, ready: true, detail: null }));

export function components(setup: MockSetup): ComponentStatus[] {
  if (setup === "loading") return ALL.map((component) => ({ component, ready: false, detail: "loading models" }));
  if (setup === "missing") {
    return [
      { component: "chat", ready: false, detail: "model file not found: gemma-4-E2B-it-Q4_0.gguf" },
      { component: "embeddings", ready: false, detail: "model file not found: embeddinggemma-300M-Q8_0.gguf" },
      { component: "speechToText", ready: false, detail: "model file not found: mmproj-gemma-4-E2B-it-Q8_0.gguf" },
      { component: "textToSpeech", ready: true, detail: null },
      { component: "microphone", ready: true, detail: null },
    ];
  }
  return readyComponents();
}
