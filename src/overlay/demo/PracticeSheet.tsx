// Dev-only practice window. A plain spreadsheet app (sample content) with real elements for
// GetCko to point at. It answers `demo:locate` the way the AI backend will: measure the
// element, call point_at with its screen rect, then send the answer to the overlay.

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button, cn } from "../../components/ui";
import { EVENTS } from "../bridge";
import { DEMO_EVENTS, DEV, PRACTICE, type TargetId } from "./script";

/** How long GetCko "thinks" before pointing, so the thinking pose reads. */
const THINK_MS = 700;

const LEARNERS: [string, number, number, number | null][] = [
  ["Andrea Bautista", 88, 91, 90],
  ["Carlo Reyes", 84, 86, 89],
  ["Daniela Santos", 92, 94, 95],
  ["Elijah Mendoza", 79, 83, 85],
  ["Francine Cruz", 90, 88, 91],
  ["Juan dela Cruz", 85, 87, 90],
  ["Kristine Lim", 87, 89, null],
];
const FILLED = 5; // rows with a final grade already
const COLS = ["A", "B", "C", "D", "E", "F"];
const COL_W = [180, 64, 64, 64, 88, 104];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function locate(id: string) {
  const item = PRACTICE.find((p) => p.id === id);
  if (!item) return;
  await sleep(THINK_MS);
  if (!item.target) {
    await invoke("clear_target");
    await emitTo("overlay", EVENTS.answer, item.answer);
    return;
  }
  const el = document.querySelector<HTMLElement>(`[data-target="${item.target}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const win = getCurrentWindow();
  const [pos, scale] = await Promise.all([win.innerPosition(), win.scaleFactor()]);
  await invoke("point_at", {
    x: pos.x + r.x * scale,
    y: pos.y + r.y * scale,
    w: r.width * scale,
    h: r.height * scale,
    label: el.dataset.label ?? null,
    physical: true,
    side: item.side ?? null,
  });
  await emitTo("overlay", EVENTS.answer, item.answer);
}

function target(id: TargetId, label: string) {
  return { "data-target": id, "data-label": label };
}

export function PracticeSheet() {
  useEffect(() => {
    const off = listen<{ id: string }>(DEMO_EVENTS.locate, (e) => void locate(e.payload.id));
    void emit(DEMO_EVENTS.ready);
    return () => {
      off.then((f) => f());
    };
  }, []);

  const cell = "h-9 border-r border-b border-border px-2 whitespace-nowrap";
  const rowHead = cn(cell, "bg-surface-2 text-center font-medium text-text-2");

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
        <nav className="flex gap-4 text-label text-text-2">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Insert</span>
        </nav>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" {...target("save", "Save")}>
          Save
        </Button>
        <Button variant="secondary" size="sm" {...target("export", "Export as PDF")}>
          Export as PDF
        </Button>
      </header>

      <div className="flex h-11 items-center gap-2 border-b border-border bg-surface px-4">
        <span className="inline-flex h-7 w-14 items-center rounded-input border border-border px-2 font-mono text-keys nums">
          E7
        </span>
        <span className="font-mono text-caption text-text-3">fx</span>
        <span className="h-7 flex-1 rounded-input border border-border" />
      </div>

      <main className="flex-1 overflow-auto p-6">
        <table className="border-separate border-spacing-0 border-t border-l border-border bg-surface text-label" aria-label={DEV.sheetTitle}>
          <colgroup>
            <col style={{ width: 40 }} />
            {COL_W.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={rowHead} />
              {COLS.map((c) => (
                <th key={c} scope="col" className={rowHead}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={rowHead}>
                1
              </th>
              {["Learner", "Q1", "Q2", "Q3", "Final", "Remarks"].map((h) => (
                <td key={h} className={cn(cell, "font-semibold")}>
                  {h}
                </td>
              ))}
            </tr>
            {LEARNERS.map(([name, a, b, c], i) => {
              const done = i < FILLED && c != null;
              const final = done ? ((a + b + (c ?? 0)) / 3).toFixed(2) : "";
              return (
                <tr key={name}>
                  <th scope="row" className={rowHead}>
                    {i + 2}
                  </th>
                  <td className={cell}>{name}</td>
                  <td className={cn(cell, "text-right nums")}>{a}</td>
                  <td className={cn(cell, "text-right nums")}>{b}</td>
                  <td
                    className={cn(cell, "text-right nums")}
                    {...(c == null ? target("q3Kristine", "cell D8") : {})}
                  >
                    {c ?? ""}
                  </td>
                  <td className={cn(cell, "text-right nums")} {...(i === FILLED ? target("finalE7", "cell E7") : {})}>
                    {final}
                  </td>
                  <td className={cn(cell, "text-text-2")}>{done ? "Passed" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>

      <footer className="flex h-9 items-center border-t border-border bg-surface px-4 text-caption text-text-2">
        Sheet1
      </footer>
    </div>
  );
}
