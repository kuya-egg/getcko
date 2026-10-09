// GetcKo brand textures: typed URLs + recommended CSS. React-free, data only.
//
// Files live in public/brand/ (served at /brand/...). Each texture has a light and a dark SVG;
// colours are baked to the brand tokens, so they are already subtle at opacity 1.
// No gradients, no glows: tone comes from ordered (Bayer) dither and hairlines.
//
// Quick use (CSS classes, theme-aware):
//   import { injectTextureStyles } from "./brand/textures";
//   injectTextureStyles();                       // once, e.g. in main.tsx
//   <section className="gc-tex-grid-cell">...    // follows data-theme / OS theme
//   <section className="gc-tex-crosshair gc-tex--dark">  // force one variant (video, plates)
//
// Inline style (any framework):
//   Object.assign(el.style, textureStyle("dither-fade", "dark"));
//
// v2 (gecko-world library): footprints, lamellae, skin, canopy*, pointer, weave, dither-hi and the
// section-* compositions, each in 3 intensities (subtle / standard / bold) x light / dark.
// For SECTIONS prefer the generated classes in ./surfaces.css (.surface .surface-<name> .surface--<intensity>)
// or <Surface> from components/ui/Surface. Marks are alpha-on-ground, so one tile works on paper, canvas,
// gecko-wash, night, gecko-night and ink. Regenerate: node scripts/brand/generate.mjs .  Guide: docs/brand/textures.md
//
// Rules: text and text-2 pass 4.5:1 on every mark (scripts/brand/contrast-check.mjs); captions (text-3)
// and accent text sit on a content card. Never on the overlay target. The sun colour appears only in
// plate-point (it is the target halo), never in a texture.

export type TextureMode = "light" | "dark";

export type TextureIntensity = "subtle" | "standard" | "bold";
export const TEXTURE_INTENSITIES: readonly TextureIntensity[] = ["subtle", "standard", "bold"];

export type TextureId =
  // v1
  | "grid-cell"
  | "dither-lo"
  | "dither-mid"
  | "dither-fade"
  | "grain"
  | "scales" // alias: the v2 skin tile at standard intensity
  | "crosshair"
  | "watermark-solid"
  | "watermark-dither"
  // v2 gecko-world library
  | "footprints"
  | "lamellae"
  | "skin"
  | "canopy"
  | "canopy-bottom"
  | "canopy-corner"
  | "pointer"
  | "weave"
  | "dither-hi"
  | "section-hero"
  | "section-how"
  | "section-footer";

export type PlateId = "point" | "watermark" | "headmark";

export interface Texture {
  id: TextureId;
  /** What it is and where it belongs. */
  use: string;
  url: Record<TextureMode, string>;
  /** Native tile size in px. Scale by integers only (2x = double each value). */
  tile: { w: number; h: number };
  /** Recommended CSS. */
  size: string;
  repeat: "repeat" | "repeat-x" | "repeat-y" | "no-repeat";
  position: string;
  /** Opacity when layered on a ::before (1 = as authored, which is already subtle). */
  opacity: Record<TextureMode, number>;
  /** True for pixel-art tiles: needs image-rendering: pixelated when scaled. */
  pixel: boolean;
  /** v2 textures: one URL per intensity per theme (`url` above = standard). */
  intensities?: Record<TextureIntensity, Record<TextureMode, string>>;
}

export interface Plate {
  id: PlateId;
  use: string;
  url: Record<TextureMode, string>;
  width: 1920;
  height: 1080;
  /** Area kept empty for title text, in plate px. */
  titleSafe: { x: number; y: number; w: number; h: number };
}

const BASE = `${(import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "")}/brand`;
const tex = (name: string): Record<TextureMode, string> => ({
  light: `${BASE}/textures/${name}-light.svg`,
  dark: `${BASE}/textures/${name}-dark.svg`,
});
const lib = (name: string, dir: "textures" | "sections"): Record<TextureIntensity, Record<TextureMode, string>> => {
  const f = (mode: TextureMode, i: TextureIntensity) => `${BASE}/${dir}/${name}-${mode}${i === "standard" ? "" : `-${i}`}.svg`;
  return {
    subtle: { light: f("light", "subtle"), dark: f("dark", "subtle") },
    standard: { light: f("light", "standard"), dark: f("dark", "standard") },
    bold: { light: f("light", "bold"), dark: f("dark", "bold") },
  };
};
/** v2 entry: native size in px, tiling, three intensities. Files come from scripts/brand/texture-lib.mjs. */
const v2 = (
  id: TextureId,
  use: string,
  w: number,
  h: number,
  repeat: Texture["repeat"],
  position: string,
  dir: "textures" | "sections" = "textures",
): Texture => {
  const intensities = lib(id, dir);
  return {
    id,
    use,
    url: intensities.standard,
    tile: { w, h },
    size: `${w}px ${h}px`,
    repeat,
    position,
    opacity: { light: 1, dark: 1 },
    pixel: true,
    intensities,
  };
};
const plate = (name: string): Record<TextureMode, string> => ({
  light: `${BASE}/plates/plate-${name}-light.svg`,
  dark: `${BASE}/plates/plate-${name}-dark.svg`,
});

export const TEXTURES: Record<TextureId, Texture> = {
  "grid-cell": {
    id: "grid-cell",
    use: "Pixel-cell grid. One tile = the 22x27 sprite canvas at 8px per cell. Onboarding, empty states, title cards.",
    url: tex("grid-cell"),
    tile: { w: 176, h: 216 },
    size: "176px 216px",
    repeat: "repeat",
    position: "0 0",
    opacity: { light: 1, dark: 1 },
    pixel: true,
  },
  "dither-lo": v2("dither-lo", "Flat 2/16 Bayer dither, 4px cells. Quiet tone for wells and side panels instead of a grey fill.", 16, 16, "repeat", "0 0"),
  "dither-mid": v2("dither-mid", "Flat 4/16 Bayer dither. Stronger tone for hero blocks and video lower thirds.", 16, 16, "repeat", "0 0"),
  "dither-fade": v2(
    "dither-fade",
    "Stepped dither band, 0 to 10/16 top to bottom (320px tall). Section bottom edges, footer, video ground. The no-gradient fade.",
    16,
    320,
    "repeat-x",
    "left bottom",
  ),
  grain: {
    id: "grain",
    use: "Paper grain, fractal noise at about 6% alpha. Large flat marketing surfaces only; not in the overlay.",
    url: tex("grain"),
    tile: { w: 240, h: 240 },
    size: "240px 240px",
    repeat: "repeat",
    position: "0 0",
    opacity: { light: 1, dark: 0.8 },
    pixel: false,
  },
  // v1 name kept working: same art as v2 "skin" (scales-<mode>.svg = skin at standard)
  scales: {
    ...v2("skin", "Alias of skin: gecko skin granules and tubercles. Kept for v1 callers.", 288, 288, "repeat", "0 0"),
    id: "scales",
    url: tex("scales"),
  },
  crosshair: {
    id: "crosshair",
    use: "Coordinate field: 2px dots every 24px, crosshair every 96px. Screen Help, pointing explainer, demo video.",
    url: tex("crosshair"),
    tile: { w: 96, h: 96 },
    size: "96px 96px",
    repeat: "repeat",
    position: "0 0",
    opacity: { light: 1, dark: 1 },
    pixel: true,
  },
  "watermark-solid": {
    id: "watermark-solid",
    use: "Flat gecko silhouette (22x27 cell viewBox). Big, cropped by an edge, behind empty space. Scale in multiples of 22x27.",
    url: tex("watermark-solid"),
    tile: { w: 22, h: 27 },
    size: "440px 540px",
    repeat: "no-repeat",
    position: "right -80px bottom -40px",
    opacity: { light: 1, dark: 1 },
    pixel: true,
  },
  "watermark-dither": {
    id: "watermark-dither",
    use: "Dithered gecko silhouette (88x108, one sprite cell = 4x4 dither). Title cards, splash, empty states.",
    url: tex("watermark-dither"),
    tile: { w: 88, h: 108 },
    size: "352px 432px",
    repeat: "no-repeat",
    position: "right 48px bottom 0",
    opacity: { light: 1, dark: 1 },
    pixel: true,
  },

  // ---- v2 gecko-world library (3 intensities each) ----
  footprints: v2("footprints", "Signature. Two geckos crossing the wall: pixel 5-toe prints with green sticky pads. Hero, onboarding, about, empty states.", 384, 384, "repeat", "0 0"),
  lamellae: v2("lamellae", "Toe-pad lamellae: ridged gecko toe undersides in staggered columns. Rhythm bands, dividers, side rails.", 108, 108, "repeat", "0 0"),
  skin: v2("skin", "Gecko skin: granules and raised tubercles with lit cells and green pigment spots. Brand moments, about, splash.", 288, 288, "repeat", "0 0"),
  canopy: v2("canopy", "Pothos vine hanging from a section's top edge (repeat-x band, 192px).", 384, 192, "repeat-x", "left top"),
  "canopy-bottom": v2("canopy-bottom", "Pothos growing up from a section's bottom edge (repeat-x band, 192px).", 384, 192, "repeat-x", "left bottom"),
  "canopy-corner": v2("canopy-corner", "A branch entering the top-right corner (no-repeat, 320px). Hero corners without the gecko plate.", 320, 320, "no-repeat", "right top"),
  pointer: v2("pointer", "Pixel cursors aimed at bracketed targets on a coordinate field. Screen Help, how-it-points explainers.", 240, 240, "repeat", "0 0"),
  weave: v2("weave", "Banig: pandan-strip weave with a dyed nested diamond. Section bands (voice, community, about).", 160, 160, "repeat", "0 0"),
  "dither-hi": v2("dither-hi", "Flat 8/16 Bayer dither. Heavy tone for bands and footers.", 16, 16, "repeat", "0 0"),
  "section-hero": v2("section-hero", "Hero plate: ghost GetcKo standing in pothos, its trail walking in from the left. Anchor right bottom; text top-left.", 1040, 560, "no-repeat", "right bottom", "sections"),
  "section-how": v2("section-how", "How-it-works band: ruler edges, prints walking left to right, a bracketed stop every 640px.", 640, 176, "repeat-x", "left center", "sections"),
  "section-footer": v2("section-footer", "Footer band: dither ground rising, pothos growing up out of it.", 384, 256, "repeat-x", "left bottom", "sections"),
};

export const PLATES: Record<PlateId, Plate> = {
  point: {
    id: "point",
    use: "Hero/title: full-colour GetcKo at 16x pointing at a target chip with the sun halo. Video opener, README hero.",
    url: plate("point"),
    width: 1920,
    height: 1080,
    titleSafe: { x: 160, y: 160, w: 720, h: 600 },
  },
  watermark: {
    id: "watermark",
    use: "Section card: pixel grid ground, giant dithered silhouette bleeding off the right, stepped fade. Chapter cards.",
    url: plate("watermark"),
    width: 1920,
    height: 1080,
    titleSafe: { x: 160, y: 216, w: 900, h: 560 },
  },
  headmark: {
    id: "headmark",
    use: "End card / app-icon reveal: head mark at 24x on an icon tile, dither stair corners. Title below the tile.",
    url: plate("headmark"),
    width: 1920,
    height: 1080,
    titleSafe: { x: 480, y: 872, w: 960, h: 160 },
  },
};

export const TEXTURE_IDS = Object.keys(TEXTURES) as TextureId[];
export const PLATE_IDS = Object.keys(PLATES) as PlateId[];

/** URL of a texture for one theme and intensity (v1 textures without intensities ignore it). */
export function textureUrl(id: TextureId, mode: TextureMode, intensity: TextureIntensity = "standard"): string {
  const t = TEXTURES[id];
  return t.intensities ? t.intensities[intensity][mode] : t.url[mode];
}

/** Plain CSS properties for a texture in one mode (camelCase, works for el.style or a React style prop). */
export function textureStyle(id: TextureId, mode: TextureMode, intensity: TextureIntensity = "standard"): Record<string, string> {
  const t = TEXTURES[id];
  const s: Record<string, string> = {
    backgroundImage: `url("${textureUrl(id, mode, intensity)}")`,
    backgroundSize: t.size,
    backgroundRepeat: t.repeat,
    backgroundPosition: t.position,
  };
  if (t.pixel) s.imageRendering = "pixelated";
  return s;
}

/** Plate as a cover background (keeps 16:9, crisp pixels). */
export function plateStyle(id: PlateId, mode: TextureMode): Record<string, string> {
  return {
    backgroundImage: `url("${PLATES[id].url[mode]}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}

/** Full background declaration for one texture in one mode. */
function decl(id: TextureId, mode: TextureMode): string {
  const t = TEXTURES[id];
  return (
    `background-image:url("${t.url[mode]}");background-size:${t.size};` +
    `background-repeat:${t.repeat};background-position:${t.position};` +
    (t.pixel ? "image-rendering:pixelated;" : "")
  );
}

/**
 * CSS text for theme-aware utility classes:
 *   .gc-tex-<id>                 follows [data-theme] / prefers-color-scheme
 *   + .gc-tex--light / --dark    forced variant (video, plates, marketing)
 *   + .gc-tex-layer              texture drawn on ::before at the recommended opacity,
 *                                children stay on top (element gets position:relative)
 */
export function textureCss(): string {
  // target selectors: the element itself, or its ::before in layer mode
  const sel = (c: string, extra: string, prefix = "") =>
    `${prefix}${c}${extra}:not(.gc-tex-layer),${prefix}${c}${extra}.gc-tex-layer::before`;
  const body = (id: TextureId, mode: TextureMode) => `{${decl(id, mode)}--gc-tex-opacity:${TEXTURES[id].opacity[mode]};}`;
  let css =
    `.gc-tex-layer{position:relative;isolation:isolate;}` +
    `.gc-tex-layer::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;opacity:var(--gc-tex-opacity,1);}`;
  let darkAttr = "";
  let darkMq = "";
  for (const id of TEXTURE_IDS) {
    const c = `.gc-tex-${id}`;
    css += sel(c, "") + body(id, "light");
    darkAttr += sel(c, ":not(.gc-tex--light)", ':root[data-theme="dark"] ') + body(id, "dark");
    darkMq += sel(c, ":not(.gc-tex--light)", ':root:not([data-theme="light"]) ') + body(id, "dark");
  }
  css += darkAttr + `@media (prefers-color-scheme: dark){${darkMq}}`;
  // forced variants last so they win over the theme rules at equal or higher specificity
  for (const id of TEXTURE_IDS) {
    const c = `.gc-tex-${id}`;
    css += sel(c, ".gc-tex--light", ":root ") + body(id, "light");
    css += sel(c, ".gc-tex--dark", ":root ") + body(id, "dark");
  }
  return css;
}

/** Insert the texture classes into <head> once. Safe to call repeatedly; no-op outside the browser. */
export function injectTextureStyles(): void {
  if (typeof document === "undefined" || document.getElementById("gc-textures")) return;
  const el = document.createElement("style");
  el.id = "gc-textures";
  el.textContent = textureCss();
  document.head.appendChild(el);
}

// ---------- Surfaces (textured sections) ----------
/** Names accepted by <Surface texture> and the .surface-<name> classes in ./surfaces.css. */
export type SurfaceTexture =
  | "footprints"
  | "lamellae"
  | "skin"
  | "scales"
  | "canopy"
  | "canopy-bottom"
  | "canopy-corner"
  | "pointer"
  | "weave"
  | "dither-lo"
  | "dither-mid"
  | "dither-hi"
  | "dither-fade"
  | "hero"
  | "how"
  | "footer";
/** Ground under the texture. ink = a dark island in either theme (re-scopes the semantic tokens). */
export type SurfaceTone = "canvas" | "paper" | "green" | "ink";
export const SURFACE_TEXTURES: readonly SurfaceTexture[] = [
  "footprints",
  "lamellae",
  "skin",
  "scales",
  "canopy",
  "canopy-bottom",
  "canopy-corner",
  "pointer",
  "weave",
  "dither-lo",
  "dither-mid",
  "dither-hi",
  "dither-fade",
  "hero",
  "how",
  "footer",
];
/** CSS for the surface classes (generated). Wire it once: `@import "./surfaces.css";` in src/brand/index.css. */
export const SURFACES_CSS = "src/brand/surfaces.css";
