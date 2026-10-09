import { useRef } from "react";
import { pointPoseFor } from "../brand/mascot";
import { MEASURED, PLACE, T, latencyLine } from "../brand/lexicon";
import { ICON_SIZE, Icon } from "../brand/icons";
import { plateStyle } from "../brand/textures";
import { ProofLine, Surface, Wordmark } from "../components/ui";
import { GeckoSlot } from "../gecko/react";
import { REPO_PUBLIC, REPO_URL } from "../config";
import { SITE } from "../copy";

/**
 * End card on the footer band. Left: "Gets mo na." and the measured proof. Right: the demo itself,
 * a poster on the kit's `headmark` end-card plate; GetcKo points at its play button (the one halo).
 */
export function Closing({ onWatch }: { onWatch: () => void }) {
  const section = useRef<HTMLElement>(null);
  const play = useRef<HTMLSpanElement>(null);
  const c = SITE.closing;

  return (
    <Surface ref={section} as="footer" texture="footer" tone="paper" aria-labelledby="closing-title" className="closing seam-top">
      <div className="site-wrap flex flex-col gap-10">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-5">
            <h2 id="closing-title" className="font-display text-display text-text md:text-hero">
              {c.title}
            </h2>
            <p className="text-title font-sans font-normal text-text-2">
              {c.gloss} {c.line}
            </p>
            <ProofLine
              items={[T.proof.wifiOff, MEASURED.firstSpokenWord != null && latencyLine(MEASURED.firstSpokenWord), T.proof.measuredOn]}
            />
            {REPO_PUBLIC && (
              <a className="closing-link self-start" href={REPO_URL} target="_blank" rel="noreferrer">
                {SITE.readCode}
              </a>
            )}
          </div>

          <div className="closing-stage lg:col-span-7">
            <GeckoSlot
              id="closing"
              section={section}
              target={play}
              pose={pointPoseFor("right")}
              className="slot-closing"
              label={T.mascot.pointingAt(SITE.watchDemo)}
            />
            <button type="button" className="demo-poster" onClick={onWatch} aria-label={SITE.watchDemo}>
              <span className="demo-art" style={plateStyle("headmark", "dark")} aria-hidden="true" />
              <span className="demo-poster-foot">
                <span ref={play} className="demo-play gc-target" data-halo="dark">
                  <Icon.start size={ICON_SIZE.row} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-1 text-left">
                  <span className="font-display text-h2 text-chrome-text">{SITE.demoTitle}</span>
                  <span className="font-mono text-keys text-chrome-text-2">
                    {T.proof.wifiOff} · {PLACE.mac.onThis}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="closing-foot flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
          <Wordmark size="sm" />
          <p className="mr-auto text-caption text-text-2">
            {SITE.footer.event} · {T.offline.nothingLeaves("mac")}
          </p>
          {REPO_PUBLIC && (
            <a className="text-label text-accent-text" href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          )}
        </div>
      </div>
    </Surface>
  );
}
