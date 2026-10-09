import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut";

type TimerId = ReturnType<typeof setTimeout>;

export interface HoldTapOptions {
  holdMs?: number;
  setTimer?: (fn: () => void, ms: number) => TimerId;
  clearTimer?: (id: TimerId) => void;
  onTap(): void;
  onHoldStart(): void;
  onHoldEnd(): void;
}

/** Splits one key press into either a tap or a hold (holdStart on threshold, holdEnd on release). */
export class HoldTapGesture {
  private readonly holdMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => TimerId;
  private readonly clearTimer: (id: TimerId) => void;
  private readonly opts: HoldTapOptions;
  private timer: TimerId | null = null;
  private down = false;
  private holding = false;

  constructor(opts: HoldTapOptions) {
    this.opts = opts;
    this.holdMs = opts.holdMs ?? 250;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id));
  }

  press(): void {
    // OS key repeat sends extra presses while the key is held.
    if (this.down) return;
    this.down = true;
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.holding = true;
      this.opts.onHoldStart();
    }, this.holdMs);
  }

  release(): void {
    if (!this.down) return;
    this.down = false;
    if (this.holding) {
      this.holding = false;
      this.opts.onHoldEnd();
      return;
    }
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.opts.onTap();
  }
}

export interface AskHotkeyHandlers {
  onTap(): void;
  onHoldStart(): void;
  onHoldEnd(): void;
}

export async function registerAskHotkey(
  accelerator: string,
  handlers: AskHotkeyHandlers,
): Promise<() => Promise<void>> {
  // A webview reload (HMR) leaves the previous registration alive in the Rust plugin.
  if (await isRegistered(accelerator)) await unregister(accelerator);
  const gesture = new HoldTapGesture(handlers);
  await register(accelerator, (ev) => (ev.state === "Pressed" ? gesture.press() : gesture.release()));
  return () => unregister(accelerator);
}

const STOP_KEY = "Escape";
let stopChain: Promise<void> = Promise.resolve();
let stopActive = false;
let stopHandler: () => void = () => undefined;

/** Holds global Esc only while active so it is not stolen from other apps otherwise. */
export function setStopKeyActive(active: boolean, onStop: () => void): Promise<void> {
  // Latest callback wins even when Esc is already registered, so callers never hit a stale closure.
  stopHandler = onStop;
  const next = stopChain.then(async () => {
    if (active === stopActive) return;
    if (active) {
      if (await isRegistered(STOP_KEY)) await unregister(STOP_KEY);
      await register(STOP_KEY, (ev) => {
        if (ev.state === "Pressed") stopHandler();
      });
    } else {
      await unregister(STOP_KEY);
    }
    stopActive = active;
  });
  // Keep the chain alive after a failed call; the caller still sees the rejection.
  stopChain = next.catch(() => undefined);
  return next;
}
