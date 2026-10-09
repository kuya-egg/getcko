import { useEffect, useRef, useState } from "react";
import { director } from "../gecko/director";
import { GeckoSlot } from "../gecko/react";
import { DocIcon } from "../components/ui";

const FILES = [
  { name: "Office Grading Manual.pdf", meta: "24 pages · 61 passages", cells: [0, 1, 2, 6, 7, 8, 12, 13, 18] },
  { name: "DepEd Forms Guide.pdf", meta: "18 pages · 44 passages", cells: [3, 4, 9, 10, 14, 15, 19] },
  { name: "Notes.md", meta: "3 pages · 9 passages", cells: [5, 11, 16, 17, 20, 21, 22, 23] },
] as const;
const CELL_COUNT = 24;
const ANSWER_CELL = 18; // the passage that answered Juan's question (manual, p. 4)

type Status = "queued" | "processing" | "ready";

export function Files() {
  const section = useRef<HTMLElement>(null);
  const answer = useRef<HTMLSpanElement>(null);
  const icons = useRef<(HTMLSpanElement | null)[]>([]);
  const cells = useRef<(HTMLSpanElement | null)[]>([]);
  const [status, setStatus] = useState<Status[]>(["queued", "queued", "queued"]);
  const [filled, setFilled] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const el = section.current!;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        FILES.forEach((f, i) => {
          timers.push(
            window.setTimeout(() => {
              setStatus((s) => s.map((v, j) => (j === i ? "processing" : v)));
              const targets = f.cells.map((c) => cells.current[c]!);
              director.flow(icons.current[i]!, targets, (k) => {
                setFilled((prev) => new Set(prev).add(f.cells[k]));
              });
              timers.push(window.setTimeout(() => setStatus((s) => s.map((v, j) => (j === i ? "ready" : v))), 1250));
            }, 250 + i * 700),
          );
        });
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <section ref={section} id="how" className="section files" aria-labelledby="files-title">
      <div className="files-copy">
        <p className="eyebrow">Your documents</p>
        <h2 id="files-title" className="h-section">Drop in your files.</h2>
        <p className="lede">
          GetCko reads them once, splits them into passages, and embeds every passage on your laptop. One local SQLite file. Your
          documents never leave the device.
        </p>
        <ul className="kb" aria-label="Knowledge base">
          {FILES.map((f, i) => (
            <li key={f.name} className="kb-row">
              <span ref={(n) => void (icons.current[i] = n)} className="kb-icon">
                <DocIcon />
              </span>
              <span className="kb-text">
                <span className="kb-name">{f.name}</span>
                <span className="kb-meta">{f.meta}</span>
              </span>
              <StatusChip status={status[i]} />
            </li>
          ))}
        </ul>
        <p className="caption">Sample files. Imports .md, .txt and text PDFs.</p>
      </div>

      <div className="passages">
        <p className="mono passages-label">passages · on-device · sqlite-vector</p>
        <div className="passages-grid" role="img" aria-label="Passages stored on this device; one passage highlighted as the source of the answer">
          {Array.from({ length: CELL_COUNT }, (_, i) => (
            <span
              key={i}
              ref={(n) => {
                cells.current[i] = n;
                if (i === ANSWER_CELL) answer.current = n;
              }}
              className={`pcell${filled.has(i) ? " is-filled" : ""}${i === ANSWER_CELL ? " is-answer gc-target" : ""}`}
            >
              <i />
              <i />
              <i />
            </span>
          ))}
        </div>
        <p className="caption passages-note">
          Highlighted: <span className="mono">Manual · p. 4</span>, the passage behind Juan's answer.
        </p>
        <GeckoSlot id="files" section={section} target={answer} className="slot-files" label="GetCko pointing at the retrieved passage" />
      </div>
    </section>
  );
}

function StatusChip({ status }: { status: Status }) {
  if (status === "ready")
    return (
      <span className="chip chip-ready">
        <span className="live-dot" aria-hidden="true" />
        Ready
      </span>
    );
  if (status === "processing")
    return (
      <span className="chip chip-processing">
        <span className="spinner" aria-hidden="true" />
        Processing
      </span>
    );
  return <span className="chip chip-queued">Queued</span>;
}
