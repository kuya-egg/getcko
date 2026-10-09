// GetcKo logo + app icon generator. Reads the sprite data (src/brand/mascot/sprites.ts), never redraws it.
// Usage: node --experimental-strip-types scripts/brand/app-icon.mjs
//
// Writes:
//   public/brand/logo/headmark.svg             head mark only, transparent (light grounds)
//   public/brand/logo/headmark-ink-tile.svg    head mark on an ink tile (dark icon), radius 22 at 96
//   public/brand/logo/headmark-paper-tile.svg  head mark on a paper tile with a line border (light icon)
//   public/brand/logo/wordmark-light.svg       lockup: head mark + "GetcKo" in ink (light grounds)
//   public/brand/logo/wordmark-dark.svg        lockup in mist (dark grounds)
//   public/brand/favicon.svg                   ink tile, 24-cell grid
//   docs/brand/app-icon-1024.png               ink tile on the macOS icon grid (824 tile in 1024), via headless Edge
//
// Then the src-tauri owner runs: npx tauri icon docs/brand/app-icon-1024.png
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "src/brand/mascot/sprites.ts")).href);

const INK = "#0E0F0C";
const PAPER = "#FFFFFF";
const LINE = "#E6E8E3";
const MIST = "#F1F3EC";
// Head mark = sprite rows 0-10 (buildHeadMark). For the logo, drop the pointing arm's stub (cols 19+, rows 9-10:
// one stray green cell on an ink tile) and crop to the head's bounding box, so the mark centers on the head.
const raw = S.buildHeadMark().map((r) => r.slice(0, 19)); // 22 x 11 -> 19 x 11
const used = raw.flatMap((r) => [...r].map((k, x) => (k === "." ? -1 : x))).filter((x) => x >= 0);
const x0 = Math.min(...used);
const x1 = Math.max(...used);
const head = raw.map((r) => r.slice(x0, x1 + 1)); // 16 x 11 cells
const W = head[0].length;
const H = head.length;

/** Head mark cells as <rect>s, horizontal runs merged per color. Cell size `c`, origin (ox, oy). */
function cells(c, ox, oy) {
  const out = [];
  head.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const k = row[x];
      let e = x + 1;
      while (e < row.length && row[e] === k) e++;
      if (k !== ".") out.push(`<rect x="${ox + x * c}" y="${oy + y * c}" width="${(e - x) * c}" height="${c}" fill="${S.PALETTE[k]}"/>`);
      x = e;
    }
  });
  return out.join("");
}

const svg = (w, h, body, title = "GetcKo") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;

/** Tile: size px square, radius 22/96 of size, mark at the largest whole scale that fits 62% width. */
function tile(size, tone, pad = 0) {
  const t = size - pad * 2;
  const r = Math.round((t * 22) / 96);
  const c = Math.max(1, Math.floor((t * 0.62) / W));
  const ox = pad + (t - W * c) / 2;
  const oy = pad + (t - H * c) / 2;
  const bg = tone === "ink"
    ? `<rect x="${pad}" y="${pad}" width="${t}" height="${t}" rx="${r}" fill="${INK}" shape-rendering="geometricPrecision"/>`
    : `<rect x="${pad + 0.5}" y="${pad + 0.5}" width="${t - 1}" height="${t - 1}" rx="${r}" fill="${PAPER}" stroke="${LINE}" shape-rendering="geometricPrecision"/>`;
  return bg + cells(c, ox, oy);
}

// Lockup in head-mark cells: clearspace 4 cells on every side, 4-cell gap, cap height ~ head height.
function wordmark(textColor) {
  const c = 10; // px per cell in the file; scale the SVG freely
  const clear = 4 * c;
  const gap = 4 * c;
  const fontSize = 15 * c; // Bricolage 800 caps ~ 0.72em ~ 11 cells = head height
  const textW = 54 * c; // "GetcKo" at 800, ~3.6em
  const w = clear + W * c + gap + textW + clear;
  const h = clear + Math.max(H * c, fontSize) + clear;
  const markY = (h - H * c) / 2;
  const baseline = markY + H * c; // caps sit on the mark's bottom edge
  const text = `<text x="${clear + W * c + gap}" y="${baseline}" font-family="'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Arial Black', sans-serif" font-weight="800" font-size="${fontSize}" letter-spacing="${-0.035 * fontSize}" fill="${textColor}" shape-rendering="geometricPrecision">GetcKo</text>`;
  return svg(w, h, cells(c, clear, markY) + text);
}

const logoDir = resolve(root, "public/brand/logo");
mkdirSync(logoDir, { recursive: true });
const files = {
  [resolve(logoDir, "headmark.svg")]: svg(W * 10, H * 10, cells(10, 0, 0)),
  [resolve(logoDir, "headmark-ink-tile.svg")]: svg(96, 96, tile(96, "ink")),
  [resolve(logoDir, "headmark-paper-tile.svg")]: svg(96, 96, tile(96, "paper")),
  [resolve(logoDir, "wordmark-light.svg")]: wordmark(INK),
  [resolve(logoDir, "wordmark-dark.svg")]: wordmark(MIST),
  [resolve(root, "public/brand/favicon.svg")]: svg(24, 24, `<rect width="24" height="24" rx="5.5" fill="${INK}" shape-rendering="geometricPrecision"/>` + cells(1, 4, 6.5)),
};
for (const [p, s] of Object.entries(files)) {
  writeFileSync(p, s);
  console.log("wrote", p.slice(root.length + 1));
}

// App icon PNG: macOS grid, 824 tile centered in a transparent 1024 canvas.
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const out = resolve(root, "docs/brand/app-icon-1024.png");
const html = resolve(tmpdir(), `getcko-app-icon-${process.pid}.html`);
writeFileSync(
  html,
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(1024, 1024, tile(1024, "ink", 100))}`,
);
if (existsSync(edge)) {
  execFileSync(edge, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--default-background-color=00000000",
    `--screenshot=${out}`,
    "--window-size=1024,1024",
    pathToFileURL(html).href,
  ], { stdio: "ignore" });
  console.log("wrote", out.slice(root.length + 1));
} else {
  console.log("Edge not found; open", html, "and screenshot it at 1024x1024 to", out);
}
rmSync(html, { force: true });
