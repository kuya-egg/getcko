// Sprite sanity checks. Usage: node --experimental-strip-types scripts/brand/mascot-check.mjs
// 1. every row same length, only palette chars (validateSprites)
// 2. outline closure: no colored, non-ink cell 4-touches transparent or the canvas edge
// 3. each pose has ink and body cells (not empty)
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "src/brand/mascot/sprites.ts")).href);

const problems = [...S.validateSprites()];
for (const pose of S.POSES) {
  for (const flip of [false, true]) {
    const rows = S.buildPose(pose, { flip });
    const h = rows.length, w = rows[0].length;
    const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? "." : rows[y][x]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = rows[y][x];
        if (c === "." || c === "K") continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
          if (at(x + dx, y + dy) === ".") problems.push(`${pose}${flip ? " (flip)" : ""}: ${c} at row ${y} col ${x} leaks ${dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"}`);
      }
    const all = rows.join("");
    if (!all.includes("K") || !all.includes("G")) problems.push(`${pose}: missing ink or body`);
  }
}
const uniq = [...new Set(problems)];
if (uniq.length) { console.log(uniq.join("\n")); console.log(`\n${uniq.length} problem(s)`); process.exit(1); }
console.log(`ok: ${S.POSES.length} poses, all closed, all ${S.POSES.map((p) => S.buildPose(p)).every((r) => r.every((x) => x.length === r[0].length)) ? "rectangular" : "?"}`);
