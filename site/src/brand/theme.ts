import { useCallback, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "gc-theme";
const MEDIA = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();
let pref: ThemePref = readStored();

function readStored(): ThemePref {
  // ?theme=light|dark|system wins for this page load (headless captures can't set localStorage). Not persisted.
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    if (q === "light" || q === "dark" || q === "system") return q;
  } catch {
    /* no window */
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage blocked */
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(MEDIA).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function resolveTheme(p: ThemePref = pref): ResolvedTheme {
  return p === "system" ? systemTheme() : p;
}

/** Writes data-theme on <html>. "system" removes the attribute so CSS follows the OS. */
function apply(p: ThemePref) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (p === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", p);
}

function emit() {
  listeners.forEach((l) => l());
}

/** Set the theme from anywhere (not only React). Persists to localStorage. */
export function setTheme(next: ThemePref) {
  pref = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage blocked */
  }
  apply(next);
  emit();
}

export function getTheme(): ThemePref {
  return pref;
}

/** Call once at startup (main.tsx) so the stored theme applies before first paint. */
export function initTheme() {
  apply(pref);
  try {
    window.matchMedia(MEDIA).addEventListener("change", () => {
      if (pref === "system") emit();
    });
  } catch {
    /* old webview */
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const snapshot = () => `${pref}|${resolveTheme()}`;

/**
 * const { theme, resolved, setTheme, toggle } = useTheme();
 * theme = stored preference, resolved = what is on screen.
 */
export function useTheme() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "system|light");
  const [theme, resolved] = snap.split("|") as [ThemePref, ResolvedTheme];
  const toggle = useCallback(() => setTheme(resolveTheme() === "dark" ? "light" : "dark"), []);
  return { theme, resolved, setTheme, toggle };
}
