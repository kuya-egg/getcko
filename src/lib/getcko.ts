import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Agent } from "../bindings/Agent";
import type { AgentDraft } from "../bindings/AgentDraft";
import type { AgentId } from "../bindings/AgentId";
import type { AskRequest } from "../bindings/AskRequest";
import type { AppError } from "../bindings/AppError";
import type { ComponentStatus } from "../bindings/ComponentStatus";
import type { Document } from "../bindings/Document";
import type { DocumentId } from "../bindings/DocumentId";
import type { ErrorKind } from "../bindings/ErrorKind";
import type { KnowledgeBase } from "../bindings/KnowledgeBase";
import type { KnowledgeBaseId } from "../bindings/KnowledgeBaseId";
import type { PermissionKind } from "../bindings/PermissionKind";
import type { PermissionStatus } from "../bindings/PermissionStatus";
import type { ScreenSnapshot } from "../bindings/ScreenSnapshot";
import type { SetupStatus } from "../bindings/SetupStatus";
import type { Template } from "../bindings/Template";
import type { TemplateId } from "../bindings/TemplateId";
import type { TurnEvent } from "../bindings/TurnEvent";
import type { TurnId } from "../bindings/TurnId";
import type { Voice } from "../bindings/Voice";
import type { ModelsStatus } from "../bindings/ModelsStatus";
import type { ModelProgress } from "../bindings/ModelProgress";

export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === "object" &&
    e !== null &&
    "kind" in e &&
    typeof e.kind === "string" &&
    "message" in e &&
    typeof e.message === "string"
  );
}

export class GetckoError extends Error {
  constructor(public readonly kind: ErrorKind, message: string) {
    super(message);
    this.name = "GetckoError";
  }
}

async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (error: unknown) {
    if (isAppError(error)) throw new GetckoError(error.kind, error.message);
    throw error;
  }
}

/** Read setup and component readiness. */
export const setupStatus = (): Promise<SetupStatus> => command("setup_status");
/** Read a permission state. */
export const permissionRequest = (kind: PermissionKind): Promise<PermissionStatus> => command("permission_request", { kind });
/** List available voices. */
export const voiceList = (): Promise<Voice[]> => command("voice_list");
/** List knowledge bases. */
export const kbList = (): Promise<KnowledgeBase[]> => command("kb_list");
/** Create a knowledge base. */
export const kbCreate = (name: string): Promise<KnowledgeBase> => command("kb_create", { name });
/** Rename a knowledge base. */
export const kbRename = (id: KnowledgeBaseId, name: string): Promise<KnowledgeBase> => command("kb_rename", { id, name });
/** Delete a knowledge base. */
export const kbDelete = (id: KnowledgeBaseId): Promise<null> => command("kb_delete", { id });
/** List documents in a knowledge base. */
export const docList = (knowledgeBaseId: KnowledgeBaseId): Promise<Document[]> => command("doc_list", { knowledgeBaseId });
/** Import a document from an absolute path. */
export const docImport = (knowledgeBaseId: KnowledgeBaseId, path: string): Promise<Document> => command("doc_import", { knowledgeBaseId, path });
/** Delete a document. */
export const docDelete = (id: DocumentId): Promise<null> => command("doc_delete", { id });
/** List agent templates. */
export const templateList = (): Promise<Template[]> => command("template_list");
/** List agents. */
export const agentList = (): Promise<Agent[]> => command("agent_list");
/** Get an agent. */
export const agentGet = (id: AgentId): Promise<Agent> => command("agent_get", { id });
/** Create an agent. */
export const agentCreate = (draft: AgentDraft): Promise<Agent> => command("agent_create", { draft });
/** Create an agent from a template. */
export const agentCreateFromTemplate = (templateId: TemplateId): Promise<Agent> => command("agent_create_from_template", { templateId });
/** Update an agent. */
export const agentUpdate = (id: AgentId, draft: AgentDraft): Promise<Agent> => command("agent_update", { id, draft });
/** Duplicate an agent. */
export const agentDuplicate = (id: AgentId): Promise<Agent> => command("agent_duplicate", { id });
/** Delete an agent. */
export const agentDelete = (id: AgentId): Promise<null> => command("agent_delete", { id });
/** Read the active agent. */
export const agentActive = (): Promise<Agent | null> => command("agent_active");
/** Set the active agent. */
export const agentSetActive = (id: AgentId): Promise<Agent> => command("agent_set_active", { id });
/** Start push-to-talk recording; with screen help on, the screen is read while the user speaks. */
export const pttStart = (screenHelp: boolean): Promise<null> => command("ptt_start", { screenHelp });
/** Read the screen ahead of a typed question (the composer opened). */
export const screenPrepare = (): Promise<null> => command("screen_prepare");
/** Start an assistant turn. */
export const ask = (request: AskRequest): Promise<TurnId> => command("ask", { request });
/** Cancel the current turn and stop speech. */
export const stop = (): Promise<null> => command("stop");
/** Capture a screen snapshot. */
export const screenSnapshot = (): Promise<ScreenSnapshot> => command("screen_snapshot");

/** Subscribe to assistant turn events. */
export const onTurn = (cb: (e: TurnEvent) => void): Promise<UnlistenFn> => listen<TurnEvent>("turn", (event) => cb(event.payload));
/** Subscribe to document status events. */
export const onDocument = (cb: (d: Document) => void): Promise<UnlistenFn> => listen<Document>("document", (event) => cb(event.payload));
/** Fires once when model loading finishes, with the final component readiness. */
export const onEngine = (cb: (components: ComponentStatus[]) => void): Promise<UnlistenFn> => listen<ComponentStatus[]>("engine", (event) => cb(event.payload));
/** Read model download status. */
export const modelsStatus = (): Promise<ModelsStatus> => command("models_status");
/** Start downloading missing models. */
export const modelsDownload = (includeOptional: boolean): Promise<null> => command("models_download", { includeOptional });
/** Cancel the active model download. */
export const modelsCancel = (): Promise<null> => command("models_cancel");
/** Restart to load newly downloaded models. */
export const appRestart = (): Promise<null> => command("app_restart");
/** Show and focus the main window. */
export const mainShow = (): Promise<null> => command("main_show");
/** Subscribe to model download progress events. */
export const onModels = (cb: (progress: ModelProgress) => void): Promise<UnlistenFn> =>
  listen<ModelProgress>("models", (event) => cb(event.payload));
