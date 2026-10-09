// Regenerate all textures + plates (run from the repo root): node scripts/brand/generate.mjs .
// Writes SVGs to public/brand/textures and public/brand/plates. This script stays out of public/ so it never ships.
// Edit colours/geometry here, never hand-edit the output SVGs.
// Generates GetcKo brand textures + plates as hand-tuned SVG. Run: node scripts/brand/generate.mjs <repoRoot>
import fs from "node:fs";
import path from "node:path";
import { writeLibrary, surfacesCss, LIBRARY } from "./texture-lib.mjs";

const root = process.argv[2];
const TEX = path.join(root, "public/brand/textures");
const PLT = path.join(root, "public/brand/plates");
fs.mkdirSync(TEX, { recursive: true });
fs.mkdirSync(PLT, { recursive: true });

// ---- palette (mirrors src/brand/tokens.css) ----
const C = {
  paper: "#FFFFFF", canvas: "#F6F7F4", line: "#E6E8E3", lineStrong: "#C9CCC4",
  ink: "#0E0F0C", ink2: "#4A4D46", ink3: "#6C7067",
  gecko: "#39D86F", geckoDeep: "#0F7A3D", geckoWash: "#EAFBEF", sun: "#FFC83D",
  night: "#121410", night1: "#191B16", night2: "#21241E", nightLine: "#2E3229",
  nightLineStrong: "#474C41", mist: "#F1F3EC", mist2: "#B8BDB0", mist3: "#8D9285",
  geckoTint: "#6FE598", geckoNight: "#15301E",
};
// per-theme mark colours: faint = hairlines, mid = marks, wash = green tint fills
const T = {
  light: { ground: C.paper, ground2: C.canvas, faint: C.line, mid: C.lineStrong, strong: C.ink3, wash: C.geckoWash, green: C.gecko, greenText: C.geckoDeep },
  dark: { ground: C.night, ground2: C.night1, faint: C.nightLine, mid: C.nightLineStrong, strong: C.mist3, wash: C.geckoNight, green: C.gecko, greenText: C.geckoTint },
};

const SPRITE = [
  "......KKKK..KKKK......",
  ".....KWWWWKKWWWWK.....",
  ".....KWKKWKKWKKWK.....",
  ".....KWKKWKKWKKWK.....",
  "....KGWWWWGGWWWWGK....",
  "...KGGGGGGGGGGGGGGK...",
  "...KGLGGGGGGGGGGPGK...",
  "...KGGKGGGGGGGGKGGK...",
  "...KGGGKKKKKKKKGGGK...",
  "....KGGGGGGGGGGGGK..KK",
  ".....KKGGGGGGGGKK..KGK",
  "......KGGGGGGGGK..KGK.",
  "......KGBBBBGGGK.KGK..",
  "......KGBBBBGGGGKGK...",
  ".....KGGBBBBGGGGK.....",
  "....KGKGBBBBGGGK......",
  "...KGK.KGBBBBGGK......",
  "..KGGK.KGBBBBGGK......",
  "..KKK..KGBBBBGGK......",
  ".......KGGBBBGGK......",
  ".KK....KGGGGGGGK......",
  "KGK...KGGGGGGGGGK.....",
  "KGK..KGGGGGGGGGGK.....",
  "KGGKKGGGGGGGGGGK......",
  ".KKKKKKGGK..KGGK......",
  "......KGGGK.KGGGK.....",
  "......KKKKK.KKKKK.....",
];
const SPAL = { K: "#0E0F0C", G: "#39D86F", L: "#9BF2B6", B: "#D6F8E0", W: "#FFFFFF", P: "#FF9DB0", D: "#0E5E2E" };

// run-length path for a set of cells (merges horizontal runs) at scale s, offset ox,oy
function cellsPath(rows, test, s = 1, ox = 0, oy = 0) {
  let d = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (test(row[x], x, y)) {
        let w = 1;
        while (x + w < row.length && test(row[x + w], x + w, y)) w++;
        d += `M${ox + x * s} ${oy + y * s}h${w * s}v${s}h${-w * s}z`;
        x += w;
      } else x++;
    }
  });
  return d;
}
function spriteFull(s, ox, oy, rows = SPRITE) {
  return Object.entries(SPAL)
    .map(([k, col]) => {
      const d = cellsPath(rows, (ch) => ch === k, s, ox, oy);
      return d ? `<path fill="${col}" d="${d}"/>` : "";
    })
    .join("");
}
const silhouetteTest = (ch) => ch !== ".";
// 1-cell rim around the silhouette (8-neighbour), for legibility on dark grounds
function rimPath(rows, s, ox, oy) {
  const H = rows.length, W = rows[0].length;
  const on = (x, y) => y >= 0 && y < H && x >= 0 && x < W && rows[y][x] !== ".";
  const pad = [];
  for (let y = -1; y <= H; y++) {
    let r = "";
    for (let x = -1; x <= W; x++) {
      let n = false;
      if (!on(x, y)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (on(x + dx, y + dy)) n = true;
      r += n ? "R" : ".";
    }
    pad.push(r);
  }
  return cellsPath(pad, (ch) => ch === "R", s, ox - s, oy - s);
}
const rimFor = (mode, rows, s, ox, oy) => mode === "dark" ? `<path fill="${C.mist}" d="${rimPath(rows, s, ox, oy)}"/>` : "";

// Bayer 4x4 threshold matrix -> density 0..16
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
function bayerPattern(id, level, cell, color) {
  // level: number of lit cells out of 16
  let d = "";
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (BAYER4[y][x] < level) d += `M${x * cell} ${y * cell}h${cell}v${cell}h${-cell}z`;
  return `<pattern id="${id}" width="${cell * 4}" height="${cell * 4}" patternUnits="userSpaceOnUse"><path fill="${color}" d="${d}"/></pattern>`;
}

const head = (w, h, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"${extra}>`;
const write = (dir, name, svg) => {
  fs.writeFileSync(path.join(dir, name), svg.replace(/\n\s*/g, "") + "\n");
};

// ============ TILES ============
for (const [mode, t] of Object.entries(T)) {
  // 1. Pixel-cell grid: one sprite canvas (22x27 cells @ 8px = 176x216). Minor 1px hairline per cell,
  //    and a heavier frame per sprite canvas with corner ticks.
  {
    const W = 176, H = 216, s = 8;
    let minor = "";
    for (let x = 0; x < W; x += s) if (x) minor += `M${x} 0v${H}h1v${-H}z`;
    for (let y = 0; y < H; y += s) if (y) minor += `M0 ${y}h${W}v1h${-W}z`;
    const frame = `M0 0h${W}v1h${-W}zM0 0h1v${H}h-1z`;
    const ticks = `M0 0h5v2h-5zM0 0h2v5h-2z`;
    write(TEX, `grid-cell-${mode}.svg`, `${head(W, H)}<path fill="${t.faint}" fill-opacity=".55" d="${minor}"/><path fill="${t.faint}" d="${frame}"/><path fill="${t.mid}" d="${ticks}"/></svg>`);
  }

  // 2-3. Dither fields and the dither fade now come from texture-lib.mjs (stronger, 3 intensities).

  // 4. Paper grain: fractal noise, stitched for seamless tiling, very low alpha.
  {
    const rgb = mode === "light" ? "0.055 0.059 0.047" : "0.945 0.953 0.925";
    const alpha = mode === "light" ? 0.07 : 0.06;
    const [r, g, b] = rgb.split(" ");
    write(
      TEX,
      `grain-${mode}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${alpha * 9} -${(alpha * 4).toFixed(3)}"/></filter><rect width="240" height="240" filter="url(#n)"/></svg>`
    );
  }

  // 5. Gecko scales: replaced by the v2 "skin" texture (texture-lib.mjs); scales-<mode>.svg is written as an alias below.

  // 6. Coordinate / crosshair field: 2px dots every 24px, a crosshair + bracket target every 96px,
  //    tick marks on the major axis. Evokes "point at this".
  {
    const W = 96, P = 24;
    let dots = "";
    for (let y = 0; y < W; y += P) for (let x = 0; x < W; x += P) if (x || y) dots += `M${x - 1} ${y - 1}h2v2h-2z`;
    // wrap dots that sit on the edge are covered by x/y=0 positions shifted; draw half-dots at edges
    const cross = `M-6 0h13v1h-13zM0 -6h1v13h-1z`;
    const wrapCross = [0, W].map((ox) => [0, W].map((oy) => `<path transform="translate(${ox} ${oy})" d="${cross}"/>`).join("")).join("");
    const ticks = [12, 36, 60, 84].map((x) => `M${x} 0h1v3h-1zM0 ${x}h3v1h-3z`).join("");
    write(TEX, `crosshair-${mode}.svg`, `${head(W, W)}<path fill="${t.mid}" d="${dots}"/><g fill="${t.strong}" fill-opacity=".7">${wrapCross}</g><path fill="${t.faint}" d="${ticks}"/></svg>`);
  }

  // 7. Watermark: full-sprite silhouette (solid) and dithered silhouette. viewBox in cells, scale freely by integers.
  {
    const d = cellsPath(SPRITE, silhouetteTest, 1);
    write(TEX, `watermark-solid-${mode}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="270" viewBox="0 0 22 27" shape-rendering="crispEdges"><path fill="${t.ground2 === C.canvas ? C.line : C.night2}" d="${d}"/></svg>`);
    // dithered: 1 sprite cell = 4x4 dither cells; 8/16 density inside, outline cells solid
    const dd = cellsPath(SPRITE, (ch) => ch !== "." && ch !== "K", 4);
    const ko = cellsPath(SPRITE, (ch) => ch === "K", 4);
    write(
      TEX,
      `watermark-dither-${mode}.svg`,
      `${head(88, 108)}<defs>${bayerPattern("h", 6, 1, mode === "light" ? C.lineStrong : C.nightLineStrong)}</defs><path fill="url(#h)" d="${dd}"/><path fill="${mode === "light" ? C.line : C.night2}" d="${ko}"/></svg>`
    );
  }
}

// ============ PLATES (1920x1080) ============
const PW = 1920, PH = 1080;
function patternDefs(t) {
  // reusable patterns inside plates
  let grid = "";
  for (let x = 8; x < 176; x += 8) grid += `M${x} 0v216h1v-216z`;
  for (let y = 8; y < 216; y += 8) grid += `M0 ${y}h176v1h-176z`;
  let dots = "";
  for (let y = 0; y < 96; y += 24) for (let x = 0; x < 96; x += 24) dots += `M${x} ${y}h2v2h-2z`;
  return (
    `<pattern id="grid" width="176" height="216" patternUnits="userSpaceOnUse"><path fill="${t.faint}" fill-opacity=".5" d="${grid}"/><path fill="${t.faint}" d="M0 0h176v1h-176zM0 0h1v216h-1z"/></pattern>` +
    `<pattern id="dots" width="96" height="96" patternUnits="userSpaceOnUse"><path fill="${t.mid}" d="${dots}"/><path fill="${t.strong}" fill-opacity=".6" d="M-6 0h13v1h-13zM0 -6h1v13h-1z"/></pattern>` +
    [2, 4, 6, 8].map((l) => bayerPattern(`d${l}`, l, 6, t.faint)).join("") +
    [4, 8].map((l) => bayerPattern(`g${l}`, l, 6, t.wash)).join("")
  );
}
// stepped dither band (no gradient): n steps of growing density
function ditherSteps(x, y, w, stepH, levels) {
  return levels.map((l, i) => `<rect x="${x}" y="${y + i * stepH}" width="${w}" height="${stepH}" fill="url(#d${l})"/>`).join("");
}

for (const [mode, t] of Object.entries(T)) {
  const bg = `<rect width="${PW}" height="${PH}" fill="${t.ground}"/>`;

  // Plate A "Point": crosshair field, full-colour sprite at 16x pointing at a target chip with sun halo.
  {
    const s = 16, sx = 944, sy = 432; // sprite 352x432
    const chipX = 1408, chipY = 352, chipW = 304, chipH = 88;
    const chipFill = mode === "light" ? C.paper : C.night1;
    const chipLine = mode === "light" ? C.lineStrong : C.nightLineStrong;
    const bar = mode === "light" ? C.line : C.nightLine;
    const halo = mode === "light"
      ? `<rect x="${chipX - 8}" y="${chipY - 8}" width="${chipW + 16}" height="${chipH + 16}" rx="22" fill="none" stroke="${C.sun}" stroke-width="8"/>`
      : `<rect x="${chipX - 7}" y="${chipY - 7}" width="${chipW + 14}" height="${chipH + 14}" rx="21" fill="none" stroke="${C.night}" stroke-width="6"/><rect x="${chipX - 14}" y="${chipY - 14}" width="${chipW + 28}" height="${chipH + 28}" rx="28" fill="none" stroke="${C.sun}" stroke-width="8"/>`;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">` +
      `<defs>${patternDefs(t)}</defs>${bg}<rect width="${PW}" height="${PH}" fill="url(#dots)"/>` +
      // faux window behind the target, flat
      `<rect x="1312" y="232" width="496" height="560" rx="20" fill="${mode === "light" ? C.canvas : C.night1}" stroke="${chipLine}" stroke-width="2"/>` +
      `<rect x="1352" y="276" width="160" height="16" rx="8" fill="${bar}"/><rect x="1352" y="480" width="416" height="16" rx="8" fill="${bar}"/><rect x="1352" y="516" width="340" height="16" rx="8" fill="${bar}"/><rect x="1352" y="552" width="380" height="16" rx="8" fill="${bar}"/>` +
      `<rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="14" fill="${chipFill}" stroke="${C.ink}" stroke-width="2"/>` +
      `<rect x="${chipX + 32}" y="${chipY + 36}" width="176" height="16" rx="8" fill="${mode === "light" ? C.ink : C.mist}"/>` +
      halo +
      // dither shadow-free ground strip under the gecko
      ditherSteps(0, 880, PW, 50, [2, 4, 6, 8]) +
      `<g shape-rendering="crispEdges">${rimFor(mode, SPRITE, s, sx, sy)}${spriteFull(s, sx, sy)}</g>` +
      `</svg>`;
    write(PLT, `plate-point-${mode}.svg`, svg);
  }

  // Plate B "Watermark": pixel grid ground, giant dithered silhouette bleeding off the right edge, stepped fade at the bottom.
  {
    const s = 40, sx = 1180, sy = 0; // 880x1080
    const body = cellsPath(SPRITE, (ch) => ch !== "." && ch !== "K", s, sx, sy);
    const outline = cellsPath(SPRITE, (ch) => ch === "K", s, sx, sy);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}" shape-rendering="crispEdges">` +
      `<defs>${patternDefs(t)}</defs>${bg}<rect width="${PW}" height="${PH}" fill="url(#grid)"/>` +
      `<path fill="url(#g8)" d="${body}"/><path fill="${t.faint}" d="${outline}"/>` +
      ditherSteps(0, 856, PW, 56, [2, 4, 6, 8]) +
      // title-safe marker: a single green cell block (brand dot) top-left
      `<rect x="160" y="160" width="24" height="24" fill="${C.gecko}"/>` +
      `</svg>`;
    write(PLT, `plate-watermark-${mode}.svg`, svg);
  }

  // Plate C "Head mark": centred head (rows 0-10) at 24x on an icon tile, dither corners, grid ground.
  {
    const rows = SPRITE.slice(0, 11).map((r) => r.slice(3, 19)); // head only, hand fragment cropped
    const s = 24, w = 16 * s, h = 11 * s; // 528x264
    const tile = 720, tx = (PW - tile) / 2, ty = 120;
    const sx = (PW - w) / 2, sy = ty + (tile - h) / 2 + 24;
    const tileFill = mode === "light" ? C.paper : C.ink;
    const tileLine = mode === "light" ? C.line : C.nightLine;
    const corner = (x, y, flipX, flipY) => {
      // stepped dither staircase in a corner, 4 steps
      let out = "";
      [8, 6, 4, 2].forEach((l, i) => {
        const size = 96 * (i + 1);
        const rx = flipX ? x - size : x, ry = flipY ? y - 96 : y;
        out += `<rect x="${rx}" y="${flipY ? ry - i * 96 : ry + i * 96}" width="${size}" height="96" fill="url(#d${l})"/>`;
      });
      return out;
    };
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}" shape-rendering="crispEdges">` +
      `<defs>${patternDefs(t)}</defs>${bg}<rect width="${PW}" height="${PH}" fill="url(#grid)"/>` +
      corner(0, 0, false, false) + corner(PW, PH, true, true) +
      `<rect x="${tx}" y="${ty}" width="${tile}" height="${tile}" rx="${Math.round(tile * 22 / 96)}" fill="${tileFill}" stroke="${tileLine}" stroke-width="4" shape-rendering="geometricPrecision"/>` +
      rimFor(mode, rows, s, sx, sy) + spriteFull(s, sx, sy, rows) +
      `</svg>`;
    write(PLT, `plate-headmark-${mode}.svg`, svg);
  }
}
// ============ v2 LIBRARY (gecko-world textures, 3 intensities, sections) ============
const sizes = writeLibrary(root);
// v1 alias: scales-<mode>.svg = skin at standard intensity
for (const mode of ["light", "dark"]) fs.copyFileSync(path.join(TEX, `skin-${mode}.svg`), path.join(TEX, `scales-${mode}.svg`));
fs.writeFileSync(path.join(root, "src/brand/surfaces.css"), surfacesCss(sizes));
fs.writeFileSync(path.join(root, "scripts/brand/texture-sizes.json"), JSON.stringify(sizes, null, 2) + "\n");
console.log("ok", Object.keys(LIBRARY).length, "library textures");
