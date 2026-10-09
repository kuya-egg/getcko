# Lexicon (agent version)

Full version: `docs/brand/lexicon.md`. Strings in code: `src/brand/lexicon.ts` (`T` = English UI chrome; `say.en` / `say.tl` / `linesFor(lang)` = GetcKo's own lines; `latencyLine(s)`, `sourceLabel(doc, page)`, `fmtSeconds`; in-flight: `MEASURED`, `fmtBytes`, `fmtDate`, `fmtCount`, `fmtSpeed`). Icons: `src/brand/icons.ts` (`Icon.<key>`, `ICON_PROPS`, `docIcon(name)`), rationale `docs/brand/icons.md`.

**Import strings and icons. Don't retype or pick your own.**

## Keywords

Is: **beside, pointing, on this Mac, honest, patient, Pinoy, pixel-plain** (`T.keywords`; "Local" was renamed "On this Mac"). Is not: magic, autonomous, cloud, stealthy, cute at the user's expense.
Tagline "Gets mo na." Product line "Help that sits right next to your cursor." Positioning: help that sits right next to your cursor. Nothing leaves this Mac.

## Use this → never this

| Use | Never |
|---|---|
| GetcKo (product and mascot) | GetCko (old spelling), Getcko, GetCKO, the gecko (in UI), mascot, Gecko, bot, buddy |
| desktop helper (category) | AI assistant, copilot, chatbot, bot |
| agent | assistant, helper, copilot, persona, profile, preset, mode |
| template (Office Helper, Teacher, Study Buddy, Taglish Explainer) | preset, starter, blueprint |
| knowledge base | library, docs, files, folder, collection, KB |
| document | file (as the concept), doc, upload, attachment |
| passage (meta only) | chunk, snippet, segment, embedding |
| source (`Manual · p. 4`) | citation (in UI), reference, footnote |
| answer | response, reply, output, result, message |
| question | prompt, query, message, input |
| Screen Help | point mode, guide me, show me, vision mode |
| point (GetcKo points, user clicks) | click (for GetcKo), highlight, guide, navigate |
| target / halo (internal); name the element in UI | hotspot, highlight, spotlight, glow |
| overlay, answer card, session bar, composer (internal) | popup, HUD, widget, toolbar, dock, chat box |
| shortcut (`⌥ Space` / `Ctrl Space`, keycaps); `hotkey` in code | hotkey (in UI), keybind |
| Hold to talk | push to talk (in UI), PTT, record, dictate |
| Answer out loud (setting), GetcKo speaks, Stop speaking | read aloud, TTS, text-to-speech, narrate |
| voice = the chosen OS voice only | TTS voice, narrator |
| Processing / Ready / Failed: {reason} / Offline | Loading, Indexing, Done, Complete, Error, Oops |
| Listening... / Looking at your screen... | Recording, Generating, bouncing dots |
| Best guess (screenshot answers) | approximate, low confidence, beta |
| I don't know. It's not in your documents. | any invented source |
| on this Mac / on this PC | local, locally, on-device, edge |
| Nothing leaves this Mac. (Windows: this PC) | 100% private, secure by design, any other privacy wording |
| `0.9 s · on this Mac`, `42 tokens/s · on this Mac` (from `MEASURED`, mono, via the `fmt*` helpers) | instant, real-time, 0.9s, ~1 sec, any unmeasured number |
| Accessibility, Screen Recording, Microphone, System Settings | AX (in UI), screen capture, System Preferences |
| Turned on / Waiting for macOS… / Check again (permission states) | Granted, Allowed, Pending, Refresh |
| Settings; Theme: Light / Dark / Match system | Preferences, Options, Appearance |

## Buttons

Ask · Start (aria `Start {agent}`) · New agent · Use template · Add documents · New knowledge base · Try this agent · Hold to talk · Screen Help · Stop speaking · Next step · Try again · Open System Settings (no keycap) · Check again · Not now · Close answer · More / Less · Edit · Duplicate · Delete.
Never: Send, Submit, OK, Upload, Retry, Launch, Skip, Maybe later, Let's go.

## Rules

- **Show, don't tell:** headline ≤ 6 words; body ≤ 1 line in app (~60 ch), ≤ 2 in marketing. Longer becomes `Kw` chips (max 3 per block), `Steps`, a diagram or motion. No paragraphs in explainer or pitch UI.
- Sentence case. Title case only for proper names (GetcKo, Screen Help, template names, Accessibility, Screen Recording, System Settings).
- Answers: action → reason → source; name the element in words.
- No emoji; no "!" except "Ready ka na!" once at onboarding finish.
- Taglish only for GetcKo's lines when the agent language is Taglish/Filipino (`linesFor`); UI chrome stays English.
- GetcKo says "I" in answers; UI talks about GetcKo in third person; the user is "you".
- Banned: AI-powered, AI assistant, copilot, magic, smart, seamless, supercharge, unleash, revolutionize, game-changer, cutting-edge, effortless, intelligent, agentic, autopilot, Oops!, Something went wrong, Let's dive in, Welcome aboard.
- Icons: one pixel icon per concept from `Icon` (never a smooth line-icon package); never Sparkles, Wand, Stars, Bot, Brain, Cpu, Zap, Rocket, cursor or hand pointers. The mascot stands for GetcKo, pointing, thinking and speaking.
