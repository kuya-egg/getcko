import { useLayoutEffect, useRef, useState } from "react";
import { EServiceForm } from "../brand/hero/GetCkoHero";
import { HERO_COPY } from "../brand/hero/copy";
import { GetCkoSprite, handTip } from "../brand/mascot";
import { MEASURED, T, latencyLine } from "../brand/lexicon";
import { ProofLine, Surface, Wordmark } from "../components/ui";

/** GetcKo pixel scale on the card (integer only). */
const SCALE = 8;

/**
 * Open Graph card, 1200 × 630. Built from the real kit pieces (sprite, form, textures, type),
 * never an image model. Captured to public/og.png; this page itself is not part of the build.
 */
export function OgCard() {
  const stage = useRef<HTMLDivElement>(null);
  const [gecko, setGecko] = useState<{ x: number; y: number } | null>(null);

  // GetcKo stands right of Upload ID, facing it, the hand tip just outside the button (placeBeside rule).
  useLayoutEffect(() => {
    document.fonts.ready.then(() => {
      const root = stage.current!;
      const target = root.querySelector<HTMLElement>('[data-hero="target"]')!;
      target.classList.add("target-halo");
      const s = root.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const tip = handTip(true);
      setGecko({
        x: Math.round(t.right - s.left + 10 - tip.col * SCALE),
        y: Math.round(t.top - s.top + t.height / 2 - (tip.row + 0.5) * SCALE),
      });
      document.documentElement.dataset.ogReady = "1";
    });
  }, []);

  return (
    <Surface as="div" texture="canopy-corner" tone="paper" className="og">
      <div className="og-copy">
        <Wordmark size="lg" />
        <h1 className="og-title font-display text-text">
          {HERO_COPY.headline.before}{" "}
          <span className="og-mark">{HERO_COPY.headline.mark}</span>
          {HERO_COPY.headline.after}
        </h1>
        <p className="og-support text-text-2">{HERO_COPY.support}</p>
        <ProofLine
          className="og-proof"
          items={[T.proof.wifiOff, MEASURED.firstSpokenWord != null && latencyLine(MEASURED.firstSpokenWord)]}
        />
      </div>
      <div ref={stage} className="og-stage">
        <div className="og-form">
          <EServiceForm />
        </div>
        {gecko && (
          <GetCkoSprite pose="pointing" flip scale={SCALE} label="" className="og-gecko" style={{ left: gecko.x, top: gecko.y }} />
        )}
        <p className="og-badge font-pixel text-pixel text-accent-text">{T.product.tagline}</p>
      </div>
      <span className="og-url font-mono text-keys text-text-3">getcko.vercel.app</span>
    </Surface>
  );
}
