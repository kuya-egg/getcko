import { useEffect, useRef, useState } from "react";
import { MOMENT_POSE } from "../brand/mascot";
import { T } from "../brand/lexicon";
import { director } from "../gecko/director";
import { GeckoSlot } from "../gecko/react";
import { ImportProgress, KnowledgeBaseList, KnowledgeBaseRow, Kw, Surface, cn } from "../components/ui";
import { SectionHead } from "../components/SectionHead";
import { SITE } from "../copy";

const CELLS = 24;
/** Which passage cells each document fills; ANSWER is the passage behind Juan's answer (Manual · p. 4). */
const FILL = [
  [0, 1, 2, 6, 7, 8, 12, 13, 18],
  [3, 4, 9, 10, 14, 15, 19],
  [5, 11, 16, 17, 20, 21, 22, 23],
];
const ANSWER = 12;

type Row = { status: "processing" | "ready"; page: number };

/** Documents become passages on this Mac: each import pours pixels into the passage grid while GetcKo reads. */
export function KnowledgeBases() {
  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLSpanElement | null)[]>([]);
  const done = useRef(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [filled, setFilled] = useState<Set<number>>(() => new Set());
  const docs = SITE.knowledge.docs;

  useEffect(() => {
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    director.setPose("kb", MOMENT_POSE.processing);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const reduced = director.reducedMotion;
        docs.forEach((d, i) => {
          const at = (reduced ? 0 : 900) * i + 200;
          later(at, () => setRows((r) => [...r, { status: "processing", page: 0 }]));
          // Page counter ticks; the row's icon pours into its passage cells.
          const ticks = 6;
          for (let k = 1; k <= ticks; k++) later(at + k * 100, () => setRows((r) => r.map((row, j) => (j === i ? { ...row, page: Math.round((d.pages * k) / ticks) } : row))));
          later(at + 120, () => {
            const from = list.current?.querySelectorAll("li")[i];
            const targets = FILL[i].map((c) => cells.current[c]!);
            if (from) director.flow(from, targets, (k) => setFilled((prev) => new Set(prev).add(FILL[i][k])));
          });
          later(at + 800, () => setRows((r) => r.map((row, j) => (j === i ? { ...row, status: "ready" } : row))));
        });
        // Reading done: GetcKo turns to point at the passage that answers Juan's question.
        later((reduced ? 0 : 900) * docs.length + 400, () => {
          done.current = true;
          director.setPose("kb", MOMENT_POSE.screenHelp);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(section.current!);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [docs]);

  const processing = rows.findIndex((r) => r.status === "processing");

  return (
    <Surface ref={section} id="knowledge" texture="footprints" intensity="subtle" tone="paper" aria-labelledby="kb-title" className="site-section seam">
      <div className="site-wrap grid items-start gap-12 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-5">
          <SectionHead id="kb-title" eyebrow={SITE.knowledge.eyebrow} title={SITE.knowledge.title}>
            Add your <Kw>office manual</Kw>. GetcKo reads it once and cites the <Kw>page</Kw>.
          </SectionHead>
          <div className="rounded-panel border border-border bg-surface p-5 shadow-card">
            <p className="eyebrow pb-2 text-text-2">{SITE.knowledge.listTitle}</p>
            <div ref={list}>
            <KnowledgeBaseList aria-live="polite">
              {rows.map((r, i) => (
                <KnowledgeBaseRow key={docs[i].name} name={docs[i].name} pages={docs[i].pages} passages={r.status === "ready" ? docs[i].passages : undefined} status={r.status} />
              ))}
            </KnowledgeBaseList>
            </div>
            {processing >= 0 ? (
              <ImportProgress className="pt-3" page={rows[processing].page} total={docs[processing].pages} />
            ) : (
              <p className="pt-3 text-caption text-text-3">{T.knowledgeBase.fileHint("mac")}</p>
            )}
          </div>
        </div>

        <div className="kb-stage lg:col-span-7">
          <div className="rounded-panel border border-border bg-surface p-5 shadow-card">
            <p className="pb-4 font-mono text-keys text-text-2">{SITE.knowledge.passagesLabel}</p>
            <div className="passages" role="img" aria-label={`Passages stored on this Mac. The highlighted one is ${SITE.knowledge.answerSource}.`}>
              {Array.from({ length: CELLS }, (_, i) => (
                <span
                  key={i}
                  ref={(n) => void (cells.current[i] = n)}
                  className={cn("pcell", filled.has(i) && "is-filled", i === ANSWER && "is-answer gc-target")}
                >
                  <i />
                  <i />
                  <i />
                </span>
              ))}
            </div>
            <p className="pt-4 text-caption text-text-3">
              {T.answerCard.sourcesLabel}: <span className="font-mono">{SITE.knowledge.answerSource}</span>
            </p>
          </div>
          <GeckoSlot
            id="kb"
            section={section}
            target={() => (done.current ? cells.current[ANSWER] : null)}
            className="slot-kb"
            label={T.mascot.moment(T.moments.processing)}
          />
        </div>
      </div>
    </Surface>
  );
}
