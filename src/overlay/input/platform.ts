import type { PlatformInfo } from "../types";

const MACOS: PlatformInfo = {
  os: "macos",
  askShortcut: "Alt+Space",
  askLabel: "⌥ Space",
  hostLabel: "on this Mac",
};

const WINDOWS: PlatformInfo = {
  os: "windows",
  askShortcut: "Control+Space",
  askLabel: "Ctrl Space",
  hostLabel: "on this PC",
};

/** GetCko ships on macOS and Windows only; any non-Mac user agent (e.g. a Linux dev build) gets the Windows mapping. */
export function detectPlatform(userAgent: string = navigator.userAgent): PlatformInfo {
  return /Macintosh|Mac OS X/.test(userAgent) ? MACOS : WINDOWS;
}
