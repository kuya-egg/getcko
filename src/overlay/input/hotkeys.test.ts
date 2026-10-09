import { describe, expect, it } from "vitest";
import { HoldTapGesture } from "./hotkeys";
import { detectPlatform } from "./platform";

function setup() {
  const calls: string[] = [];
  let pending: (() => void) | null = null;
  const gesture = new HoldTapGesture({
    setTimer: (fn) => {
      pending = fn;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: () => {
      pending = null;
    },
    onTap: () => calls.push("tap"),
    onHoldStart: () => calls.push("holdStart"),
    onHoldEnd: () => calls.push("holdEnd"),
  });
  const elapse = () => {
    const fn = pending;
    pending = null;
    fn?.();
  };
  return { gesture, calls, elapse };
}

describe("HoldTapGesture", () => {
  it("quick press and release is a tap and never starts a hold", () => {
    const { gesture, calls, elapse } = setup();
    gesture.press();
    gesture.release();
    elapse();
    expect(calls).toEqual(["tap"]);
  });

  it("holding past the threshold starts and ends a hold, without a tap", () => {
    const { gesture, calls, elapse } = setup();
    gesture.press();
    elapse();
    gesture.release();
    expect(calls).toEqual(["holdStart", "holdEnd"]);
  });

  it("ignores OS key repeat while held and ends the hold exactly once", () => {
    const { gesture, calls, elapse } = setup();
    gesture.press();
    gesture.press();
    elapse();
    gesture.press();
    gesture.release();
    gesture.release();
    expect(calls).toEqual(["holdStart", "holdEnd"]);
  });

  it("ignores release without a press", () => {
    const { gesture, calls } = setup();
    gesture.release();
    expect(calls).toEqual([]);
  });

  it("each new gesture is classified independently", () => {
    const { gesture, calls, elapse } = setup();
    gesture.press();
    elapse();
    gesture.release();
    gesture.press();
    gesture.release();
    expect(calls).toEqual(["holdStart", "holdEnd", "tap"]);
  });
});

describe("detectPlatform", () => {
  it("maps the macOS WKWebView user agent to Alt+Space", () => {
    const p = detectPlatform(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)",
    );
    expect(p).toEqual({ os: "macos", askShortcut: "Alt+Space", askLabel: "⌥ Space", hostLabel: "on this Mac" });
  });

  it("maps the Windows WebView2 user agent to Control+Space", () => {
    const p = detectPlatform(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
    );
    expect(p).toEqual({ os: "windows", askShortcut: "Control+Space", askLabel: "Ctrl Space", hostLabel: "on this PC" });
  });
});
