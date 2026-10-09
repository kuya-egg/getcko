// Onboarding logic, kept pure so it can be tested without a window.
// Steps: one per permission the OS gates (Accessibility → Screen Recording → Microphone), then "ready"
// (models + shortcut). Kinds the OS doesn't gate ("notRequired", e.g. Windows) get no step. On Windows
// the microphone reads "notAsked" but nothing can ask for it: it only gets a step once it is refused.
import type { ComponentStatus } from "../../bindings/ComponentStatus";
import type { EngineComponent } from "../../bindings/EngineComponent";
import type { PermissionKind } from "../../bindings/PermissionKind";
import type { PermissionStatus } from "../../bindings/PermissionStatus";
import type { SetupStatus } from "../../bindings/SetupStatus";
import type { Platform } from "../../brand/lexicon";
import type { ModelFile } from "../../bindings/ModelFile";
import type { ModelRole } from "../../bindings/ModelRole";

export function formatModelSize(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

export interface DownloadRow {
  key: string;
  name: string;
  files: ModelFile[];
  required: boolean;
  bytes: number;
}

const MODEL_NAMES: Record<ModelRole, string> = {
  chat: "Answer model",
  chatProjector: "Screenshot reading",
  embeddings: "Document search",
  speech: "Speech to text",
  grounder: "Pointing on hard screens",
  grounderProjector: "Pointing on hard screens",
};

export function modelDownloadRows(files: ModelFile[]): DownloadRow[] {
  const grouped: Record<string, ModelFile[]> = {};
  for (const file of files) {
    const name = MODEL_NAMES[file.role];
    (grouped[name] ??= []).push(file);
  }
  return Object.entries(grouped).map(([name, groupedFiles]) => ({
    key: name,
    name,
    files: groupedFiles,
    required: groupedFiles.some((file) => file.required),
    bytes: groupedFiles.reduce((sum, file) => sum + file.bytes, 0),
  })).sort((a, b) => Number(b.required) - Number(a.required));
}
import {
  REQUIRED_COMPONENTS,
  isAllowed,
  isLoadingModels,
  missingComponents,
  modelsLoading,
  permissionOf,
} from "../../app/setup";

export type StepId = PermissionKind | "models" | "ready";

/** Accessibility first: Screen Help needs it most (T.onboarding.order). */
export const PERMISSION_ORDER: readonly PermissionKind[] = ["accessibility", "screenRecording", "microphone"];

/** Engine components in the order a person cares about them. */
export const COMPONENT_ORDER: readonly EngineComponent[] = ["chat", "embeddings", "speechToText", "textToSpeech", "microphone"];

/**
 * Does the OS really gate this permission here? "notRequired" never does. On Windows the microphone
 * reports "notAsked" with no way to ask (same rule as offFeatures: only a refusal turns it off).
 */
export function isGated(status: SetupStatus | undefined, kind: PermissionKind, platform: Platform = "mac"): boolean {
  const s = permissionOf(status, kind);
  if (s === undefined || s === "notRequired") return false;
  // Windows has no Accessibility or Screen Recording switch for GetcKo: never a step there.
  if (platform === "win" && kind !== "microphone") return false;
  if (platform === "win" && kind === "microphone") return s === "denied";
  return true;
}

/** Permissions this computer gates, in step order. Settings lists the same ones. */
export function gatedPermissions(status: SetupStatus | undefined, platform: Platform = "mac"): PermissionKind[] {
  return PERMISSION_ORDER.filter((k) => isGated(status, k, platform));
}

/** The steps this computer needs. Missing required models get their own download step. */
export function stepsFor(status: SetupStatus | undefined, platform: Platform = "mac"): StepId[] {
  return [...gatedPermissions(status, platform), ...(readiness(status) === "missing" ? ["models" as const] : []), "ready"];
}

/** Where to start: the first permission that isn't on, then required models, else ready. */
export function firstOpenStep(status: SetupStatus | undefined, platform: Platform = "mac"): StepId {
  return stepsFor(status, platform).find((s) => s === "models" || s === "ready" || !isAllowed(permissionOf(status, s))) ?? "ready";
}

/**
 * "Check again" on a waiting permission: a refusal ("denied") is asked again (macOS doesn't prompt
 * twice); anything else is just read again, so macOS doesn't bring its dialog back.
 */
export function checkAgainMode(status: PermissionStatus | undefined): "request" | "refresh" {
  return status === "denied" ? "request" : "refresh";
}

/** Permission line under the body: idle (not asked), waiting (asked, still off), granted. */
export type AskState = "idle" | "waiting" | "granted";

/**
 * macOS reports an un-granted permission as "notAsked" again after a refresh, so "we asked in this
 * session" is remembered by the screen and passed in as `asked`.
 */
export function askState(status: PermissionStatus | undefined, asked: boolean): AskState {
  if (isAllowed(status)) return "granted";
  if (status === "denied" || asked) return "waiting";
  return "idle";
}

/** Model state for the ready step. Missing wins over loading: a missing file never loads. */
export type Readiness = "loading" | "missing" | "ready";

export function readiness(status: SetupStatus | undefined): Readiness {
  if (missingComponents(status).length > 0) return "missing";
  if (!status || modelsLoading(status)) return "loading";
  return "ready";
}

/** Why a component isn't ready, in a few plain words. */
export type ComponentProblem = "missing" | "notHere" | "unavailable";

export interface ComponentRow {
  component: EngineComponent;
  required: boolean;
  state: "ready" | "processing" | "failed";
  problem?: ComponentProblem;
  /** Model file named in the backend detail ("gemma-4-E2B-it-Q4_0.gguf"), shown in mono. */
  file?: string;
}

/** "model file not found: gemma-4-E2B-it-Q4_0.gguf" → "gemma-4-E2B-it-Q4_0.gguf". */
export function missingFile(detail: string | null | undefined): string | undefined {
  const m = detail?.match(/([\w.-]+\.(?:gguf|bin|onnx))/i);
  return m?.[1];
}

export function componentProblem(detail: string | null | undefined): ComponentProblem {
  const d = (detail ?? "").toLowerCase();
  if (/not found|missing|no such file/.test(d)) return "missing";
  if (/not built|not supported|unsupported|this os|platform/.test(d)) return "notHere";
  return "unavailable";
}

/** Components that are model files (they load). The microphone device does not. */
export const MODEL_COMPONENTS: readonly EngineComponent[] = ["chat", "embeddings", "speechToText", "textToSpeech"];

function rowOf(c: ComponentStatus): ComponentRow {
  const required = REQUIRED_COMPONENTS.includes(c.component);
  if (c.ready) return { component: c.component, required, state: "ready" };
  if (isLoadingModels(c)) return { component: c.component, required, state: "processing" };
  return { component: c.component, required, state: "failed", problem: componentProblem(c.detail), file: missingFile(c.detail) };
}

/** One row per reported component, required first. Unknown components keep their place at the end. */
export function componentRows(status: SetupStatus | undefined): ComponentRow[] {
  if (!status) return [];
  const rank = (c: EngineComponent) => {
    const i = COMPONENT_ORDER.indexOf(c);
    return i < 0 ? COMPONENT_ORDER.length : i;
  };
  return [...status.components].sort((a, b) => rank(a.component) - rank(b.component)).map(rowOf);
}

/** Rows a person needs to see: every model, and the microphone device only when it failed. */
export function visibleComponentRows(status: SetupStatus | undefined): ComponentRow[] {
  return componentRows(status).filter((r) => MODEL_COMPONENTS.includes(r.component) || r.state === "failed");
}

/** Features that are off because a permission is off. Order = how much it matters. */
export type OffFeature = "screenHelp" | "screenshots" | "holdToTalk";

export function offFeatures(status: SetupStatus | undefined): OffFeature[] {
  if (!status) return [];
  const off: OffFeature[] = [];
  const allowed = (k: PermissionKind) => {
    const s = permissionOf(status, k);
    return s === undefined || isAllowed(s);
  };
  if (!allowed("accessibility")) off.push("screenHelp");
  // Screenshots only matter while Screen Help itself works.
  else if (!allowed("screenRecording")) off.push("screenshots");
  // macOS asks for the microphone on the first hold, so only a refusal turns it off.
  if (permissionOf(status, "microphone") === "denied") off.push("holdToTalk");
  return off;
}

// ---------------------------------------------------------------------------
// Step navigation

export interface FlowState {
  /** null until the first setup read decides where to start. */
  step: StepId | null;
  /** 1 forward, -1 back (stepIn direction). */
  dir: 1 | -1;
  /** Permissions asked in this session (macOS forgets a refusal, see askState). */
  asked: PermissionKind[];
}

export type FlowAction =
  | { type: "start"; step: StepId }
  | { type: "next"; steps: StepId[] }
  | { type: "back"; steps: StepId[] }
  | { type: "asked"; kind: PermissionKind };

export const INITIAL_FLOW: FlowState = { step: null, dir: 1, asked: [] };

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "start":
      return state.step === null ? { ...state, step: action.step, dir: 1 } : state;
    case "next":
    case "back": {
      if (state.step === null) return state;
      const i = action.steps.indexOf(state.step);
      const d = action.type === "next" ? 1 : -1;
      const j = i < 0 ? action.steps.length - 1 : Math.min(Math.max(i + d, 0), action.steps.length - 1);
      if (j === i) return state;
      return { ...state, step: action.steps[j], dir: d };
    }
    case "asked":
      return state.asked.includes(action.kind) ? state : { ...state, asked: [...state.asked, action.kind] };
  }
}
