// Font faces are bundled by src/brand/index.css (fontsource, offline).
// This module is the JS side: family names for canvas/GSAP/video code, and a readiness helper.

export const FONT_FAMILIES = {
  display: "Bricolage Grotesque Variable",
  ui: "Geist Variable",
  mono: "Geist Mono Variable",
  pixel: "Silkscreen",
} as const;

export type FontRole = keyof typeof FONT_FAMILIES;

/** CSS font shorthand helper for <canvas> text, e.g. canvasFont("pixel", 22). */
export function canvasFont(role: FontRole, sizePx: number, weight: number | string = 400): string {
  return `${weight} ${sizePx}px "${FONT_FAMILIES[role]}"`;
}

/**
 * Resolves when the brand fonts are loaded. Await before measuring text,
 * drawing to canvas, or starting a GSAP intro (avoids a flash of fallback type in the demo video).
 */
export async function fontsReady(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`800 64px "${FONT_FAMILIES.display}"`),
      document.fonts.load(`400 16px "${FONT_FAMILIES.ui}"`),
      document.fonts.load(`500 13px "${FONT_FAMILIES.mono}"`),
      document.fonts.load(`400 22px "${FONT_FAMILIES.pixel}"`),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back silently; system fonts are in every stack */
  }
}
