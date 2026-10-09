// Renders every GetcKo pose into a contact sheet (8x grid + 2x/4x strips) and screenshots it.
// Usage: node --experimental-strip-types scripts/brand/mascot-sheet.mjs [out.png] [--only=pose,pose] [--scale=8]
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const S = await import(pathToFileURL(resolve(root, "src/brand/mascot/sprites.ts")).href);

const args = process.argv.slice(2);
const out = resolve(root, args.find((a) => !a.startsWith("--")) ?? "docs/brand/mascot-poses.png");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const big = Number(args.find((a) => a.startsWith("--scale="))?.slice(8) ?? 8);
const poses = only ?? S.POSES;

function svg(rows, s, bg) {
  const w = rows[0].length, h = rows.length;
  let r = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = S.PALETTE[row[x]];
      if (c && c !== "transparent") r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
    }
  });
  return `<svg width="${w * s}" height="${h * s}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" style="background:${bg}">${r}</svg>`;
}

const cols = 6;
const cellW = Math.max(26 * big, 200);
let html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#F6F5F0;font:13px/1.3 Consolas,monospace;color:#0E0F0C}
h1{font:600 18px Segoe UI,sans-serif;margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:20px 16px}
.c{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.c svg{border:1px dashed #d5d8d0}
.strip{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;margin-top:28px;padding:16px;background:#fff}
.strip.dk{background:#16181A}
.strip svg{display:block}
</style><h1>GetcKo poses (${big}x grid; 2x and 4x strips below, light and dark)</h1><div class="grid">`;
for (const p of poses) {
  const rows = S.buildPose(p);
  html += `<div class="c">${svg(rows, big, "#FFFFFF")}<div>${p} <span style="color:#888">${rows[0].length}x${rows.length}</span></div></div>`;
}
html += `</div>`;
for (const [s, bg, cls] of [[4, "#fff", ""], [2, "#fff", ""], [2, "#22262A", "dk"]]) {
  html += `<div class="strip ${cls}">${poses.map((p) => svg(S.buildPose(p), s, bg)).join("")}</div>`;
}
const htmlPath = resolve(here, "mascot-sheet.html");
writeFileSync(htmlPath, html);
const rowsN = Math.ceil(poses.length / cols);
const height = 80 + rowsN * (27 * big + 50) + 4 * 27 * 2 + 3 * 27 * 4 + 400;
const width = 60 + cols * (cellW + 16);
execFileSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless", "--disable-gpu", "--hide-scrollbars", `--screenshot=${out}`, `--window-size=${width},${height}`,
  pathToFileURL(htmlPath).href,
], { stdio: "ignore" });
console.log("wrote", out, width, height);
