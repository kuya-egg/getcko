// Main window: first-run gate (onboarding, full window) → AppShell with three screens.
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { gsap } from "gsap";
import { DUR, EASE, GetCkoSprite, MOMENT_POSE, prefersReducedMotion } from "../brand";
import { T } from "../brand/lexicon";
import { AppShell, ErrorNotice, Keycap, OfflineBadge, StatusChip, type NavItem } from "../components/ui";
import { AgentsScreen } from "../screens/agents";
import { KnowledgeBasesScreen } from "../screens/knowledge";
import { OnboardingScreen } from "../screens/onboarding";
import { APP_COPY } from "./copy";
import { errorCopy } from "./errors";
import { AppNavContext, initialRoute, type AppNav, type LeaveGuard, type Screen } from "./nav";
import { place } from "./platform";
import { SettingsScreen } from "./SettingsScreen";
import { missingComponents, modelsLoading, needsSetup, useSetup } from "./setup";
import { useDelayed } from "./useResource";

const NAV: NavItem[] = [
  { id: "agents", label: T.nav.agents },
  { id: "knowledge", label: T.nav.knowledgeBases },
  { id: "settings", label: T.nav.settings },
];

/**
 * Screens whose textured section runs to the bottom of the pane (the screen's last block takes
 * `flex-1`), so a short list never leaves a bare strip of page under it.
 */
const FILL: ReadonlySet<Screen> = new Set(["knowledge", "settings"]);

const SCREEN: Record<Screen, ComponentType> = {
  agents: AgentsScreen,
  knowledge: KnowledgeBasesScreen,
  settings: SettingsScreen,
};

export function MainWindow() {
  const setup = useSetup();
  const [route] = useState(initialRoute);
  const [screen, setScreen] = useState<Screen>(route.screen);
  /** null = not decided yet (waiting for the first setup read). */
  const [onboarding, setOnboarding] = useState<boolean | null>(route.onboarding ? true : null);

  // Decide once, on the first setup read. After that only onDone / showOnboarding change it,
  // so granting a permission mid-flow never yanks the person out of onboarding.
  if (onboarding === null && setup.status) setOnboarding(needsSetup(setup.status));
  if (onboarding === null && setup.error) setOnboarding(false);

  const go = useCallback((s: Screen) => setScreen(s), []);
  const leaveGuard = useRef<LeaveGuard | null>(null);
  const setLeaveGuard = useCallback((g: LeaveGuard | null) => {
    leaveGuard.current = g;
  }, []);
  const nav = useMemo<AppNav>(
    () => ({ screen, go, showOnboarding: () => setOnboarding(true), setLeaveGuard }),
    [screen, go, setLeaveGuard],
  );
  /** Sidebar switch: ask the current screen first when it holds unsaved work. */
  const navigate = (id: string) => {
    const next = id as Screen;
    if (next === screen) return;
    const proceed = () => setScreen(next);
    if (leaveGuard.current) leaveGuard.current(proceed);
    else proceed();
  };

  const waiting = useDelayed(onboarding === null);

  if (onboarding === null) return <Checking shown={waiting} />;

  if (onboarding) {
    return (
      <AppNavContext.Provider value={nav}>
        <div className="h-dvh min-h-0 overflow-hidden bg-bg text-text">
          <OnboardingScreen
            onDone={() => {
              setOnboarding(false);
              void setup.refresh();
            }}
          />
        </div>
      </AppNavContext.Provider>
    );
  }

  const Current = SCREEN[screen];
  return (
    <AppNavContext.Provider value={nav}>
      <AppShell nav={NAV} active={screen} onNavigate={navigate} footer={<ShellFooter />}>
        {setup.error !== undefined && !setup.status && (
          <ErrorNotice title={errorCopy(setup.error).title} onRetry={() => void setup.refresh()} className="mb-6">
            {errorCopy(setup.error).body}
          </ErrorNotice>
        )}
        <Crossfade id={screen} fill={FILL.has(screen)}>
          <Current />
        </Crossfade>
      </AppShell>
    </AppNavContext.Provider>
  );
}

/**
 * Sidebar footer: the one gesture worth remembering (the shortcut, from any app), the offline proof,
 * and the model state only while it needs a look.
 */
function ShellFooter() {
  const { status } = useSetup();
  const missing = missingComponents(status).length > 0;
  return (
    <>
      <p className="flex items-center gap-2 pb-1 text-label text-text-2">
        <Keycap hotkey />
        <span>{T.sessionBar.shortcutHint}</span>
      </p>
      {modelsLoading(status) && <StatusChip status="processing" className="self-start">{T.settings.models}</StatusChip>}
      {missing && <StatusChip status="failed" className="self-start">{T.settings.modelsNotLoaded}</StatusChip>}
      <OfflineBadge detail={place.onThis} className="self-start" />
    </>
  );
}

/** Nav switch = crossfade only, no slide (design system §5.6). */
function Crossfade({ id, fill, children }: { id: string; fill?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const tween = gsap.fromTo(
      el,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: prefersReducedMotion() ? DUR.instant : DUR.fast, ease: EASE.out },
    );
    return () => {
      tween.kill();
      gsap.set(el, { autoAlpha: 1 });
    };
  }, [id]);
  return (
    <div ref={ref} key={id} className={fill ? "flex min-h-full flex-col" : undefined}>
      {children}
    </div>
  );
}

/** First setup read. Blank for 300ms, then GetcKo's thinking moment (never a spinner block). */
function Checking({ shown }: { shown: boolean }) {
  return (
    <div className="flex h-dvh items-center bg-bg px-16 text-text">
      {shown && (
        <div className="flex items-center gap-4" role="status">
          <GetCkoSprite pose={MOMENT_POSE.thinking} scale={3} label={T.mascot.moment(T.moments.thinking)} />
          <p className="text-body text-text-2">{APP_COPY.shell.checking}</p>
        </div>
      )}
    </div>
  );
}
