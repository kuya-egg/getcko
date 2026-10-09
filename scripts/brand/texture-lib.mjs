// GetcKo texture library v2: gecko-world motifs, light + dark, three intensities each.
// Called by scripts/brand/generate.mjs. Never hand-edit the SVGs it writes; edit here and regenerate.
//
// How it works
//   Every texture is drawn on an integer cell Grid (pixel-art DNA: 1 cell = N px, no anti-aliasing).
//   Cells hold a "key" (a, b, c = neutral marks faint/mid/strong; g, h = green marks; d, e, f, q = dithered fills).
//   Keys turn into ONE colour per theme at an alpha per intensity:
//     light: ink (#0E0F0C) and gecko / gecko-deep  -> marks darken whatever light ground they sit on
//     dark : mist (#F1F3EC) and gecko              -> marks lighten whatever dark ground they sit on
//   So the same tile works on paper, canvas, gecko-wash (light) or night, night-1, gecko-night, ink (dark).
//   Grids wrap (modulo), so pattern tiles are seamless by construction.
//   Sun yellow never appears here: it belongs to the target halo only.
import fs from "node:fs";
import path from "node:path";

// ---- palette (mirrors src/brand/tokens.css) ----
const INK = "#0E0F0C";
const MIST = "#F1F3EC";
const GECKO = "#39D86F";
const GECKO_DEEP = "#0F7A3D";

export const INTENSITIES = ["subtle", "standard", "bold"];

// alpha per key per intensity [subtle, standard, bold]. Tuned so text / text-2 stay >= 4.5:1 on every
// mark at every intensity (checked by scripts/brand/contrast-check.mjs).
export const ALPHA = {
  light: { a: [0.04, 0.065, 0.1], b: [0.065, 0.105, 0.16], c: [0.1, 0.16, 0.24], g: [0.17, 0.28, 0.42], h: [0.15, 0.24, 0.36] },
  dark: { a: [0.035, 0.06, 0.09], b: [0.06, 0.095, 0.14], c: [0.085, 0.14, 0.2], g: [0.12, 0.17, 0.23], h: [0.15, 0.2, 0.26] },
};
export const COLOR = {
  light: { a: INK, b: INK, c: INK, g: GECKO, h: GECKO_DEEP },
  dark: { a: MIST, b: MIST, c: MIST, g: GECKO, h: GECKO },
};
// dithered fills: key -> [base key, Bayer level out of 16]
const DITHER = { q: ["a", 8], f: ["b", 4], d: ["b", 8], e: ["g", 8] };
// paint priority when shapes overlap (higher wins)
const PRI = { ".": 0, q: 1, f: 1, a: 2, d: 2, e: 3, b: 3, g: 4, c: 5, h: 6 };

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const mod = (n, m) => ((n % m) + m) % m;
function rng(seed) {
  // mulberry32
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Grid {
  constructor(w, h, wrap = true) {
    this.w = w;
    this.h = h;
    this.wrap = wrap;
    this.c = new Array(w * h).fill(".");
  }
  idx(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.wrap) {
      x = mod(x, this.w);
      y = mod(y, this.h);
    } else if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }
  set(x, y, k) {
    const i = this.idx(x, y);
    if (i >= 0 && PRI[k] >= PRI[this.c[i]]) this.c[i] = k;
  }
  force(x, y, k) {
    const i = this.idx(x, y);
    if (i >= 0) this.c[i] = k;
  }
  get(x, y) {
    const i = this.idx(x, y);
    return i < 0 ? "." : this.c[i];
  }
  /** Stamp a character map. map: char -> key ('0' clears the cell). */
  stamp(rows, ox, oy, map = {}) {
    rows.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (ch === ".") return;
        const k = map[ch] ?? ch;
        if (k === ".") return;
        if (k === "0") this.force(ox + x, oy + y, ".");
        else this.set(ox + x, oy + y, k);
      }),
    );
  }
  /** Copy another grid in (non-empty cells only). */
  paste(g, ox, oy) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.c[y * g.w + x] !== ".") this.set(ox + x, oy + y, g.c[y * g.w + x]);
  }
  flipV() {
    const n = new Grid(this.w, this.h, this.wrap);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) n.c[(this.h - 1 - y) * this.w + x] = this.c[y * this.w + x];
    return n;
  }
  rows() {
    const out = [];
    for (let y = 0; y < this.h; y++) out.push(this.c.slice(y * this.w, (y + 1) * this.w).join(""));
    return out;
  }
}

// run-length path in cell units (viewBox = cells, so numbers stay short)
function runs(rows, key) {
  let d = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === key) {
        let w = 1;
        while (x + w < row.length && row[x + w] === key) w++;
        d += `M${x} ${y}h${w}v1h-${w}z`;
        x += w;
      } else x++;
    }
  });
  return d;
}

const f2 = (n) => String(+n.toFixed(3)).replace(/^0\./, ".");

/** Grid -> SVG string for one theme + intensity index (0 subtle, 1 standard, 2 bold). */
export function gridSvg(grid, cell, mode, ii) {
  const rows = grid.rows();
  let defs = "";
  let body = "";
  for (const k of ["q", "f", "d", "e"]) {
    const d = runs(rows, k);
    if (!d) continue;
    const [base, lvl] = DITHER[k];
    let p = "";
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (BAYER4[y][x] < lvl) p += `M${x} ${y}h1v1h-1z`;
    defs += `<pattern id="${k}" width="4" height="4" patternUnits="userSpaceOnUse"><path fill="${COLOR[mode][base]}" fill-opacity="${f2(ALPHA[mode][base][ii])}" d="${p}"/></pattern>`;
    body += `<path fill="url(#${k})" d="${d}"/>`;
  }
  for (const k of ["a", "b", "c", "g", "h"]) {
    const d = runs(rows, k);
    if (d) body += `<path fill="${COLOR[mode][k]}" fill-opacity="${f2(ALPHA[mode][k][ii])}" d="${d}"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${grid.w * cell}" height="${grid.h * cell}" viewBox="0 0 ${grid.w} ${grid.h}" shape-rendering="crispEdges">` +
    (defs ? `<defs>${defs}</defs>` : "") +
    body +
    `</svg>\n`
  );
}

// ================= MOTIFS =================

// 8-way directions, index 0 = N, clockwise (screen coords: y grows down)
const DIR8 = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];
const dirIndex = (dx, dy) => mod(Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 45 + 2), 8);

/**
 * Gecko footprint: a broad palm, five short toes fanned forward, each ending in a big round sticky pad
 * (that is what a gecko print actually is: pads, not claws). Directions snap to 45 degree steps so every
 * toe is a clean pixel line. side: +1 right foot, -1 left foot (the inner toe is the short one).
 */
function disc(out, cx, cy, r, k) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) out.push([cx + x, cy + y, k]);
}
function footCells(h, side, keys = { palm: "b", toe: "b", pad: "h" }) {
  const out = [];
  const [hx, hy] = DIR8[h];
  // palm: a disc pulled back from the toes, plus a heel cell
  disc(out, -hx, -hy, 2, keys.palm);
  // toes fanned -90..+90 around the heading; outer toes lean forward; inner toe (thumb) shorter
  const fan = [-2, -1, 0, 1, 2];
  for (const t of fan) {
    const [dx, dy] = DIR8[mod(h + t, 8)];
    const diag = dx !== 0 && dy !== 0;
    const inner = t === -2 * side;
    const reach = (Math.abs(t) === 2 ? 5 : 6) - (inner ? 1 : 0) - (diag ? 1 : 0);
    const lean = Math.abs(t) === 2 ? 1 : 0;
    const px = dx * (reach + 1) + hx * lean, py = dy * (reach + 1) + hy * lean;
    // stem
    const n = Math.max(Math.abs(px), Math.abs(py));
    for (let s = 1; s < n; s++) out.push([Math.round((px * s) / n), Math.round((py * s) / n), keys.toe]);
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) out.push([px + x, py + y, keys.pad]); // 3x3 round pad
  }
  return out;
}

function stampFoot(g, cx, cy, h, side, keys) {
  for (const [x, y, k] of footCells(h, side, keys)) g.set(cx + x, cy + y, k);
}

/** Lay prints along a path p(t), t in [0,1). Alternates right/left feet, gait = offset from the path. */
function trail(g, p, n, { gait = 4, keys, skip = () => false, phase = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const t = (i + phase) / n;
    const [x, y] = p(t);
    const [x2, y2] = p(t + 0.002);
    const tx = x2 - x, ty = y2 - y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len; // right-hand normal
    const side = i % 2 ? 1 : -1;
    const cx = x + nx * gait * side, cy = y + ny * gait * side;
    if (skip(cx, cy)) continue;
    stampFoot(g, Math.round(cx), Math.round(cy), dirIndex(tx, ty), side, keys);
  }
}

// 1. Footprint trail: two geckos crossing a wall, one climbing up-right, one heading down-left.
function footprints() {
  const T = 128;
  const g = new Grid(T, T);
  const wander = (t, a, ph) => a * Math.sin(2 * Math.PI * t + ph) + (a / 3) * Math.sin(4 * Math.PI * t + ph * 2);
  const s = Math.SQRT1_2;
  // trail A: up-right along x + y = T
  trail(g, (t) => { const w = wander(t, 10, 0); return [t * T + w * s, T - t * T + w * s]; }, 8, { gait: 4, keys: { palm: "c", toe: "c", pad: "h" } });
  // trail B: down-left, half a tile over, fainter (the second gecko is further away)
  trail(g, (t) => { const w = wander(t, 8, 2.1); return [T * 1.5 - t * T + w * s, t * T + w * s]; }, 8, { gait: 4, phase: 0.5, keys: { palm: "b", toe: "b", pad: "g" } });
  return g;
}

// 2. Lamellae: the underside of gecko toes. Columns of curved sticky ridges, each toe capped by its
//    round tip pad; neighbouring toes staggered by half a toe, so the band has a walking rhythm.
function lamellae() {
  const cw = 14, gap = 2, pitch = 3, arcs = 10;
  const colW = cw + gap, W = colW * 2, H = 6 + arcs * pitch; // 32 x 36 cells
  const g = new Grid(W, H);
  const mid = (cw - 1) / 2;
  for (let c = 0; c < 2; c++) {
    const x0 = c * colW, y0 = c ? H / 2 : 0;
    // tip pad: a lit dome
    for (let y = 0; y < 5; y++) for (let x = 0; x < cw; x++) {
      const u = (x - mid) / (mid + 0.5), v = (4.5 - y) / 5;
      const e = u * u + v * v;
      if (e <= 1) g.set(x0 + x, y0 + y, e > 0.55 ? "h" : "g");
    }
    // ridges: arches, alternating strong/mid, each with a dithered shadow under it
    for (let r = 0; r < arcs; r++) {
      for (let x = 0; x < cw; x++) {
        const u = (x - mid) / mid;
        const y = y0 + 5 + r * pitch + Math.round(2.2 * u * u);
        g.set(x0 + x, y, r % 2 ? "b" : "c");
        g.set(x0 + x, y + 1, "q");
      }
    }
    // seams between toes
    for (let y = 2; y < H; y++) g.set(x0 + cw, y0 + y, "a");
  }
  return g;
}

// 3. Skin: granular scales with raised tubercles; highlight cells catch the light, a few pigment spots.
function skin() {
  const T = 96;
  const g = new Grid(T, T);
  const r = rng(11);
  // granules: staggered 2x2 dots on a 4-cell lattice, corner cell dropped so they read round
  for (let y = 0; y < T; y += 4) {
    for (let x = 0; x < T; x += 4) {
      if (r() < 0.08) continue;
      const ox = x + ((y / 4) % 2 ? 2 : 0) + (r() < 0.3 ? 1 : 0), oy = y + (r() < 0.25 ? 1 : 0);
      g.set(ox, oy, "a");
      g.set(ox + 1, oy, "a");
      g.set(ox, oy + 1, "a");
      if (r() < 0.5) g.set(ox + 1, oy + 1, "a");
    }
  }
  // tubercles on a jittered hex lattice (period divides T for seamless wrap)
  const px = 16, py = 12;
  for (let j = 0; j < T / py; j++) {
    for (let i = 0; i < T / px; i++) {
      const cx = i * px + (j % 2 ? px / 2 : 0) + Math.round((r() - 0.5) * 4);
      const cy = j * py + Math.round((r() - 0.5) * 4);
      const rad = r() < 0.35 ? 4 : 3;
      const spot = r() < 0.22;
      // clear a ring so the tubercle sits proud of the granules
      for (let y = -rad - 1; y <= rad + 1; y++) for (let x = -rad - 1; x <= rad + 1; x++) if (x * x + y * y <= (rad + 1) * (rad + 1) + 0.6) g.force(cx + x, cy + y, ".");
      for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
          if (x * x + y * y > rad * rad + 0.6) continue;
          let k = spot ? "g" : "b";
          if (x + y >= rad) k = "c"; // shaded lower-right rim
          if (x + y <= -rad + 1 && x * x + y * y >= (rad - 1) * (rad - 1)) k = spot ? "h" : "g"; // lit upper-left rim
          g.force(cx + x, cy + y, k);
        }
      }
      // specular cell
      g.force(cx - 1, cy - 1, spot ? "h" : "g");
    }
  }
  return g;
}

// leaf: lens/heart shape along an axis from a base point; flat green, darker midrib
function leaf(g, bx, by, ang, L, hw, keys = { leaf: "g", rib: "h" }) {
  const ax = Math.sin(ang), ay = Math.cos(ang); // ang 0 = hanging straight down
  const nx = -ay, ny = ax;
  const R = L + hw + 2;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const u = x * ax + y * ay, w = x * nx + y * ny;
      if (u < 0 || u > L) continue;
      const tt = u / L;
      const half = hw * Math.pow(Math.sin(Math.PI * Math.min(1, tt * 1.15)), 0.7) * (tt < 0.12 ? 0.8 : 1);
      if (Math.abs(w) > half) continue;
      const k = Math.abs(w) < 0.55 && tt < 0.86 ? keys.rib : keys.leaf;
      g.set(bx + x, by + y, k);
    }
  }
}
function stem(g, pts, key) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    let lx = null, ly = null;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n);
      // 4-connected stroke: fill the corner on diagonal steps so the line never breaks into dots
      if (lx !== null && x !== lx && y !== ly) g.set(x, ly, key);
      g.set(x, y, key);
      lx = x; ly = y;
    }
  }
}

// 4. Canopy: a pothos vine along the top edge with hanging leaves (repeat-x band, top aligned)
function canopy() {
  const W = 96, H = 48;
  const g = new Grid(W, H);
  const sy = (x) => 3 + 2 * Math.sin((2 * Math.PI * x) / W);
  const pts = [];
  for (let x = 0; x <= W; x += 2) pts.push([x, sy(x)]);
  stem(g, pts, "h");
  const leaves = [
    [5, 0.55, 16, 5], [19, -0.35, 27, 7], [36, 0.15, 13, 4], [50, -0.55, 21, 6], [66, 0.4, 31, 8], [83, -0.1, 17, 5],
  ];
  for (const [n, [x, a, L, hw]] of leaves.entries()) {
    const y = Math.round(sy(x)) + 1;
    const keys = n % 2 ? { leaf: "e", rib: "g" } : { leaf: "g", rib: "h" };
    // petiole
    const px = Math.round(Math.sin(a) * 3), py = 3;
    stem(g, [[x, y], [x + px, y + py]], "h");
    leaf(g, x + px, y + py, a, L, hw, keys);
  }
  // tendrils: thin hanging threads with a hooked end
  for (const [x, len] of [[12, 9], [44, 14], [58, 7], [76, 11], [91, 6]]) {
    const y = Math.round(sy(x)) + 1;
    for (let k = 0; k < len; k++) g.set(x, y + k, "b");
    g.set(x + 1, y + len, "b");
    g.set(x + 2, y + len - 1, "b");
  }
  return g;
}

// canopy corner cluster: a branch entering from the top-right, leaves both sides (no-repeat)
function canopyCorner(S = 80) {
  const g = new Grid(S, S, false);
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push([S - 1 - t * (S * 0.78), t * (S * 0.42) + Math.sin(t * Math.PI) * 10]);
  }
  stem(g, pts, "h");
  const at = (t) => pts[Math.round(t * 20)];
  const L = [
    [0.08, 0.3, 22, 7], [0.2, -0.7, 26, 8], [0.33, 0.55, 18, 6], [0.46, -0.45, 24, 7], [0.6, 0.2, 20, 6], [0.74, -0.9, 16, 5], [0.88, 0.5, 13, 4], [0.97, -0.2, 9, 3],
  ];
  L.forEach(([t, a, len, hw], n) => {
    const [x, y] = at(t);
    // alternate front (solid) and back (dithered) leaves so the cluster has depth, not one green mass
    leaf(g, Math.round(x), Math.round(y) + 1, a, len, hw, n % 2 ? { leaf: "e", rib: "g" } : { leaf: "g", rib: "h" });
  });
  // a few new shoots: small upward leaves
  for (const [t, a] of [[0.27, Math.PI - 0.5], [0.53, Math.PI + 0.4], [0.81, Math.PI - 0.3]]) {
    const [x, y] = at(t);
    leaf(g, Math.round(x), Math.round(y) - 1, a, 8, 3);
  }
  return g;
}

// 6. Pointer: pixel arrow cursors aimed at bracketed targets on a coordinate dot field
const CURSOR = [
  "X..........",
  "XX.........",
  "XoX........",
  "XooX.......",
  "XoooX......",
  "XooooX.....",
  "XoooooX....",
  "XooooooX...",
  "XoooooooX..",
  "XooooXXXXX.",
  "XooXoX.....",
  "XoX.XoX....",
  "XX..XoX....",
  "X....XoX...",
  ".....XoX...",
  "......XX...",
];
function bracket(g, cx, cy, r, key) {
  const arm = 3;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * r, y = cy + sy * r;
    for (let k = 0; k < arm; k++) {
      g.set(x - sx * k, y, key);
      g.set(x, y - sy * k, key);
    }
  }
}
function pointer() {
  const T = 120;
  const g = new Grid(T, T);
  for (let y = 0; y < T; y += 10) for (let x = 0; x < T; x += 10) g.set(x, y, "a");
  const pairs = [[18, 18], [78, 34], [40, 78], [100, 96]];
  for (const [x, y] of pairs) {
    bracket(g, x, y, 6, "h");
    g.set(x, y, "g"); g.set(x - 1, y, "g"); g.set(x + 1, y, "g"); g.set(x, y - 1, "g"); g.set(x, y + 1, "g");
    g.stamp(CURSOR, x + 5, y + 5, { X: "c", o: "a" });
  }
  // loose crosshairs: coordinates waiting for a target
  for (const [x, y] of [[60, 8], [8, 56], [96, 64], [64, 110], [26, 106]]) {
    for (let k = -2; k <= 2; k++) { g.set(x + k, y, "b"); g.set(x, y + k, "b"); }
  }
  return g;
}

// 7. Banig: pandan-strip plain weave. Each block shows one strip segment with shaded ends where it dives
//    under its neighbour (that is what makes it read as woven, not as a checkerboard). Nested diamonds
//    are dyed strips, as on a real banig.
function weave() {
  const S = 5, B = 16; // strip width in cells, blocks per tile
  const T = S * B; // 80 cells -> 160px
  const g = new Grid(T, T);
  const c = B / 2;
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const i = Math.floor(x / S), j = Math.floor(y / S);
      const horiz = (i + j) % 2 === 0; // horizontal strip on top in this block
      const lx = x % S, ly = y % S;
      const along = horiz ? lx : ly; // position along the visible strip segment
      const across = horiz ? ly : lx;
      const d = Math.abs(i - c) + Math.abs(j - c); // diamond distance on the block lattice
      const dyed = d === 0 || d === 2 || d === 5 || d === 6;
      const deep = d === 2;
      let k;
      if (along === 0 || along === S - 1) k = dyed ? "h" : "b"; // strip ends: diving under
      else if (across === S - 1) k = dyed ? "h" : "a"; // gap between strips
      else k = dyed ? (deep ? "h" : "g") : horiz ? "." : "a";
      if (d === 11 && !(along === 0 || along === S - 1)) k = across === S - 1 ? "b" : "a"; // outer border ring
      g.c[y * T + x] = k;
    }
  }
  return g;
}

// 8. Dither fields + fade
function ditherField(level) {
  const g = new Grid(4, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (BAYER4[y][x] < level) g.c[y * 4 + x] = "b";
  return g;
}
function ditherFade() {
  // 0 -> 10/16 top to bottom in 10 steps of 8 cells (cell 4px -> 320px tall)
  const g = new Grid(4, 80);
  for (let y = 0; y < 80; y++) {
    const level = Math.floor(y / 8) + 1;
    for (let x = 0; x < 4; x++) if (BAYER4[y % 4][x] < level) g.c[y * 4 + x] = "b";
  }
  return g;
}

// ---- sprite for the hero composition (copy of the base pointing map) ----
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

// 9a. Hero: a giant ghost GetcKo (dithered body, green belly) standing in pothos at the bottom right,
//     its own trail of prints walking in from the left. Anchor right bottom; text lives top-left.
//     1040 x 560: fits a 560px+ hero without cropping the head.
function sectionHero() {
  const W = 260, H = 140, s = 5;
  const g = new Grid(W, H, false);
  const gx = W - 22 * s - 8, gy = H - 27 * s;
  // back plants first (dithered, behind the gecko)
  for (const [x, a, L, hw] of [[gx - 16, -0.6, 36, 9], [gx - 6, 0.15, 28, 7], [W - 3, -0.3, 40, 9]]) leaf(g, x, H - 1, Math.PI + a, L, hw, { leaf: "e", rib: "g" });
  const map = { K: "c", G: "d", L: "g", B: "e", P: "g", W: ".", D: "c" };
  SPRITE.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const k = map[ch];
      if (!k || k === ".") return;
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) g.force(gx + x * s + i, gy + y * s + j, k);
    }),
  );
  // front leaves: solid, overlapping the feet so the gecko stands IN its habitat
  for (const [x, a, L, hw] of [[gx - 12, 0.55, 26, 7], [gx + 46, -0.3, 20, 6], [W - 12, 0.7, 24, 6]]) leaf(g, x, H - 1, Math.PI + a, L, hw);
  // trail from the left edge, rising over a shallow hill, landing at the gecko's toes
  const P0 = [-8, H - 22], P1 = [80, H - 86], P2 = [gx - 4, H - 10];
  const bez = (t) => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ];
  trail(g, bez, 9, { gait: 5, keys: { palm: "c", toe: "c", pad: "h" } });
  return g;
}

// 9b. How-it-works band: a ruler edge, prints walking left to right, one bracketed stop per tile
function sectionHow() {
  const W = 160, H = 44;
  const g = new Grid(W, H);
  // ruler edges top and bottom, ticks every 10 cells, long tick every 40
  for (let x = 0; x < W; x++) {
    g.set(x, 0, "a");
    g.set(x, H - 1, "a");
    if (x % 10 === 0) for (let k = 1; k <= (x % 40 === 0 ? 4 : 2); k++) { g.set(x, k, "b"); g.set(x, H - 1 - k, "b"); }
  }
  const stopX = 132, cy = 22;
  trail(g, (t) => [t * W, cy + 3 * Math.sin(2 * Math.PI * t * 2)], 8, {
    gait: 4,
    keys: { palm: "c", toe: "c", pad: "h" },
    skip: (x) => Math.abs(mod(x, W) - stopX) < 12,
  });
  bracket(g, stopX, cy, 9, "h");
  for (let k = -3; k <= 3; k++) { g.set(stopX + k, cy, "g"); g.set(stopX, cy + k, "g"); }
  return g;
}

// 9c. Footer band: ground rises in dither steps, ferns and pothos grow up out of it (repeat-x, bottom)
function sectionFooter() {
  const W = 96, H = 64;
  const g = new Grid(W, H);
  // stepped ground, densest at the bottom
  for (let y = 0; y < H; y++) {
    const fromBottom = H - 1 - y;
    const k = fromBottom < 8 ? "d" : fromBottom < 16 ? "f" : fromBottom < 24 ? "q" : null;
    if (k) for (let x = 0; x < W; x++) g.set(x, y, k);
  }
  // upward leaves (ang = PI is pointing up)
  const plants = [
    [8, [[-0.35, 22, 6], [0.3, 16, 5]]],
    [30, [[0.15, 30, 7], [-0.6, 14, 4]]],
    [52, [[-0.2, 18, 5]]],
    [70, [[0.45, 26, 7], [-0.25, 34, 8], [0.9, 12, 4]]],
    [90, [[-0.4, 15, 5]]],
  ];
  for (const [x, ls] of plants) for (const [a, L, hw] of ls) leaf(g, x, H - 6, Math.PI + a, L, hw);
  return g;
}

// ================= REGISTRY =================
// id -> { grid builder, cell px, css }
export const LIBRARY = {
  footprints: { build: footprints, cell: 3, repeat: "repeat", position: "0 0", dir: "textures" },
  lamellae: { build: lamellae, cell: 3, repeat: "repeat", position: "0 0", dir: "textures" },
  skin: { build: skin, cell: 3, repeat: "repeat", position: "0 0", dir: "textures" },
  canopy: { build: canopy, cell: 4, repeat: "repeat-x", position: "left top", dir: "textures" },
  "canopy-bottom": { build: () => canopy().flipV(), cell: 4, repeat: "repeat-x", position: "left bottom", dir: "textures" },
  "canopy-corner": { build: () => canopyCorner(), cell: 4, repeat: "no-repeat", position: "right top", dir: "textures" },
  pointer: { build: pointer, cell: 2, repeat: "repeat", position: "0 0", dir: "textures" },
  weave: { build: weave, cell: 2, repeat: "repeat", position: "0 0", dir: "textures" },
  "dither-lo": { build: () => ditherField(2), cell: 4, repeat: "repeat", position: "0 0", dir: "textures" },
  "dither-mid": { build: () => ditherField(4), cell: 4, repeat: "repeat", position: "0 0", dir: "textures" },
  "dither-hi": { build: () => ditherField(8), cell: 4, repeat: "repeat", position: "0 0", dir: "textures" },
  "dither-fade": { build: ditherFade, cell: 4, repeat: "repeat-x", position: "left bottom", dir: "textures" },
  "section-hero": { build: sectionHero, cell: 4, repeat: "no-repeat", position: "right bottom", dir: "sections" },
  "section-how": { build: sectionHow, cell: 4, repeat: "repeat-x", position: "left center", dir: "sections" },
  "section-footer": { build: sectionFooter, cell: 4, repeat: "repeat-x", position: "left bottom", dir: "sections" },
};

// Surface recipes: class -> layers (top first). Each layer is a LIBRARY id.
export const SURFACES = {
  footprints: ["footprints"],
  lamellae: ["lamellae"],
  skin: ["skin"],
  scales: ["skin"], // alias of the v1 name
  canopy: ["canopy"],
  "canopy-bottom": ["canopy-bottom"],
  "canopy-corner": ["canopy-corner"],
  pointer: ["pointer"],
  weave: ["weave"],
  "dither-lo": ["dither-lo"],
  "dither-mid": ["dither-mid"],
  "dither-hi": ["dither-hi"],
  "dither-fade": ["dither-fade"],
  hero: ["section-hero"],
  how: ["section-how"],
  footer: ["section-footer"],
};

const fileName = (id, mode, ii) => `${id}-${mode}${ii === 1 ? "" : `-${INTENSITIES[ii]}`}.svg`;
export const urlFor = (id, mode, ii, base = "/brand") => `${base}/${LIBRARY[id].dir}/${fileName(id, mode, ii)}`;

/** Write every SVG (2 themes x 3 intensities) and return { id: {w, h} } in px. */
export function writeLibrary(root) {
  const sizes = {};
  const report = [];
  for (const [id, spec] of Object.entries(LIBRARY)) {
    const grid = spec.build();
    const dir = path.join(root, "public/brand", spec.dir);
    fs.mkdirSync(dir, { recursive: true });
    sizes[id] = { w: grid.w * spec.cell, h: grid.h * spec.cell };
    for (const mode of ["light", "dark"]) {
      for (let ii = 0; ii < 3; ii++) {
        const svg = gridSvg(grid, spec.cell, mode, ii);
        fs.writeFileSync(path.join(dir, fileName(id, mode, ii)), svg);
        report.push([fileName(id, mode, ii), svg.length]);
      }
    }
  }
  const big = report.filter(([, n]) => n > 40000);
  if (big.length) console.warn("over 40KB:", big);
  return sizes;
}

/** Generate src/brand/surfaces.css from the registry. */
export function surfacesCss(sizes) {
  const L = [];
  L.push(`/*
 * GetcKo surfaces: textured SECTIONS (not one global background). GENERATED by
 * scripts/brand/generate.mjs from scripts/brand/texture-lib.mjs. Do not hand-edit; regenerate.
 *
 *   <section class="surface surface-footprints surface--standard surface--canvas">
 *
 *   texture   .surface-{footprints|lamellae|skin|canopy|canopy-bottom|canopy-corner|pointer|weave|
 *                       dither-lo|dither-mid|dither-hi|dither-fade|hero|how|footer}   (.surface-scales = skin)
 *   intensity .surface--subtle | .surface--standard (default) | .surface--bold
 *   tone      .surface--canvas (default) | .surface--paper | .surface--green | .surface--ink
 *   theme     follows <html data-theme> / prefers-color-scheme; force with .surface--light / .surface--dark.
 *             .surface--ink and .surface--dark re-scope the semantic tokens, so text-text, bg-surface,
 *             border-border inside them read as the dark theme (a dark island in a light page).
 *
 * Text rules: headings, text and text-2 pass 4.5:1 on every mark at every intensity.
 * Captions (text-3) only on subtle or on a content card. Content cards: bg-surface + border.
 */`);
  // base
  L.push(`.surface{--sf-ground-light:var(--gc-canvas);--sf-ground-dark:var(--gc-night);--sf-light:var(--sf-light-standard,none);--sf-dark:var(--sf-dark-standard,none);--sf-img:var(--sf-light);--sf-ground:var(--sf-ground-light);background-color:var(--sf-ground);background-image:var(--sf-img);background-size:var(--sf-size,auto);background-repeat:var(--sf-repeat,repeat);background-position:var(--sf-pos,0 0);color:var(--gc-text);}`);
  // textures
  for (const [cls, layers] of Object.entries(SURFACES)) {
    const vars = [];
    for (const mode of ["light", "dark"]) {
      for (let ii = 0; ii < 3; ii++) {
        vars.push(`--sf-${mode}-${INTENSITIES[ii]}:${layers.map((id) => `url("${urlFor(id, mode, ii)}")`).join(",")}`);
      }
    }
    vars.push(`--sf-size:${layers.map((id) => `${sizes[id].w}px ${sizes[id].h}px`).join(",")}`);
    vars.push(`--sf-repeat:${layers.map((id) => LIBRARY[id].repeat).join(",")}`);
    vars.push(`--sf-pos:${layers.map((id) => LIBRARY[id].position).join(",")}`);
    L.push(`.surface-${cls}{${vars.join(";")};}`);
  }
  // intensity
  L.push(`.surface--subtle{--sf-light:var(--sf-light-subtle,none);--sf-dark:var(--sf-dark-subtle,none);}`);
  L.push(`.surface--standard{--sf-light:var(--sf-light-standard,none);--sf-dark:var(--sf-dark-standard,none);}`);
  L.push(`.surface--bold{--sf-light:var(--sf-light-bold,none);--sf-dark:var(--sf-dark-bold,none);}`);
  // tones
  L.push(`.surface--canvas{--sf-ground-light:var(--gc-canvas);--sf-ground-dark:var(--gc-night);}`);
  L.push(`.surface--paper{--sf-ground-light:var(--gc-paper);--sf-ground-dark:var(--gc-night-1);}`);
  L.push(`.surface--green{--sf-ground-light:var(--gc-gecko-wash);--sf-ground-dark:var(--gc-gecko-night);}`);
  L.push(`.surface--ink{--sf-ground-light:var(--gc-ink);--sf-ground-dark:var(--gc-ink);}`);
  // contrast cap: on the dark gecko-night ground, bold marks drop text-2 under 4.5:1, so dark green caps at standard
  L.push(`.surface--green.surface--bold{--sf-dark:var(--sf-dark-standard,none);}`);
  // theme pick
  const dark = `--sf-img:var(--sf-dark);--sf-ground:var(--sf-ground-dark);`;
  L.push(`:root[data-theme="dark"] .surface:not(.surface--light){${dark}}`);
  L.push(`@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .surface:not(.surface--light){${dark}}}`);
  L.push(`.surface.surface--dark,.surface.surface--ink{${dark}}`);
  L.push(`:root .surface.surface--light:not(.surface--ink){--sf-img:var(--sf-light);--sf-ground:var(--sf-ground-light);}`);
  // dark island token re-scope (mirrors the dark block in tokens.css)
  L.push(`.surface--ink,.surface--dark{color-scheme:dark;--gc-bg:var(--gc-night);--gc-surface:var(--gc-night-1);--gc-surface-2:var(--gc-night-2);--gc-border:var(--gc-night-line);--gc-border-strong:var(--gc-night-line-strong);--gc-text:var(--gc-mist);--gc-text-2:var(--gc-mist-2);--gc-text-3:var(--gc-mist-3);--gc-accent-text:var(--gc-gecko-tint);--gc-accent-wash:var(--gc-gecko-night);--gc-danger:var(--gc-alert-tint);--gc-danger-wash:var(--gc-alert-night);--gc-inverse-bg:var(--gc-mist);--gc-inverse-text:var(--gc-ink);--gc-focus:var(--gc-gecko);--gc-focus-wash:var(--gc-gecko-night);--gc-selection:var(--gc-gecko-night-2);--gc-keycap-bg:var(--gc-night-2);--gc-keycap-border:var(--gc-night-line-strong);--gc-halo:0 0 0 3px var(--gc-night),0 0 0 6px var(--gc-sun);}`);
  L.push(`.surface--light:not(.surface--ink){color-scheme:light;--gc-bg:var(--gc-paper);--gc-surface:var(--gc-paper);--gc-surface-2:var(--gc-canvas);--gc-border:var(--gc-line);--gc-border-strong:var(--gc-line-strong);--gc-text:var(--gc-ink);--gc-text-2:var(--gc-ink-2);--gc-text-3:var(--gc-ink-3);--gc-accent-text:var(--gc-gecko-deep);--gc-accent-wash:var(--gc-gecko-wash);--gc-danger:var(--gc-alert);--gc-danger-wash:var(--gc-alert-wash);--gc-inverse-bg:var(--gc-ink);--gc-inverse-text:var(--gc-paper);--gc-focus:var(--gc-gecko-deep);--gc-focus-wash:var(--gc-gecko-wash);--gc-selection:var(--gc-gecko-wash);--gc-keycap-bg:var(--gc-paper);--gc-keycap-border:var(--gc-line-strong);--gc-halo:0 0 0 3px var(--gc-sun),0 0 0 4px var(--gc-ink);}`);
  return L.join("\n") + "\n";
}
