---
name: getcko-brand
description: GetcKo's brand kit and rules. Use whenever someone says "use brand", "on brand", "brand it", "GetcKo style", "make it look like GetcKo", or does any GetcKo UI, screen, component, overlay, onboarding, empty/error state, marketing page, slide, image prompt, icon, mascot, logo, motion, or demo-video work. Loads the tokens, components, mascot, textures, layout recipes, copy voice and anti-slop checks so output looks intentional, not generic AI.
---

# GetcKo brand

## Build a screen (do these in order)

1. `<AppShell>` (nav, window 1040×680) → `<PageHeader>` (title ≤ 6 words, one primary action).
2. Each section is a `<Surface>`; content sits on `Panel` cards. Working screens: flat or `subtle`.
3. Use the primitive from `./components/ui` before writing any markup (table below).
4. Every visible word is a `T.*` key (`./brand/lexicon`); missing? add a key, never inline text.
5. Mascot pose = `MOMENT_POSE[moment]`, integer scale, one per screen, facing the target.
6. Icons = `Icon.*` only, 24px, bare, only where they add meaning.
7. Exactly one halo (`target-halo`) on the thing the gecko faces, or none.
8. Show, don't tell: headline ≤ 6 words, body ≤ 1 line; more becomes `Kw` chips, `Steps`, a diagram or motion.
9. Recipe for this screen: `references/recipes.md`. Then run the self-check (§6).

**Product:** a private, offline desktop helper. A pixel gecko points at the right thing on your screen, answers out loud, cites your own documents. Tagline **"Gets mo na."** Audience: Filipino LGU staff, teachers, office workers learning new software. North star: **the helper at your elbow.**

Sources: spec `docs/getcko-design-system.md` (v0.4), summary `DESIGN.md`, product `PRODUCT.md`. Paths below are relative to `src/` (no `@/` alias). *In-flight* = being added in parallel; read the file's exports before use.

## 1. Import, don't invent

| Need | Use |
|---|---|
| CSS, theme | `import "./brand/index.css"` once per window entry; `initTheme()`, `useTheme()` from `./brand` |
| Shell and pages *(in-flight)* | `AppShell`, `NavLink`, `Wordmark`, `PageHeader` |
| Onboarding *(in-flight)* | `OnboardingStep`, `StepSquares`, `MockToggle` |
| Knowledge bases | `KnowledgeBaseRow`, `KnowledgeBaseList`, `EmptyState`; *(in-flight)* `DropZone`, `ImportProgress` |
| Agents | `AgentCard`, `NewAgentCard`, `ChatBubble`, `Composer`; *(in-flight)* `SegmentedControl`, `Select`, `Slider`, `VoicePicker`, `LanguagePicker`, `Tabs` |
| Overlay | `AnswerCard` (*in-flight* `variant` `answer`/`bestGuess`/`dontKnow`/`noTarget` + `step`), `SessionBar`, `TargetHalo` |
| Controls | `Button`, `IconButton`, `Keycap`, `TextField`, `Toggle`, `Checkbox`; *(in-flight)* `Tooltip` |
| Status, feedback | `StatusChip`, `CitationChip`, `OfflineBadge`, `GeckoDot`, `Tag`, `ErrorNotice`; *(in-flight)* `Notice`, `Dialog`, `Toast` + `useToast` |
| Show, don't tell *(in-flight)* | `Kw` (keyword chip), `Steps` (1→2→3), `Stat` (`value={null}` renders nothing), `ProofLine` |
| Layout | `Panel`, `Surface` (`texture`, `intensity`, `tone`) |
| Words | `T`, `say`, `linesFor`, `latencyLine`, `sourceLabel`, `statusLabel`; *(in-flight)* `MEASURED`, `fmtBytes`, `fmtDate`, `fmtCount`, `fmtSpeed` from `./brand/lexicon` |
| Mascot | `GetCkoSprite`, `GetCkoHeadMark`, `MOMENT_POSE`, `pointPoseFor`, `handTip`, `POSE_CYCLES` from `./brand` |
| Icons | `Icon`, `ICON_PROPS`, `docIcon`, `STATUS_ICON` from `./brand/icons`; *(in-flight)* `switchAgent`, `chevronDown`, `mic`, `back`, `search`, `info`, `drop` |
| Motion | `DUR`, `EASE`, `prefersReducedMotion`, `flyTo`, `haloIn`, `answerCardIn`, `speakLoop`, `thinkingLoop`; *(in-flight)* `pageIn`, `stepIn(el, dir)`, `staggerIn` |
| Textures | `injectTextureStyles` (called in `main.tsx`, *in-flight*), `textureStyle`, `plateStyle` from `./brand` |
| Tokens *(in-flight)* | `z-base/raised/sticky/scrim/dialog/toast/overlay`, `max-w-copy`, `max-w-answer` |
| Logo | `public/brand/logo/*.svg`, `public/brand/favicon.svg`, `docs/brand/app-icon-1024.png` |

## 2. Rules

1. **Semantic tokens only** in components (`bg-surface`, `text-text-2`, `text-accent-text`, `bg-inverse`). No hex, no `dark:` for color, no default Tailwind colors.
2. **One green** (`bg-accent`, fill only, ≤ ~3% of screen); green text is `text-accent-text`.
3. **One sun halo** on the target, never decorative.
4. **Banned:** gradients, glows, blur, glass, purple/blue, emoji, Title Case, Inter/Roboto/Arial, icon packages in components.
5. **Type:** `text-h1` is the biggest app headline; `text-display`/`text-hero` only on onboarding and marketing. No `text-[…]`, `rounded-[…]`, `w-[…]`, `max-w-[…]`.
6. **App window:** design at 1040×680, min 900×600. No `lg:`/`xl:` breakpoints in app screens.
7. **Mascot:** `MOMENT_POSE`, integer scale (2 overlay · 3 inline · 6 empty · 8 onboarding · 12–16 hero), one per screen, beside the target via `placeBeside` (never on it). Never redrawn.
8. **It points, never clicks.** No "Do it for me".
9. **Honest numbers:** only `MEASURED` values, mono, with "on this Mac". TBD renders nothing.
10. **Show, don't tell:** headline ≤ 6 words; body ≤ 1 line (~60 ch) in app, ≤ 2 lines in marketing; no paragraphs in explanatory or pitch UI. Judges must get it at first glance.
11. **Lexicon:** every word from `T`/`say`. "Nothing leaves this Mac." is the only privacy line. Banned synonyms: `references/lexicon.md`.
12. **Icons:** one pixel icon per concept, none beside headings, none in tiles.
13. **Sections wear a texture** (light: footprints, canopy*, pointer, how, footer). Overlay and working screens flat or `subtle`.
14. **Accessible:** ≥ 44px targets, real `<button>`/`<label>`, `aria-label` on icon buttons, visible focus, keyboard map in `references/recipes.md`.
15. **Loading = GetcKo's moment** (`thinking`/`processing` pose + line), never a shimmer or skeleton.

## 3. Compose

Eye path on every screen, slide or frame: **ask → GetcKo → target → source.** Left-aligned text column + asymmetric visual. Spacing: 8–16 inside, 24 between components, 48 between sections, 32 app gutter, 64 marketing gutter. Recipes: **`references/recipes.md`**.

## 4. Motion

UI 140–360ms `EASE.out`; only the gecko overshoots. Pages `pageIn`, onboarding `stepIn(el, dir)`, nav switch = crossfade only. Order: gecko → halo → words → sources. Reduced motion: teleport, static halo, 80ms fades. **`references/motion.md`**.

## 5. Voice

Action → reason → source. Short, plain, warm, sentence case; Taglish only for GetcKo's lines when the agent is Taglish. **`references/voice.md`**, anti-slop **`references/anti-slop.md`**.

## 6. Self-check (do it, then say you did)

- [ ] Built from `AppShell`/`PageHeader`/primitives; nothing redefines colors, fonts, shadows or the sprite.
- [ ] Every string from `T`/`say`; banned-word grep clean; headline ≤ 6 words, body ≤ 1 line.
- [ ] Every icon from `Icon`; no icon package; no decorative icons.
- [ ] Every section a `<Surface>`; no plain white page; no grey noise in light mode.
- [ ] Pose from `MOMENT_POSE`; integer scale; one gecko; faces the one halo.
- [ ] No arbitrary values (`text-[`, `rounded-[`, `w-[`), no `lg:`/`xl:` in app screens, fits 900×600.
- [ ] Loading, empty and error states exist (table in `references/recipes.md`).
- [ ] Keyboard: focus visible, Esc order respected, dialogs trap and return focus.
- [ ] Light **and** dark checked; session bar dark in both.
- [ ] Numbers come from `MEASURED` or are absent.
- [ ] Could this screen belong to any other AI startup? If yes, apply a recipe until it couldn't.
