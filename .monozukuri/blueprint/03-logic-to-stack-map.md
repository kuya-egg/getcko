# Logic → stack map — GetCko

Every stage-1 business element maps to exactly one home in the stack. Future homes are explicitly team-owned, not represented as implemented.

| Business element | Type | Home in stack | Notes |
| --- | --- | --- | --- |
| User | actor | `src/App.tsx` (team-owned future main UI) | One local user; no account or sharing layer. |
| Operating system | actor | `src-tauri/src/platform/Platform` (`platform/macos.rs`, `windows.rs` team-owned) | Current platform module defines seam; native implementations pending. |
| Maintainer | actor | `scripts/fetch-models.sh`, `src-tauri/src/engine/llama.rs` | Explicit model preparation and local engine; benchmark UI/script remains team-owned future work. |
| Knowledge | domain | `src-tauri/src/ingest.rs`, `pipeline.rs`, `store/` | Import, chunk, embed and retrieve. |
| Agents | domain | `src-tauri/src/templates.rs`, `store/`, `commands.rs` | Templates and agent operations. |
| Asking | domain | `src-tauri/src/pipeline.rs`, `prompt.rs` | Context, retrieval, answer and event flow. |
| Screen Help | domain | `src-tauri/src/platform/`, `pointer.rs`, `pipeline.rs` | Snapshot seam and pointer mapping; OS implementation pending. |
| Voice | domain | `src-tauri/src/model.rs` and `commands.rs` IPC contract; engine voice implementations team-owned future | `ptt_start`/voice types exist; mic, STT and TTS not implemented. |
| Setup and trust | domain | `src-tauri/src/commands.rs::setup_status`, `engine/` | Model/component status; real OS permissions depend on future platform implementations. |
| Knowledge base | entity | `src-tauri/src/model.rs`, `store/schema.sql` | One-to-many documents. |
| Document | entity | `model.rs`, `store/schema.sql`, `ingest.rs` | PDF/text ingestion present; DOCX/PPTX future. |
| Passage | entity | `model.rs`, `store/schema.sql`, `ingest.rs` | Location and embedding stored with source relation. |
| Agent | entity | `model.rs`, `store/schema.sql`, `commands.rs` | Active selection and CRUD. |
| Template | entity | `model.rs`, `templates.rs` | Built-in immutable templates. |
| Base rules | entity | `src-tauri/src/prompt.rs` | Prompt assembly and non-clicking/grounding instructions. |
| Session | entity | `pipeline.rs`, `store/` | Active agent and current turn state; guided-task storage/behavior not implemented. |
| Question | entity | `model.rs`, `pipeline.rs` | Typed request; voice input path not yet implemented. |
| Screen snapshot | entity | `model.rs`, `platform/mod.rs` | Shared contract exists; OS snapshot implementations pending. |
| Screen element | entity | `model.rs`, `pointer.rs` | Target identifier and geometry contract. |
| Answer | entity | `model.rs`, `pipeline.rs` | Turn result / streamed events. |
| Citation | entity | `model.rs`, `pipeline.rs`, `store/schema.sql` | Supplied passage references. |
| Guided task | entity | team-owned future `src-tauri/src/pipeline.rs` | S5 is not implemented/homed as behavior; no dedicated module yet. |
| Pointer | entity | `src-tauri/src/pointer.rs`, overlay team-owned future `src/overlay/` | Coordinate transform exists; rendering/window is future. |
| Permission | entity | `model.rs`, `commands.rs::permission_request`; OS implementations future | Shared types/command; native prompts/status pending. |
| Model set | entity | `engine/llama.rs`, `commands.rs::setup_status`, `scripts/fetch-models.sh` | Chat/embedding models; speech/vision models not included. |
| Measurement | entity | `model.rs` / turn latency in `pipeline.rs`; benchmark recording future team work | Per-answer elapsed latency exists; persisted benchmark records/display not implemented. |
| BR-1 | rule | `src-tauri/src/engine/llama.rs`, `scripts/fetch-models.sh` | Local inference, explicit download only; no runtime network in asking path. |
| BR-2 | rule | `src-tauri/src/store/schema.sql`, `store/` | Local SQLite persistence. |
| BR-3 | rule | Team-owned future `src-tauri/tauri.conf.json`, `src/overlay/` | Always-visible/share behavior not yet implemented. |
| BR-4 | rule | `src-tauri/src/pipeline.rs` | Citations derive from supplied retrieval context. |
| BR-5 | rule | `pipeline.rs`, `store/` | Retrieval is scoped to active-agent knowledge bases. |
| BR-6 | rule | `prompt.rs`, `pipeline.rs` | Grounding/no-answer instruction and answer flow. |
| BR-7 | rule | `pipeline.rs`, future answer UI `src/overlay/` | Backend citation payload; visible citation rendering pending. |
| BR-8 | rule | `store/` (future) | R5 small-library mode is not implemented; threshold remains open. |
| BR-9 | rule | `src-tauri/src/store/`, `engine/` | Ready-document top-five exact vector retrieval. |
| BR-10 | rule | `commands.rs`, `store/` | Active agent selection/update affects next turn. |
| BR-11 | rule | `store/`, `model.rs` | Agent knowledge-base limit. |
| BR-12 | rule | `prompt.rs` | Include/replace mode plus guarantees. |
| BR-13 | rule | `templates.rs`, `commands.rs` | Template-based independent editable agent creation. |
| BR-14 | rule | `prompt.rs`, `pipeline.rs` | Advice/pointing only; no app-control action. |
| BR-15 | rule | `model.rs`, `pointer.rs`, future `platform/*` | Target IDs belong to snapshot; native snapshots pending. |
| BR-16 | rule | `pipeline.rs`, `model.rs` | Null target / targetless answer behavior. |
| BR-17 | rule | `pointer.rs`, future `src/overlay/` | Pointer target geometry contract; one visible halo/panel placement pending UI. |
| BR-18 | rule | Future `model.rs` confidence + paired platform implementations | Image fallback and best-guess labeling are P1, not implemented. |
| BR-19 | rule | Future `pipeline.rs` guided-task state | S5 guided-task context is not implemented. |
| BR-20 | rule | `src-tauri/src/pointer.rs`; platform implementations future | Physical-coordinate mapping helper; native geometry pending. |
| BR-21 | rule | Future shared `Speaker` engine + `pipeline.rs` | Sentence-streaming TTS not implemented. |
| BR-22 | rule | `pipeline.rs` cancellation contract; future speaker | Text remains while speech cancellation awaits voice implementation. |
| BR-23 | rule | Future agent language/voice settings in `model.rs` and shared speaker | P1 language/voice behavior not implemented. |
| BR-24 | rule | `pipeline.rs` per-turn elapsed latency; benchmark future | Avoid unmeasured figures; benchmark record/display pending. |
| First run | flow | `commands.rs::setup_status`, `templates.rs`; future `src/App.tsx` | Backend pieces exist; onboarding and permissions UX pending. |
| Build a knowledge base | flow | `commands.rs::kb_*`, `doc_*`; `ingest.rs`, `store/` | Import and processing are implemented. |
| Make an agent | flow | `commands.rs::agent_*`, `templates.rs`, `store/` | Backend CRUD; UI pending. |
| Ask about the screen | flow | `commands.rs::ask`, `pipeline.rs`, `engine/`, future platform + overlay | Text question end-to-end exists; screen/voice portions future. |
| Ask without the screen | flow | `pipeline.rs`, `engine/`, `store/` | Text question retrieval/answer vertical slice exists. |
| Continue a guided task | flow | Future `pipeline.rs` | Not implemented. |
| Stop | flow | `commands.rs::stop`, `pipeline.rs` | Turn cancellation contract; speech silence awaits speaker. |
| Benchmark | flow | Future team-owned benchmark script and measurement store | Per-turn timing exists, repeat-run benchmark workflow does not. |
| Document Queued→Processing→Ready/Failed/retry/remove | state | `model.rs`, `ingest.rs`, `store/`, `commands.rs` | Import lifecycle and persistence. |
| Derived knowledge-base status | state | `store/` | Counts/status derived from documents. |
| Turn Listening→Transcribing→Thinking→Answering→Done / Cancelled / Failed | state | `pipeline.rs`, `model.rs` | Text path implemented; voice phases await mic/STT. |
| Pointer Idle→Thinking→Pointing→Speaking | state | `pointer.rs`, future overlay | Contract/geometry exists, visual behavior pending. |
| Guided task none→Active→Ended | state | Future `pipeline.rs` | P1 not implemented. |
| Permission Not asked→Granted/Denied | state | `model.rs`, `commands.rs`; future platform implementations | Shared contract only. |
| Model Missing→Present→Warm | state | `engine/llama.rs`, `commands.rs::setup_status` | Local load/readiness state. |
| INV-1 | invariant | `src-tauri/src/store/schema.sql`, `store/` | Ownership and cascading removal. |
| INV-2 | invariant | `schema.sql`, `ingest.rs` | Passage source and location. |
| INV-3 | invariant | `pipeline.rs` | Citation limited to supplied passage context. |
| INV-4 | invariant | `store/` | Agent references and maximum attachment constraint. |
| INV-5 | invariant | `store/`, `commands.rs` | Active agent invariant; first-run UI recovery pending. |
| INV-6 | invariant | `pipeline.rs`, future overlay/speaker | One target/one speech behavior across presentation; speech pending. |
| INV-7 | invariant | `engine/llama.rs`, `store/`, `pipeline.rs` | Local-only asking path. |
| INV-8 | invariant | `templates.rs` | Templates treated as read-only source values. |

## Orphans
Stage-1 elements with no implemented home in the stack yet (future ownership is named above).

- BR-3 — always-visible/share behavior awaits overlay/window configuration.
- BR-8 — R5 small-library mode and threshold are not implemented/decided.
- BR-18 — screenshot fallback and best-guess behavior are P1 and unimplemented.
- BR-19 and Guided task entity/state/flow — S5 has no implemented home.
- BR-21–23 — microphone/STT/TTS and language/voice behavior are not implemented.
- BR-24 benchmark record/display — only per-turn elapsed timing exists; measured multi-run benchmark workflow is future.
- Screen Help native snapshot/permission behavior and visual pointing — `Platform` contract exists, native OS implementations and overlay are pending.
- Measurement as a recorded benchmark entity — not persisted; current turn latency is not a substitute for benchmark records.
- P1 Word/PowerPoint documents and vision model set — not implemented.

## Unused components
Stack pieces no business element uses.

- None identified. Diagnostics and build tooling support operating and shipping the stage-1-driven local application; they do not add an unused product component.
