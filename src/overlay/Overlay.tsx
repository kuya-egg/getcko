import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AskInput } from "../bindings/AskInput";
import type { TaskStep } from "../bindings/TaskStep";
import type { MonitorFrame } from "../bindings/MonitorFrame";
import type { Rect } from "../bindings/Rect";
import { agentActive, ask, onTurn, pttStart, screenPrepare, stop } from "../lib/getcko";
import { registerAskHotkey, setStopKeyActive } from "./input/hotkeys";
import { detectPlatform } from "./input/platform";
import { Gecko } from "./pointer/Gecko";
import { Halo } from "./pointer/Halo";
import { placeGecko, placePanel } from "./pointer/placement";
import { SPRITE_COLS, SPRITE_ROWS } from "./pointer/sprite";
import { coverMonitor, coverPrimaryMonitor, currentWorkArea, showOverlayOnce, useClickThrough } from "./pointer/window";
import { geckoPose, initialOverlayState, isBestGuess, MAX_TASK_STEPS, nextTaskSteps, reduceOverlay } from "./state/turn";
import type { GeckoPlacement, HaloVariant, Size, TurnStatus } from "./types";
import { AnswerCard } from "./ui/AnswerCard";
import { Composer } from "./ui/Composer";
import { SessionBar } from "./ui/SessionBar";

const GECKO_SCALE = 2;
const PANEL_MARGIN = 24;
const BUSY: Partial<Record<TurnStatus, true>> = { listening: true, transcribing: true, thinking: true, answering: true };
/** Question sent for S5 "next"; the earlier steps travel in `AskRequest.task`. */
const NEXT_STEP = "What's the next step?";

export function Overlay() {
  const platform = useMemo(() => detectPlatform(), []);
  const [state, dispatch] = useReducer(reduceOverlay, initialOverlayState);
  const [screenHelp, setScreenHelp] = useState(true);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Size>(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [panel, setPanel] = useState<Size>({ width: 0, height: 0 });
  /** Monitor the window currently covers; target geometry is only drawn once it matches. */
  const [placedOn, setPlacedOn] = useState<MonitorFrame | null>(null);
  /** Work area of the covered monitor (CSS px); `null` until known, then the whole viewport is used. */
  const [workArea, setWorkArea] = useState<Rect | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Serialises asks so `askResolved` of one turn always lands before the next `asked`. */
  const pendingAsk = useRef<Promise<unknown>>(Promise.resolve());
  /** Resolves when the microphone is recording; `null` when not held. */
  const recording = useRef<Promise<boolean> | null>(null);

  useClickThrough([panelRef], state.composerOpen);

  useEffect(() => {
    void coverPrimaryMonitor()
      .then(showOverlayOnce)
      .then(currentWorkArea)
      .then(setWorkArea)
      .catch((e: unknown) => console.error("overlay placement failed", e));
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    const unlisten = onTurn((event) => dispatch({ type: "event", event }));
    return () => {
      window.removeEventListener("resize", onResize);
      void unlisten.then((off) => off());
    };
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPanel({ width: el.offsetWidth, height: el.offsetHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Move to the target's monitor. Never react to the core's capture hide/show.
  const target = state.target ?? null;
  useEffect(() => {
    if (!target) return;
    const monitor = target.monitor;
    void coverMonitor(monitor)
      .then(() => setPlacedOn(monitor))
      .then(currentWorkArea)
      .then(setWorkArea)
      .catch((e: unknown) => console.error("overlay could not cover monitor", e));
  }, [target]);

  // Re-read the active agent on every local ask; the main window can switch it at any time.
  useEffect(() => {
    if (!state.awaiting) return;
    void agentActive()
      .then((agent) => setAgentName(agent?.name ?? null))
      .catch(() => setAgentName(null));
  }, [state.awaiting]);

  /** `help` reads the screen for this turn; `task` holds earlier guided-task steps (S5). */
  const startAsk = useCallback((input: AskInput, question: string | null, help: boolean, task: TaskStep[]) => {
    const run = pendingAsk.current.then(async () => {
      dispatch({ type: "asked", input: input.type, screenHelp: help, question, task });
      try {
        const turnId = await ask({ input, screenHelp: help, agentId: null, task });
        dispatch({ type: "askResolved", turnId });
      } catch (e: unknown) {
        dispatch({ type: "askRejected", message: e instanceof Error ? e.message : String(e) });
      }
    });
    pendingAsk.current = run;
  }, []);

  const micDown = useCallback(() => {
    if (recording.current) return;
    dispatch({ type: "listen" });
    recording.current = pttStart(screenHelp).then(
      () => true,
      (e: unknown) => {
        dispatch({ type: "askRejected", message: e instanceof Error ? e.message : String(e) });
        return false;
      },
    );
  }, [screenHelp]);

  const micUp = useCallback(() => {
    const started = recording.current;
    recording.current = null;
    if (!started) return;
    void started.then((ok) => {
      if (ok) startAsk({ type: "voice" }, null, screenHelp, []);
    });
  }, [startAsk, screenHelp]);

  const handleStop = useCallback(() => {
    dispatch({ type: "stop" });
    void stop().catch((e: unknown) => console.error("stop failed", e));
  }, []);

  const openComposer = useCallback(() => {
    dispatch({ type: "openComposer" });
    // Read the screen while the user types, as push-to-talk does while they speak.
    if (screenHelp) void screenPrepare().catch((e: unknown) => console.error("screen prepare failed", e));
    void getCurrentWindow()
      .setFocus()
      .catch((e: unknown) => console.error("overlay focus failed", e));
  }, [screenHelp]);

  // Global ask hotkey: hold = talk, tap = type. Handlers go through a ref so the
  // registration happens once and always calls the latest callbacks.
  const hotkey = useRef({ onTap: openComposer, onHoldStart: micDown, onHoldEnd: micUp });
  hotkey.current = { onTap: openComposer, onHoldStart: micDown, onHoldEnd: micUp };
  useEffect(() => {
    const off = registerAskHotkey(platform.askShortcut, {
      onTap: () => hotkey.current.onTap(),
      onHoldStart: () => hotkey.current.onHoldStart(),
      onHoldEnd: () => hotkey.current.onHoldEnd(),
    }).catch((e: unknown) => {
      console.error(`could not register ${platform.askShortcut}`, e);
      return null;
    });
    return () => {
      void off.then((unregister) => unregister?.());
    };
  }, [platform.askShortcut]);

  // Esc is global only while the answer card is open, so it is never stolen otherwise.
  useEffect(() => {
    void setStopKeyActive(state.cardOpen, handleStop).catch((e: unknown) => console.error("stop key", e));
  }, [state.cardOpen, handleStop]);

  const targetShown = target !== null && state.cardOpen && placedOn === target.monitor;
  const sprite: Size = { width: SPRITE_COLS * GECKO_SCALE, height: SPRITE_ROWS * GECKO_SCALE };
  const pointing: GeckoPlacement | null = targetShown ? placeGecko(target.rect, viewport, GECKO_SCALE) : null;
  // placePanel works in work-area coordinates; shift into it and back out.
  const area: Rect = workArea ?? { x: 0, y: 0, ...viewport };
  const toArea = (r: Rect): Rect => ({ ...r, x: r.x - area.x, y: r.y - area.y });
  const avoid = pointing ? [toArea({ x: pointing.x, y: pointing.y, ...sprite })] : [];
  const inArea = placePanel(targetShown ? toArea(target.rect) : null, area, panel, PANEL_MARGIN, avoid);
  const panelAt = { x: inArea.x + area.x, y: inArea.y + area.y };
  const gecko: GeckoPlacement = pointing ?? {
    x: panelAt.x + panel.width - sprite.width,
    y: panelAt.y - sprite.height - 4,
    facing: "right",
    scale: GECKO_SCALE,
  };
  const haloVariant: HaloVariant = target !== null && isBestGuess(target) ? "soft" : "exact";
  const nextSteps = nextTaskSteps(state);

  const closeComposerOnBackdrop = (e: PointerEvent<HTMLDivElement>) => {
    if (state.composerOpen && e.target === e.currentTarget) dispatch({ type: "closeComposer" });
  };

  return (
    <div className="gc-overlay-root" onPointerDown={closeComposerOnBackdrop}>
      {targetShown && <Halo rect={target.rect} variant={haloVariant} />}
      <Gecko pose={geckoPose(state)} placement={gecko} />
      <div ref={panelRef} className="gc-panel" style={{ position: "absolute", left: panelAt.x, top: panelAt.y }}>
        {state.cardOpen && (
          <AnswerCard
            question={state.question}
            sentences={state.sentences}
            answer={state.answer}
            status={state.status}
            error={state.error}
            agentName={agentName}
            hostLabel={platform.hostLabel}
            screenHelp={state.screenHelp}
            target={state.target}
            onStop={handleStop}
            onDismiss={() => dispatch({ type: "dismiss" })}
            step={state.task.length > 0 ? state.task.length + 1 : null}
            taskEnded={state.status === "finished" && state.task.length + 1 >= MAX_TASK_STEPS}
            onNext={nextSteps ? () => startAsk({ type: "text", text: NEXT_STEP }, NEXT_STEP, true, nextSteps) : undefined}
          />
        )}
        <Composer
          open={state.composerOpen}
          screenHelp={screenHelp}
          onSubmit={(text) => startAsk({ type: "text", text }, text, screenHelp, [])}
          onClose={() => dispatch({ type: "closeComposer" })}
          onMicDown={micDown}
          onMicUp={micUp}
          onToggleScreenHelp={() => setScreenHelp((on) => !on)}
        />
        <SessionBar
          agentName={agentName}
          askLabel={platform.askLabel}
          listening={state.status === "listening"}
          busy={BUSY[state.status] === true}
          screenHelp={screenHelp}
          onMicDown={micDown}
          onMicUp={micUp}
          onToggleScreenHelp={() => setScreenHelp((on) => !on)}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
