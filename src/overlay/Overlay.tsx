import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent } from "react";
import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import type { AskInput } from "../bindings/AskInput";
import type { TaskStep } from "../bindings/TaskStep";
import type { MonitorFrame } from "../bindings/MonitorFrame";
import type { Rect } from "../bindings/Rect";
import { agentActive, ask, onTurn, pttStart, screenPrepare, stop } from "../lib/getcko";
import { registerAskHotkey, setStopKeyActive } from "./input/hotkeys";
import { detectPlatform } from "./input/platform";
import { Gecko } from "./pointer/Gecko";
import { Halo } from "./pointer/Halo";
import { placeGecko, placePanel, rectsIntersect } from "./pointer/placement";
import { SPRITE_COLS, SPRITE_ROWS } from "./pointer/sprite";
import { initialFollowState, reduceFollow } from "./pointer/follow";
import { composerBesideBar, positionFractions, positionFromFractions, parseBarPosition, type BarPosition } from "./ui/sessionBarPosition";
import { coverMonitor, coverPrimaryMonitor, currentWorkArea, showOverlayOnce, useClickThrough } from "./pointer/window";
import { geckoPose, initialOverlayState, isBestGuess, MAX_TASK_STEPS, nextTaskSteps, reduceOverlay } from "./state/turn";
import type { GeckoPlacement, Size, TurnStatus } from "./types";
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
  const target = state.target ?? null;
  const [screenHelp, setScreenHelp] = useState(true);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Size>(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [panel, setPanel] = useState<Size>({ width: 0, height: 0 });
  /** Monitor the window currently covers; target geometry is only drawn once it matches. */
  const [placedOn, setPlacedOn] = useState<MonitorFrame | null>(null);
  /** Work area of the covered monitor (CSS px); `null` until known, then the whole viewport is used. */
  const [workArea, setWorkArea] = useState<Rect | null>(null);
  /** Latest cursor in overlay CSS px (null off this monitor); read every frame by the gecko. */
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const [cursorOnScreen, setCursorOnScreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [follow, followDispatch] = useReducer(reduceFollow, initialFollowState);
  const followMode = useRef(follow.mode);
  followMode.current = follow.mode;
  const [barVisible, setBarVisible] = useState(() => localStorage.getItem("getcko.barHidden") !== "true");
  const [barCompact, setBarCompact] = useState(() => localStorage.getItem("getcko.barCompact") === "true");
  const [barPosition, setBarPosition] = useState<BarPosition>(() => parseBarPosition(localStorage.getItem("getcko.sessionBar")) ?? { x: 1, y: 1 });
  const [flightLanded, setFlightLanded] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useClickThrough([panelRef, barRef, composerRef], state.composerOpen);
  useEffect(() => {
    followDispatch({ type: "tick", now: performance.now() });
    const timer = window.setInterval(() => followDispatch({ type: "tick", now: performance.now() }), 40);
    return () => window.clearInterval(timer);
  }, []);
  // A new target starts the flight; the halo draws once the gecko has landed. Keyed on the
  // target alone: status changes during the flight (the answer finishing) must not cancel
  // the landing or restart the follow state.
  useEffect(() => {
    setFlightLanded(false);
    if (!target) return;
    followDispatch({ type: "turn-start", target: target.rect, now: performance.now() });
    const landing = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 520;
    const timer = window.setTimeout(() => setFlightLanded(true), landing);
    return () => window.clearTimeout(timer);
  }, [target]);
  useEffect(() => {
    if (state.status === "finished") followDispatch({ type: "turn-finished", now: performance.now() });
  }, [state.status]);
  useEffect(() => {
    if (!state.cardOpen) {
      followDispatch({ type: "dismiss" });
      setFlightLanded(false);
    }
  }, [state.cardOpen]);
  useEffect(() => {
    // One IPC call per poll at ~60 Hz: the window origin and scale only change when the
    // overlay moves to another monitor (`placedOn`), so they are read once per placement.
    let stopped = false;
    let busy = false;
    let frame: { x: number; y: number; scale: number } | null = null;
    const win = getCurrentWindow();
    void Promise.all([win.outerPosition(), win.scaleFactor()])
      .then(([origin, scale]) => {
        frame = { x: origin.x, y: origin.y, scale };
      })
      .catch(() => {
        frame = null;
      });
    const poll = async () => {
      if (busy || !frame) return;
      busy = true;
      try {
        const point = await cursorPosition();
        if (stopped || !frame) return;
        const x = (point.x - frame.x) / frame.scale;
        const y = (point.y - frame.y) / frame.scale;
        const on = x >= 0 && y >= 0 && x <= viewport.width && y <= viewport.height;
        cursorRef.current = on ? { x, y } : null;
        setCursorOnScreen(on);
        // The follow reducer only cares while the gecko is at a target (did the user reach it?).
        if (on && followMode.current !== "cursor") followDispatch({ type: "cursor", x, y, now: performance.now() });
      } catch {
        if (!stopped) {
          cursorRef.current = null;
          setCursorOnScreen(false);
        }
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => void poll(), 16);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [viewport.width, viewport.height, placedOn]);
  /** Serialises asks so `askResolved` of one turn always lands before the next `asked`. */
  const pendingAsk = useRef<Promise<unknown>>(Promise.resolve());
  /** Resolves when the microphone is recording; `null` when not held. */
  const recording = useRef<Promise<boolean> | null>(null);


  useEffect(() => {
    void coverPrimaryMonitor()
      .then(showOverlayOnce)
      .then(currentWorkArea)
      .then(setWorkArea)
      .catch((e: unknown) => console.error("overlay placement failed", e));
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    const unlisten = onTurn((event) => {
      setBarVisible(true);
      localStorage.setItem("getcko.barHidden", "false");
      dispatch({ type: "event", event });
    });
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
    setBarVisible(true);
    localStorage.setItem("getcko.barHidden", "false");
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
    setBarVisible(true);
    localStorage.setItem("getcko.barHidden", "false");
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
    setBarVisible(true);
    localStorage.setItem("getcko.barHidden", "false");
    dispatch({ type: "openComposer" });
    // Read the screen while the user types, as push-to-talk does while they speak.
    if (screenHelp) void screenPrepare().catch((e: unknown) => console.error("screen prepare failed", e));
    void getCurrentWindow().setFocus().catch((e: unknown) => console.error("overlay focus failed", e));
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
  const barBounds = { width: barRef.current?.offsetWidth ?? 280, height: barRef.current?.offsetHeight ?? 64 };
  const barPoint = positionFromFractions(barPosition, viewport, barBounds);
  // The ask box opens attached to the bar (480 px wide by CSS until measured).
  const composerBounds = { width: composerRef.current?.offsetWidth ?? 480, height: composerRef.current?.offsetHeight ?? 60 };
  const composerAt = composerBesideBar({ ...barPoint, ...barBounds }, composerBounds, viewport);
  // The answer card opens attached to the widget too (above the ask box when it is open,
  // else the bar), unless that would cover the target or the gecko at it; then it takes
  // the screen corner clear of all of them.
  const anchor: Rect = state.composerOpen ? { ...composerAt, ...composerBounds } : { ...barPoint, ...barBounds };
  const besideWidget = composerBesideBar(anchor, panel, viewport);
  const geckoRect: Rect | null = pointing ? { x: pointing.x, y: pointing.y, ...sprite } : null;
  const covers = (r: Rect | null) => r !== null && rectsIntersect({ ...besideWidget, ...panel }, r);
  let panelAt = besideWidget;
  if (covers(targetShown ? target.rect : null) || covers(geckoRect)) {
    const avoid = [
      ...(geckoRect ? [toArea(geckoRect)] : []),
      ...(barVisible ? [toArea({ ...barPoint, ...barBounds })] : []),
      ...(state.composerOpen ? [toArea({ ...composerAt, ...composerBounds })] : []),
    ];
    const inArea = placePanel(targetShown ? toArea(target.rect) : null, area, panel, PANEL_MARGIN, avoid);
    panelAt = { x: inArea.x + area.x, y: inArea.y + area.y };
  }
  const atTarget = (follow.mode === "target" || follow.mode === "dwelling") && pointing !== null;
  const gecko: GeckoPlacement = atTarget && pointing
    ? pointing
    : {
      x: panelAt.x + panel.width - sprite.width,
      y: panelAt.y - sprite.height - 4,
      facing: "right",
      scale: GECKO_SCALE,
    };
  const dragStart = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  };
  const dragMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const next = positionFractions({ x: drag.current.left + event.clientX - drag.current.x, y: drag.current.top + event.clientY - drag.current.y }, viewport, barBounds);
    setBarPosition(next);
    localStorage.setItem("getcko.sessionBar", JSON.stringify(next));
  };
  const dragEnd = () => { drag.current = null; };
  const nextSteps = nextTaskSteps(state);

  const closeComposerOnBackdrop = (e: PointerEvent<HTMLDivElement>) => {
    if (state.composerOpen && e.target === e.currentTarget) dispatch({ type: "closeComposer" });
  };

  return (
    <div className="gc-overlay-root" onPointerDown={closeComposerOnBackdrop} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}>
      {targetShown && flightLanded && follow.mode !== "cursor" && (
        <Halo
          key={`${target.rect.x},${target.rect.y},${target.rect.width},${target.rect.height}`}
          rect={target.rect}
          bestGuess={isBestGuess(target)}
          viewport={viewport}
        />
      )}
      <Gecko
        pose={geckoPose(state)}
        placement={gecko}
        visible={atTarget || cursorOnScreen}
        follow={atTarget ? undefined : cursorRef}
      />
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
        <div style={{ position: "fixed", left: composerAt.x, top: composerAt.y }}>
          <Composer
            ref={composerRef}
            open={state.composerOpen}
            screenHelp={screenHelp}
            onSubmit={(text) => startAsk({ type: "text", text }, text, screenHelp, [])}
            onClose={() => dispatch({ type: "closeComposer" })}
            onMicDown={micDown}
            onMicUp={micUp}
            onToggleScreenHelp={() => setScreenHelp((on) => !on)}
          />
        </div>
        {barVisible && <SessionBar
          ref={barRef}
          style={{ position: "fixed", left: barPoint.x, top: barPoint.y }}
          agentName={agentName}
          askLabel={platform.askLabel}
          listening={state.status === "listening"}
          busy={BUSY[state.status] === true}
          screenHelp={screenHelp}
          compact={barCompact}
          onCompact={() => { const next = !barCompact; setBarCompact(next); localStorage.setItem("getcko.barCompact", String(next)); }}
          onHide={() => { setBarVisible(false); localStorage.setItem("getcko.barHidden", "true"); }}
          onDragStart={dragStart}
          onMicDown={micDown}
          onMicUp={micUp}
          onToggleScreenHelp={() => setScreenHelp((on) => !on)}
          onStop={handleStop}
        />}
      </div>
    </div>
  );
}
