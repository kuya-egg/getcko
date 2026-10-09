# Recipes: build GetcKo screens from the components

Spec: `docs/getcko-design-system.md` §7–§9. **The component is the source of truth.** Snippets show composition only; for styling, read the component. Components marked *(in-flight)* are being added in parallel: read the Props interface in `src/components/ui/` before use and follow it where it differs from a snippet here.

| Always | Never |
|---|---|
| `import { … } from "./components/ui"`, `T` from `./brand/lexicon`, `Icon` from `./brand/icons` | Hand-rolled buttons, chips, cards, dialogs |
| `MOMENT_POSE[moment]` for the sprite | A pose name typed by hand |
| Tokens: `max-w-copy`, `max-w-answer`, `z-*`, `rounded-panel` | `w-[…]`, `max-w-[…]`, `rounded-[…]`, `text-[…]`, `z-[…]` |
| One halo, the gecko facing it | Two halos, a halo on an error |

## 1. Window sizes

| Surface | Design at | Min | Notes |
|---|---|---|---|
| Main window | 1040×680 | 900×600 | No `lg:`/`xl:` breakpoints. Nav + content; content scrolls, nav does not |
| Onboarding | Same window | 900×600 | `text-display` allowed here only |
| Overlay | Full screen, transparent | — | Answer card `max-w-answer` (380), 24px inset, flips to avoid the target |
| Marketing | 1440 | 360 | 64px gutter; breakpoints allowed |
| Video | 1920×1080, 1080×1920 | — | `docs/brand/video.md` |

## 2. App shell screen

| Part | Component | Rule |
|---|---|---|
| Frame | `AppShell` *(in-flight)* | Nav left, content right, 32px gutter |
| Nav item | `NavLink` | Active = `GeckoDot` after the label + `bg-surface`. No side stripe, no icon on every row |
| Brand | `Wordmark` | Head mark + "GetcKo", top of nav |
| Title row | `PageHeader` | `text-h1`, ≤ 6 words, one primary action |
| Sections | `Surface` + `Panel` | Working screens `texture="none"` or `intensity="subtle"` |

```tsx
const NAV: NavItem[] = [
  { id: "agents", label: T.nav.agents },
  { id: "kb", label: T.nav.knowledgeBases },
  { id: "settings", label: T.nav.settings },
];

<AppShell nav={NAV} active={screen} onNavigate={setScreen} footer={<OfflineBadge detail={PLACE.mac.onThis} />}>
  <PageHeader title={T.nav.agents} action={<Button icon={Icon.newAgent}>{T.actions.newAgent}</Button>} />
  <Surface texture="footprints" intensity="subtle" className="p-8">
    <Panel title={T.agent.templates}>…</Panel>
  </Surface>
</AppShell>
```

## 3. Onboarding step

Steps: **Accessibility → Screen Recording → Microphone → Shortcut**, then the finish (`say.tl.onboardingDone`, `MOMENT_POSE.endCard`).

| Part | Component | Rule |
|---|---|---|
| Frame | `OnboardingStep` *(in-flight)* | 5-col text / 7-col visual well; H1 gets focus on step change |
| Progress | `StepSquares` | 4 pixel squares, not a bar or dots |
| Visual | `Surface texture="pointer" intensity="subtle"` well + `MockToggle` | Gecko 8× faces the mock OS control; the toggle wears the halo |
| Status | From `T.onboarding` | Granted "Turned on" (`StatusChip ready`) · waiting "Waiting for macOS…" · button "Check again" |
| Buttons | `Button` "Open System Settings" (no keycap) + ghost "Not now" | Shortcut step: primary "Start" |
| Copy | Title ≤ 6 words, body 1 line | "Nothing leaves this Mac." as the body or a `ProofLine` |

```tsx
<OnboardingStep
  step={1} total={4}
  title={T.onboarding.accessibilityTitle}
  body={T.onboarding.accessibilityBody}
  // OnboardingStep draws the pointer well and GetcKo 8x (moment, scale); pass only the mock OS control.
  visual={<MockToggle on={granted} permission={T.onboarding.permissionAccessibility} halo />}
  primary={{ label: T.actions.openSystemSettings, onClick: openSettings }}
  secondary={{ label: T.actions.notNow, onClick: skip }}
  state={granted ? "granted" : waiting ? "waiting" : "idle"}
/>
```

**Microphone step:** same frame, the mock is the Microphone row; on denial show `T.errors.micBlocked` in a `Notice`. The gecko uses `MOMENT_POSE.listening` (3× or larger) once granted.
**Shortcut step:** the visual is a `Keycap hotkey` with the halo; the gecko points at it. Primary "Start".

## 4. Agents: list and editor

| Part | Component | Rule |
|---|---|---|
| Templates strip | 4 template cards, one row | Name in `font-display text-title`, one line from `T.templates.*`, "Use template". No icons |
| List | `AgentCard` / `NewAgentCard` | Primary "Start" (aria `Start {agent}`); several in a row → `startVariant="secondary"` |
| Editor sections | `Panel eyebrow=…` × 4, 48px apart | Instructions · Knowledge bases · Voice and language · Try it |
| Answer length | `SegmentedControl` | Short / Medium / Long from `T.agent.length*` |
| Speaking speed | `Slider` | Value in mono (`1.0×`) |
| Voice | `VoicePicker` | Installed OS voices; `T.agent.noFilipinoVoice` as a `Notice` when none |
| Language | `LanguagePicker` | English / Filipino / Taglish |
| Try it | `ChatBubble from="getcko"` + sprite 3× | The only gecko on this screen |

```tsx
<Panel eyebrow={T.agent.sectionVoice}>
  <LanguagePicker value={lang} onChange={setLang} />
  <SegmentedControl label={T.agent.lengthLabel} value={len} onChange={setLen}
    options={[{ value: "short", label: T.agent.lengthShort }, { value: "medium", label: T.agent.lengthMedium }, { value: "long", label: T.agent.lengthLong }]} />
  <VoicePicker voices={voices} value={voice} onChange={setVoice} onPlaySample={play} language={lang} />
  <Slider label={T.agent.speedLabel} min={0.75} max={1.5} step={0.25} value={speed} onChange={setSpeed} format={fmtSpeed} />
</Panel>
```

## 5. Knowledge base import

| Part | Component | Rule |
|---|---|---|
| Drop target | `DropZone` *(in-flight)* | Button "Add documents" inside; caption `T.knowledgeBase.fileHint()`; `Icon.drop` |
| Progress | `ImportProgress` (`page`, `total`) | Pixel squares + mono "12 / 48 pages"; the row's `mascot` shows GetcKo reading; no bar shimmer |
| Rows | `KnowledgeBaseList` > `KnowledgeBaseRow` | `docIcon(name)`, meta `T.knowledgeBase.meta(pages, passages)`, `StatusChip` |
| Failure | Row `status="failed" reason=…` | Reason words from `T.errors.*` |

```tsx
<DropZone onFiles={add} />
{importing && <ImportProgress page={page} total={totalPages} />}
<KnowledgeBaseList>
  {docs.map((d) => <KnowledgeBaseRow key={d.id} name={d.name} pages={d.pages} passages={d.passages} status={d.status} reason={d.reason} />)}
</KnowledgeBaseList>
```

## 6. Overlay answer variants

| `variant` | Gecko (`MOMENT_POSE`) | Halo | Footer |
|---|---|---|---|
| `answer` | `screenHelp` 2× beside the target (`pointPoseFor`, `handTip`) | On the target | `CitationChip`s + `latencyLine()` if measured |
| `bestGuess` | `screenHelp` 2× | On the guessed target | "Best guess" chip, sources if any |
| `dontKnow` | `failed` (confused) 3× | None | No sources. Text `linesFor(lang).dontKnow` |
| `noTarget` | `failed` (confused) 3× | None | Text `linesFor(lang).noTarget`; hint `T.errors.noTarget` |

`step={{ n, total }}` adds "Next step". The card never covers the target (flip corner) and never steals focus.

```tsx
<AnswerCard variant="answer" agent={agent} question={q} citations={[{ source: "Manual", page: 4 }]} latency={MEASURED.firstSpokenWord ?? undefined} step={{ n: 1, total: 3, onNext: next }} onStopSpeaking={stop} onClose={close}>
  {answer}
</AnswerCard>
```

## 7. Settings

| Section | Components |
|---|---|
| Shortcut | `Keycap hotkey` + `T.settings.shortcutHelp` |
| Theme | `SegmentedControl` Light / Dark / Match system (`T.settings.theme*`) → `setTheme` |
| Permissions | One row per permission: `StatusChip ready` "Turned on" or `Button` "Open System Settings" |
| Models | Rows with `fmtBytes` sizes + `T.settings.modelsHelp`; measured speed only via `Stat` |

`Surface texture="none"`, `Panel` per section, `max-w-copy` column.

## 8. Benchmark and proof

| Rule | How |
|---|---|
| Only measured | Values come from `MEASURED` (mirrors `docs/MODELS.md`) |
| TBD shows nothing | `<Stat value={null} />` renders nothing; never a placeholder dash |
| Mono, with place | `Stat` formats via `fmtSeconds` / `fmtSpeed` + "on this Mac" |
| Proof line | `<ProofLine items={[…]} />`: "Wi-Fi off · on this Mac" plus measured figures only (null/false items drop out) |

```tsx
<div className="flex gap-6">
  <Stat label={T.stats.firstSpokenWord} value={MEASURED.firstSpokenWord} unit={T.stats.unitSeconds} digits={1} />
  <Stat label={T.stats.tokensPerSecond} value={MEASURED.tokensPerSecond} unit={T.stats.unitTokens} digits={0} />
</div>
<ProofLine items={[T.proof.wifiOff, MEASURED.bytesSent != null && T.proof.bytesSent(MEASURED.bytesSent), PLACE.mac.onThis]} />
```

## 9. Dialog, toast, notice

| Need | Component | Rule |
|---|---|---|
| Confirm a destructive action | `Dialog` | Title ≤ 6 words, one line body, primary names the action ("Delete"), `z-dialog` over `z-scrim` |
| Quick confirmation ("Ready") | `const t = useToast()` → `t.show(T.toast.saved)` + `<Toast {...t.props} />` | `role="status"`, no focus steal, `z-toast`, auto-hides |
| Inline info or warning | `Notice` | In the flow, never floating; `Icon.info` |
| Failure with a fix | `ErrorNotice` | `MOMENT_POSE.failed`, "Try again", no halo |

## 10. Empty, error, loading per screen

Loading is always GetcKo's moment (`thinking` or `processing` pose + its line). Never a shimmer, skeleton or spinner block.

| Screen | Loading | Empty | Error |
|---|---|---|---|
| Agents | `thinking` 3× + `say.en.thinking` (only if > 300ms) | `EmptyState` `T.agentsEmpty` → "Use template" | `ErrorNotice` |
| Agent editor, Try it | `AnswerCard`/bubble `thinking` | Caption `T.agent.tryNotSaved` | `ErrorNotice` `T.errors.modelNotLoaded` |
| Knowledge bases | `ImportProgress` + row `StatusChip processing` | `EmptyState` `T.knowledgeBase.emptyTitle` → "Add documents" | Row `failed` + reason; `ErrorNotice` |
| Overlay | `listening` while held, then `thinking` | — | `dontKnow` / `noTarget` variants; `offline` pose if the model is down |
| Onboarding | "Waiting for macOS…" + "Check again" | — | `Notice` + "Open System Settings" |
| Settings | `processing` on model rows | — | `Notice` |
| Benchmark | `processing` while running | Nothing (TBD renders nothing) | `ErrorNotice` |

## 11. Z-index scale

`z-base` < `z-raised` (cards on hover) < `z-sticky` (headers) < `z-scrim` < `z-dialog` < `z-toast` < `z-overlay` (gecko + answer card window layer). Never `z-[…]` or raw numbers.

## 12. Data formatting

| Data | Helper | Shape |
|---|---|---|
| Seconds | `fmtSeconds`, `latencyLine` | `0.9 s · on this Mac` |
| Throughput | `fmtSpeed` | `42 tokens/s` |
| Sizes | `fmtBytes` | `3.6 GB` |
| Counts | `fmtCount` | `1,204 passages` |
| Dates | `fmtDate` | Short, sentence case |
| Sources | `sourceLabel` | `Manual · p. 4` |

All numbers `font-mono nums`. Never format by hand.

## 13. Focus and keyboard

| Situation | Behavior |
|---|---|
| Dialog | Traps focus; Esc closes; focus returns to the opener |
| Answer card | Never steals focus from the user's app; reachable by the shortcut |
| Onboarding | On step change, focus moves to the step H1 (`tabIndex={-1}`) |
| Esc order | Stop speaking → close answer → close dialog (one per press) |
| Toast | `role="status"`, never focused |
| Tabs, SegmentedControl | Arrow keys move, Tab leaves |
| Hold to talk | Space or Enter held on the focused mic |
| Global | `⌥ Space` / `Ctrl Space` opens GetcKo from any app |

## 14. Page transitions

| Change | Motion |
|---|---|
| Route mount | `pageIn(el)`: rise 8px + fade, 220ms |
| Onboarding step | `stepIn(el, dir)`, `dir` = 1 forward, -1 back |
| Nav switch | Crossfade only, no slide |
| Lists | `staggerIn`, max 4 items |
| Reduced motion | 80ms opacity only |

## 15. Logo

| Item | Rule |
|---|---|
| Head mark | Sprite rows 0–10, arm stub removed, `public/brand/logo/headmark.svg` |
| Lockup | Head mark + "GetcKo" (Bricolage 800), caps = head height, gap 4 cells: `wordmark-light.svg` / `wordmark-dark.svg`, `Wordmark` in the app |
| Clearspace | 4 head-mark cells on every side |
| Min size | Head mark 24px wide |
| Tiles | `headmark-ink-tile.svg` (dark), `headmark-paper-tile.svg` (light), radius 22 at 96 |
| App icon | `docs/brand/app-icon-1024.png`, ink tile on the macOS grid (824 in 1024) |
| Never | Recolor, outline, rotate, stretch, add effects, set on a busy texture |

## 16. Marketing, video, slides

| Surface | Recipe |
|---|---|
| Hero (1440) | `Surface texture="footprints"` + a `canopy-corner` branch (or an ink hero). Left 7 cols: `text-hero` ≤ 6 words, 1–2 line subline, primary + keycap, `ProofLine`. Right 5 cols: real screenshot, one halo, gecko 12× beside it |
| Features | One worked example per feature (text + real screenshot, alternating). `Kw` chips and `Steps` instead of paragraphs. No card grids |
| Transitions | `dither-fade` band, never a gradient |
| Video title | `plateStyle("point", "dark")`, gecko 16× left third, title ≤ 2 lines, "Gets mo na." pixel badge. `docs/brand/video.md` |
| Slides | 16:9, one idea, title ≤ 6 words, real screenshots, measured numbers only, one gecko pointing at the key element |
