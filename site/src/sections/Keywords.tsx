import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { MOMENT_POSE, pointPoseFor } from "../brand/mascot";
import { DUR, EASE } from "../brand/motion";
import { T } from "../brand/lexicon";
import { Surface, cn } from "../components/ui";
import { director } from "../gecko/director";
import { GeckoSlot } from "../gecko/react";
import { SITE } from "../copy";

/**
 * The brand keywords (T.keywords, minus the place- and culture-specific two), one per line on gecko skin. As you scroll, GetcKo walks
 * down the list and points right at the keyword in the reading band; that word wears the green mark.
 */
export function Keywords() {
  const section = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const list = SITE.keywords.list;

  // The keyword crossing the middle band of the viewport is the active one.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // GetcKo walks (walk frames) to the active word, then points right at it: hand row level with the word.
  useEffect(() => {
    const slot = rail.current?.firstElementChild as HTMLElement | null;
    const word = items.current[active]?.querySelector<HTMLElement>(".kw-word");
    if (!slot || !word || !rail.current) return;
    const cell = parseInt(getComputedStyle(slot).getPropertyValue("--cell"), 10) || 5;
    const handRow = 13; // POSE_TIP.pointRight.row
    // Measured against the rail's own box (offsetTop is relative to the section, not the rail).
    const w = word.getBoundingClientRect();
    const y = Math.round(w.top - rail.current.getBoundingClientRect().top + w.height / 2 - (handRow + 0.5) * cell);
    if (director.reducedMotion) {
      gsap.set(slot, { y });
      director.setPose("keywords", pointPoseFor("right"));
      return;
    }
    director.setPose("keywords", MOMENT_POSE.moving);
    let step = 0;
    const tl = gsap.timeline({ onComplete: () => director.setPose("keywords", pointPoseFor("right")) });
    tl.to(slot, {
      y,
      duration: DUR.pointer,
      ease: EASE.land,
      snap: { y: cell },
      onUpdate: () => {
        const next = Math.floor(tl.time() / 0.16) % 2;
        if (next !== step) {
          step = next;
          director.setPose("keywords", next ? "walk2" : MOMENT_POSE.moving);
        }
      },
    });
    return () => void tl.kill();
  }, [active]);

  return (
    <Surface ref={section} id="keywords" texture="skin" intensity="subtle" tone="paper" aria-labelledby="kw-title" className="site-section seam">
      <div className="site-wrap grid gap-12 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <p className="eyebrow text-text-2">{SITE.keywords.eyebrow}</p>
          <h2 id="kw-title" className="font-display text-h1 text-text md:text-display">
            {SITE.keywords.title}
          </h2>
          <p className="text-title font-sans font-normal text-text-2">{T.product.line}</p>
        </div>
        <div className="kw-stage lg:col-span-8">
          <div ref={rail} className="kw-rail">
            <GeckoSlot id="keywords" section={section} pose={pointPoseFor("right")} className="slot-kw" label={T.mascot.pointingAt(list[active].word)} />
          </div>
          <ol className="kw-list">
            {list.map((k, i) => (
              <li key={k.word} ref={(n) => void (items.current[i] = n)} data-i={i} className={cn("kw-item", i === active && "is-active")}>
                <span className="kw-num font-mono text-keys nums text-text-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="kw-word font-display text-text">{k.word}</span>
                <span className="kw-line text-label text-text-2">{k.line}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Surface>
  );
}
