# Designer

## Mission
Define the visible, calm GetCko experience and deliver assets that make the user’s screen the hero. Follow the [design system](../getcko-design-system.md) as the UI source of truth.

## Owns
- `design/` exported sprite and visual assets
- `docs/demo-manual.pdf` demo knowledge-base manual
- Pitch visual and one-minute demo video deliverables

## Consumes
- [Visual tokens and typography](../getcko-design-system.md#2-color-tokens), [components](../getcko-design-system.md#5-components), [mascot states](../getcko-design-system.md#6-mascot-getcko-pixel-sprite)
- [Shared IPC, event, and coordinate contract](../architecture.md#ipc-contract)

## Tasks

### P0 — by 1 AM
1. Deliver the 22 × 27 pixel GetCko sprite specification and exported assets for Idle, Thinking, Pointing, Speaking; preserve palette and pose overrides in design-system §6. Acceptance: renderer can draw 1×/2×/3× integer scales with pixel edges, no fractional scaling; pointer is beside, not covering, target. Supply target halo exactly `0 0 0 3px #FFC83D`, only one target at a time (S3; `TurnEvent.target`).
2. Specify overlay panel, answer card, session bar, composer, citation chips and measured-latency footer using design-system §2–5. Acceptance: answer card streams sentence-by-sentence and shows citation `document · page/section` plus real latency; composer supports text and hold-to-talk. Use `TurnEvent.sentence`, `TurnEvent.finished`, `ask`, `ptt_start`, `stop`.
3. Deliver agent card, knowledge-base row, and first-run onboarding/permissions screen. Acceptance: ≥44px controls, permission state and component loading/missing states understandable, no fake readiness; agent card and row match design-system §5. Use `SetupStatus`, `PermissionState`, `Agent`, `KnowledgeBase`, `Document`.
4. Produce a usable demo manual PDF for R1: 20 pages with text/page locations suitable for import, citations, and demo questions; review import result Ready within <60 s on M4 Pro (Wi-Fi off). Commands/events: `doc_import`, `document`.

### P1 — 1–4 AM
5. Refine the visual states for targetless answer and “best guess” fallback without implying certainty (S4); keep panel clear of target. Use `TurnEvent.target` null and `Confidence`.
6. Deliver pitch visuals and a one-minute demo video that truthfully show offline operation, local documents, pointer, spoken answer, and measured numbers from `MODELS.md` (BR-24). Include model/license disclosures supplied by engineers.

### P2
7. If ahead after P1, deliver a high-resolution pitch/hero composition using the existing sprite and token palette only. Acceptance: no gradients, decorative yellow, or unmeasured performance claim; conforms to design-system §2, §6 and §7.

## Handoffs
- By P0 integration: deliver token values, component specs, sprite source/export formats, and bundled-font requirements to both frontend engineers.
- By P0 demo: provide the PDF and its expected page-level citations to frontend/backend; provide pitch visuals to pitcher.
- By 6–8:30 AM: deliver final pitch visuals/video assets and measured-number slots to pitcher; never invent benchmark figures.

## Done
- [ ] Four sprite states and documented React-renderer-ready exports delivered.
- [ ] Target halo, panel, answer card, session bar and composer specs meet design system.
- [ ] Agent, KB and onboarding screens specified.
- [ ] Demo manual PDF imports and has citeable page locations.
- [ ] Pitch visuals and one-minute demo video show only verified claims.
- [ ] UI fonts Bricolage Grotesque, Geist, Geist Mono and Silkscreen are available bundled offline.
