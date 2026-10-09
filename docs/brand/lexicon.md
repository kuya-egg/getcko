# GetcKo lexicon

One word per thing. This file is the controlled vocabulary for the app, the overlay, onboarding, marketing, slides, the pitch and the demo video. When a word here disagrees with older copy, this file wins and the older copy gets fixed.

- Code: `src/brand/lexicon.ts` (`T` for UI chrome, `say.en` / `say.tl` for GetcKo's own lines, plus `latencyLine`, `sourceLabel`, `fmtSeconds`; in-flight: `MEASURED`, `fmtBytes`, `fmtDate`, `fmtCount`, `fmtSpeed`). Import strings; don't retype them.
- Icons: `src/brand/icons.ts`, explained in `docs/brand/icons.md`.
- Agent short version: `.claude/skills/getcko-brand/references/lexicon.md`.
- Voice and Taglish rules: `docs/getcko-design-system.md` §11, `.claude/skills/getcko-brand/references/voice.md`.

---

## 1. Brand keywords

**Positioning line:** Help that sits right next to your cursor. Nothing leaves this Mac.
**Tagline:** Gets mo na. ("Now you get it.")
**Product line:** Help that sits right next to your cursor.
**North star:** The helper at your elbow.

### What GetcKo is

| Keyword | Meaning | In UI | In copy | In motion |
|---|---|---|---|---|
| **Beside** | Help sits next to the work, never on top of it. The user's screen is the hero. | Gecko lands 12px beside the target; the answer card flips corners so it never covers it. | "the **Save** button at the top right": always names the place. | 520ms flight that stops short of the target. |
| **Pointing** | GetcKo shows the way and explains. The user clicks. | One sun halo on one element. No "Do it for me" button anywhere. | Action first: "Click **Save**." Never "I'll do it." | Gecko → halo → words → source, in that order. |
| **On this Mac** (`T.keywords`, was "Local") | Everything runs on this Mac. Works with Wi-Fi off. | Offline chip in every answer card and the session bar. | "on this Mac", "Offline", "Nothing leaves this Mac." | No loading spinners that pretend to call a server. |
| **Honest** | Only measured numbers, only real sources, "I don't know" when it doesn't. | Mono `0.9 s · on this Mac`; source chip on every grounded answer; "Best guess" label on screenshot answers. | "Hindi ko alam. Wala ito sa mga document mo." | Halo pulses twice, then holds. No fake liveliness. |
| **Patient** | A calm officemate for people new to computers. | 44px targets, plain labels, one primary button per screen. | Short sentences, no jargon, no blame. | Quick, calm UI (140–360ms). Nothing bounces except the gecko. |
| **Pinoy** | Made for Filipino offices and classrooms; Taglish is first-class. | Answer language: English, Filipino, Taglish. | English nouns for software, Filipino glue: "I-click mo ang **Save**." | n/a |
| **Pixel-plain** | Paper, ink, one green creature, one yellow ring. | Integer-scaled sprite, flat surfaces, dither instead of gradients. | Silkscreen badge "Gets mo na." once, beside the gecko. | Stepped sprite frames, pixel-snapped flight. |

### What GetcKo is not

| Not | Why |
|---|---|
| **Magic** | It reads the accessibility tree and your documents. Say how, not "magic". |
| **Autonomous** | It never clicks or types for the user. No "agentic" or "autopilot" language. |
| **Cloud / connected** | No accounts, no sync, no servers. Never imply data goes anywhere. |
| **Stealthy** | It is visible on screen share. No "invisible", "undetectable", "hidden". |
| **Cute at the user's expense** | No "Oops!", no mascot jokes about mistakes, no waving gecko next to an error. |

---

## 2. Canonical terms

Casing is exact. "UI" means words the user reads or hears; "internal" means code, specs, tickets and team talk. Taglish examples apply only when the agent language is Taglish; UI chrome stays English.

### 2.1 Names and things

| Concept | Canonical term | Definition | Where it appears | Banned synonyms | English example | Taglish example |
|---|---|---|---|---|---|---|
| Product | **GetcKo** | The app. Spelled GetcKo: lowercase c, capital K (decided Oct 9). From "gecko" + "gets ko". | Everywhere. | GetCko, Getcko, GETCKO, Get Cko, GetCKO, Gecko (as the name), "the app" in marketing | GetcKo works with Wi-Fi off. | Gumagana ang GetcKo kahit naka-off ang Wi-Fi. |
| Mascot | **GetcKo** | The pixel sprite. Same name as the product, never a separate character name. | Answer card header, empty states, onboarding, video. | the gecko (in UI), mascot (in UI), buddy, little guy, Cko, lizard, bot | GetcKo points at the **Save** button. | Itinuturo ni GetcKo ang **Save** button. |
| Category descriptor | **desktop helper** | What kind of thing GetcKo is, when a noun is needed. | Store blurb, README, pitch. | AI assistant, your AI assistant, copilot, chatbot, bot, AI companion | A private desktop helper that works offline. | n/a (marketing stays English) |
| Agent | **agent** | A saved preset: name, instructions, knowledge bases, language, voice. One per session. | Agents screen, session bar chip, answer card header. | assistant, helper, copilot, bot, persona, profile, preset (in UI), mode | Start the Office Helper agent. | I-start mo ang Office Helper agent. |
| Template | **template** | A ready-made agent you copy and edit: Office Helper, Teacher, Study Buddy, Taglish Explainer. | Templates strip on the Agents screen. | preset, starter, blueprint, example agent, recipe | Use the Teacher template, then add your grade sheet guide. | Gamitin mo ang Teacher template, tapos i-add ang grading guide. |
| Template names | **Office Helper**, **Teacher**, **Study Buddy**, **Taglish Explainer** | Proper names. The only Title Case allowed besides GetcKo and Screen Help. | Template cards, demo. | Office Assistant, Teacher Mode, Study Helper | n/a | n/a |
| Knowledge base | **knowledge base** | A named collection of documents an agent can use (up to 5 per agent). | Knowledge bases screen, agent editor. | library, docs, files, folder, collection, corpus, KB (in UI), vault, memory | Attach the Office manual knowledge base. | I-attach mo ang Office manual na knowledge base. |
| Document | **document** | One imported file in a knowledge base (.pdf, .txt, .md; later .docx, .pptx). | Knowledge-base rows, empty states, "Add documents". | file (as the concept), doc, upload, attachment, resource, source file | Add your office manual as a document. | I-add mo ang office manual bilang document. |
| Passage | **passage** | A 300–500 token piece of a document, embedded and stored on the device. | Knowledge-base row meta only ("24 pages · 61 passages"). | chunk, snippet, segment, embedding, vector, node | 61 passages, ready. | n/a (meta stays English) |
| Source | **source** | The document and page or heading an answer came from. Shown as a chip: `Manual · p. 4`. | Answer card footer, "Try it" chat. | citation (in UI), reference, footnote, ref, link, evidence | Source: Manual · p. 4 | (Manual, p. 4) |
| Answer | **answer** | What GetcKo says back. Action, then reason, then source. | Answer card, "Answer out loud", "Answer language", "Answer length". | response, reply, output, result, completion, message, generation | GetcKo's answer cites your manual. | May source ang sagot ni GetcKo mula sa manual mo. |
| Question | **question** | What the user asks, by voice or text. | Composer label, answer card question strip. | prompt, query, message, input, request, command | Your question | Ang tanong mo |
| Screen Help | **Screen Help** | The feature: GetcKo reads the focused app's accessibility tree and points at the right element. Feature name, so title case. | Composer button, session bar, onboarding, pitch. | point mode, guide, guide me, show me, screen assist, screen reader, pointer mode, vision mode | Press Screen Help, then ask where to click. | I-press mo ang Screen Help, tapos itanong kung saan ka magki-click. |
| Target | **target** (internal) | The one element GetcKo points at; it wears the sun halo. In UI, name the element itself ("the **Save** button"). | Specs, code (`target-halo`), design files. | hotspot, highlight, selection, focus, element (in UI), spot | Click **Save** at the top right. | I-click mo ang **Save** sa taas, kanan. |
| Point (verb) | **point** | What GetcKo does at a target. It never clicks. | Copy, pitch, aria-labels. | click (for GetcKo), highlight, guide, show, select, tap, navigate | GetcKo points; you click. | Si GetcKo ang tuturo, ikaw ang magki-click. |
| Halo | **halo** (internal) | The sun-yellow ring on the target. | Specs and code only. | glow, outline, ring (in specs), spotlight | n/a | n/a |
| Overlay | **overlay** (internal) | The transparent, always-on-top window that draws GetcKo and the answer card over other apps. Users never need the word. | Code, specs. | popup, HUD, floating window, widget, bubble | n/a | n/a |
| Answer card | **answer card** | The panel in the overlay with the question, answer, sources and speed figure. | Specs, code (`AnswerCard`). In UI only via "Close answer". | popup, toast, chat window, result panel | Close answer | n/a |
| Session bar | **session bar** | The dark pill with the agent chip, Hold to talk, Screen Help, Stop speaking and the shortcut hint. | Specs, code (`SessionBar`). | toolbar, dock, launcher, pill, control bar, widget | n/a | n/a |
| Composer | **composer** (internal) | The input row: text field, Hold to talk, Screen Help, Ask. Users see its placeholder only. | Specs, code (`Composer`). | chat box, input bar, prompt box, search bar | Ask about your screen or your documents | n/a (placeholder stays English) |
| Try it chat | **Try this agent** | The unsaved test chat on the agent page. Section eyebrow "Try it". | Agent editor. | playground, sandbox, preview, test mode | Try this agent. This test chat is not saved. | n/a |
| Instructions | **instructions** | The agent's plain-language rules. | Agent editor. | system prompt, prompt, persona, rules (alone) | Tell GetcKo how to help. | n/a |
| Base rules | **base rules** | GetcKo's built-in rules the agent can include or replace. | Agent editor toggle "Include GetcKo's base rules". | system prompt, core prompt, guardrails, defaults | Include GetcKo's base rules | n/a |

### 2.2 Input, output and keys

| Concept | Canonical term | Definition | Where it appears | Banned synonyms | English example | Taglish example |
|---|---|---|---|---|---|---|
| Shortcut | **shortcut** | The global key combo that opens GetcKo from any app: `⌥ Space` (macOS), `Ctrl Space` (Windows). Always shown as keycaps. Code name stays `hotkey`. | Session bar hint, onboarding, Settings. | hotkey (in UI), keybind, hot key, key combo, trigger | Press ⌥ Space in any app to ask. | I-press mo ang ⌥ Space sa kahit anong app. |
| Voice question | **Hold to talk** | Hold the mic button (or shortcut) and speak; release to send. PRD says "push-to-talk"; UI says Hold to talk because it describes the gesture. | Mic button label and aria-label. | push to talk, push-to-talk (in UI), PTT, dictate, voice mode, record, speak now | Hold to talk, then let go. | I-hold mo para magsalita, tapos bitawan. |
| Spoken answers | **Answer out loud** | The agent setting that makes GetcKo speak each answer. Verb: GetcKo **speaks**. | Agent editor toggle, help text. | read aloud, TTS, text-to-speech, voice output, narrate, speak mode | GetcKo speaks each answer. Esc stops it. | Sasabihin ni GetcKo ang bawat sagot. Esc para tumigil. |
| Voice | **voice** | Which installed OS voice the agent speaks with, plus Speaking speed. Only this meaning. | Agent editor "Voice and language". | TTS voice, speaker, narrator, avatar voice | Voice: Samantha. Speaking speed: 1.0×. | n/a |
| Answer language | **Answer language** | English, Filipino or Taglish. | Agent editor, agent card chip. | locale, mode, dialect | Answer language: Taglish | n/a |

### 2.3 Status, place and numbers

| Concept | Canonical term | Definition | Where it appears | Banned synonyms | English example | Taglish example |
|---|---|---|---|---|---|---|
| Working | **Processing** | A document is being read, split and embedded. | Status chip. | Loading, Indexing, Importing, Syncing, Uploading, Analyzing, Working | Processing | Processing |
| Done | **Ready** | Usable now. | Status chip, onboarding finish. | Done, Complete, Indexed, Success, Available, Synced | Ready | Ready |
| Error | **Failed** + reason | Did not work; always followed by the reason. `Failed: scanned PDF`. | Status chip. | Error, Oops, Something went wrong, Problem, Broken, Unavailable | Failed: scanned PDF | Failed: scanned PDF |
| No network, by design | **Offline** | The steady state. A proud fact, not a warning. | Chip in the answer card and session bar. | Local mode, Airplane mode, Disconnected, No connection, On-device mode, Private mode | Offline | Offline |
| Listening | **Listening** | Mic is open while the user holds to talk. | Session bar, mic aria-label. | Recording, Hearing, Capturing | Listening... | Nakikinig ako... |
| Thinking | (the thinking pose) | GetcKo is reading the screen or documents. Shown by the sprite, plus the line below. | Overlay. | Loading, Generating, Processing (here), bouncing dots | Looking at your screen... | Tinitingnan ko ang screen mo... |
| Screenshot answer | **Best guess** | Label on an answer that came from the screenshot fallback, not the accessibility tree. | Answer card chip. | approximate, low confidence, beta, estimated | Best guess | Best guess |
| No source found | **I don't know** | The honest answer when retrieval finds nothing. | Answer text. | "I'm not sure, but...", any invented source | I don't know. It's not in your documents. | Hindi ko alam. Wala ito sa mga document mo. |
| Where it runs | **on this Mac** (`on this PC` on Windows) | Location of every model, file and number. | Speed figure, file hints, Settings, marketing. | local, locally, on-device, on the edge, in your browser, offline-first | Stays on this Mac. | Nandito lang sa Mac na ito. |
| Privacy proof | **Nothing leaves this Mac.** | The privacy sentence. One wording only. | Onboarding, Settings, marketing. | 100% private, secure by design, military-grade, your data is safe with us, any other privacy wording | macOS asks once. Nothing leaves this Mac. | Isang beses lang magtatanong ang macOS. Walang lalabas sa Mac na ito. |
| Speed figure | **`0.9 s · on this Mac`** | A measured time, mono, one decimal, a space before `s`, middle dot, place. From `MEASURED` (mirrors `docs/MODELS.md`) only; "TBD" there means show nothing (`<Stat value={null}>` renders nothing). | Answer card footer, pitch proof slide. | instant, lightning-fast, real-time, 0.9s, 900ms (for anything over 1 s), ~1 sec | 0.9 s · on this Mac | same |
| Throughput | **`42 tokens/s · on this Mac`** | Whole number, `tokens/s`. Measured only. | Pitch proof slide, Settings > Models. | tok/s, t/s, TPS | 42 tokens/s · on this Mac | same |

### 2.4 Onboarding and settings

| Concept | Canonical term | Definition | Where it appears | Banned synonyms | English example | Taglish example |
|---|---|---|---|---|---|---|
| Permission 1 | **Accessibility** | macOS permission that lets GetcKo read the app's elements (AX tree). Use Apple's exact name. | Onboarding step, Settings > Permissions. | AX, accessibility access (lowercase), screen reader access, control permission | Turn on Accessibility for GetcKo. | I-on mo ang Accessibility para kay GetcKo. |
| Permission 2 | **Screen Recording** | macOS permission for the screenshot fallback. Use Apple's name; newer macOS shows "Screen & System Audio Recording", so match what the user's System Settings shows if we detect it. | Onboarding step, Settings > Permissions. | screen capture, screen access, screen sharing, recording permission | Turn on Screen Recording for GetcKo. | I-on mo ang Screen Recording para kay GetcKo. |
| Permission 3 | **Microphone** | macOS permission for Hold to talk. | Onboarding step 3, Settings > Permissions. | mic access, audio permission, recording | Turn on Microphone for GetcKo. | I-on mo ang Microphone para kay GetcKo. |
| Permission state | **Turned on** / **Waiting for macOS…** / **Check again** | Granted chip, waiting line, re-check button. Steps run Accessibility → Screen Recording → Microphone → Shortcut. | Onboarding, Settings > Permissions. | Granted, Allowed, Enabled, Pending, Refresh, Retry | Turned on | n/a |
| OS settings app | **System Settings** | macOS app (Windows: **Settings**). | "Open System Settings" button (no keycap). | System Preferences, Control Panel (on macOS) | Open System Settings | n/a |
| GetcKo's settings | **Settings** | GetcKo's own settings screen. | Nav, window menu. | Preferences, Options, Config, Configuration, Setup | Settings | n/a |
| Theme | **Theme**: Light, Dark, Match system | Color theme. | Settings. | Appearance, Mode, Dark mode toggle, Skin | Theme: Match system | n/a |

### 2.5 Actions (button labels)

Verb first, sentence case, no trailing period. Icon-only buttons use the same words as their `aria-label`.

| Action | Canonical label | Where | Banned | Note |
|---|---|---|---|---|
| Send a question | **Ask** | Composer primary | Send, Submit, Go, Enter, Search | "Ask" is the verb the user already has in mind. |
| Activate an agent | **Start** | Agent card primary. aria-label `Start {agent}` | Launch, Activate, Use, Run, Open, Start agent | Card already names the agent. PRD voice table says "Start agent"; we pick "Start" because the card shows the name. |
| Create agent | **New agent** | Agents header, dashed card | Create agent, Add agent, + Agent, Build an agent | |
| Copy a template | **Use template** | Template card | Clone, Duplicate template, Start from template | |
| Import | **Add documents** | Knowledge-base screen, empty state | Upload, Import, Add files, Browse, Drop files | Nothing is uploaded, so never "Upload". |
| Create knowledge base | **New knowledge base** | Knowledge bases header | Create library, Add KB | |
| Test chat | **Try this agent** | Agent editor | Test, Preview, Playground | |
| Voice question | **Hold to talk** | Mic button | Push to talk, Record, Speak | |
| Screen Help | **Screen Help** | Composer and session bar button | Point, Guide me, Show me, Scan | |
| Stop speech | **Stop speaking** | Answer card, session bar. Key: Esc | Stop, Mute, Pause, Cancel, Shut up | Always says what stops. |
| Continue a task | **Next step** | Answer card during multi-step help | Next, Continue, Go on, Proceed | GetcKo's spoken line: "Next, open the Grades tab." |
| After an error | **Try again** | Error block | Retry, Reload, Refresh, Redo | Code and icon key stay `retry`. |
| Permission | **Open System Settings** / **Check again** / **Not now** | Onboarding | Grant access, Allow, Skip, Later, Maybe later, Refresh | No keycap inside "Open System Settings". |
| Dismiss | **Close answer** | Answer card icon button | Dismiss, Hide, X | |
| Expand | **More** / **Less** | Answer card | Show more, Read more, Expand | |
| Agent row | **Edit**, **Duplicate**, **Delete** | Agent menu | Remove (for agents), Copy, Clone | "Remove" is only for a document leaving a knowledge base. |

---

## 3. Decisions where the docs disagreed

| Conflict | Sources | Decision |
|---|---|---|
| "push-to-talk" vs "Hold to talk" | PRD T2 vs design system §7–8, components | **Hold to talk** in UI. "push-to-talk" stays in PRD and engineering. |
| "desktop copilot" vs helper | PRD overview vs north star "The helper at your elbow" | **a private, offline desktop helper** everywhere, including DESIGN.md, PRODUCT.md and the skill (v0.4). "Copilot" is a Microsoft product name and reads as generic AI. Only the PRD keeps its original wording. |
| Privacy line wording | design system §11 vs §9.1 (v0.3) | **Nothing leaves this Mac.** (Windows: "this PC"). Matches "on this Mac". Fixed in every doc in v0.4. |
| "Start" vs "Start agent" | design system §8 / AgentCard vs voice.md | **Start** on the agent card, aria-label `Start {agent}`. |
| "Retry" vs "Try again" | design system §9.5 "retry button" vs ErrorBlock default | **Try again** on the button. |
| "library" | PRD R7 "large libraries" | **knowledge base**. "library" is banned even internally to avoid a second noun. |
| "citation" vs "source" | PRD R4/§8 "citation chip" vs answer copy | **source** in UI. `CitationChip` stays as a component name; "cite" is fine as a verb ("GetcKo can cite it"). |
| "Hindi ko alam. Wala ito sa mga document na in-add mo." vs "...mga document mo." | design system §11 bullet vs table | **"Hindi ko alam. Wala ito sa mga document mo."** (shorter). |
| "hotkey" vs "shortcut" | PRD, platform.ts vs design system §7 "Shortcut" | **shortcut** in UI, `hotkey` in code. |
| "speak / voice / TTS" | PRD §4 "TTS", design system "Speak / voice", "Answer out loud" | Setting: **Answer out loud**. Verb: **speaks**. Button: **Stop speaking**. **voice** means only the chosen OS voice. |
| Brand keyword "Local" | `T.keywords` v0.3 | **On this Mac**: "local" is banned in visible text, so the keyword could not be. |
| Mascot "GetcKo" vs "the gecko" | design system §10 vs specs | **GetcKo** in all user-facing text. "the gecko" or "the sprite" only in design and engineering docs about drawing it. |

---

## 4. Writing rules

1. **Sentence case** everywhere: buttons, headings, menu items, chips, slides, video titles. Exceptions are proper names only: GetcKo, Screen Help, template names, Accessibility, Screen Recording, System Settings, Wi-Fi, macOS, Windows.
2. **Verbs on buttons**, verb + object when the object isn't obvious: "Add documents", "Stop speaking". Never "OK", "Submit", "Yes", "Let's go".
3. **Answers**: action → reason → source. Name the element in words ("the **Save** button") so the halo is never the only signal.
4. **Numbers**: measured only. One decimal for seconds with a space (`0.9 s`); whole numbers for counts and `tokens/s`; middle dot ` · ` between value and place; `font-mono nums`. Pages: `p. 4`. Sizes: `3.6 GB`. Never a number from marketing claims, never "up to".
5. **Place**: "on this Mac" / "on this PC". Never "local", "on-device", "edge" in UI.
6. **Statuses** are one word: Processing, Ready, Failed, Offline. Failed always gets a reason.
7. **Errors**: what happened → what to do → Try again. Never blame the user, never "Oops!", never "Something went wrong".
8. **Banned words**: AI-powered, AI assistant, your AI assistant, copilot, magic, magical, smart (as a selling word), seamless, supercharge, unleash, revolutionize, game-changer, cutting-edge, effortless, intelligent, agentic, autopilot, Oops!, Something went wrong, Let's dive in, Welcome aboard.
9. **Punctuation**: no exclamation marks except "Ready ka na!" once at onboarding finish. No emoji. Ellipsis only on live status lines ("Listening...").
10. **Taglish**: only for GetcKo's own lines when the agent language is Taglish or Filipino. English nouns for software things (cell, button, file, settings, Wi-Fi, document, screen); standard verb forms `i-click`, `i-save`, `i-add`, `in-add`. No deep formal Filipino, no "lodi"/"petmalu".
11. **Show, don't tell**: headline ≤ 6 words; body ≤ 1 line (~60 ch) in the app, ≤ 2 lines in marketing. Anything longer becomes `Kw` keyword chips (max 3 per block), `Steps` (1→2→3), a diagram or motion. No paragraphs in explanatory or pitch UI: a judge must get it at first glance.
12. **Numbers** come from the helpers: `fmtSeconds`, `fmtSpeed`, `fmtBytes`, `fmtCount`, `fmtDate`, `latencyLine`, `sourceLabel`. Never format by hand.
13. **Pronouns**: GetcKo speaks as "I" in answers ("I can't read this PDF"). UI chrome talks about GetcKo in third person ("GetcKo speaks each answer"). The user is "you"; never "we" for GetcKo.
