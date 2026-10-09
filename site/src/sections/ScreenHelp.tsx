import { useRef } from "react";
import { GeckoSlot } from "../gecko/react";
import { CitationChip } from "../components/ui";

export function ScreenHelp() {
  const section = useRef<HTMLElement>(null);
  const chip = useRef<HTMLSpanElement>(null);

  return (
    <section ref={section} id="screen-help" className="section screenhelp" aria-labelledby="screenhelp-title">
      <div>
        <p className="eyebrow">Screen Help</p>
        <h2 id="screenhelp-title" className="h-section">
          It points.
          <br />
          You click.
        </h2>
        <p className="lede">
          GetCko never clicks or types for you. It reads the app in front of you, finds the right field, and shows which page of your
          manual says so.
        </p>
      </div>
      <div className="screenhelp-stage">
        <GeckoSlot id="screen" section={section} target={chip} className="slot-screen" label="GetCko pointing at the answer's source" />
        <aside className="answer-card" aria-label="GetCko answer">
          <header className="answer-head">
            <span className="live-dot" aria-hidden="true" />
            <span className="answer-agent">
              GetCko <span className="muted">· Office Helper</span>
            </span>
            <span className="chip chip-offline">Offline</span>
          </header>
          <p className="answer-q" lang="fil">
            Saan ko ilalagay ang grade ni Juan?
          </p>
          <p className="answer-body">
            Type <strong>86</strong> in <span className="kbd-inline">Final grade</span>. It's 40% written + 60% performance: 0.4 × 84 +
            0.6 × 88 = 86.4, rounded to 86.
          </p>
          <footer className="answer-foot">
            <CitationChip ref={chip}>Manual · p. 4</CitationChip>
            <span className="mono caption">target ≤ 3 s · on this Mac</span>
          </footer>
        </aside>
      </div>
    </section>
  );
}
