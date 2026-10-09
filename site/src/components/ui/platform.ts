// Platform-aware shortcut labels. macOS first, Windows second (design system section 12).

export type Platform = "mac" | "win";

/** Best guess from the webview. Pass `platform` explicitly for deterministic captures. */
export function detectPlatform(): Platform {
  try {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const p = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
    return /mac|iphone|ipad/i.test(p) ? "mac" : "win";
  } catch {
    return "mac";
  }
}

/** Global hotkey: Option Space on macOS, Ctrl Space on Windows. */
export const HOTKEY: Record<Platform, string[]> = {
  mac: ["alt", "Space"],
  win: ["ctrl", "Space"],
};

type KeyDef = { glyph: string; name: string };

const MAC: Record<string, KeyDef> = {
  mod: { glyph: "⌘", name: "Command" },
  cmd: { glyph: "⌘", name: "Command" },
  ctrl: { glyph: "⌃", name: "Control" },
  alt: { glyph: "⌥", name: "Option" },
  option: { glyph: "⌥", name: "Option" },
  shift: { glyph: "⇧", name: "Shift" },
  enter: { glyph: "↩", name: "Return" },
  esc: { glyph: "Esc", name: "Escape" },
  space: { glyph: "Space", name: "Space" },
};

const WIN: Record<string, KeyDef> = {
  mod: { glyph: "Ctrl", name: "Control" },
  cmd: { glyph: "Ctrl", name: "Control" },
  ctrl: { glyph: "Ctrl", name: "Control" },
  alt: { glyph: "Alt", name: "Alt" },
  option: { glyph: "Alt", name: "Alt" },
  shift: { glyph: "Shift", name: "Shift" },
  enter: { glyph: "Enter", name: "Enter" },
  esc: { glyph: "Esc", name: "Escape" },
  space: { glyph: "Space", name: "Space" },
};

/** Map key tokens ("mod", "alt", "shift", "Space", "K") to visible glyphs and spoken names. */
export function formatKeys(keys: string[], platform: Platform): { glyphs: string[]; spoken: string } {
  const table = platform === "mac" ? MAC : WIN;
  const defs = keys.map((k) => table[k.toLowerCase()] ?? { glyph: k, name: k });
  return { glyphs: defs.map((d) => d.glyph), spoken: defs.map((d) => d.name).join(" ") };
}
