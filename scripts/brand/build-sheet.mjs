// Builds scripts/brand/textures-sheet.html: every surface texture x intensity, light or dark, with real
// type on top. Inlines the GENERATED src/brand/surfaces.css (paths rewritten for file://), so the sheet
// tests the exact CSS the app ships.
//   node scripts/brand/build-sheet.mjs .
//   open scripts/brand/textures-sheet.html            (light)
//   open scripts/brand/textures-sheet.html?theme=dark (dark)   &rows=footprints,skin  to isolate rows
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? ".";
const css = fs.readFileSync(path.join(root, "src/brand/surfaces.css"), "utf8").replaceAll('url("/brand/', 'url("../../public/brand/');

const ROWS = [
  ["footprints", "Gecko footprint trail", "Signature. Two geckos crossing the wall; sticky toe pads in green."],
  ["lamellae", "Toe-pad lamellae", "The ridged underside of a toe pad. Rhythm bands, dividers, side rails."],
  ["skin", "Gecko skin", "Granules + raised tubercles with lit cells and pigment spots. Brand moments."],
  ["canopy", "Canopy, top edge", "Pothos vine hanging into a section from its top edge."],
  ["canopy-bottom", "Canopy, bottom edge", "Leaves growing up from a section's bottom edge."],
  ["canopy-corner", "Canopy corner", "Branch entering the top-right corner. Hero corners."],
  ["pointer", "Pointer field", "Pixel cursors aimed at bracketed targets. It points."],
  ["weave", "Banig weave", "Pandan-strip plain weave with a nested diamond. Section bands."],
  ["dither-lo", "Dither lo", "2/16 Bayer tone."],
  ["dither-mid", "Dither mid", "4/16 Bayer tone."],
  ["dither-hi", "Dither hi", "8/16 Bayer tone."],
  ["dither-fade", "Dither fade", "The no-gradient fade, 0 to 10/16 bottom-up."],
  ["hero", "Hero plate", "Ghost GetcKo standing in pothos, its trail walking in from the left. Right bottom."],
  ["how", "How-it-works band", "Ruler edge, prints walking to a bracketed stop."],
  ["footer", "Footer band", "Dither ground with plants growing up."],
];
const TALL = new Set(["hero"]);
const BAND = new Set(["how"]);
const BOTTOM = new Set(["canopy-bottom", "footer", "dither-fade"]);

const sample = (id, i) => `
  <div class="surface surface-${id} surface--${i} cell${TALL.has(id) ? " tall" : ""}${BOTTOM.has(id) ? " top" : ""}">
    <div class="copy">
      <h3>Gets mo na.</h3>
      <p>I-click mo ang <b>Save</b> sa taas, kanan. Nasa page 4 ng manual.</p>
    </div>
    <div class="card"><strong>Office manual.pdf</strong><span>p. 4 · on this Mac</span></div>
  </div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GetcKo textures</title>
<link rel="stylesheet" href="../../node_modules/@fontsource-variable/bricolage-grotesque/standard.css">
<link rel="stylesheet" href="../../node_modules/@fontsource-variable/geist/index.css">
<link rel="stylesheet" href="../../node_modules/@fontsource-variable/geist-mono/index.css">
<link rel="stylesheet" href="../../src/brand/tokens.css">
<script>
  const q = new URLSearchParams(location.search);
  document.documentElement.dataset.theme = q.get("theme") === "dark" ? "dark" : "light";
</script>
<style>
/* generated surfaces.css, inlined */
${css}
/* sheet chrome */
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--gc-bg); color: var(--gc-text); font: 16px/24px var(--gc-font-ui); }
header.top { padding: 32px 40px 16px; display: flex; align-items: baseline; gap: 24px; }
header.top h1 { font: 800 40px/44px var(--gc-font-display); letter-spacing: -0.03em; margin: 0; }
header.top p { margin: 0; color: var(--gc-text-2); }
.row { display: grid; grid-template-columns: 200px repeat(3, 1fr); gap: 12px; padding: 6px 40px; align-items: stretch; }
.row.tones { grid-template-columns: 200px repeat(4, 1fr); }
.label { padding-top: 8px; }
.label code { font: 500 13px/16px var(--gc-font-mono); color: var(--gc-accent-text); }
.label b { display: block; font: 700 16px/20px var(--gc-font-display); margin: 4px 0; }
.label span { display: block; font-size: 12px; line-height: 16px; color: var(--gc-text-2); }
.cols { display: grid; grid-template-columns: 200px repeat(3, 1fr); gap: 12px; padding: 0 40px; font: 500 12px/16px var(--gc-font-mono); color: var(--gc-text-2); }
.cell { position: relative; height: 184px; border-radius: 20px; overflow: hidden; border: 1px solid var(--gc-border); padding: 20px 22px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.cell.top { align-items: flex-start; }
.cell.tall { height: 360px; align-items: flex-start; }
.copy h3 { font: 800 28px/30px var(--gc-font-display); letter-spacing: -0.02em; margin: 0 0 6px; color: var(--gc-text); }
.copy p { margin: 0; max-width: 30ch; color: var(--gc-text-2); font-size: 15px; line-height: 22px; }
.card { flex: none; background: var(--gc-surface); border: 1px solid var(--gc-border); border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; box-shadow: var(--gc-shadow-1); }
.card strong { font: 600 14px/20px var(--gc-font-ui); }
.card span { font: 500 12px/16px var(--gc-font-mono); color: var(--gc-text-3); }
.full { margin: 18px 40px 6px; height: 600px; border-radius: 20px; overflow: hidden; border: 1px solid var(--gc-border); padding: 72px 64px; }
.full h2 { font: 800 72px/72px var(--gc-font-display); letter-spacing: -0.035em; margin: 0; max-width: 11ch; color: var(--gc-text); }
.full p { font-size: 20px; line-height: 30px; color: var(--gc-text-2); max-width: 36ch; margin: 20px 0 0; }
.full .mono { font: 500 13px/16px var(--gc-font-mono); color: var(--gc-text-2); margin-top: 28px; }
.tonecell { height: 150px; border-radius: 20px; border: 1px solid var(--gc-border); padding: 18px 20px; display: flex; align-items: flex-end; }
.tonecell h3 { font: 800 24px/28px var(--gc-font-display); margin: 0; color: var(--gc-text); }
.tonecell p { margin: 0; font-size: 14px; color: var(--gc-text-2); }
</style>
</head>
<body>
<header class="top"><h1>GetcKo textures</h1><p id="mode"></p></header>
<div class="cols"><span></span><span>subtle</span><span>standard</span><span>bold</span></div>
${ROWS.map(([id, name, use]) => `<section class="row" data-row="${id}"><div class="label"><code>.surface-${id}</code><b>${name}</b><span>${use}</span></div>${["subtle", "standard", "bold"].map((i) => sample(id, i)).join("")}</section>`).join("\n")}
<section class="row tones" data-row="tones"><div class="label"><code>.surface--{tone}</code><b>Tones</b><span>Footprints, standard, on each ground.</span></div>
${["paper", "canvas", "green", "ink"].map((t) => `<div class="surface surface-footprints surface--${t} tonecell"><div><h3>${t}</h3><p>Tumuro ako. Gets mo na.</p></div></div>`).join("")}
</section>
<section data-row="full" class="surface surface-hero surface--standard full">
  <h2>Help that sits right next to your cursor.</h2>
  <p>Ask out loud. GetcKo points at the right button and tells you which page of your manual says so.</p>
  <div class="mono">Offline · nothing leaves this Mac</div>
</section>
<script>
  document.getElementById("mode").textContent = document.documentElement.dataset.theme + " theme · surfaces.css (generated)";
  const rows = q.get("rows");
  if (rows) { const keep = rows.split(","); document.querySelectorAll("[data-row]").forEach((el) => { if (!keep.includes(el.dataset.row)) el.remove(); }); }
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, "scripts/brand/textures-sheet.html"), html);
console.log("sheet ok");
