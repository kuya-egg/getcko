// Component QA sheet: every v0.3 component at the 1040 x 680 window size (and the 900 minimum),
// light or dark via ?theme=. Visual QA, not product UI; sample content is labeled as such.
import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import "../../src/brand/index.css";
import { ICON_PROPS, Icon } from "../../src/brand/icons";
import { MEASURED, PLACE, T, say, type AgentLanguage } from "../../src/brand/lexicon";
import { injectTextureStyles } from "../../src/brand/textures";
import {
  AnswerCard,
  AppShell,
  Button,
  Dialog,
  DropZone,
  ImportProgress,
  Keycap,
  KnowledgeBaseList,
  KnowledgeBaseRow,
  Kw,
  LanguagePicker,
  MockToggle,
  Notice,
  OfflineBadge,
  OnboardingStep,
  PageHeader,
  ProofLine,
  SegmentedControl,
  Select,
  Slider,
  Stat,
  StepSquares,
  Steps,
  Tabs,
  Toast,
  Tooltip,
  VoicePicker,
  Wordmark,
  IconButton,
  useToast,
} from "../../src/components/ui";

injectTextureStyles();
const params = new URLSearchParams(location.search);
const NOW = new Date("2026-10-09T10:00:00");

const NAV = [
  { id: "agents", label: T.nav.agents },
  { id: "kb", label: T.nav.knowledgeBases },
  { id: "try", label: T.nav.try },
  { id: "speed", label: T.nav.benchmark },
  { id: "settings", label: T.nav.settings },
  { id: "about", label: T.nav.about },
];

function Frame({ w = 1040, h = 680, label, children }: { w?: number; h?: number; label: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="font-mono text-keys text-text-3">{label}</figcaption>
      <div className="overflow-hidden rounded-window border border-border-strong shadow-card" style={{ width: w, height: h }}>
        {children}
      </div>
    </figure>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="font-mono text-keys text-text-3">{title}</h2>
      {children}
    </section>
  );
}

function KnowledgeScreen({ dragging }: { dragging?: boolean }) {
  return (
    <AppShell
      contained
      nav={NAV}
      active="kb"
      onNavigate={() => {}}
      footer={<OfflineBadge detail={PLACE.mac.onThis} />}
    >
      <PageHeader
        title={T.nav.knowledgeBases}
        hint={T.knowledgeBase.emptyBody}
        action={<Button icon={Icon.add}>{T.actions.newKnowledgeBase}</Button>}
      />
      <DropZone onFiles={() => {}} dragging={dragging} />
      <KnowledgeBaseList className="mt-6 rounded-panel border border-border bg-surface px-5">
        <KnowledgeBaseRow name="Records office manual.pdf" pages={48} passages={312} bytes={2_400_000} addedAt={NOW} status="ready" />
        <KnowledgeBaseRow
          name="DepEd grading guide.docx"
          status="processing"
          meta={<ImportProgress page={12} total={48} className="mt-1" />}
        />
        <KnowledgeBaseRow name="Scan 0042.pdf" status="failed" reason="scanned image" bytes={812_000} addedAt="2025-12-01" />
      </KnowledgeBaseList>
    </AppShell>
  );
}

function Controls() {
  const [len, setLen] = useState<"short" | "medium" | "long">("short");
  const [lang, setLang] = useState<AgentLanguage>("Taglish");
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState("samantha");
  const [tab, setTab] = useState<"instructions" | "kb" | "voice">("voice");
  const tipRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    tipRef.current?.querySelector("button")?.focus();
  }, []);
  return (
    <div className="grid grid-cols-2 gap-8 rounded-panel border border-border bg-surface p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-label text-text">{T.agent.lengthLabel}</span>
          <SegmentedControl
            label={T.agent.lengthLabel}
            value={len}
            onChange={setLen}
            options={[
              { value: "short", label: T.agent.lengthShort },
              { value: "medium", label: T.agent.lengthMedium },
              { value: "long", label: T.agent.lengthLong },
            ]}
          />
        </div>
        <LanguagePicker value={lang} onChange={setLang} />
        <Select
          label={T.agent.answerOutLoudLabel}
          options={[
            { value: "on", label: T.agent.answerOutLoudLabel },
            { value: "off", label: T.actions.notNow },
          ]}
          helper={T.agent.answerOutLoudHelp}
        />
        <Slider label={T.settings.speakingSpeed} value={speed} onChange={setSpeed} />
      </div>
      <div className="flex flex-col gap-6">
        <VoicePicker
          voices={[
            { id: "samantha", name: "Samantha", lang: "en-US" },
            { id: "daniel", name: "Daniel", lang: "en-GB" },
          ]}
          value={voice}
          onChange={setVoice}
          onPlaySample={() => {}}
          language={lang}
        />
        <Tabs
          label={T.agent.sectionVoice}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "instructions", label: T.agent.sectionInstructions, panel: <p className="text-body text-text-2">{T.agent.instructionsHelp}</p> },
            { value: "kb", label: T.agent.sectionKnowledgeBases, panel: <p className="text-body text-text-2">{T.agent.knowledgeBasesHelp}</p> },
            { value: "voice", label: T.agent.sectionVoice, panel: <p className="text-body text-text-2">{T.agent.answerOutLoudHelp}</p> },
          ]}
        />
        <div className="flex items-center gap-3 pt-10">
          <span ref={tipRef}>
            <Tooltip content={T.settings.micHelp}>
              <IconButton icon={Icon.info} label={T.aria.moreInfo} noTooltip />
            </Tooltip>
          </span>
          <span className="text-label text-text-2">{T.settings.mic}</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const toast = useToast(60_000);
  const [dialog, setDialog] = useState(params.has("dialog"));
  useEffect(() => {
    toast.show(T.toast.saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const confirm = T.confirm.deleteAgent("Office Helper");

  return (
    <div className="flex flex-col gap-10 bg-bg p-8 text-text" style={{ width: 1120 }}>
      <header className="flex items-end justify-between">
        <Wordmark size="lg" />
        <span className="font-mono text-keys text-text-3">components v0.3 · {document.documentElement.dataset.theme}</span>
      </header>

      <Frame label="AppShell + PageHeader + DropZone + ImportProgress · 1040 x 680">
        <KnowledgeScreen />
      </Frame>
      <Frame w={900} h={600} label="Same screen at the 900 x 600 minimum · drag-over">
        <KnowledgeScreen dragging />
      </Frame>

      <Frame label="OnboardingStep · step 3 of 4 · waiting">
        <OnboardingStep
          step={3}
          total={4}
          title={T.onboarding.micTitle}
          body={T.onboarding.micBody}
          visual={<MockToggle on={false} permission={T.onboarding.permissionMic} />}
          primary={{ label: T.actions.openSystemSettings, icon: Icon.openExternal }}
          secondary={{ label: T.onboarding.checkAgain }}
          state="waiting"
        />
      </Frame>
      <Frame w={900} h={600} label="OnboardingStep · 900 x 600 · granted · shortcut visual">
        <OnboardingStep
          step={4}
          total={4}
          title={T.onboarding.shortcutTitle}
          body={T.onboarding.shortcutBody}
          visual={<Keycap hotkey className="target-halo" />}
          primary={{ label: T.onboarding.finish }}
          secondary={{ label: T.actions.back, icon: Icon.back }}
          state="granted"
        />
      </Frame>

      <Section title="Pickers · SegmentedControl · Select · Slider · VoicePicker · LanguagePicker · Tabs · Tooltip (focused)">
        <Controls />
      </Section>

      <Section title="AnswerCard variants">
        <div className="grid grid-cols-2 items-start gap-8">
          <AnswerCard
            agent="Office Helper"
            question="Saan ko ilalagay ang grade ni Juan?"
            citations={[{ source: "Grading guide", page: 4 }]}
            step={{ n: 2, total: 4, onNext: () => {} }}
          >
            I-click mo ang <b>Save</b> sa taas, kanan. Doon nase-save ang grade sheet.
          </AnswerCard>
          <AnswerCard variant="bestGuess" agent="Office Helper" question="Where is Export?" citations={[{ source: "Manual", page: 12 }]}>
            Click <b>File</b>, then <b>Export</b>. This is from a screenshot, so check the menu.
          </AnswerCard>
          <AnswerCard variant="dontKnow" agent="Office Helper" question="What is the leave policy?">
            {say.en.dontKnow}
          </AnswerCard>
          <AnswerCard variant="noTarget" agent="Office Helper" question="Where is Print preview?" citations={[{ source: "Manual", page: 7 }]}>
            Open <b>File</b> first. Print preview is inside it.
          </AnswerCard>
        </div>
      </Section>

      <Section title="Explanatory copy · Kw · Steps · Notice · ProofLine · Stat (null renders nothing)">
        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-6 rounded-panel border border-border bg-surface p-6">
            <p className="max-w-copy text-body text-text-2">
              Press <Kw>⌥ Space</Kw> in any app, ask out loud, and GetcKo points at the <Kw>button</Kw>.
            </p>
            <Steps
              items={[
                { icon: Icon.pushToTalk, label: T.nav.ask },
                { pose: "screenHelp", label: T.product.name },
                { icon: Icon.target, label: "One ring" },
                { icon: Icon.source, label: T.answerCard.sourcesLabel },
              ]}
            />
            <ProofLine
              items={[T.proof.wifiOff, MEASURED.bytesSent != null && T.proof.bytesSent(MEASURED.bytesSent), PLACE.mac.onThis]}
            />
          </div>
          <div className="flex flex-col gap-4">
            <Notice>{T.agent.tryNotSaved}</Notice>
            <Notice tone="info">{T.agent.noFilipinoVoice}</Notice>
            <Notice tone="info" title={T.states.agentNoKnowledgeBases.title} action={<Button variant="ghost" size="sm">{T.actions.addDocuments}</Button>}>
              {T.states.agentNoKnowledgeBases.body}
            </Notice>
            <div className="flex items-start gap-8 rounded-panel border border-border bg-surface p-5">
              <Stat label={T.stats.firstSpokenWord} value={MEASURED.firstSpokenWord} unit={T.stats.unitSeconds} />
              <Stat label="Layout sample, not measured" value={0.9} unit={T.stats.unitSeconds} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Parts · Wordmark sm/md · StepSquares · MockToggle on · ImportProgress · new icons">
        <div className="flex flex-wrap items-center gap-8 rounded-panel border border-border bg-surface p-6">
          <Wordmark size="sm" />
          <Wordmark size="md" />
          <StepSquares step={2} total={4} />
          <MockToggle on permission={T.onboarding.permissionAccessibility} />
          <ImportProgress page={48} total={48} />
          <div className="flex items-center gap-3 text-text">
            <Icon.switchAgent {...ICON_PROPS} />
            <Icon.chevronDown {...ICON_PROPS} />
            <Icon.mic {...ICON_PROPS} />
            <Icon.back {...ICON_PROPS} />
            <Icon.search {...ICON_PROPS} />
            <Icon.info {...ICON_PROPS} />
            <Icon.drop {...ICON_PROPS} />
          </div>
          <div className="flex items-center gap-3 text-text">
            <Icon.switchAgent {...ICON_PROPS} size={48} />
            <Icon.chevronDown {...ICON_PROPS} size={48} />
            <Icon.mic {...ICON_PROPS} size={48} />
            <Icon.drop {...ICON_PROPS} size={48} />
          </div>
        </div>
      </Section>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title={confirm.title}
        body={confirm.body}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog(false)}>
              {confirm.cancel}
            </Button>
            <Button icon={Icon.delete}>{confirm.confirm}</Button>
          </>
        }
      />
      <Toast {...toast.props} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
