import { useMemo, type HTMLAttributes } from "react";
import { cn } from "./cn";
import { HOTKEY, detectPlatform, formatKeys, type Platform } from "./platform";

export interface KeycapProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Key tokens: "mod", "ctrl", "alt", "shift", "enter", "esc", "Space" or any literal ("K"). */
  keys?: string[];
  /** Shortcut for the global hotkey: Option Space (mac) / Ctrl Space (win). Ignores `keys`. */
  hotkey?: boolean;
  /** "auto" reads the webview platform. Pass "mac" or "win" for deterministic captures. */
  platform?: Platform | "auto";
  /** default = on surfaces, inverse = inside a primary button, chrome = inside the session bar. */
  tone?: "default" | "inverse" | "chrome";
}

const TONE = {
  default: "bg-keycap border-keycap-border text-text inset-shadow-keycap",
  inverse: "bg-keycap-inverse border-transparent text-keycap-inverse-text",
  chrome: "bg-chrome-raised border-chrome-line text-chrome-text-2",
} as const;

/** One keycap holding the whole combo, e.g. `⌥ Space` or `Ctrl Space`. Spoken as words. */
export function Keycap({ keys, hotkey, platform = "auto", tone = "default", className, ...rest }: KeycapProps) {
  const os = useMemo<Platform>(() => (platform === "auto" ? detectPlatform() : platform), [platform]);
  const { glyphs, spoken } = formatKeys(hotkey ? HOTKEY[os] : (keys ?? []), os);
  return (
    <kbd
      {...rest}
      className={cn(
        "inline-flex h-6 min-w-6 shrink-0 items-center justify-center gap-1 rounded-keycap border px-1.5",
        "font-mono text-keys nums whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden="true">{glyphs.join(" ")}</span>
      <span className="sr-only">{spoken}</span>
    </kbd>
  );
}
