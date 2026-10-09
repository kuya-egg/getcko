import { useRef } from "react";
import { MOMENT_POSE } from "../brand/mascot";
import { MEASURED, T } from "../brand/lexicon";
import { MockToggle, OfflineBadge, ProofLine, Stat, Surface } from "../components/ui";
import { SectionHead } from "../components/SectionHead";
import { GeckoSlot } from "../gecko/react";
import { SITE } from "../copy";

/** The page's one dark island. Wi-Fi off, nothing leaves the computer, and only measured numbers. */
export function Offline() {
  const section = useRef<HTMLElement>(null);
  const c = SITE.offline;

  return (
    <Surface ref={section} id="offline" texture="footprints" tone="ink" aria-labelledby="offline-title" className="site-section seam-island">
      <div className="site-wrap grid items-center gap-12 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-6">
          <SectionHead id="offline-title" eyebrow={c.eyebrow} title={c.title}>
            {c.nothingLeaves}
          </SectionHead>
          <div className="offline-proof">
            <GeckoSlot id="offline" section={section} pose={MOMENT_POSE.offline} className="slot-offline" label={T.mascot.moment(T.moments.offline)} />
            <div className="flex flex-col gap-4">
              <MockToggle on={false} label="Wi-Fi" halo={false} />
              <OfflineBadge />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-panel border border-border bg-surface p-6 shadow-overlay lg:col-span-6">
          <Stat label={T.stats.firstSpokenWord} value={MEASURED.firstSpokenWord} unit={T.stats.unitSeconds} digits={1} where={T.proof.measuredOn} />
          <Stat label={T.stats.tokensPerSecond} value={MEASURED.tokensPerSecond} unit={T.stats.unitTokens} where={T.proof.measuredOn} />
          <ProofLine items={[T.proof.wifiOff, MEASURED.bytesSent != null && T.proof.bytesSent(MEASURED.bytesSent)]} />
          <div className="border-t border-border pt-5">
            <p className="eyebrow pb-1 text-text-2">{c.stackTitle}</p>
            <p className="pb-3 text-label font-normal text-text-2">{c.stackHelp}</p>
            <ul className="flex flex-col">
              {c.stack.map(([job, model]) => (
                <li key={job} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-2 last:border-b-0">
                  <span className="text-label text-text">{job}</span>
                  <span className="font-mono text-keys text-text-2">{model}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Surface>
  );
}
