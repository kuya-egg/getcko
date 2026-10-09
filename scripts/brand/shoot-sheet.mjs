// Screenshot the texture contact sheet (light + dark) with headless Edge into docs/brand/.
//   node scripts/brand/build-sheet.mjs . && node scripts/brand/shoot-sheet.mjs .
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const edge = process.env.EDGE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const page = "file:///" + path.join(root, "scripts/brand/textures-sheet.html").replaceAll("\\", "/");
for (const theme of ["light", "dark"]) {
  const out = path.join(root, `docs/brand/textures-${theme}.png`);
  execFileSync(edge, ["--headless", "--disable-gpu", "--hide-scrollbars", `--screenshot=${out}`, "--window-size=1600,4200", `${page}?theme=${theme}`], { stdio: "ignore" });
  console.log("wrote", out);
}
