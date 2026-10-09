// Animated GetcKo GIFs from the sprite data (no npm deps; needs ffmpeg on PATH).
// Usage: node --experimental-strip-types scripts/brand/mascot-gifs.mjs [scale=8]
// Writes public/brand/gifs/<name>.gif (transparent) and <name>-light.gif / <name>-dark.gif (on paper / night).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "src/brand/mascot/sprites.ts")).href);
const SCALE = Number(process.argv[2] ?? 8);
const PAD = 2; // cells of headroom/footroom so hops don't clip
const GROUNDS = { light: "#FFFFFF", dark: "#121410" };

// [pose, seconds, dy in cells (negative = up)]
const ANIMS = {
  idle: [["pointing", 1.2, 0], ["blink", 0.12, 0], ["breathe", 0.9, 0]],
  point: [["pointing", 0.5, 0], ["pointing", 0.12, -1], ["pointRight", 0.5, 0]],
  talk: [["speaking", 0.16, 0], ["pointing", 0.16, 0], ["speaking", 0.16, -1]],
  think: [["thinking", 0.6, 0], ["thinking", 0.3, -1], ["blink", 0.12, 0]],
  listen: [["listening", 0.5, 0], ["listening", 0.3, -1], ["listeningBlink", 0.12, 0]],
  read: [["reading", 0.6, 0], ["readingBlink", 0.12, 0], ["reading", 0.4, -1]],
  wave: [["wave", 0.22, 0], ["wave2", 0.22, -1], ["wave", 0.22, 0]],
  walk: [["walk1", 0.16, 0], ["walk2", 0.16, -1], ["walk1", 0.16, 0]],
  success: [["pointing", 0.2, 0], ["success", 0.18, -2], ["success", 0.6, 0]],
  confused: [["confused", 0.6, 0], ["confusedBlink", 0.12, 0], ["confused", 0.3, -1]],
  sleep: [["sleeping", 0.9, 0], ["sleeping2", 0.9, 0], ["sleeping", 0.9, 0]],
  celebrate: [["celebrate", 0.2, 0], ["celebrate2", 0.2, -2], ["celebrate", 0.2, 0]],
  offline: [["offline", 0.6, 0], ["offlineBlink", 0.12, 0], ["offline", 0.3, -1]],
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function frameRGBA(rows, dy, w, h) {
  const W = w * SCALE, H = h * SCALE;
  const buf = Buffer.alloc(W * H * 4); // transparent
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const color = S.PALETTE[ch];
    if (!color || ch === ".") return;
    const [r, g, b] = hex(color);
    const cy = y + PAD + dy;
    for (let py = 0; py < SCALE; py++) for (let px = 0; px < SCALE; px++) {
      const i = (((cy * SCALE + py) * W) + x * SCALE + px) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }));
  return Buffer.concat([Buffer.from(`P7\nWIDTH ${W}\nHEIGHT ${H}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`), buf]);
}

const out = resolve(root, "public/brand/gifs");
mkdirSync(out, { recursive: true });
const tmp = join(tmpdir(), "getcko-gifs");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

for (const [name, frames] of Object.entries(ANIMS)) {
  const w = Math.max(...frames.map(([p]) => S.poseSize(p).w));
  const h = Math.max(...frames.map(([p]) => S.poseSize(p).h)) + PAD * 2;
  const list = [];
  frames.forEach(([pose, sec, dy], i) => {
    const f = join(tmp, `${name}-${i}.pam`);
    writeFileSync(f, frameRGBA(S.buildPose(pose), dy, w, h));
    list.push(`file '${f.replace(/\\/g, "/")}'`, `duration ${sec}`);
  });
  list.push(list[list.length - 2]); // concat demuxer needs the last file repeated
  const listFile = join(tmp, `${name}.txt`);
  writeFileSync(listFile, list.join("\n"));
  const ff = (filter, dest) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile,
    "-filter_complex", filter, "-loop", "0", dest]);
  // transparent
  ff("[0:v]split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=dither=none:alpha_threshold=128", join(out, `${name}.gif`));
  // on solid grounds (for places that can't do transparency well)
  for (const [g, color] of Object.entries(GROUNDS)) {
    ff(`color=c=${color}:s=${w * SCALE}x${h * SCALE}[bg];[bg][0:v]overlay=shortest=1,split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none`, join(out, `${name}-${g}.gif`));
  }
  console.log(`${name}: ${frames.length} frames, ${w * SCALE}x${h * SCALE}`);
}
rmSync(tmp, { recursive: true, force: true });
