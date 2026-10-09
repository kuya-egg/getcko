// Native file picker (tauri-plugin-dialog, capability "dialog:allow-open").
// In the browser mock, 'plugin:dialog|open' is answered by src/lib/mock with fake absolute paths.
import { open } from "@tauri-apps/plugin-dialog";

/** Extensions docImport accepts (PRD R1, R6). Matches DocumentKind in src/bindings. */
export const DOCUMENT_EXTENSIONS = ["pdf", "docx", "pptx", "txt", "md"] as const;

/**
 * Ask for one or more documents. Resolves to absolute paths (empty when the person cancels),
 * ready for docImport(knowledgeBaseId, path).
 */
export async function pickDocuments(): Promise<string[]> {
  const picked = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Documents", extensions: [...DOCUMENT_EXTENSIONS] }],
  });
  if (picked === null) return [];
  return Array.isArray(picked) ? picked : [picked];
}
