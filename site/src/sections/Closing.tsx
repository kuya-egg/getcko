import { useRef } from "react";
import { GeckoSlot } from "../gecko/react";
import { PlayIcon } from "../components/ui";
import { REPO_PUBLIC, REPO_URL } from "../config";

export function Closing({ onWatch }: { onWatch: () => void }) {
  const section = useRef<HTMLElement>(null);
  const cta = useRef<HTMLButtonElement>(null);

  return (
    <section ref={section} className="section closing" aria-labelledby="closing-title">
      <h2 id="closing-title" className="display closing-title">
        Help that sits right next to your cursor.
      </h2>
      <div className="closing-act">
        <div className="closing-gecko">
          <span className="pixel-badge" aria-hidden="true">
            Gets mo na.
          </span>
          <GeckoSlot id="closing" section={section} target={cta} className="slot-closing" label="GetCko pointing at Watch the 1-min demo" />
        </div>
        <div className="closing-buttons">
          <button ref={cta} type="button" className="btn btn-primary btn-hero gc-target" onClick={onWatch}>
            <PlayIcon /> Watch the 1-min demo
          </button>
          {REPO_PUBLIC && (
            <a className="btn btn-secondary btn-hero" href={REPO_URL} target="_blank" rel="noreferrer">
              Read the code on GitHub
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
