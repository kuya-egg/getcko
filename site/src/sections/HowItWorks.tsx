import { Fragment, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ICON_SIZE, Icon } from "../brand/icons";
import { MOMENT_POSE } from "../brand/mascot";
import { T } from "../brand/lexicon";
import { Keycap, Kw, Surface } from "../components/ui";
import { SectionHead } from "../components/SectionHead";
import { GeckoSlot } from "../gecko/react";
import { SITE } from "../copy";

gsap.registerPlugin(ScrollTrigger);

const STEP_ICONS = [Icon.pushToTalk, Icon.screenHelp, Icon.target, Icon.source];
const DOTS = 6;

/**
 * Screen Help, shown not told: the approved D3 pair (GetcKo + one window, one halo), then the four
 * beats on the `how` band. Scrolling scrubs the band: the prints walk, each beat lights up with the
 * green keyword mark, and the pixel connectors fill toward the next beat. Desktop pins the section.
 */
export function HowItWorks() {
  const section = useRef<HTMLElement>(null);
  const band = useRef<HTMLElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const c = SITE.how;

  useLayoutEffect(() => {
    const root = section.current!;
    const mm = gsap.matchMedia();
    const build = (pin: boolean) => {
      const q = gsap.utils.selector(root);
      const steps = q(".hs-step");
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: pin
          ? { trigger: root, start: "bottom bottom", end: "+=140%", scrub: 0.6, pin: true, anticipatePin: 1 }
          : { trigger: band.current, start: "top 85%", end: "bottom 35%", scrub: 0.6 },
      });
      // The prints on the band walk one stop (1280 px at 2×) left to right across the whole scrub.
      tl.fromTo(band.current, { backgroundPositionX: "0px" }, { backgroundPositionX: "1280px", duration: steps.length }, 0);
      steps.forEach((step, i) => {
        const at = i;
        tl.fromTo(step, { "--on": 0 }, { "--on": 1, duration: 0.35, ease: "power2.out" }, at)
          .fromTo(step.querySelector(".hs-mark"), { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power3.out" }, at + 0.05)
          .fromTo(step.querySelector(".hs-icon"), { scale: 0.5 }, { scale: 1, duration: 0.25, ease: "steps(2)" }, at);
        const dots = q(`.hs-link[data-after="${i}"] i`);
        if (dots.length) tl.fromTo(dots, { scale: 0 }, { scale: 1, duration: 0.12, ease: "steps(2)", stagger: 0.09 }, at + 0.4);
      });
      tl.to({}, { duration: 0.5 }); // hold the last beat before the pin releases
    };
    mm.add("(min-width: 1100px) and (prefers-reduced-motion: no-preference)", () => build(true));
    mm.add("(max-width: 1099px) and (prefers-reduced-motion: no-preference)", () => build(false));
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(root.querySelectorAll(".hs-step"), { "--on": 1 });
      gsap.set(root.querySelectorAll(".hs-mark, .hs-link i"), { scale: 1, scaleX: 1 });
    });
    return () => mm.revert();
  }, []);

  return (
    <Surface ref={section} id="how" texture="pointer" intensity="subtle" tone="paper" aria-labelledby="how-title" className="site-section how-section seam">
      <div className="site-wrap grid items-center gap-12 lg:grid-cols-12">
        <SectionHead id="how-title" eyebrow={c.eyebrow} title={c.title} className="lg:col-span-5">
          Hold <Keycap hotkey platform="mac" />, ask, and GetcKo lands beside the <Kw>exact field</Kw>.
        </SectionHead>

        <div className="how-pair lg:col-span-7">
          <GeckoSlot
            id="how"
            section={section}
            target={field}
            pose={MOMENT_POSE.screenHelp}
            className="slot-how"
            label={T.mascot.pointingAt(`the empty ${c.finalGrade} field`)}
          />
          <div
            className="how-window rounded-window border border-border bg-surface shadow-overlay"
            role="img"
            aria-label={`${c.window} window for ${c.studentName}. The ${c.finalGrade} field is empty.`}
          >
            <div className="hw-bar border-b border-border bg-surface-2">
              <span className="flex gap-2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-3 rounded-pill border border-border-strong" />
                ))}
              </span>
              <span className="hw-title text-label font-semibold text-text">{c.window}</span>
            </div>
            <div className="hw-body">
              <div className="hw-row">
                <span className="text-text-2">{c.student}</span>
                <span className="font-mono text-text">{c.studentName}</span>
              </div>
              <div className="hw-row border-t border-border">
                <span className="text-text-2">{c.finalGrade}</span>
                <div ref={field} className="hw-field gc-target rounded-input border border-border-strong bg-surface">
                  <span className="caret" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The how band: ruler edges, prints walking to a bracketed stop, the four beats along it. */}
      <Surface ref={band} as="div" texture="how" tone="paper" className="how-band">
        <ol className="hs-row site-wrap" aria-label={c.eyebrow}>
          {c.steps.map((s, i) => {
            const Glyph = STEP_ICONS[i];
            return (
              <Fragment key={s.n}>
                {i > 0 && (
                  <li className="hs-link" data-after={i - 1} aria-hidden="true">
                    {Array.from({ length: DOTS }, (_, k) => (
                      <span key={k}>
                        <i />
                      </span>
                    ))}
                  </li>
                )}
                <li className="hs-step">
                  <span className="hs-icon text-text">
                    <Glyph size={ICON_SIZE.x2} aria-hidden="true" />
                  </span>
                  <span className="hs-head">
                    <span className="font-mono text-keys nums text-text-2">{s.n}</span>
                    <span className="hs-label font-display text-h2 text-text">
                      <span className="hs-mark" aria-hidden="true" />
                      {s.label}
                    </span>
                  </span>
                  <span className="hs-line text-label font-normal text-text-2">{s.line}</span>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </Surface>
    </Surface>
  );
}
