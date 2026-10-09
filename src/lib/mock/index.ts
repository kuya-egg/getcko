// Browser mock backend. main.tsx installs it only when import.meta.env.DEV && !isTauri().
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { createMockBackend } from "./backend";
import { readMockOptions } from "./params";

export { createMockBackend, MOCK_EVENTS, MOCK_TIMING } from "./backend";
export { readMockOptions, DEFAULT_OPTIONS } from "./params";
export type { MockOptions, MockSetup } from "./params";

/** Answer every invoke() from memory and route listen()/emit() through the mock event bus. */
export function installMockBackend(search: string = window.location.search): void {
  const opts = readMockOptions(search);
  const handler = createMockBackend(opts, (event, payload) => void emit(event, payload));
  mockIPC((cmd, payload) => handler(cmd, payload as Record<string, unknown> | undefined), { shouldMockEvents: true });
  console.info("[getcko mock] browser backend on", opts);
}
