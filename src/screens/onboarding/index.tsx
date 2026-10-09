// Onboarding (first run, full window) and the setup status list for Settings.
// Reads setupStatus() through useSetup(); asks for permissions with permissionRequest(kind); leaves
// the "loading models" state when the 'engine' event lands (useSetup listens, nothing polls here).
// Never triggers a download: missing models are listed as missing.
import { useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { PermissionKind } from "../../bindings/PermissionKind";
import { GetCkoSprite, MOMENT_POSE } from "../../brand";
import { ICON_PROPS, Icon } from "../../brand/icons";
import { T, say } from "../../brand/lexicon";
import { Button, ErrorNotice, Notice, StatusChip, Surface, Wordmark } from "../../components/ui";
import { APP_COPY } from "../../app/copy";
import { errorCopy } from "../../app/errors";
import { PLATFORM } from "../../app/platform";
import { permissionOf, useSetup } from "../../app/setup";
import { useDelayed } from "../../app/useResource";
import { ComponentList } from "./ComponentList";
import { ONBOARDING_COPY } from "./copy";
import {
  INITIAL_FLOW,
  askState,
  checkAgainMode,
  firstOpenStep,
  flowReducer,
  gatedPermissions,
  offFeatures,
  readiness,
  stepsFor,
  type AskState,
  type StepId,
} from "./flow";
import { MockSettingsWindow, ShortcutKeys, StageCard } from "./Stage";
import { StepFrame } from "./StepFrame";

const PERMISSION: Record<PermissionKind, { name: string; title: string; body: string }> = {
  accessibility: {
    name: T.onboarding.permissionAccessibility,
    title: T.onboarding.accessibilityTitle,
    body: T.onboarding.accessibilityBody,
  },
  screenRecording: {
    name: T.onboarding.permissionScreenRecording,
    title: T.onboarding.screenRecordingTitle,
    body: T.onboarding.screenRecordingBody,
  },
  microphone: {
    name: T.onboarding.permissionMic,
    title: T.onboarding.micTitle,
    // Windows never pops up a question: the step only exists there once Windows refused.
    body: PLATFORM === "win" ? ONBOARDING_COPY.win.micBody : T.onboarding.micBody,
  },
};

/** Waiting line on a permission that is still off, by OS ("Waiting for macOS…" never shows on a PC). */
const waitingText = (): string => (PLATFORM === "win" ? ONBOARDING_COPY.win.waiting : T.onboarding.waiting);

/**
 * "Waiting for macOS…" or "Turned on". Nothing while idle. The waiting icon is static: nothing polls,
 * so the screen only moves when the person comes back or presses "Check again".
 */
function AskLine({ state }: { state: AskState }) {
  if (state === "waiting")
    return (
      <span className="inline-flex items-center gap-2 text-text-2">
        <Icon.info {...ICON_PROPS} />
        {waitingText()}
      </span>
    );
  if (state === "granted")
    return (
      <span className="inline-flex items-center gap-2 font-semibold text-accent-text">
        <Icon.ready {...ICON_PROPS} />
        {T.onboarding.granted}
      </span>
    );
  return null;
}

/** What still works while a permission is off. Screen Recording explains it is optional up front. */
function permissionNotice(kind: PermissionKind, state: AskState): ReactNode {
  if (state === "granted") return null;
  if (kind === "accessibility" && state === "waiting") {
    const c = ONBOARDING_COPY.off.screenHelp;
    return <Notice title={c.title}>{c.body}</Notice>;
  }
  if (kind === "screenRecording") {
    // macOS applies Screen Recording only after GetcKo opens again, so say so while it reads as off.
    if (state === "waiting") return <Notice title={ONBOARDING_COPY.off.screenshots.title}>{ONBOARDING_COPY.reopen}</Notice>;
    return <Notice title={ONBOARDING_COPY.optional.title}>{ONBOARDING_COPY.optional.body}</Notice>;
  }
  if (kind === "microphone" && state === "waiting") {
    return <Notice title={T.errors.micBlocked}>{ONBOARDING_COPY.off.holdToTalk.body}</Notice>;
  }
  return null;
}

/** Dev only (browser mock, screenshots): ?step=accessibility|screenRecording|microphone|ready. */
function devStep(status: Parameters<typeof stepsFor>[0]): StepId | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(window.location.search).get("step");
  return stepsFor(status, PLATFORM).find((s) => s === q) ?? null;
}

/** Full-window first run. Call onDone when the person continues into the app. */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const setup = useSetup();
  const { status } = setup;
  const [flow, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(undefined);
  const steps = useMemo(() => stepsFor(status, PLATFORM), [status]);

  // Start at the first thing that needs a look, once, when the first read lands.
  useEffect(() => {
    if (status && flow.step === null) dispatch({ type: "start", step: devStep(status) ?? firstOpenStep(status, PLATFORM) });
  }, [status, flow.step]);

  // Truthful after a trip to System Settings: read again when the window gets focus back (an event,
  // not polling). Only on permission steps, so it never races the models' 'engine' event.
  const onPermissionStep = flow.step !== null && flow.step !== "ready";
  const { refresh } = setup;
  useEffect(() => {
    if (!onPermissionStep) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [onPermissionStep, refresh]);

  const waiting = useDelayed(!status && setup.error === undefined);

  if (!status) {
    if (setup.error !== undefined) {
      const c = errorCopy(setup.error);
      return (
        <Surface texture="footprints" intensity="subtle" className="flex h-full flex-col p-8">
          <Wordmark size="md" />
          <div className="flex max-w-copy flex-1 flex-col justify-center gap-6 px-8">
            <ErrorNotice title={c.title} mascot moment="offline" onRetry={() => void setup.refresh()}>
              {c.body}
            </ErrorNotice>
            <div>
              <Button variant="ghost" onClick={onDone}>
                {T.actions.notNow}
              </Button>
            </div>
          </div>
        </Surface>
      );
    }
    return (
      // Branded from frame 0: the wordmark shows at once, GetcKo's moment only if the read is slow.
      <Surface texture="footprints" intensity="subtle" className="flex h-full flex-col p-8">
        <Wordmark size="md" />
        <div className="flex flex-1 items-center px-8">
          {waiting && (
            <div className="flex items-center gap-4" role="status">
              <GetCkoSprite pose={MOMENT_POSE.thinking} scale={3} label={T.mascot.moment(T.moments.thinking)} />
              <p className="text-body text-text-2">{APP_COPY.shell.checking}</p>
            </div>
          )}
        </div>
      </Surface>
    );
  }

  const step = flow.step ?? firstOpenStep(status, PLATFORM);
  const index = Math.max(0, steps.indexOf(step));
  const next = () => {
    setFailure(undefined);
    dispatch({ type: "next", steps });
  };
  const back = () => {
    setFailure(undefined);
    dispatch({ type: "back", steps });
  };
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setFailure(undefined);
    try {
      await task();
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(false);
    }
  };
  // A failed button press, else a failed re-read (refresh keeps the last status and sets error).
  const shown = failure !== undefined ? failure : setup.error;
  const failureNotice =
    shown !== undefined ? <ErrorNotice title={errorCopy(shown).title}>{errorCopy(shown).body}</ErrorNotice> : null;
  const backButton =
    index > 0 ? (
      <Button variant="ghost" size="sm" icon={Icon.back} onClick={back}>
        {T.actions.back}
      </Button>
    ) : null;

  const frame = { stepKey: step, dir: flow.dir, step: index + 1, total: steps.length, back: backButton };

  // ---- Permission steps ---------------------------------------------------------------------
  if (step !== "ready") {
    const kind = step;
    const p = PERMISSION[kind];
    const current = permissionOf(status, kind);
    const state = askState(current, flow.asked.includes(kind));
    const ask = () =>
      run(async () => {
        // "Check again" only reads the state again (no second macOS dialog), unless it was refused.
        if (state === "waiting" && checkAgainMode(current) === "refresh") return setup.refresh();
        // Remember the ask only once the OS answered (a failed call isn't "waiting for macOS").
        await setup.request(kind);
        dispatch({ type: "asked", kind });
      });
    return (
      <StepFrame
        {...frame}
        stepLabel={p.name}
        title={p.title}
        body={p.body}
        status={<AskLine state={state} />}
        notice={failureNotice ?? permissionNotice(kind, state)}
        // Off: GetcKo points at the switch. On: it's done pointing (the microphone starts listening).
        moment={state !== "granted" ? "screenHelp" : kind === "microphone" ? "listening" : "ready"}
        visual={<MockSettingsWindow permission={p.name} on={state === "granted"} />}
        actions={
          state === "granted" ? (
            <Button size="lg" onClick={next}>
              {T.actions.continue}
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                icon={state === "waiting" ? Icon.retry : undefined}
                onClick={() => void ask()}
                disabled={busy}
                aria-busy={busy || undefined}
              >
                {state === "waiting" ? T.onboarding.checkAgain : T.actions.openSystemSettings}
              </Button>
              <Button variant="ghost" onClick={next} disabled={busy}>
                {T.actions.notNow}
              </Button>
            </>
          )
        }
      />
    );
  }

  // ---- Ready step: models, then the shortcut ---------------------------------------------------
  const models = readiness(status);

  if (models === "ready") {
    const off = offFeatures(status);
    return (
      <StepFrame
        {...frame}
        stepLabel={T.settings.shortcut}
        title={T.onboarding.shortcutTitle}
        body={T.onboarding.shortcutBody}
        status={
          <span className="inline-flex items-center gap-2 font-semibold text-accent-text">
            <Icon.ready {...ICON_PROPS} />
            {/* "You're ready." only when nothing is off; otherwise just the fact about the models. */}
            {off.length === 0 ? say.en.onboardingDone : T.settings.modelsReady}
          </span>
        }
        notice={
          off.length > 0 ? (
            <div className="flex flex-col gap-2">
              {off.map((f) => (
                <Notice key={f} title={ONBOARDING_COPY.off[f].title}>
                  {ONBOARDING_COPY.off[f].body}
                </Notice>
              ))}
            </div>
          ) : null
        }
        moment="screenHelp"
        stageTone="ink"
        visual={<ShortcutKeys />}
        // The one Silkscreen badge on the screen, beside GetcKo (design system §3).
        aside={<span className="font-pixel text-pixel text-accent-text">{T.product.tagline}</span>}
        actions={
          <Button size="lg" onClick={onDone}>
            {T.actions.start}
          </Button>
        }
      />
    );
  }

  // The headline says it once; the list carries one chip per model (no extra status line).
  const loadingModels = models === "loading";
  const c = loadingModels ? ONBOARDING_COPY.loading : ONBOARDING_COPY.missing;
  return (
    <StepFrame
      {...frame}
      stepLabel={T.settings.models}
      title={c.title}
      body={c.body}
      notice={failureNotice}
      moment={loadingModels ? "processing" : "offline"}
      // GetcKo stands beside the list (it isn't pointing here), so the list sits on the floor with it.
      grounded
      visual={
        <StageCard title={T.settings.models}>
          <ComponentList status={status} />
        </StageCard>
      }
      actions={
        loadingModels ? (
          <Button size="lg" onClick={onDone}>
            {T.actions.start}
          </Button>
        ) : (
          <>
            <Button size="lg" icon={Icon.retry} onClick={() => void run(setup.refresh)} disabled={busy} aria-busy={busy || undefined}>
              {T.onboarding.checkAgain}
            </Button>
            <Button variant="ghost" onClick={onDone} disabled={busy}>
              {T.actions.notNow}
            </Button>
          </>
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Settings

/** Setup status for Settings: permissions and components. Reads setup_status again on open. */
export function SetupPanel() {
  const setup = useSetup();
  const { status, refresh } = setup;
  const [asked, setAsked] = useState<PermissionKind[]>([]);
  const [busy, setBusy] = useState<PermissionKind | "refresh" | null>(null);
  const [failure, setFailure] = useState<unknown>(undefined);

  // Truthful after a trip to System Settings: read again whenever Settings opens.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (who: PermissionKind | "refresh", task: () => Promise<unknown>) => {
    setBusy(who);
    setFailure(undefined);
    try {
      await task();
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(null);
    }
  };

  if (!status) {
    if (setup.error !== undefined) {
      const c = errorCopy(setup.error);
      return (
        <ErrorNotice title={c.title} onRetry={() => void refresh()}>
          {c.body}
        </ErrorNotice>
      );
    }
    return null;
  }

  const kinds = gatedPermissions(status, PLATFORM);
  const off = offFeatures(status);
  // A failed button press, else a failed re-read (the last status stays on screen, so say it is stale).
  const shown = failure !== undefined ? failure : setup.error;

  const hintFor = (kind: PermissionKind, state: AskState): ReactNode => {
    if (kind === "accessibility" && off.includes("screenHelp")) {
      const h = ONBOARDING_COPY.off.screenHelp;
      return (
        <>
          <span className="font-semibold">{h.title}</span> {h.body}
        </>
      );
    }
    if (kind === "screenRecording" && state === "waiting") return ONBOARDING_COPY.reopen;
    if (kind === "screenRecording" && state !== "granted") {
      const h = ONBOARDING_COPY.optional;
      return (
        <>
          <span className="font-semibold">{h.title}</span> {h.body}
        </>
      );
    }
    if (kind === "microphone" && off.includes("holdToTalk")) {
      const h = ONBOARDING_COPY.off.holdToTalk;
      return (
        <>
          <span className="font-semibold">{h.title}</span> {h.body}
        </>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-4">
      {kinds.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-label font-semibold text-text-2">{T.settings.permissions}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {kinds.map((kind) => {
              const current = permissionOf(status, kind);
              const state = askState(current, asked.includes(kind));
              const hint = hintFor(kind, state);
              return (
                <li key={kind} className="flex min-h-11 flex-col justify-center gap-0.5 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-row text-text">{PERMISSION[kind].name}</span>
                    {state === "granted" ? (
                      <StatusChip status="ready">{T.onboarding.granted}</StatusChip>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(kind, async () => {
                            // "Check again" reads again (no second macOS dialog) unless it was refused.
                            if (state === "waiting" && checkAgainMode(current) === "refresh") return refresh();
                            await setup.request(kind);
                            setAsked((a) => (a.includes(kind) ? a : [...a, kind]));
                          })
                        }
                      >
                        {state === "waiting" ? T.onboarding.checkAgain : T.actions.openSystemSettings}
                      </Button>
                    )}
                  </div>
                  {hint && <p className="text-label text-text-2">{hint}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={kinds.length > 0 ? "flex flex-col gap-1 border-t border-border pt-4" : "flex flex-col gap-1"}>
        <h3 className="text-label font-semibold text-text-2">{T.settings.models}</h3>
        <ComponentList status={status} />
      </section>

      {shown !== undefined && <ErrorNotice title={errorCopy(shown).title}>{errorCopy(shown).body}</ErrorNotice>}

      <div>
        <Button
          size="sm"
          variant="ghost"
          icon={Icon.retry}
          disabled={busy !== null}
          onClick={() => void run("refresh", refresh)}
        >
          {T.onboarding.checkAgain}
        </Button>
      </div>
    </div>
  );
}
