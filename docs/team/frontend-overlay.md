# Frontend engineer 2 — overlay window

## Mission
Implement the visible, click-through screen helper and streaming answer experience on macOS and Windows. Follow the same IPC and geometry contract on both platforms in [architecture](../architecture.md).

## Owns
- Overlay React renderer and styles under `src/overlay/`
- Overlay window creation/configuration in `src-tauri/tauri.conf.json` and platform config fragments, coordinated with main-window engineer
- Global shortcut plugin integration and overlay capability configuration

## Consumes
- [IPC commands, events and generated types](../architecture.md#ipc-contract)
- [Coordinate spaces and threading](../architecture.md#coordinate-spaces-and-threading), [cross-platform parity](../architecture.md#cross-platform-parity)
- [Overlay and sprite specs](../getcko-design-system.md#5-components), [mascot states](../getcko-design-system.md#6-mascot-getcko-pixel-sprite)

## Tasks

### P0 — by 1 AM
1. Create the `overlay` window: transparent, frameless, always-on-top, click-through via `setIgnoreCursorEvents`; remain visible in screen sharing. Acceptance: overlay does not hide from share/app switcher; user can interact with composer when interaction is enabled (S3, BR-3).
2. On `TurnEvent.target`, position overlay over `PointerTarget.monitor` using Tauri `PhysicalPosition` / `PhysicalSize`; draw GetCko beside `rect` in CSS pixels relative to monitor top-left. Apply single yellow target halo. Acceptance: pointer lands on the correct element across monitor scaling and multi-monitor coordinates (S3, BR-20); correct element ≥8/10 scripted tasks across three demo apps (S2).
3. Drive gecko state with turn phase/target/sentence/finished events. Stream answer sentences, show citation chips and measured latency in the answer card, session bar and composer. Acceptance: first sentence’s speech starts within 0.5 s of readiness; displayed latency is a measured value, e.g. format `0.9 s · on this Mac`, never a fabricated constant (T1, BR-24). Commands/events: `onTurn`, `ask`, `stop`, `TurnEvent`, `Answer`, `Citation`, `Latency`.
4. Add text ask and hold-to-talk: call `pttStart()` on press and `ask({input:{type:'voice'}})` on release; text uses `ask({input:{type:'text',text},screenHelp:true})`. Add stop action and hotkey. Acceptance: new ask cancels old turn and stop silences speech immediately (T3). Commands: `pttStart`, `ask`, `stop`.
5. Register global shortcuts via `tauri-plugin-global-shortcut`: macOS `⌥Space`, Windows `Ctrl+Space` ask; stop key invokes `stop()`. Acceptance: same shortcut behaviour and command set on both OSes; no hidden/covert mode.

### P1 — 1–4 AM
6. Implement S5 “next”: continue task context for at most 5 steps with a fresh screen snapshot per step. Acceptance: after step 5, end the guided task and tell the user; retain prior task context only up to that limit. Use `screenSnapshot`, `ask`, `TurnEvent`.
7. Render targetless answers honestly (“can’t read this app”) and S4 screenshot fallback as “best guess” when backend supplies `Confidence::BestGuess`; never draw a nonexistent target (BR-16, BR-18).

### P2
8. If ahead, add configurable Windows Ctrl+Space shortcut preference while retaining the default parity mapping. Acceptance: shortcut changes only the trigger, not command/event behaviour; stop remains immediate (T3). Use `ask`, `stop` and global-shortcut plugin.

## Handoffs
- By P0 integration: agree with main-window engineer on shared API facade, agent picker/session selection, window labels, global shortcut ownership and setup entry points.
- By coordinate integration: give platform engineers the observed `PointerTarget` monitor/rect mapping failures and reproduce S3 scaling cases on both OSes.
- Before demo: coordinate sprite exports and answer-card/session-bar specs with designer; confirm hotkey labels match OS adaptation.

## Done
- [ ] Overlay is transparent, topmost, click-through when idle, and visible in screen share.
- [ ] Multi-monitor placement uses physical monitor bounds and CSS-relative target rect correctly.
- [ ] Sprite states, halo, sentences, citation chips and measured latency respond to events.
- [ ] Text/voice input and stop/hotkeys use shared commands on both OSes.
- [ ] P1 “next” supports no more than 5 steps; fallback is labelled best guess.
