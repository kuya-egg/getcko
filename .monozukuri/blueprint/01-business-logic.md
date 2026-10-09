# Business logic — GetCko (Local AI Desktop Copilot)

Source of intent: `docs/getcko-prd-v1.md` (framed problem, users, goals, non-goals) and
`docs/getcko-design-system.md` (mascot states, copy rules). Requirement IDs (R*, A*, S*, T*)
refer to the PRD. Priority tags: **P0** = demo, **P1** = product feel, **P2** = only if ahead.

## Overview

GetCko is a visible helper that sits next to the cursor on the user's own computer. The user
asks a question — by voice or by typing — about what is on their screen or in their own
documents. GetCko answers out loud, shows where the answer came from, and points a gecko at
the on-screen element the user should use. Everything happens on the user's machine: the
question, the screen, the documents and the answer never leave it, and it works with the
network switched off. GetCko only points and explains; the user always does the clicking.

## Actors and roles

- **User** — one person on their own computer; the only human role (no accounts, no sharing).
  Wants "where do I click, and why?" answered on their own screen, grounded in their own
  documents, privately and offline. May: manage knowledge bases and documents, manage agents,
  pick the active agent, ask questions, continue or abandon a guided task, stop speech, grant
  or refuse screen permissions.
  - Personas (same role, different motive): new-to-the-software worker (LGU staff, teacher,
    office worker); professional with confidential files; person with poor or costly internet.
- **Operating system** (external) — reports what is on screen (the elements of the focused
  app with their role, label, value and position), supplies installed voices, and grants or
  denies the screen-reading and screen-capture permissions. GetCko cannot work around a denial.
- **Maintainer** (the team) — prepares the machine before use (fetches the models once),
  runs the benchmark, and publishes the measured numbers GetCko displays.

## Domains

- **Knowledge** — turning the user's files into searchable, cited passages and finding the
  passages relevant to a question.
- **Agents** — saved presets that decide how GetCko behaves: instructions, attached knowledge,
  language, answer length, voice.
- **Asking** — taking one question plus its context (screen, passages, agent) to one answer
  with citations; owns the grounding rules.
- **Screen Help** — reading the current screen, choosing the target element, placing the
  pointer, and carrying a multi-step guided task.
- **Voice** — hearing a spoken question and speaking the answer.
- **Setup and trust** — first-run permissions, model presence, the offline guarantee, and
  measured performance figures.

## Entities and relationships

- **Knowledge base** — a named collection of documents. Attributes: name, created time,
  derived status, document count, passage count.
- **Document** — one imported file. Attributes: file name, kind (Markdown, plain text,
  text PDF; P1: Word, PowerPoint), page count where meaningful, status, failure reason,
  content fingerprint.
- **Passage** — a contiguous slice of a document, a few paragraphs long (~300–500 tokens) and
  overlapping its neighbours. Attributes: text, source document, location (page number or
  heading path), its meaning-fingerprint used for similarity search.
- **Agent** — a saved preset. Attributes: name, one-line description, instructions,
  base-rules mode (*include* or *replace* GetCko's base rules), attached knowledge bases,
  answer language (English, Filipino, Taglish — P1), answer length, voice and speaking speed
  (P1), template origin (if any).
- **Template** — a built-in, read-only agent blueprint: Office Helper, Teacher (DepEd forms),
  Study Buddy, Taglish Explainer.
- **Base rules** — GetCko's built-in behaviour rules (grounding, honesty, brevity, "point,
  never click"). Fixed text; an agent includes or replaces them.
- **Session** — the period the app is running with one active agent. Holds the active agent
  and at most one guided task.
- **Question** — what the user asked. Attributes: text (typed or transcribed), mode (voice or
  text), whether screen help was requested, time asked.
- **Screen snapshot** — the list of elements the operating system reports for the focused app
  at the moment of the question, each with a short identifier, role, label, value and on-screen
  position; or, when that list is empty and the fallback is enabled (P1), a captured image.
- **Screen element** — one item of a snapshot. Has a position on screen.
- **Answer** — GetCko's reply to one question. Attributes: text (1–2 sentences for screen
  help; leads with the action, then the reason, then the source), citations, target element
  (optional), confidence label (*normal* or *best guess*), measured latency.
- **Citation** — a reference from an answer to a passage actually supplied for that answer;
  shown as "document · page/section".
- **Guided task** (P1) — a multi-step goal the user is being walked through. Attributes:
  goal, steps taken (≤ 5), last target.
- **Pointer** — the on-screen gecko. Attributes: state (Idle, Thinking, Pointing, Speaking),
  current target position.
- **Permission** — screen-reading permission and screen-capture permission, each with a
  status.
- **Model set** — the local language, meaning-fingerprint, speech-recognition and vision
  models GetCko needs. Attribute: present / missing.
- **Measurement** — a recorded performance figure (step, value, machine, date, how produced).

Relationships:

- Knowledge base *owns* Documents (one-to-many); Document *owns* Passages (one-to-many).
- Agent *references* Knowledge bases (many-to-many, at most 5 per agent).
- Agent *may originate from* one Template (copy, no live link).
- Agent *includes or replaces* Base rules.
- Session *has* exactly one active Agent and at most one Guided task.
- Question *produces* at most one Answer; Answer *has* zero or more Citations; Citation
  *references* exactly one Passage.
- Question *may take* one Screen snapshot; Answer *may target* one Screen element of that
  snapshot.
- Guided task *spans* up to 5 Question/Answer pairs.

## Business rules

Privacy and offline

- **BR-1** Nothing in the asking path — listening, reading the screen, searching documents,
  answering, speaking — sends any data off the computer. The only network use ever is the
  maintainer's one-time model download before use.
- **BR-2** Documents, passages, agents and screen contents are stored only on the user's
  computer.
- **BR-3** GetCko is always visible: it never hides from screen sharing or the app switcher
  and has no covert mode.

Grounding and honesty

- **BR-4** An answer may cite only passages that were actually supplied for that answer. A
  citation to anything else is forbidden.
- **BR-5** When the active agent has knowledge bases, facts about documents come only from
  passages of *those* knowledge bases; knowledge bases not attached to the active agent are
  never searched.
- **BR-6** When neither the supplied passages nor the current screen support an answer,
  GetCko says it doesn't know instead of guessing.
- **BR-7** Every answer that uses a passage shows at least one citation (document plus page or
  section).
- **BR-8** (P1) When all passages of the active agent's knowledge bases together fit under the
  small-library threshold, all of them are supplied instead of a searched subset.
- **BR-9** Retrieval returns the 5 passages most similar in meaning to the question, from
  Ready documents only.

Agents

- **BR-10** Exactly one agent is active at a time. Changing the active agent, or editing it,
  takes effect from the next question.
- **BR-11** An agent attaches at most 5 knowledge bases.
- **BR-12** With base-rules mode *include*, the agent's instructions are added to the base
  rules; with *replace*, only the agent's instructions apply. BR-1, BR-4 and "point, never
  click" (BR-14) still hold in *replace* mode — they are product guarantees, not agent
  behaviour.
- **BR-13** Using a template creates a new, editable agent; templates themselves never change.
  Duplicating an agent creates an independent copy.

Screen Help

- **BR-14** GetCko never clicks, types or otherwise acts on the user's apps. It only points
  and explains.
- **BR-15** The target is chosen by identifier from the current screen snapshot. GetCko never
  points at a position that does not belong to a snapshot element.
- **BR-16** If no element fits, GetCko answers without pointing and says so.
- **BR-17** At most one element is targeted at a time. The gecko sits *beside* the target and
  GetCko's own panel never covers it.
- **BR-18** (P1) An answer produced from a captured image instead of the element list is
  labelled "best guess".
- **BR-19** (P1) A guided task keeps its context for at most 5 steps; "next" continues it from
  a fresh snapshot.
- **BR-20** The pointer lands on the element's true position on the display it is on,
  regardless of display scaling or which monitor it is on.

Voice

- **BR-21** Every answer is spoken. Speech starts as soon as the first full sentence is
  ready; later sentences follow as they complete.
- **BR-22** Stop silences speech immediately and discards the rest of the current answer's
  speech; the answer text stays on screen.
- **BR-23** (P1) Answer text follows the agent's language. The voice follows it too when a
  matching voice is installed; otherwise an English voice reads the text, and the text stays
  in the chosen language.

Trust and numbers

- **BR-24** Every speed figure GetCko shows is a measured value from this machine (the
  answer's own latency, or a recorded measurement with how it was produced). No estimated or
  vendor-quoted figure is shown as GetCko's.

## Primary flows

1. **First run**: User opens GetCko -> GetCko checks the model set (missing -> tells the user
   the maintainer setup is incomplete; nothing is downloaded silently) -> GetCko asks for
   screen-reading and screen-capture permission -> User grants or skips -> User picks a
   template -> an editable agent is created and made active.
2. **Build a knowledge base**: User creates a knowledge base -> adds files -> each document is
   read, split into passages with their locations, fingerprinted for meaning, and marked
   Ready (or Failed with a reason) -> knowledge base shows document and passage counts.
3. **Make an agent**: User starts from a template or blank -> sets name, instructions,
   base-rules mode -> attaches up to 5 knowledge bases -> (P1) sets language, voice, speed ->
   saves -> (P1) optionally "Try this agent" in an unsaved test chat.
4. **Ask about the screen (main demo)**: User presses the hotkey and holds to talk -> GetCko
   transcribes the question (gecko: Thinking) -> takes a screen snapshot of the focused app ->
   retrieves passages from the active agent's knowledge bases -> produces one answer: target
   element, 1–2 sentence explanation, citations -> gecko moves beside the target and the
   target is haloed (Pointing) -> answer is spoken sentence by sentence (Speaking) -> latency
   shown -> gecko returns to Idle.
5. **Ask without the screen**: same as flow 4 but typed or spoken without screen help; no
   snapshot, no pointer; answer is text plus speech plus citations.
6. **Continue a guided task** (P1): after an answer, User says or presses "next" -> fresh
   snapshot -> next target and explanation, with the task's earlier steps as context -> ends
   when the goal is reached, the user abandons it, or 5 steps pass.
7. **Stop**: User presses the stop hotkey at any time -> speech stops at once; any in-progress
   answer is cancelled; gecko returns to Idle.
8. **Benchmark**: Maintainer runs the benchmark on the demo machine -> each step of the
   asking path is timed over repeated runs -> results recorded as measurements -> those are
   the only figures shown in the app and pitch.

## State transitions

- Document: Queued --processing starts--> Processing --all passages stored--> Ready
- Document: Processing --unreadable / no text / unsupported--> Failed (with reason)
- Document: Failed --user retries--> Processing
- Document: Ready | Failed --user removes--> (gone, with all its passages)
- Knowledge base (derived): Processing while any document is Queued/Processing; otherwise
  Ready if at least one document is Ready; Empty if it has no documents; Failed if every
  document Failed.
- Question/answer turn: Listening --hotkey released--> Transcribing --text ready--> Thinking
  --first sentence ready--> Answering --last sentence spoken--> Done
- Turn: any state --stop--> Cancelled; any state --unrecoverable error--> Failed (user sees
  the reason)
- Pointer: Idle --question accepted--> Thinking --answer has target--> Pointing
  --speech starts--> Speaking (still beside target) --speech ends or stop--> Idle;
  Thinking --answer has no target--> Speaking
- Guided task (P1): (none) --screen-help answer--> Active(step 1) --"next"--> Active(step n+1)
  --goal reached | abandoned | step 5 done--> Ended
- Permission: Not asked --prompted--> Granted | Denied; Denied --user grants later in system
  settings--> Granted
- Model set: Missing --maintainer setup--> Present --app start--> Warm (loaded, ready to answer)

## Invariants

- **INV-1** Every passage belongs to exactly one document, and every document to exactly one
  knowledge base; removing a parent removes its children.
- **INV-2** Every passage records its source document and its location (page or heading).
- **INV-3** Every citation on an answer references a passage supplied for that answer.
- **INV-4** No agent references more than 5 knowledge bases, and none references a knowledge
  base that no longer exists.
- **INV-5** There is exactly one active agent whenever the app is running and at least one
  agent exists.
- **INV-6** At most one target element is haloed, and at most one answer is being spoken.
- **INV-7** No data leaves the computer during use (BR-1).
- **INV-8** Templates are unchanged by any user action.

## Edge cases

- Scanned PDF with no text layer -> document Failed: "No text found (scanned PDF?)".
- Unsupported file type dropped -> rejected before import with the reason; nothing stored.
- Same file added twice to one knowledge base (same content fingerprint) -> not duplicated;
  user told it is already there.
- Very large file -> processed in the background; knowledge base stays usable with its other
  Ready documents; questions only see Ready documents.
- Knowledge base removed while attached to agents -> detached from those agents; agents remain.
- Last agent deleted -> user is sent to pick a template; asking is disabled until an agent
  exists.
- Agent has no knowledge bases -> answers come from the screen only; no citations; documents
  never claimed.
- Nothing relevant retrieved and the screen doesn't answer it -> "I don't know" (BR-6); no
  citation.
- Screen-reading permission denied -> screen help unavailable with a clear prompt to grant it;
  document questions still work.
- Focused app reports no elements (canvas, image, thin app) -> P0: answer without pointing and
  say the app can't be read; P1: captured-image fallback, answer labelled "best guess".
- Focused app is GetCko itself -> ignore GetCko's own windows and read the previously focused
  app.
- Target element is off-screen or on another monitor -> point at it where it is; if it has no
  visible position, answer without pointing (BR-16).
- Screen changes between snapshot and pointing (window moved/closed) -> pointer shows the
  snapshot position; the next question takes a fresh snapshot. (No live tracking.)
- Push-to-talk shorter than ~0.3 s or silent -> no question; gecko back to Idle.
- New question while an answer is still being spoken -> current speech stops; new turn begins.
- Agent language Filipino/Taglish, no Filipino voice installed -> English voice reads the
  text; text stays in the chosen language (BR-23).
- Model set missing at start -> GetCko does not attempt any download; shows that setup is
  incomplete.
- Guided task reaches step 5 -> task ends; GetCko says so and the next question starts fresh.
- "Try this agent" chat -> nothing saved, not even the turns.

## Open questions

- Which demo apps have the richest on-screen element lists (Numbers, Excel, Finder, Safari,
  Chrome)? Decides the scripted tasks for the 8/10 pointing target.
- Is a Filipino voice installed or installable on the demo machine?
- Which document is the demo knowledge base: an office manual, the DepEd grading guide, or the
  team's own?
- When an agent has knowledge bases, may GetCko also use the model's general knowledge (marked
  uncited), or is it strictly screen + passages (current rule BR-5/BR-6)?
- Small-library threshold for BR-8 (P1): what size counts as "small"?
- Answer length setting: fixed choices (short / normal) or free?
