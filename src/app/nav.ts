// State routing for the main window. No router library: one screen id in App state.
import { createContext, useContext } from "react";

export type Screen = "agents" | "knowledge" | "settings";
export const SCREENS: readonly Screen[] = ["agents", "knowledge", "settings"];

export const isScreen = (v: unknown): v is Screen => typeof v === "string" && (SCREENS as readonly string[]).includes(v);

export interface AppNav {
  screen: Screen;
  /** Switch screens (crossfade). Screens use this to send people elsewhere, e.g. "Add documents". */
  go: (screen: Screen) => void;
  /** Show onboarding again (full window) until its onDone. */
  showOnboarding: () => void;
  /**
   * A screen with unsaved work registers a guard; the sidebar then asks it before switching.
   * The guard calls `proceed` once it is fine to leave (e.g. after a "Discard changes?" dialog).
   * Pass null to clear. `go` is not guarded: screens guard their own links.
   */
  setLeaveGuard: (guard: LeaveGuard | null) => void;
}

export type LeaveGuard = (proceed: () => void) => void;

export const AppNavContext = createContext<AppNav | null>(null);

/** const { screen, go } = useAppNav(); go("knowledge"); */
export function useAppNav(): AppNav {
  const v = useContext(AppNavContext);
  if (!v) throw new Error("useAppNav must be used inside the main window");
  return v;
}

/** Dev-only start screen from ?screen=agents|knowledge|settings|onboarding (screenshots, mock). */
export function initialRoute(): { screen: Screen; onboarding: boolean } {
  if (!import.meta.env.DEV) return { screen: "agents", onboarding: false };
  const q = new URLSearchParams(window.location.search).get("screen");
  if (q === "onboarding") return { screen: "agents", onboarding: true };
  return { screen: isScreen(q) ? q : "agents", onboarding: false };
}
