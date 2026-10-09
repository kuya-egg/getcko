// Talks to src-tauri/src/overlay.rs. Outside Tauri (plain browser at /overlay.html)
// the same calls run against a local bus, so the overlay can be previewed without the app.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, once } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Citation } from "../components/ui";
import type { Rect } from "../brand/motion";
import { DEMO_EVENTS, DEMO_LABEL, DEV } from "./demo/script";

/** Matches `OverlayTarget` in overlay.rs: a rect in overlay CSS pixels. */
export interface OverlayTarget extends Rect {
  label?: string | null;
  /** Which side GetCko stands on; null/undefined = auto. */
  side?: "left" | "right" | null;
  viewportW: number;
  viewportH: number;
  scaleFactor: number;
  onScreen: boolean;
}

/** What the answer card shows. Emit `overlay:answer` to the overlay window with this payload. */
export interface OverlayAnswer {
  agent?: string;
  question?: string;
  answer: string;
  citations?: Citation[];
  /** Measured seconds only. */
  latency?: number | string;
  /** No answer found ("I don't know"): no target, GetCko shows the failed pose. */
  failed?: boolean;
}

/** A rect in global screen points (macOS AX units). */
export interface ScreenRect extends Rect {
  label?: string;
  side?: "left" | "right";
}

export const EVENTS = {
  pointAt: "overlay:point-at",
  clearTarget: "overlay:clear-target",
  shown: "overlay:shown",
  hidden: "overlay:hidden",
  answer: "overlay:answer",
} as const;

export const inTauri = isTauri();

const bus = new EventTarget();

function local(name: string, payload?: unknown) {
  bus.dispatchEvent(new CustomEvent(name, { detail: payload }));
}

export async function on<T>(name: string, cb: (payload: T) => void): Promise<() => void> {
  if (inTauri) return listen<T>(name, (e) => cb(e.payload));
  const h = (e: Event) => cb((e as CustomEvent<T>).detail);
  bus.addEventListener(name, h);
  return () => bus.removeEventListener(name, h);
}

export async function pointAt(rect: ScreenRect): Promise<void> {
  if (inTauri) {
    await invoke("point_at", { ...rect });
    return;
  }
  const t: OverlayTarget = {
    ...rect,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    scaleFactor: window.devicePixelRatio || 1,
    onScreen: true,
  };
  local(EVENTS.pointAt, t);
}

export async function clearTarget(): Promise<void> {
  if (inTauri) await invoke("clear_target");
  else local(EVENTS.clearTarget);
}

export async function showAnswer(answer: OverlayAnswer | null): Promise<void> {
  if (inTauri) await emitTo("overlay", EVENTS.answer, answer);
  else local(EVENTS.answer, answer);
}

export async function hideOverlay(): Promise<void> {
  if (inTauri) await invoke("hide_overlay");
  else local(EVENTS.hidden);
}

export async function currentTarget(): Promise<OverlayTarget | null> {
  return inTauri ? invoke<OverlayTarget | null>("current_target") : null;
}

/** Usable screen (no taskbar / Dock / menu bar) in overlay CSS pixels. */
export async function workArea(): Promise<Rect> {
  const full = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  if (!inTauri) return full;
  return (await invoke<Rect | null>("overlay_work_area").catch(() => null)) ?? full;
}

/** Areas that should take the mouse; everything else stays click-through. */
export async function setHitRegions(regions: Rect[]): Promise<void> {
  if (inTauri) await invoke("set_overlay_hit_regions", { regions });
}

// ---------------------------------------------------------------------------
// Dev-only practice window (src/overlay/demo). Opens it if needed, then asks it to point.

async function ensurePracticeSheet(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(DEMO_LABEL);
  if (existing) {
    if (await existing.isMinimized()) {
      await existing.unminimize();
      // Give the OS a moment to restore it, so point_at measures where it really is.
      await new Promise((r) => setTimeout(r, 300));
    }
    await existing.setFocus();
    return;
  }
  const ready = new Promise<void>((resolve) => {
    void once(DEMO_EVENTS.ready, () => resolve());
    setTimeout(resolve, 8000);
  });
  new WebviewWindow(DEMO_LABEL, { url: "demo.html", title: DEV.sheetTitle, width: 760, height: 560, center: true });
  await ready;
}

export async function openPracticeSheet(): Promise<void> {
  if (inTauri) await ensurePracticeSheet();
}

/** The practice sheet answers like the backend will: point_at, then an `overlay:answer`. */
export async function askPractice(id: string): Promise<void> {
  if (!inTauri) return;
  await ensurePracticeSheet();
  await emitTo(DEMO_LABEL, DEMO_EVENTS.locate, { id });
}
