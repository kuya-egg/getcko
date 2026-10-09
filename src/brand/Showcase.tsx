// GetCko brand board v0.4. The hackathon first impression and the team's visual reference.
// Show, don't tell: every headline ≤ 6 words, no body paragraphs. Words become Kw chips, Steps or screens.
//   ?theme=dark | light | system  -> force a theme for headless captures
//   ?dev                          -> show dev notes (moment ids, poses, version)
// Every word comes from ./lexicon (T / say). Missing keys live in BOARD below with a TODO naming the key.
// Sample content (names, files, questions, third-party app buttons) is data, as in hero/copy.ts.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTheme, type ThemePref } from "./theme";
import { GetCkoSprite, MOMENT_POSE, pointPoseFor, type Moment } from "./mascot";
import { ICON_PROPS, ICON_SIZE, Icon, type IconComponent } from "./icons";
import { MEASURED, PLACE, T, fmtSpeed, say, sourceLabel } from "./lexicon";
import { GetCkoHero, HERO_COPY } from "./hero";
import {
  AgentCard,
  AnswerCard,
  AppShell,
  Button,
  Checkbox,
  CitationChip,
  Dialog,
  DropZone,
  EmptyState,
  ErrorNotice,
  GeckoDot,
  IconButton,
  ImportProgress,
  Keycap,
  KnowledgeBaseList,
  KnowledgeBaseRow,
  Kw,

  MockToggle,
  NewAgentCard,
  Notice,
  OfflineBadge,
  OnboardingStep,
  PageHeader,
  Panel,
  ProofLine,
  SegmentedControl,
  SessionBar,
  Slider,
  Stat,
  StatusChip,
  Steps,
  Surface,
  TargetHalo,
  TextField,
  Toast,
  Toggle,
  Tooltip,
  VoicePicker,
  Wordmark,
  cn,
  useToast,
  type NavItem,
  type Voice,
} from "../components/ui";

const B = T.board;
const MAC = PLACE.mac.onThis;

/** Board-only strings with no lexicon key yet. Canonical words only; move each to its TODO key. */
const BOARD = {
  stepPoint: "GetcKo points", // TODO lexicon: T.board.how.stepPoint
  screensEyebrow: "Screens", // TODO lexicon: T.board.screens.eyebrow
  screensTitle: "The app, at window size.", // TODO lexicon: T.board.screens.title
  onboarding: "Onboarding", // TODO lexicon: T.nav.onboarding (window caption)
  overlay: "Overlay", // TODO lexicon: T.board.screens.overlay
  variants: "Answer card", // TODO lexicon: T.board.screens.variants
  typeTitle: "Bricolage speaks. Geist explains.", // TODO lexicon: T.board.type.title (current one is 7 words)
  feedback: "Dialogs and notices", // TODO lexicon: T.board.parts.feedback
  runSpeedTest: "Run the speed test", // TODO lexicon: T.actions.runSpeedTest
  greenShare: "Green < 3%", // TODO lexicon: T.board.color.greenShare
} as const;

/** Sample content for the screens (data, not UI copy). */
const SAMPLE = {
  windowSize: "1040 × 680",
  question: "\"Where do I put Juan's grade in the class record?\"",
  appButtons: ["New record", "Search", "Print"],
  voices: [{ id: "samantha", name: "Samantha", lang: "en-US" }] satisfies Voice[],
};

const query = (() => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
})();
const DEV = query.has("dev");

const WRAP = "mx-auto w-full max-w-[1440px] px-8 lg:px-16";
const WIN = { w: 1040, h: 680, bar: 36 } as const;

// ---------------------------------------------------------------------------
// Small pieces

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl<ThemePref>
      label={T.aria.theme}
      value={theme}
      onChange={setTheme}
      options={[
        { value: "light", label: T.settings.themeLight },
        { value: "dark", label: T.settings.themeDark },
        { value: "system", label: T.settings.themeSystem },
      ]}
    />
  );
}

/** Section headline: eyebrow + ≤ 6-word h2. No body copy, by rule. */
function Head({ id, eyebrow, title, className }: { id: string; eyebrow?: string; title: string; className?: string }) {
  return (
    <header className={cn("mb-10 flex flex-col gap-2", className)}>
      {eyebrow && <p className="eyebrow text-text-2">{eyebrow}</p>}
      <h2 id={id} className="text-h1 font-display text-text text-balance">
        {title}
      </h2>
    </header>
  );
}

/** A 1040 × 680 app window drawn at true size, scaled to fit its column. */
function Window({ caption, children }: { caption: string; children: ReactNode }) {
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / WIN.w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = WIN.h + WIN.bar;
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div ref={fitRef} className="w-full" style={{ height: h * scale }}>
        <div
          className="origin-top-left overflow-hidden rounded-window border border-border bg-bg shadow-card"
          style={{ width: WIN.w, height: h, transform: `scale(${scale})` }}
        >
          <div className="relative flex items-center border-b border-border bg-surface-2 px-3" style={{ height: WIN.bar }}>
            <span className="flex gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-3 rounded-pill border border-border-strong" />
              ))}
            </span>
            <span className="absolute inset-x-0 text-center text-caption text-text-2">{T.product.name}</span>
          </div>
          <div className="relative" style={{ height: WIN.h }}>
            {children}
          </div>
        </div>
      </div>
      <figcaption className="flex items-baseline gap-3">
        <span className="text-label font-semibold text-text">{caption}</span>
        <span className="font-mono text-keys nums text-text-3">{SAMPLE.windowSize}</span>
      </figcaption>
    </figure>
  );
}

const NAV: NavItem[] = [
  { id: "agents", label: T.nav.agents },
  { id: "kb", label: T.nav.knowledgeBases },
  { id: "speed", label: T.nav.benchmark },
  { id: "settings", label: T.nav.settings },
];

function Shell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <AppShell contained nav={NAV} active={active} onNavigate={() => {}} footer={<OfflineBadge detail={MAC} />}>
      {children}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Screens

function OnboardingScreen() {
  return (
    <OnboardingStep
      step={1}
      total={4}
      title={T.onboarding.accessibilityTitle}
      body={T.onboarding.accessibilityBody}
      visual={<MockToggle on={false} permission={T.onboarding.permissionAccessibility} halo />}
      primary={{ label: T.actions.openSystemSettings }}
      secondary={{ label: T.actions.notNow }}
      state="waiting"
    />
  );
}

function AgentsScreen() {
  return (
    <Shell active="agents">
      <PageHeader title={T.nav.agents} action={<Button icon={Icon.newAgent}>{T.actions.newAgent}</Button>} />
      <div className="mt-6 grid grid-cols-2 gap-4">
        <AgentCard
          name={T.templates.officeHelper.name}
          description={T.templates.officeHelper.line}
          knowledgeBases={["Records manual"]}
          onStart={() => {}}
        />
        <AgentCard
          name={T.templates.teacher.name}
          description={T.templates.teacher.line}
          knowledgeBases={["DepEd forms"]}
          onStart={() => {}}
          startVariant="secondary"
        />
        <AgentCard
          name={T.templates.studyBuddy.name}
          description={T.templates.studyBuddy.line}
          knowledgeBases={["Science 6"]}
          onStart={() => {}}
          startVariant="secondary"
        />
        <NewAgentCard />
      </div>
    </Shell>
  );
}

type Length = "short" | "medium" | "long";

function AgentEditorScreen() {
  const [length, setLength] = useState<Length>("short");
  const [voice, setVoice] = useState(SAMPLE.voices[0].id);
  const [speed, setSpeed] = useState(1);
  return (
    <Shell active="agents">
      <PageHeader
        eyebrow={T.nav.agents}
        title={T.templates.officeHelper.name}
        action={
          <Button variant="secondary" icon={Icon.tryThisAgent}>
            {T.actions.tryThisAgent}
          </Button>
        }
      />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <Panel title={T.agent.sectionVoice} className="col-span-2">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-label text-text">{T.agent.lengthLabel}</p>
              <SegmentedControl<Length>
                label={T.agent.lengthLabel}
                value={length}
                onChange={setLength}
                block
                options={[
                  { value: "short", label: T.agent.lengthShort },
                  { value: "medium", label: T.agent.lengthMedium },
                  { value: "long", label: T.agent.lengthLong },
                ]}
              />
            </div>
            <VoicePicker voices={SAMPLE.voices} value={voice} onChange={setVoice} onPlaySample={() => {}} />
            <Slider label={T.agent.speedLabel} value={speed} onChange={setSpeed} min={0.75} max={1.5} step={0.25} format={fmtSpeed} />
          </div>
        </Panel>
        <Panel title={T.agent.sectionKnowledgeBases} className="col-span-2">
          <KnowledgeBaseList>
            <KnowledgeBaseRow name="Records manual 2026.pdf" pages={48} passages={312} status="ready" />
          </KnowledgeBaseList>
        </Panel>
      </div>
    </Shell>
  );
}

function KnowledgeScreen() {
  return (
    <Shell active="kb">
      <PageHeader
        eyebrow={T.knowledgeBase.documentsCount(4)}
        title={T.nav.knowledgeBases}
      />
      <div className="mt-6 flex flex-col gap-6">
        <DropZone onFiles={() => {}} mascot={false} halo={false} />
        <Panel padding="md">
          <ImportProgress page={12} total={48} />
          <KnowledgeBaseList className="mt-2">
            <KnowledgeBaseRow name="Barangay clearance steps.pdf" pages={48} status="processing" mascot />
            <KnowledgeBaseRow name="Records manual 2026.pdf" pages={48} passages={312} status="ready" />
            <KnowledgeBaseRow name="Front desk script.txt" pages={2} passages={9} status="ready" />
            <KnowledgeBaseRow name="Memo 0423 scan.pdf" pages={3} status="failed" reason={T.states.scannedPdf.title} />
          </KnowledgeBaseList>
        </Panel>
      </div>
    </Shell>
  );
}

function OverlayScreen() {
  const [print] = SAMPLE.appButtons.slice(-1);
  return (
    <Surface as="div" texture="none" tone="canvas" className="relative h-full">
      {/* A third-party app under the overlay (sample). */}
      <div className="absolute inset-8 rounded-window border border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border p-4">
          {SAMPLE.appButtons.slice(0, -1).map((b) => (
            <Button key={b} variant="ghost" size="sm" tabIndex={-1}>
              {b}
            </Button>
          ))}
          <TargetHalo>
            <Button variant="secondary" size="sm" tabIndex={-1}>
              {print}
            </Button>
          </TargetHalo>
          <GetCkoSprite pose={pointPoseFor("right")} flip scale={2} label={T.mascot.pointingAt(print)} className="ml-2" />
        </div>
        <div className="grid grid-cols-3 gap-3 p-6" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="h-10 rounded-input border border-border bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="absolute bottom-12 left-12">
        <SessionBar agent={T.templates.officeHelper.name} platform="mac" speaking hideHint />
      </div>
      <AnswerCard
        className="absolute right-12 bottom-12"
        agent={T.templates.officeHelper.name}
        question={SAMPLE.question}
        step={{ n: 2, total: 5, onNext: () => {} }}
        citations={[{ source: "Records manual", page: 12 }]}
        latency={MEASURED.firstSpokenWord ?? undefined}
      >
        {say.pointClick(print, "upper right")}
      </AnswerCard>
    </Surface>
  );
}

/** The four answer card variants, as they land on the overlay. */
function VariantsScreen() {
  const agent = T.templates.officeHelper.name;
  return (
    <Surface as="div" texture="none" tone="canvas" className="grid h-full grid-cols-2 content-center justify-items-center gap-6 p-8">
      <AnswerCard agent={agent} question={SAMPLE.question} citations={[{ source: "Records manual", page: 12 }]}>
        {say.pointClick("Print", "upper right")}
      </AnswerCard>
      <AnswerCard variant="bestGuess" agent={agent} question={SAMPLE.question}>
        {say.pointClick("Print", "upper right")}
      </AnswerCard>
      <AnswerCard variant="dontKnow" agent={agent} question={SAMPLE.question}>
        {say.dontKnow}
      </AnswerCard>
      <AnswerCard variant="noTarget" agent={agent} question={SAMPLE.question}>
        {say.noTarget}
      </AnswerCard>
    </Surface>
  );
}

function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const [speed, setSpeed] = useState(1);
  return (
    <Shell active="settings">
      <PageHeader title={T.settings.title} />
      <div className="mt-6 flex flex-col gap-4">
        <Panel title={T.settings.shortcut} actions={<Keycap hotkey platform="mac" />}>
          <p className="text-label font-normal text-text-2">{T.settings.shortcutHelp}</p>
        </Panel>
        <Panel title={T.settings.theme}>
          <SegmentedControl<ThemePref>
            label={T.settings.theme}
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: T.settings.themeLight },
              { value: "dark", label: T.settings.themeDark },
              { value: "system", label: T.settings.themeSystem },
            ]}
          />
        </Panel>
        <Panel title={T.settings.models} actions={<StatusChip status="ready" />}>
          <p className="text-label font-normal text-text-2">{T.settings.modelsHelp}</p>
        </Panel>
        <Panel title={T.settings.voice}>
          <Toggle label={T.settings.answerOutLoud} description={T.settings.answerOutLoudHelp} defaultChecked />
          <Slider label={T.settings.speakingSpeed} value={speed} onChange={setSpeed} min={0.75} max={1.5} step={0.25} format={fmtSpeed} />
        </Panel>
      </div>
    </Shell>
  );
}

/** Honest numbers: only MEASURED values. All null today, so every Stat renders nothing. */
function SpeedScreen() {
  const stats = [
    { label: T.stats.firstSpokenWord, value: MEASURED.firstSpokenWord, unit: T.stats.unitSeconds, digits: 1 },
    { label: T.stats.tokensPerSecond, value: MEASURED.tokensPerSecond, unit: T.stats.unitTokens, digits: 0 },
    { label: T.stats.pdfToReady, value: MEASURED.pdfToReady, unit: T.stats.unitSeconds, digits: 1 },
    { label: T.stats.bytesSent, value: MEASURED.bytesSent, unit: T.stats.unitBytes, digits: 0 },
  ];
  const measured = stats.some((s) => s.value != null);
  return (
    <Shell active="speed">
      <PageHeader title={T.nav.benchmark} action={<Button icon={Icon.start}>{BOARD.runSpeedTest}</Button>} />
      <div className="mt-6 flex flex-col gap-6">
        {measured ? (
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} unit={s.unit} digits={s.digits} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={T.states.benchmark.empty.title}
            body={T.states.benchmark.empty.body}
            moment="ready"
            halo={false}
          />
        )}
        <ProofLine
          items={[
            T.proof.wifiOff,
            MEASURED.bytesSent != null ? T.proof.bytesSent(MEASURED.bytesSent) : null,
            measured ? T.proof.measuredOn : null,
            MAC,
          ]}
        />
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Moments, parts, tokens

const MOMENT_ORDER: Moment[] = [
  "listening",
  "thinking",
  "screenHelp",
  "speaking",
  "processing",
  "ready",
  "failed",
  "offline",
  "empty",
  "moving",
  "idle",
  "onboarding",
  "endCard",
];

function MomentTile({ moment }: { moment: Moment }) {
  const word = T.moments[moment];
  return (
    <li className="flex flex-col overflow-hidden rounded-panel border border-border bg-surface">
      <div className="grid h-32 place-items-center border-b border-border bg-surface-2">
        <GetCkoSprite pose={MOMENT_POSE[moment]} scale={4} label={T.mascot.moment(word)} />
      </div>
      <div className="flex flex-col gap-0.5 px-4 pt-3 pb-4">
        <span className="text-row font-semibold text-text">{word}</span>
        {DEV && (
          <span className="font-mono text-keys text-text-3">
            {moment} · {MOMENT_POSE[moment]}
          </span>
        )}
      </div>
    </li>
  );
}

const ICONS: IconComponent[] = [
  Icon.screenHelp,
  Icon.pushToTalk,
  Icon.source,
  Icon.readAloud,
  Icon.target,
  Icon.knowledgeBase,
  Icon.agent,
  Icon.onThisMac,
  Icon.offline,
  Icon.ready,
  Icon.failed,
  Icon.hotkey,
  Icon.template,
  Icon.drop,
  Icon.switchAgent,
];

const TYPE = [
  { name: "Display", cls: "text-display font-display", sample: T.product.tagline },
  { name: "H1", cls: "text-h1 font-display", sample: T.nav.knowledgeBases },
  { name: "H2", cls: "text-h2 font-display", sample: T.knowledgeBase.emptyTitle },
  { name: "Answer", cls: "text-answer", sample: say.pointClick("Save", "upper right") },
  { name: "Label", cls: "text-label", sample: T.actions.addDocuments },
  { name: "Eyebrow", cls: "eyebrow", sample: T.agent.sectionVoice },
  { name: "Keys", cls: "text-keys font-mono nums", sample: sourceLabel("Manual", 4) },
  { name: "Pixel", cls: "font-pixel text-pixel text-accent-text", sample: T.product.tagline },
];

const SEMANTIC: [name: string, cssVar: string][] = [
  ["bg", "--gc-bg"],
  ["surface", "--gc-surface"],
  ["surface-2", "--gc-surface-2"],
  ["border", "--gc-border"],
  ["text", "--gc-text"],
  ["text-2", "--gc-text-2"],
  ["accent", "--gc-accent-fill"],
  ["accent-wash", "--gc-accent-wash"],
  ["target", "--gc-target"],
  ["danger", "--gc-danger"],
  ["inverse", "--gc-inverse-bg"],
  ["chrome", "--gc-chrome-bg"],
];

function Swatches() {
  return (
    <ul className="grid grid-cols-4 gap-x-3 gap-y-4">
      {SEMANTIC.map(([name, v]) => (
        <li key={name} className="flex flex-col gap-1.5">
          <span className="h-12 rounded-tile border border-border" style={{ background: `var(${v})` }} aria-hidden="true" />
          <span className="font-mono text-keys text-text-2">{name}</span>
        </li>
      ))}
    </ul>
  );
}

function Part({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

function Parts() {
  const [dialog, setDialog] = useState(false);
  const toast = useToast();
  const del = T.confirm.deleteAgent(T.templates.teacher.name);
  return (
    <Panel padding="lg" className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-3">
      <Part label={B.parts.buttons}>
        <div className="flex flex-wrap items-center gap-3">
          <Button keycap="hotkey" platform="mac">
            {T.actions.ask}
          </Button>
          <Button variant="secondary" icon={Icon.addDocuments}>
            {T.actions.addDocuments}
          </Button>
          <Button variant="ghost">{T.actions.notNow}</Button>
        </div>
      </Part>
      <Part label={B.parts.iconButtons}>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton icon={Icon.pushToTalk} label={T.aria.holdToTalk} variant="accent" />
          <IconButton icon={Icon.pushToTalk} label={T.aria.listening} variant="accent" pressed />
          <Tooltip content={T.aria.screenHelp}>
            <IconButton icon={Icon.screenHelp} label={T.aria.screenHelp} />
          </Tooltip>
          <IconButton icon={Icon.readAloud} label={T.agent.answerOutLoudLabel} />
        </div>
      </Part>
      <Part label={B.parts.statusAndSources}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status="ready" />
          <StatusChip status="processing" />
          <StatusChip status="failed" />
          <OfflineBadge detail={MAC} />
          <CitationChip source="Manual" page={4} onClick={() => {}} />
        </div>
      </Part>
      <Part label={B.parts.fields}>
        <TextField label={T.agent.nameLabel} defaultValue={T.templates.officeHelper.name} />
      </Part>
      <Part label={B.parts.choices}>
        <Toggle label={T.agent.answerOutLoudLabel} defaultChecked />
        <Checkbox label={T.agent.baseRulesLabel} defaultChecked />
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Keycap hotkey platform="mac" />
          <Keycap hotkey platform="win" />
          <Keycap keys={["esc"]} platform="mac" />
        </div>
      </Part>
      <Part label={BOARD.feedback}>
        <Notice tone="info" title={T.offline.proof} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setDialog(true)}>
            {T.actions.delete}
          </Button>
          <Button variant="ghost" onClick={() => toast.show(T.toast.saved)}>
            {T.actions.save}
          </Button>
        </div>
        <ErrorNotice title={T.states.scannedPdf.title} onRetry={() => {}} />
      </Part>
      <Part label={B.parts.icons} className="lg:col-span-3">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-4 text-text" aria-label={B.parts.icons}>
          {ICONS.map((I, i) => (
            <li key={i} className="inline-flex">
              <I {...ICON_PROPS} />
            </li>
          ))}
          {ICONS.slice(0, 3).map((I, i) => (
            <li key={`x2-${i}`} className="inline-flex">
              <I {...ICON_PROPS} size={ICON_SIZE.x2} />
            </li>
          ))}
        </ul>
      </Part>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title={del.title}
        body={del.body}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              {del.cancel}
            </Button>
            <Button onClick={() => setDialog(false)}>
              {del.confirm}
            </Button>
          </>
        }
      />
      <Toast {...toast.props} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function Showcase() {
  const { resolved } = useTheme();

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Slim header bar. */}
      <Surface as="div" texture="none" tone="paper" className="sticky top-0 z-sticky border-b border-border">
        <div className={cn(WRAP, "flex h-16 items-center justify-between gap-6")}>
          <div className="flex items-center gap-4">
            <Wordmark size="md" />
            {DEV && <span className="font-mono text-keys text-text-3">{B.version}</span>}
          </div>
          <ThemeSwitch />
        </div>
      </Surface>

      {/* 1. Hero: the 3-second story. */}
      <GetCkoHero />

      {/* 2. How it works: four steps, no prose. */}
      <Surface texture="how" tone="canvas" className="border-y border-border" aria-labelledby="how-title">
        <div className={cn(WRAP, "flex flex-wrap items-center justify-between gap-10 py-16")}>
          <Head id="how-title" title={B.how.eyebrow} className="mb-0" />
          <Panel padding="lg" className="flex-1 lg:max-w-[760px]">
            <Steps
              className="justify-between"
              items={[
                { icon: Icon.pushToTalk, label: T.actions.ask },
                { pose: "screenHelp", label: BOARD.stepPoint },
                { icon: Icon.source, label: HERO_COPY.beats.source },
                { icon: Icon.offline, label: T.status.offline },
              ]}
            />
          </Panel>
        </div>
      </Surface>

      {/* 3. Screens: the real app at 1040 x 680. */}
      <Surface id="screens" texture="pointer" intensity="subtle" tone="paper" aria-labelledby="screens-title">
        <div className={cn(WRAP, "py-24")}>
          <Head id="screens-title" eyebrow={BOARD.screensEyebrow} title={BOARD.screensTitle} />
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-2">
            <Window caption={BOARD.onboarding}>
              <OnboardingScreen />
            </Window>
            <Window caption={BOARD.overlay}>
              <OverlayScreen />
            </Window>
            <Window caption={T.nav.agents}>
              <AgentsScreen />
            </Window>
            <Window caption={T.templates.officeHelper.name}>
              <AgentEditorScreen />
            </Window>
            <Window caption={T.nav.knowledgeBases}>
              <KnowledgeScreen />
            </Window>
            <Window caption={T.nav.settings}>
              <SettingsScreen />
            </Window>
            <Window caption={T.nav.benchmark}>
              <SpeedScreen />
            </Window>
            <Window caption={BOARD.variants}>
              <VariantsScreen />
            </Window>
          </div>

        </div>
      </Surface>

      {/* 4. GetCko moments: an ink island on the creature's own skin. */}
      <Surface texture="skin" intensity="subtle" tone="ink" aria-labelledby="moments-title">
        <div className={cn(WRAP, "py-24")}>
          <Head id="moments-title" eyebrow={B.moments.eyebrow} title={B.moments.title} />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {MOMENT_ORDER.map((m) => (
              <MomentTile key={m} moment={m} />
            ))}
          </ul>
        </div>
      </Surface>

      {/* 5. Brand keywords: words only. */}
      <Surface texture="weave" intensity="subtle" tone="paper" className="border-y border-border" aria-label={B.keywords.eyebrow}>
        <div className={cn(WRAP, "flex flex-wrap items-center gap-x-4 gap-y-3 py-12")}>
          <p className="eyebrow mr-4 text-text-2">{B.keywords.eyebrow}</p>
          {T.keywords.map((k) => (
            <Kw key={k.word} className="font-display text-h2 px-3 py-1">
              {k.word}
            </Kw>
          ))}
        </div>
      </Surface>

      {/* 6. Parts, with pothos rising from the bottom edge. */}
      <Surface texture="canopy-bottom" tone="canvas" aria-labelledby="parts-title">
        <div className={cn(WRAP, "pt-24 pb-48")}>
          <Head id="parts-title" eyebrow={B.parts.eyebrow} title={B.parts.title} />
          <Parts />
        </div>
      </Surface>

      {/* 7. Type and color, compact. */}
      <Surface
        texture={resolved === "dark" ? "footprints" : "dither-lo"}
        intensity="subtle"
        tone="paper"
        className="border-t border-border"
        aria-labelledby="type-title"
      >
        <div className={cn(WRAP, "grid grid-cols-1 gap-8 py-24 lg:grid-cols-12")}>
          <Panel padding="lg" className="lg:col-span-7">
            <Head id="type-title" eyebrow={B.type.eyebrow} title={BOARD.typeTitle} className="mb-4" />
            <ul className="flex flex-col">
              {TYPE.map((t) => (
                <li key={t.name} className="grid grid-cols-[96px_1fr] items-baseline gap-6 border-b border-border py-3 last:border-b-0">
                  <span className="font-mono text-keys text-text-3">{t.name}</span>
                  <span className={cn(t.cls, "min-w-0 truncate")}>{t.sample}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel padding="lg" className="self-start lg:col-span-5">
            <Head id="color-title" eyebrow={B.color.eyebrow} title={B.color.title} className="mb-6" />
            <Swatches />
            <p className="mt-6 flex items-center gap-2 text-caption text-text-2">
              <GeckoDot /> <Kw>{BOARD.greenShare}</Kw>
            </p>
          </Panel>
        </div>
      </Surface>

      {/* 8. Footer band: GetCko celebrates. */}
      <Surface as="footer" texture="footer" tone="paper" className="border-t border-border">
        <div className={cn(WRAP, "flex flex-wrap items-end justify-between gap-8 pt-20 pb-56")}>
          <div className="flex items-end gap-8">
            <img
              src={`/brand/gifs/celebrate-${resolved}.gif`}
              width={176}
              height={248}
              alt={T.mascot.moment(T.moments.endCard)}
              className="[image-rendering:pixelated]"
            />
            <p className="pb-6 font-pixel text-display text-accent-text">{B.footer.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pb-6">
            <OfflineBadge detail={MAC} />
            <Kw>{T.offline.nothingLeaves("mac")}</Kw>
          </div>
          {DEV && (
            <p className="w-full font-mono text-keys text-text-3">
              {B.version} · {B.sample} · {B.stillHint}
            </p>
          )}
        </div>
      </Surface>
    </div>
  );
}
