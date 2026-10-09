import { useEffect, useRef, type RefObject } from "react";
import {
  currentMonitor,
  cursorPosition,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
} from "@tauri-apps/api/window";
import type { MonitorFrame } from "../../bindings/MonitorFrame";
import type { Rect } from "../../bindings/Rect";

const POLL_MS = 50;

let warned = false;
function warnOnce(error: unknown): void {
  if (warned) return;
  warned = true;
  console.error("overlay window API failed", error);
}

/** Covers `m` in desktop physical pixels (architecture: coordinate spaces). */
export async function coverMonitor(m: MonitorFrame): Promise<void> {
  const win = getCurrentWindow();
  try {
    await win.setPosition(new PhysicalPosition(m.x, m.y));
    await win.setSize(new PhysicalSize(m.width, m.height));
  } catch (error) {
    warnOnce(error);
  }
}

export async function coverPrimaryMonitor(): Promise<void> {
  const m = await primaryMonitor().catch((error: unknown) => {
    warnOnce(error);
    return null;
  });
  if (!m) return;
  await coverMonitor({ ...m.position, ...m.size, scaleFactor: m.scaleFactor });
}

/**
 * The covered monitor's work area (without menu bar, Dock or taskbar) in CSS px relative to
 * the window. Panels must stay inside it: the Dock and taskbar sit above always-on-top windows.
 */
export async function currentWorkArea(): Promise<Rect | null> {
  const m = await currentMonitor().catch((error: unknown) => {
    warnOnce(error);
    return null;
  });
  if (!m) return null;
  const s = m.scaleFactor;
  return {
    x: (m.workArea.position.x - m.position.x) / s,
    y: (m.workArea.position.y - m.position.y) / s,
    width: m.workArea.size.width / s,
    height: m.workArea.size.height / s,
  };
}

let shown: Promise<void> | null = null;
/** Startup only. Core hides/shows the window around screenshots; never re-show from events. */
export function showOverlayOnce(): Promise<void> {
  shown ??= getCurrentWindow().show().catch(warnOnce);
  return shown;
}

/**
 * Keeps the overlay click-through except while the cursor is over a mounted target
 * (or `forceInteractive`). Polls the cursor only while a target is mounted.
 */
export function useClickThrough(
  targets: ReadonlyArray<RefObject<HTMLElement | null>>,
  forceInteractive: boolean,
): void {
  const targetsRef = useRef(targets);
  const forceRef = useRef(forceInteractive);
  const ignoring = useRef<boolean | null>(null);
  const timer = useRef<number | null>(null);
  const busy = useRef(false);

  // Runs after every render: refs are attached by then, so mounts/unmounts are seen.
  useEffect(() => {
    targetsRef.current = targets;
    forceRef.current = forceInteractive;

    const setIgnore = (ignore: boolean) => {
      if (ignoring.current === ignore) return;
      ignoring.current = ignore;
      getCurrentWindow()
        .setIgnoreCursorEvents(ignore)
        .catch((error: unknown) => {
          ignoring.current = null;
          warnOnce(error);
        });
    };

    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const win = getCurrentWindow();
        const [cursor, origin, scale] = await Promise.all([
          cursorPosition(),
          win.outerPosition(),
          win.scaleFactor(),
        ]);
        if (timer.current === null) return;
        const x = (cursor.x - origin.x) / scale;
        const y = (cursor.y - origin.y) / scale;
        const over = targetsRef.current.some((t) => {
          const r = t.current?.getBoundingClientRect();
          return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        });
        setIgnore(!(over || forceRef.current));
      } catch (error) {
        warnOnce(error);
      } finally {
        busy.current = false;
      }
    };

    const mounted = targets.some((t) => t.current);
    if (mounted && timer.current === null) timer.current = window.setInterval(tick, POLL_MS);
    if (!mounted && timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (!mounted || forceInteractive) setIgnore(!forceInteractive);
  });

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
      getCurrentWindow().setIgnoreCursorEvents(true).catch(warnOnce);
    },
    [],
  );
}
