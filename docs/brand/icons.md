# GetcKo icons: the pixel set

GetcKo's icons are pixel art, drawn on the same kind of grid as the mascot. A smooth line-icon set next to a pixel gecko looks like two products glued together, and it is the default look of every generated app. We dropped the line set we started with for this reason.

Code: `src/brand/icons.ts` (`Icon`, `DOC_ICON`, `STATUS_ICON`, `docIcon()`, `ICON_PROPS`, `ICON_SIZE`, `snapIconSize()`, `CUSTOM_ICONS`, type `IconComponent`). CSS: `src/brand/icons.css`. Vocabulary: `docs/brand/lexicon.md`. Contact sheet: `scripts/brand/icons-sheet.html` → `docs/brand/icons-sheet.png`.

```tsx
import { Icon, ICON_PROPS, ICON_SIZE, docIcon } from "./brand/icons";

<Icon.screenHelp {...ICON_PROPS} />                          // 24px, decorative
<Icon.source {...ICON_PROPS} size={ICON_SIZE.x2} />          // 48px (empty states, docs)
<Icon.processing {...ICON_PROPS} className="gc-icon-spin" /> // animated, reduced-motion aware
const DocIcon = docIcon("manual.pdf"); <DocIcon {...ICON_PROPS} />
<Icon.offline size={24} title="Offline" />                    // announced (role="img")
```

Every icon is a React component that takes `{ size?, className?, style?, title?, "aria-hidden"? }`. Color is always `currentColor`.

## Where the icons come from

- **Base set: [pixelarticons](https://github.com/halfmage/pixelarticons) 2.4.2, MIT** (© 2019 Gerrit Halfmann). 24 × 24 grid, 2-unit strokes, crisp `<path>`s in `currentColor`. Used for generic actions (arrows, chevrons, edit, copy, trash, settings...). Imported per icon from `pixelarticons/react`, so only the icons we use are bundled. The MIT license allows use and modification; keep the copyright notice (it ships in `node_modules/pixelarticons/LICENSE`, and is credited here and in `icons.ts`).
- **GetcKo set: hand-drawn** in `icons.ts` as string maps (`"#"` = one unit), exactly like the sprite in `src/brand/mascot/sprites.ts`. Rendered as one SVG path of whole-unit rectangles with `shape-rendering="crispEdges"`. Used for every concept that is GetcKo's own (agent, Screen Help, source, Hold to talk, statuses...) and for icons where the base set had no good pixel equivalent.

## The grid

| Rule | Value |
|---|---|
| Grid | 24 × 24 units, `viewBox="0 0 24 24"` |
| Stroke | **2 units.** At 24px a stroke is 2px, the same as one mascot cell at scale 2. Icon and gecko share the cell. |
| Live area | Units 2 to 21 (2-unit margin). Wide shapes may touch 1 or 22. |
| Minimum gap | 2 units between strokes, so nothing fills in at 24px. |
| Corners | Notched: the outer 2 × 2 corner of a box is left empty, which reads as a pixel-rounded corner. Inner corners stay square. |
| Diagonals | Step in 2 × 2 cells. Status marks (check, close) use 4-unit runs stepping 2, so the diagonal holds the same weight as a straight stroke. |
| Fills | Solid fills only for small heavy parts: mic head, speaker cone, plug, play wedge, keycap face. Everything else is outline. |
| Anti-aliasing | None. No curves, no half units, no rotation, no blur, no opacity gradients. |
| Color | One color, `currentColor`. Never two-tone, never gecko green on white. |

## Sizes

Icons render at **whole multiples of 24 only**. `size` is snapped by `snapIconSize()` (16 → 24, 30 → 24, 40 → 48), so a unit never lands on a fractional pixel.

| Size | Where |
|---|---|
| **24** (`ICON_SIZE.row` = `.chip` = `.button`) | Everywhere in the UI: buttons, icon buttons, rows, chips (pulled into the chip padding with `-my-0.5 -ml-1`). |
| **48** (`ICON_SIZE.x2`) | Empty states, docs, the brand board. Pairs with the mascot at 4×. |

At 125% / 150% OS scaling `crispEdges` keeps edges hard; a cell may be 2 or 3 device pixels, the same trade the sprite makes.

## Treatment

- **Icons earn their place.** An icon goes next to a word only when it adds meaning: an action (add, start, try again), a status, a file type, a source. No icon next to headings, no icon repeated on every nav row, no decorative icon on a card.
- **No tiles.** No icon inside a tinted circle or tinted rounded square. `IconTile` survives only as a 1px-bordered, untinted 44px square for a picker target. Agent cards carry no icon tile.
- **Color by meaning, with text tokens:** `text-text-2` default, `text-accent-text` for ready / active, `text-danger` for failed, `text-inverse-text` / `text-chrome-text-2` on dark chrome. The only gecko fill is the accent icon button (Hold to talk), where the icon is `text-on-accent` (ink).
- **Alignment:** `items-center` with the label, `gap-2` (8px) between icon box and label (chips: `gap-1.5` plus the icon's own 2-unit margin). On a multi-line text block, center the icon on the first line (`-my-0.5` for a 20px line).
- **The mascot outranks the icon.** If GetcKo is shown in a moment (confused, offline, reading), drop the matching status icon next to it.
- Icon-only buttons need the canonical `T.aria` label; status chips always show their word.

## What the mascot represents instead

| Concept | Use |
|---|---|
| The product, GetcKo | `GetCkoHeadMark` (app icon, header) |
| Point (the verb) | The sprite in a pointing pose beside the target. Never a hand. |
| Thinking, speaking (live states) | Sprite poses. `Icon.readAloud` is for the setting, not the live state. |
| Empty states, onboarding finish | Sprite at 6× / 8× pointing at the primary action. |
| Shortcut in context | The `Keycap` component (`⌥ Space`). `Icon.hotkey` only labels a settings row. |

## Map

★ = hand-drawn GetcKo icon. Everything else is pixelarticons (name in the second column).

| Key | Icon | Concept (canonical term) | Drawing |
|---|---|---|---|
| `agent` | ★ | agent | The GetcKo head mark as a stencil: bulging eyes, wide head, smile. |
| `template` | ★ | template | Frame with a header bar and placeholder blocks. |
| `knowledgeBase` | ★ | knowledge base | Stack of three pages, front page square-on. |
| `document` | ★ | document, unknown type | The GetcKo page: folded corner top right, notched corners. |
| `passage` | `article` | passage | A block of text. |
| `source` | ★ | source | The page with a slanted double quote mark. |
| `answer` | `message-text` | answer | Speech panel with lines. |
| `question` | `circle-question` | question | Question mark. |
| `screenHelp` | ★ | Screen Help | A screen, a pixel cursor, and the element it is about. |
| `target` | ★ | target | Corner brackets around one element. Docs and settings; on screen the target is the halo. |
| `overlay` | `picture-in-picture` | overlay | A window over a window. |
| `sessionBar` | `dock` | session bar | A bar of controls. |
| `composer` | `text-cursor` | composer | Text cursor. |
| `hotkey` | ★ | shortcut (settings row) | A keycap with a solid face and a deeper bottom edge. |
| `instructions` | `script` | instructions | A scroll of written rules. |
| `baseRules` | `bulletlist` | base rules | A list GetcKo follows. |
| `language` | `languages` | Answer language | Language glyph. |
| `answerLength` | `text-align-left` | Answer length | Lines of varying length. |
| `voice` | ★ | voice | A head with sound in front of the mouth. |
| `latency` | `hourglass` | speed figure | Measured time. |
| `onThisMac` | ★ | on this Mac | A laptop. |
| `pushToTalk` | ★ | Hold to talk | Solid capsule mic on a stand. Wears the accent fill button. |
| `listening` | `audio-waveform` | Listening | Sound coming in. |
| `readAloud` | ★ | Answer out loud (on) | Solid speaker with two pixel waves. |
| `readAloudOff` | ★ | Answer out loud (off) | Same speaker with a pixel X. |
| `processing` | ★ | Processing | 8 squares on a ring. `gc-icon-spin` lights one at a time clockwise in `steps()` (100ms a step); never rotated, so squares stay on the grid. Static fallback shows a fading trail. |
| `ready` | ★ | Ready | Heavy pixel check. |
| `failed` | ★ | Failed | Pixel triangle with "!". |
| `offline` | ★ | Offline | Unplugged plug beside a wall socket: the prop GetcKo holds in his offline pose. |
| `bestGuess` | `camera` | Best guess | The answer came from a screenshot. |
| `dontKnow` | `zoom-out` | I don't know | Searched, found nothing. |
| `ask` | `arrow-up` | Ask | Send-up arrow. |
| `start` | ★ | Start | Solid play wedge. |
| `newAgent` | `plus-box` | New agent | Add, boxed: differs from plain add. |
| `addDocuments` | ★ | Add documents | The GetcKo page with a plus. Never an upload arrow. |
| `add` | `plus` | add (generic) | |
| `tryThisAgent` | `comment` | Try this agent | Speech bubble. |
| `stop` | `stop` | Stop speaking | Media stop. |
| `next` | `arrow-right` | Next step | |
| `retry` | `reload` | Try again | |
| `close` | ★ | Close answer | X with the check's diagonal weight. |
| `more` / `less` | `chevron-down` / `chevron-up` | More / Less | |
| `edit` | `pencil` | Edit | |
| `duplicate` | `copy` | Duplicate | |
| `delete` | `trash` | Delete | |
| `openExternal` | `external-link` | Open System Settings | |
| `settings` | `sliders-horizontal` | Settings | Not a gear, to avoid looking like the OS. |
| `theme` | `moon` | Theme | |
| `permissionAccessibility` | `human` | Accessibility | Echoes Apple's Accessibility figure. |
| `permissionScreen` | `monitor` | Screen Recording | |

In-flight keys (being added to `src/brand/icons.ts`; check the file for the final drawing): `switchAgent` (agent chip in the session bar), `chevronDown` (Select, pickers), `mic` (Microphone permission, distinct from `pushToTalk`), `back` (onboarding back, dialogs), `search`, `info` (`Notice`), `drop` (`DropZone`).

### Document types (`DOC_ICON`, `docIcon(fileName)`)

All share the GetcKo page; only the mark inside differs.

| Type | Icon | Mark |
|---|---|---|
| `.pdf` | ★ | Three lines of text (the common case). |
| `.txt` | ★ | A pixel "T". |
| `.md` | ★ | A pixel "#". |
| `.docx` | ★ | Heading block and a line. |
| `.pptx` | `presentation` | Slides on a stand. |
| other | ★ `Icon.document` | Blank page. |

## Adding an icon

1. Check the concept really needs one (see Treatment). Add the canonical term to the lexicon first.
2. Look in pixelarticons (`node_modules/pixelarticons/svg/`, or the contact sheet of the package) for a generic concept. Skip `*-sharp` and `*-solid` variants unless the whole set moves. Never use `sparkle(s)`, `wand`, `robot*`, `ai-*`, `cpu`, `zap`, `cursor`/`hand` pointers, `cloud*`, `upload`.
3. Otherwise draw it: a 24-character × up-to-24-row map in `icons.ts`, following the grid rules above. Reuse `page({...})` for anything document-like and `withMarks()` for variants (on / off).
4. Register it in `Icon` (and `CUSTOM_ICONS` if hand-drawn), add a row to the map above.
5. Build with `GC_SHEETS=1 npx vite build`, run `npx vite preview --port 4181`, open `/scripts/brand/icons-sheet.html`, and look at it at 24 and 48 in both themes next to the mascot. Re-shoot `docs/brand/icons-sheet.png`.

## Rules

1. One icon per concept; never reuse an icon for a second meaning.
2. Components import from `src/brand/icons.ts` only, never from `pixelarticons` or any other icon package.
3. No smooth line-icon packages (the npm defaults). They are slop for GetcKo.
4. Icons never carry meaning alone: statuses show their word, icon buttons have an `aria-label`.
