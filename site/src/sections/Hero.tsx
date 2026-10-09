import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { GetCkoHero } from "../brand/hero";
import { buildHeadMark, PALETTE } from "../brand/mascot";
import { DUR, EASE } from "../brand/motion";
import { T } from "../brand/lexicon";
import { Icon } from "../brand/icons";
import { Button } from "../components/ui";
import { useVacantSlot } from "../gecko/react";
import { SITE } from "../copy";

gsap.registerPlugin(SplitText);

/** Head-mark cells (rows 0–10 of the real sprite) for the logo entry. */
const HEAD_CELLS = buildHeadMark().flatMap((row, y) =>
  [...row].flatMap((ch, x) => (ch !== "." ? [{ x, y, color: PALETTE[ch as keyof typeof PALETTE] }] : [])),
);

/** Raster colours a window prints through before it snaps crisp: washes plus a few creature pixels. */
const CURTAIN = ["var(--gc-accent-wash)", "var(--gc-accent-wash)", "var(--gc-surface-2)", "var(--gc-surface-2)", PALETTE.L, PALETTE.G, PALETTE.K];

function addCurtain(el: HTMLElement, size: number) {
  const cols = Math.ceil(el.offsetWidth / size);
  const rows = Math.ceil(el.offsetHeight / size);
  const wrap = document.createElement("div");
  wrap.className = "px-curtain";
  wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  wrap.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  for (let i = 0; i < cols * rows; i++) {
    const b = document.createElement("i");
    b.style.background = CURTAIN[Math.floor(Math.random() * CURTAIN.length)];
    wrap.appendChild(b);
  }
  el.appendChild(wrap);
  return { wrap, cells: [...wrap.children], cols, rows };
}

export function Hero({ onWatch }: { onWatch: () => void }) {
  const [playIntro] = useState(() => document.documentElement.classList.contains("intro-pending"));
  // While the intro runs, the kit hero is frozen at t=0 (everything hidden but the sheet); then it plays.
  const [storyOn, setStoryOn] = useState(!playIntro);
  const section = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  useVacantSlot("hero", section);

  useLayoutEffect(() => {
    if (!playIntro) return;
    const html = document.documentElement;
    const root = section.current!;
    const ov = intro.current!;
    let disposed = false;
    let tl: gsap.core.Timeline | null = null;
    const curtains: HTMLElement[] = [];
    const ctx = gsap.context(() => {}, root);

    const finish = () => {
      html.classList.remove("intro-pending");
      try {
        sessionStorage.setItem("gc-intro", "1");
      } catch {
        /* storage blocked: the intro simply plays again next visit */
      }
      curtains.forEach((c) => c.remove());
      removeSkip();
    };
    const skip = () => {
      if (!tl || tl.progress() === 1) return;
      tl.progress(1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") skip();
    };
    const removeSkip = () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
      window.removeEventListener("keydown", onKey);
    };

    document.fonts.ready.then(() => {
      if (disposed) return;
      ctx.add(() => {
        const q = gsap.utils.selector(ov);
        const navMark = document.querySelector<HTMLElement>("[data-nav-mark] > :first-child")!;
        const navRest = document.querySelectorAll<HTMLElement>("[data-nav-mark] > :last-child, .nav-links a, .nav-cta");
        const tile = q(".intro-tile")[0] as HTMLElement;
        const word = SplitText.create(q(".intro-word"), { type: "chars", mask: "chars" });
        const copy = root.querySelectorAll<HTMLElement>('[data-hero="copy"] > *');
        const sheet = root.querySelector<HTMLElement>('[data-hero="window"]')!;
        const sheetCurtain = addCurtain(sheet, 18);
        curtains.push(sheetCurtain.wrap);

        gsap.set([navMark, ...navRest], { autoAlpha: 0 });
        gsap.set(q(".intro-word"), { autoAlpha: 1 });

        tl = gsap.timeline({ defaults: { ease: EASE.out }, onComplete: finish });
        tl
          // 1. The head mark assembles cell by cell out of a scattered pixel field.
          .fromTo(
            q(".intro-cell"),
            {
              autoAlpha: 0,
              x: () => gsap.utils.random(-0.55, 0.55) * innerWidth,
              y: () => gsap.utils.random(-0.45, 0.45) * innerHeight,
              scale: () => gsap.utils.random(0.5, 2.4),
            },
            { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.95, ease: "expo.out", stagger: { amount: 0.5, from: "random" } },
            0,
          )
          // 2. The ink tile grows behind it (two-step pixel pop), wordmark and badge print in.
          .fromTo(q(".intro-tile-bg"), { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: DUR.slow * 2, ease: EASE.point }, 1.0)
          .fromTo(word.chars, { yPercent: 110 }, { yPercent: 0, duration: 0.55, stagger: 0.035, ease: "expo.out" }, 1.2)
          .fromTo(q(".intro-badge"), { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: DUR.base, ease: EASE.step }, 1.55)
          .fromTo(q(".intro-skip"), { autoAlpha: 0 }, { autoAlpha: 1, duration: DUR.slow }, 0.4)
          // 3. The tile flies into the nav wordmark; the paper lifts off the page.
          .to([q(".intro-word"), q(".intro-badge"), q(".intro-skip")], { autoAlpha: 0, y: -14, duration: 0.3, ease: "power2.in" }, 2.05)
          .to(
            tile,
            {
              x: () => {
                const a = tile.getBoundingClientRect();
                const b = navMark.getBoundingClientRect();
                return b.left + b.width / 2 - (a.left + a.width / 2);
              },
              y: () => {
                const a = tile.getBoundingClientRect();
                const b = navMark.getBoundingClientRect();
                return b.top + b.height / 2 - (a.top + a.height / 2);
              },
              scale: () => navMark.getBoundingClientRect().width / tile.getBoundingClientRect().width,
              duration: 0.9,
              ease: "expo.inOut",
            },
            2.15,
          )
          .to(q(".intro-bg"), { autoAlpha: 0, duration: 0.6, ease: "power2.out" }, 2.4)
          .set(navMark, { autoAlpha: 1 }, 3.05)
          .set(tile, { autoAlpha: 0 }, 3.05)
          .fromTo(navRest, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "expo.out" }, 2.75)
          // 4. Words rise (headline, support, CTA, beats, shortcut), 40 ms stagger per brand motion.
          .fromTo(copy, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.09, ease: "expo.out" }, 2.55)
          // 5. The grade sheet springs up and prints in through a pixel curtain, top-left first.
          .fromTo(sheet, { y: 70, scale: 0.92 }, { y: 0, scale: 1, duration: 0.9, ease: EASE.point }, 2.7)
          .to(
            sheetCurtain.cells,
            { scale: 0, duration: 0.3, ease: "power2.in", stagger: { amount: 0.55, grid: [sheetCurtain.rows, sheetCurtain.cols], from: "start" } },
            2.85,
          )
          // 6. Hand off: the kit hero's story (ask → GetcKo hops → halo → answer → source) takes over.
          .call(() => setStoryOn(true), [], 3.7);

        window.addEventListener("pointerdown", skip);
        window.addEventListener("wheel", skip, { passive: true });
        window.addEventListener("touchmove", skip, { passive: true });
        window.addEventListener("keydown", onKey);
      });
    });

    return () => {
      disposed = true;
      removeSkip();
      ctx.revert();
      curtains.forEach((c) => c.remove());
    };
  }, [playIntro]);

  return (
    <div ref={section} id="top" className="hero-wrap">
      {playIntro && (
        <div ref={intro} className="intro" aria-hidden="true">
          <div className="intro-bg" />
          <div className="intro-center">
            <div className="intro-tile">
              <div className="intro-tile-bg" />
              <div className="intro-head">
                {HEAD_CELLS.map(({ x, y, color }) => (
                  <i key={`${x}-${y}`} className="intro-cell" style={{ ["--x" as string]: x, ["--y" as string]: y, background: color }} />
                ))}
              </div>
            </div>
            <p className="intro-word">{T.product.name}</p>
            <p className="intro-badge">{SITE.tagline}</p>
          </div>
          <Button variant="secondary" size="sm" className="intro-skip" tabIndex={-1}>
            Skip intro
          </Button>
        </div>
      )}
      <GetCkoHero
        theme="light"
        autoplay={storyOn}
        // 0.01 s, not 0: a fresh paused timeline does not render its t=0 set() calls on time(0).
        at={storyOn ? undefined : 0.01}
        actions={
          <Button size="lg" icon={Icon.start} onClick={onWatch} className="hero-cta">
            {SITE.watchDemo}
          </Button>
        }
      />
    </div>
  );
}
