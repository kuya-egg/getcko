// Worst-case text contrast on every texture mark: each key's colour at its alpha, composited on each
// tone's ground, against the text tokens. Run: node scripts/brand/contrast-check.mjs
import { ALPHA, COLOR, INTENSITIES } from "./texture-lib.mjs";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const ratio = (x, y) => { const [a, b] = [L(x), L(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };

const GROUNDS = {
  light: { paper: "#FFFFFF", canvas: "#F6F7F4", green: "#EAFBEF" },
  dark: { canvas: "#121410", paper: "#191B16", green: "#15301E", ink: "#0E0F0C" },
};
const TEXT = {
  light: { text: "#0E0F0C", "text-2": "#4A4D46", "text-3": "#6C7067", "accent-text": "#0F7A3D" },
  dark: { text: "#F1F3EC", "text-2": "#B8BDB0", "text-3": "#8D9285", "accent-text": "#6FE598" },
};

let fails = 0;
const rows = [];
for (const mode of ["light", "dark"]) {
  for (const [tone, g] of Object.entries(GROUNDS[mode])) {
    for (let ii = 0; ii < 3; ii++) {
      if (mode === "dark" && tone === "green" && ii === 2) continue; // capped to standard in surfaces.css
      for (const [tname, t] of Object.entries(TEXT[mode])) {
        let worst = Infinity, wk = "";
        for (const k of Object.keys(ALPHA[mode])) {
          const c = over(hex(COLOR[mode][k]), ALPHA[mode][k][ii], hex(g));
          const r = ratio(c, hex(t));
          if (r < worst) { worst = r; wk = k; }
        }
        const ok = worst >= 4.5;
        rows.push(`${mode.padEnd(5)} ${tone.padEnd(6)} ${INTENSITIES[ii].padEnd(8)} ${tname.padEnd(11)} ${worst.toFixed(2).padStart(5)} (${wk}) ${ok ? "ok" : "LOW"}`);
        if (!ok && (tname === "text" || tname === "text-2")) fails++;
      }
    }
  }
}
console.log(rows.join("\n"));
console.log(fails ? `\n${fails} FAIL(S) for text/text-2` : "\ntext and text-2 pass 4.5:1 on every mark, every tone, every intensity");
process.exitCode = fails ? 1 : 0;
