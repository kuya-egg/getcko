# Frontend engineer 1 — main window

## Mission
Build GetCko’s main React/Tauri experience for setup, local knowledge and editable agents. Keep client behaviour on the typed shared contract in [architecture](../architecture.md).

## Owns
- `src/App.tsx`, `src/App.css`, `src/main.tsx`
- `src/lib/` main-window UI integration (shared client `src/lib/getcko.ts` is the IPC facade)
- `src/assets/`, local font assets, Tailwind configuration and styles
- Main-window Tauri capabilities/config changes, coordinated with overlay engineer

Closing the main window (red button or Cmd+W) hides it while the app and the overlay session bar keep running. Cmd+W is a custom "Close Window" menu item (`src-tauri/src/app_menu.rs`) because Tauri's default item closes the key window, which is often the overlay. Use the agent chip ("Open GetCko") or the macOS Dock icon to reopen the main window.

The overlay session bar floats like Wispr Flow: drag it by its grip, switch between compact and expanded, or hide it with ×; Option+Space or a new turn brings it back. Its position (as screen fractions) and its compact/hidden state persist in localStorage. The gecko follows the cursor (positioned every animation frame by a transform, without a React render), flies to the target when a turn points somewhere, draws the halo on landing, and returns to the cursor once the cursor has rested on the target for 300 ms, or 8 s after the answer finishes (`src/overlay/pointer/follow.ts`). The answer card keeps clear of both the gecko and the bar. The overlay engineer owns this behavior.

## Consumes
- [IPC commands, events and generated types](../architecture.md#ipc-contract)
- [Parity and model setup](../architecture.md#cross-platform-parity), [visual tokens](../getcko-design-system.md#2-color-tokens), [components](../getcko-design-system.md#5-components)

## Tasks

### P0 — by 1 AM
1. Implement onboarding/setup screen: show `setupStatus`, component loading/missing status, and permission states; request permission through `permissionRequest(kind)`. Leave the "loading models" state when `onEngine` fires (no polling). Explain Screen Recording as optional: without it GetCko still points from the element list (tier 1) but can't use screenshots for hard screens (tiers 2–3, see [three tiers](../architecture.md#screen-understanding-three-tiers)). Acceptance: user can see unavailable/missing models rather than triggering downloads; denied Accessibility clearly disables Screen Help while document questions remain available; denied Screen Recording only disables tiers 2–3. Commands/types: `setupStatus`, `permissionRequest`, `onEngine`, `SetupStatus`, `PermissionState`, `ComponentStatus`.
2. Implement knowledge-base CRUD and document list/import. Use Tauri dialog plugin file picker; pass absolute paths to `docImport(knowledgeBaseId, path)`. Subscribe to `onDocument` and update live status chips. Acceptance: create/rename/delete works offline; Ready/Processing/Failed chips reflect events; Duplicate and Invalid errors have clear, actionable copy; 20-page text PDF reaches Ready in <60 s on M4 Pro, Wi-Fi off (R1). Commands/events: `kbList`, `kbCreate`, `kbRename`, `kbDelete`, `docList`, `docImport`, `docDelete`, `onDocument`.
3. Build agents list/editor and template picker. Acceptance: create, edit, duplicate, delete survive restart; one-click template is editable; attach no more than 5 KBs; base-rules include/replace toggle affects next answer (A1–A4). Commands/types: `templateList`, `agentList`, `agentGet`, `agentCreate`, `agentCreateFromTemplate`, `agentUpdate`, `agentDuplicate`, `agentDelete`, `agentActive`, `agentSetActive`, `AgentDraft`, `Template`.
4. Establish Tailwind design tokens and bundle Bricolage Grotesque, Geist, Geist Mono and Silkscreen locally. Acceptance: offline UI loads those fonts; implementation matches [design-system tokens and typography](../getcko-design-system.md#2-color-tokens) and controls have visible focus and ≥44px hit targets.

### P1 — 1–4 AM
5. Add per-agent voice and speaking-speed fields, populated with `voiceList`; add “Try this agent” unsaved test chat. User-facing language is English only. Acceptance: answers are in English; selected voice/speed is applied (A6); test conversation is not saved (A7). Commands/types: `voiceList`, `ask({input:{type:'text',text}, screenHelp:false, agentId})`, `TurnEvent`, `AgentDraft`.
6. Ensure component readiness and model-missing states remain truthful after refresh; communicate any failure states to overlay and backend. Never display unmeasured latency.

### P2
7. If ahead, prototype R7 library-size status affordance with backend before exposing quantized search controls. Acceptance: no UI claims quantized retrieval until measured Recall@5 remains within a few points of exact search on team data; no change to P0 exact-search default. Use existing KB/status UI and measured backend output.

## Handoffs
- By P0 integration: provide overlay engineer stable navigation/agent selection and shared `src/lib/getcko.ts` usage; agree on window labels and event ownership.
- Before demo: provide designer’s token/font assets in the app and confirm sample-manual filenames and expected citations with the team.
- By P1: provide backend engineer concrete import/agent errors observed in UI for user-facing mapping; coordinate voice fields with engine owner.

## Done
- [ ] Onboarding reflects permissions and component availability.
- [ ] KB/document CRUD, absolute-path picker and live status updates work.
- [ ] Duplicate and invalid import errors have clear copy.
- [ ] Templates and agent CRUD honor A1–A4 and five-KB limit.
- [ ] P1 language, voice/speed and unsaved Try-chat honor A5–A7.
- [ ] UI uses bundled fonts and design tokens offline.
