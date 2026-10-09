// Agent editor (design system §9.3): Instructions · Knowledge bases · Voice and language · Try it,
// Panels 48px apart, with a sticky save bar. Save/Cancel, Duplicate and Delete (with a confirm).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Agent } from "../../bindings/Agent";
import type { AgentDraft } from "../../bindings/AgentDraft";
import type { AnswerLength } from "../../bindings/AnswerLength";
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { Voice } from "../../bindings/Voice";
import { Icon } from "../../brand/icons";
import { T, fmtSpeed } from "../../brand/lexicon";
import {
  Button,
  Checkbox,
  Dialog,
  ErrorNotice,
  GeckoDot,
  LanguagePicker,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Slider,
  Surface,
  TextField,
  Toggle,
  VoicePicker,
} from "../../components/ui";
import { errorCopy } from "../../app/errors";
import { useAppNav } from "../../app/nav";
import { PLATFORM } from "../../app/platform";
import { AGENTS_COPY } from "./copy";
import {
  MAX_KNOWLEDGE_BASES,
  SPEED,
  blankDraft,
  clampSpeed,
  draftOf,
  cardLine,
  hasProblems,
  isDirty,
  isFilipinoVoice,
  languageOf,
  languageWord,
  liveKnowledgeBases,
  normalizeDraft,
  toggleKnowledgeBase,
  validateDraft,
} from "./model";
import { TryAgent } from "./TryAgent";

export interface AgentEditorProps {
  /** null = a new agent, not saved yet. */
  agent: Agent | null;
  active: boolean;
  knowledgeBases: KnowledgeBase[];
  voices: Voice[];
  /** Persist. Resolves with the stored agent; throws a GetckoError. */
  onSave: (draft: AgentDraft) => Promise<Agent>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onStart: () => Promise<void>;
  onBack: () => void;
}

const LENGTHS = [
  { value: "short", label: T.agent.lengthShort },
  { value: "normal", label: AGENTS_COPY.lengthNormal },
] as const;

export function AgentEditor({
  agent,
  active,
  knowledgeBases,
  voices,
  onSave,
  onDuplicate,
  onDelete,
  onStart,
  onBack,
}: AgentEditorProps) {
  const { go, setLeaveGuard } = useAppNav();
  const saved = useMemo<AgentDraft | null>(
    () => (agent ? { ...draftOf(agent), knowledgeBaseIds: liveKnowledgeBases(agent.knowledgeBaseIds, knowledgeBases) } : null),
    [agent, knowledgeBases],
  );
  const [draft, setDraft] = useState<AgentDraft>(() => saved ?? blankDraft());
  const [nameError, setNameError] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [busy, setBusy] = useState<"save" | "duplicate" | "delete" | "start" | null>(null);
  /** Delete, or leave with unsaved changes (then = where to go once confirmed). */
  const [confirm, setConfirm] = useState<{ kind: "delete" } | { kind: "discard"; then: () => void } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const dirty = isDirty(draft, saved);
  const set = <K extends keyof AgentDraft>(k: K, v: AgentDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const full = draft.knowledgeBaseIds.length >= MAX_KNOWLEDGE_BASES;
  const lang = languageWord(draft.language);
  const hasFilipino = voices.some((v) => isFilipinoVoice(v.language));

  const runBusy = async (kind: NonNullable<typeof busy>, f: () => Promise<void>) => {
    setBusy(kind);
    setError(undefined);
    try {
      await f();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    const d = normalizeDraft(draft);
    const problems = validateDraft(d);
    if (hasProblems(problems)) {
      if (problems.name) {
        setNameError(true);
        nameRef.current?.focus();
      }
      return;
    }
    void runBusy("save", async () => {
      const stored = await onSave(d);
      // Keep anything typed while the save was in flight; otherwise take what was stored.
      setDraft((now) => (isDirty(normalizeDraft(now), d) ? now : draftOf(stored)));
    });
  };

  const cancel = () => {
    if (!saved) onBack();
    else {
      setDraft(saved);
      setNameError(false);
      setError(undefined);
    }
  };

  /** Leave the editor: ask first when there are unsaved changes. */
  const leave = (then: () => void) => (dirty ? setConfirm({ kind: "discard", then }) : then());
  const back = () => leave(onBack);
  // The sidebar asks the same question before switching screens.
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => {
    if (!dirty) return;
    setLeaveGuard((proceed) => leaveRef.current(proceed));
    return () => setLeaveGuard(null);
  }, [dirty, setLeaveGuard]);

  const err = error === undefined ? null : errorCopy(error);
  const title = draft.name.trim() || agent?.name || AGENTS_COPY.untitled;

  return (
    <>
      <Button variant="ghost" size="sm" icon={Icon.back} onClick={back} aria-label={AGENTS_COPY.backAria} className="-ml-1 mb-2">
        {AGENTS_COPY.back}
      </Button>
      <PageHeader
        className="min-h-12"
        title={<span className="line-clamp-1">{title}</span>}
        action={
          agent &&
          (active ? (
            <InUse />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={Icon.start}
              disabled={busy !== null}
              onClick={() => void runBusy("start", onStart)}
              aria-label={T.aria.startAgent(agent.name)}
            >
              {T.actions.start}
            </Button>
          ))
        }
      />

      <Surface texture="footprints" intensity="subtle" className="flex flex-col gap-12 rounded-panel p-6">
        <Panel eyebrow={T.agent.sectionInstructions}>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                ref={nameRef}
                label={T.agent.nameLabel}
                value={draft.name}
                maxLength={60}
                autoComplete="off"
                error={nameError && !draft.name.trim() ? AGENTS_COPY.nameRequired : undefined}
                onChange={(e) => {
                  set("name", e.currentTarget.value);
                  if (e.currentTarget.value.trim()) setNameError(false);
                }}
              />
              <TextField
                label={AGENTS_COPY.descriptionLabel}
                helper={AGENTS_COPY.descriptionHelp}
                value={draft.description}
                // An empty description falls back to this line on the card, so show it here too.
                placeholder={cardLine({ description: "", instructions: draft.instructions, templateId: agent?.templateId ?? null })}
                maxLength={90}
                autoComplete="off"
                onChange={(e) => set("description", e.currentTarget.value)}
              />
            </div>
            <TextField
              multiline
              rows={5}
              label={T.agent.instructionsLabel}
              helper={T.agent.instructionsHelp}
              value={draft.instructions}
              onChange={(e) => set("instructions", e.currentTarget.value)}
            />
            <Toggle
              label={T.agent.baseRulesLabel}
              description={T.agent.baseRulesHelp}
              checked={draft.baseRules === "include"}
              onChange={(e) => set("baseRules", e.currentTarget.checked ? "include" : "replace")}
            />
          </div>
        </Panel>

        <Panel
          eyebrow={T.agent.sectionKnowledgeBases}
          actions={
            knowledgeBases.length > 0 && (
              <span
                className="font-mono text-keys nums text-text-2"
                aria-label={AGENTS_COPY.attachedAria(draft.knowledgeBaseIds.length, MAX_KNOWLEDGE_BASES)}
              >
                {AGENTS_COPY.attached(draft.knowledgeBaseIds.length, MAX_KNOWLEDGE_BASES)}
              </span>
            )
          }
        >
          {knowledgeBases.length === 0 ? (
            <Notice
              title={T.states.agentNoKnowledgeBases.title}
              action={
                <Button variant="ghost" size="sm" onClick={() => leave(() => go("knowledge"))}>
                  {T.actions.newKnowledgeBase}
                </Button>
              }
            >
              {T.states.agentNoKnowledgeBases.body}
            </Notice>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-label text-text-2">{T.agent.knowledgeBasesHelp}</p>
              <ul className="flex flex-col divide-y divide-border rounded-button border border-border px-4">
                {knowledgeBases.map((kb) => {
                  const on = draft.knowledgeBaseIds.includes(kb.id);
                  return (
                    <li key={kb.id}>
                      <Checkbox
                        label={kb.name}
                        description={T.knowledgeBase.documentsCount(kb.documentCount)}
                        checked={on}
                        disabled={!on && full}
                        onChange={() => set("knowledgeBaseIds", toggleKnowledgeBase(draft.knowledgeBaseIds, kb.id))}
                      />
                    </li>
                  );
                })}
              </ul>
              {/* None attached: the "0 of 5" count and the help line already say it. */}
              {full && <Notice tone="info">{T.agent.maxKnowledgeBases}</Notice>}
            </div>
          )}
        </Panel>

        <Panel eyebrow={T.agent.sectionVoice}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <LanguagePicker value={lang} onChange={(w) => set("language", languageOf(w))} />
            <Field label={T.agent.lengthLabel}>
              <SegmentedControl<AnswerLength>
                label={T.agent.lengthLabel}
                options={LENGTHS}
                value={draft.answerLength}
                onChange={(v) => set("answerLength", v)}
              />
            </Field>
            <VoicePicker
              voices={[
                { id: "", name: AGENTS_COPY.systemVoice },
                ...voices.map((v) => ({ id: v.id, name: v.name, lang: v.language })),
              ]}
              value={draft.voiceId ?? ""}
              onChange={(id) => set("voiceId", id || null)}
              language={lang}
              hasFilipinoVoice
            />
            <Slider
              label={T.agent.speedLabel}
              min={SPEED.min}
              max={SPEED.max}
              step={SPEED.step}
              value={clampSpeed(draft.speechRate)}
              format={fmtSpeed}
              onChange={(v) => set("speechRate", v)}
            />
            {lang !== "English" && !hasFilipino && (
              <Notice tone="info" className="col-span-2">
                {AGENTS_COPY.noFilipinoVoice(PLATFORM)}
              </Notice>
            )}
          </div>
        </Panel>

        <Panel eyebrow={T.agent.sectionTry}>
          <TryAgent
            agentId={agent?.id ?? null}
            agentName={agent?.name ?? title}
            language={agent?.language ?? draft.language}
            dirty={dirty && agent !== null}
          />
        </Panel>
      </Surface>

      <div className="sticky -bottom-8 z-sticky -mx-8 -mb-8 mt-8 flex flex-col gap-3 border-t border-border bg-bg px-8 py-4">
        {err && (
          <ErrorNotice title={err.title}>{err.body}</ErrorNotice>
        )}
        <div className="flex items-center gap-2">
          {agent && (
            <>
              {/* Duplicate copies the saved agent, so it waits for Save (no silent loss of edits). */}
              <Button
                variant="ghost"
                size="sm"
                icon={Icon.duplicate}
                disabled={busy !== null || dirty}
                title={dirty ? AGENTS_COPY.duplicateSaveFirst : undefined}
                onClick={() => void runBusy("duplicate", onDuplicate)}
              >
                {T.actions.duplicate}
              </Button>
              <Button variant="ghost" size="sm" icon={Icon.delete} disabled={busy !== null} onClick={() => setConfirm({ kind: "delete" })}>
                {T.actions.delete}
              </Button>
            </>
          )}
          <span className="flex-1" />
          {dirty && <span className="text-label text-text-2">{AGENTS_COPY.unsaved}</span>}
          <Button variant="secondary" size="sm" disabled={busy !== null || (!dirty && agent !== null)} onClick={cancel}>
            {T.actions.cancel}
          </Button>
          <Button size="sm" disabled={busy !== null || (!dirty && agent !== null)} onClick={save}>
            {T.actions.save}
          </Button>
        </div>
      </div>

      {agent && (
        <Dialog
          open={confirm?.kind === "delete"}
          onClose={() => setConfirm(null)}
          title={T.confirm.deleteAgent(agent.name).title}
          body={T.confirm.deleteAgent(agent.name).body}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>
                {T.confirm.deleteAgent(agent.name).cancel}
              </Button>
              <Button
                size="sm"
                icon={Icon.delete}
                onClick={() => {
                  setConfirm(null);
                  void runBusy("delete", onDelete);
                }}
              >
                {T.confirm.deleteAgent(agent.name).confirm}
              </Button>
            </>
          }
        />
      )}
      <Dialog
        open={confirm?.kind === "discard"}
        onClose={() => setConfirm(null)}
        title={AGENTS_COPY.discard.title}
        body={AGENTS_COPY.discard.body}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>
              {AGENTS_COPY.discard.cancel}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const then = confirm?.kind === "discard" ? confirm.then : onBack;
                setConfirm(null);
                then();
              }}
            >
              {AGENTS_COPY.discard.confirm}
            </Button>
          </>
        }
      />
    </>
  );
}

/** A visible label over a control that carries its own aria-label (SegmentedControl). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="text-label text-text">
        {label}
      </span>
      {children}
    </div>
  );
}

/** The agent GetcKo uses now: the live dot plus words (never color alone). */
export function InUse() {
  return (
    <span className="inline-flex h-11 items-center gap-2 text-label text-text-2">
      <GeckoDot />
      {AGENTS_COPY.inUse}
    </span>
  );
}
