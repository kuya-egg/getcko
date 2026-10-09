import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { director } from "../gecko/director";
import { GeckoSlot } from "../gecko/react";
import { HEAD_ROWS, PALETTE } from "../gecko/sprite";
import { PlayIcon } from "../components/ui";

gsap.registerPlugin(SplitText);

/** Head-mark cells for the logo intro; ink outline cells merge into the ink tile once it grows. */
const HEAD_CELLS = HEAD_ROWS.flatMap((row, y) => [...row].flatMap((ch, x) => (PALETTE[ch] ? [{ x, y, color: PALETTE[ch] }] : [])));

/** Raster colours a window "prints" through before it snaps crisp: mostly wash, a few helper pixels. */
const CURTAIN = ["#EAFBEF", "#EAFBEF", "#F6F7F4", "#F6F7F4", "#9BF2B6", "#39D86F", "#0E0F0C"];

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
  const section = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const passage = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    if (!playIntro) return;
    const html = document.documentElement;
    const root = section.current!;
    const ov = intro.current!;
    director.hold("intro");

    let disposed = false;
    let released = false;
    let tl: gsap.core.Timeline | null = null;
    const curtains: HTMLElement[] = [];
    const ctx = gsap.context(() => {}, root);

    const release = (instant = false) => {
      if (released) return;
      released = true;
      director.release("intro", { instant });
    };
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
      if (released) director.settle();
      else release(true);
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
        const nav = document.querySelector<HTMLElement>(".nav")!;
        const navTile = nav.querySelector<HTMLElement>(".brand-tile")!;
        const navRest = nav.querySelectorAll<HTMLElement>(".brand-word, .nav-links a, .btn-nav");
        const tile = q(".intro-tile")[0] as HTMLElement;
        const cells = q(".intro-cell");
        const word = SplitText.create(q(".intro-word"), { type: "chars", mask: "chars" });
        const title = SplitText.create(root.querySelector(".hero-title"), { type: "words", mask: "words" });
        const sub = root.querySelector(".hero-sub");
        const cta = root.querySelector(".hero-actions");
        const manual = root.querySelector<HTMLElement>(".hero-manual")!;
        const win = root.querySelector<HTMLElement>(".hero-window")!;
        const manCurtain = addCurtain(manual, 18);
        const winCurtain = addCurtain(win, 20);
        curtains.push(manCurtain.wrap, winCurtain.wrap);

        gsap.set([navTile, ...navRest, sub, cta, win], { autoAlpha: 0 });
        gsap.set(q(".intro-word"), { autoAlpha: 1 });
        gsap.set(title.words, { yPercent: 110 });

        tl = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: finish });
        tl
          // F1: the head assembles cell by cell out of a scattered pixel field.
          .fromTo(
            cells,
            {
              autoAlpha: 0,
              x: () => gsap.utils.random(-0.55, 0.55) * innerWidth,
              y: () => gsap.utils.random(-0.45, 0.45) * innerHeight,
              scale: () => gsap.utils.random(0.5, 2.4),
            },
            { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.95, stagger: { amount: 0.5, from: "random" } },
            0,
          )
          // F2: the ink app-icon tile grows around it; wordmark and badge print in.
          .fromTo(q(".intro-tile-bg"), { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: "back.out(1.7)" }, 1.0)
          .fromTo(word.chars, { yPercent: 110 }, { yPercent: 0, duration: 0.55, stagger: 0.035 }, 1.2)
          .fromTo(q(".intro-badge"), { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(2.6)" }, 1.5)
          .fromTo(q(".intro-skip"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.4)
          // F3: the tile flies into the nav; the white curtain lifts off the page.
          .to([q(".intro-word"), q(".intro-badge"), q(".intro-skip")], { autoAlpha: 0, y: -14, duration: 0.3, ease: "power2.in" }, 2.0)
          .to(
            tile,
            {
              x: () => {
                const a = tile.getBoundingClientRect();
                const b = navTile.getBoundingClientRect();
                return b.left + b.width / 2 - (a.left + a.width / 2);
              },
              y: () => {
                const a = tile.getBoundingClientRect();
                const b = navTile.getBoundingClientRect();
                return b.top + b.height / 2 - (a.top + a.height / 2);
              },
              scale: () => navTile.getBoundingClientRect().width / tile.getBoundingClientRect().width,
              duration: 0.9,
              ease: "expo.inOut",
            },
            2.1,
          )
          .to(q(".intro-bg"), { autoAlpha: 0, duration: 0.6, ease: "power2.out" }, 2.35)
          .set(navTile, { autoAlpha: 1 }, 3.0)
          .set(tile, { autoAlpha: 0 }, 3.0)
          .fromTo(navRest, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06 }, 2.7)
          // F4 copy: headline words rise out of their masks.
          .to(title.words, { yPercent: 0, duration: 1, stagger: 0.08 }, 2.5)
          .fromTo(sub, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 2.85)
          .fromTo(cta, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "back.out(2)" }, 3.0)
          // Window entries: the manual springs up and prints in top-left to bottom-right…
          .fromTo(manual, { autoAlpha: 1, y: 90, scale: 0.88 }, { y: 0, scale: 1, duration: 1, ease: "back.out(1.5)" }, 2.6)
          .to(manCurtain.cells, { scale: 0, duration: 0.3, ease: "power2.in", stagger: { amount: 0.45, grid: [manCurtain.rows, manCurtain.cols], from: "start" } }, 2.75)
          // …the Student Record window unfolds from where the gecko's hand will be, then de-rasterizes.
          .set(win, { autoAlpha: 1 }, 2.9)
          .fromTo(
            win,
            { clipPath: "inset(46% 100% 46% 0% round 10px)" },
            { clipPath: "inset(0% 0% 0% 0% round 10px)", duration: 0.8, ease: "expo.inOut" },
            2.9,
          )
          .to(winCurtain.cells, { scale: 0, duration: 0.3, ease: "power2.in", stagger: { amount: 0.5, from: "random" } }, 3.35)
          // The passage pours into the gecko; once it has, the manual is used up.
          .call(() => release(), [], 3.45)
          .to(manual, { autoAlpha: 0, y: 24, scale: 0.94, duration: 0.5, ease: "power2.in" }, 4.6);

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
      release();
    };
  }, [playIntro]);

  return (
    <section ref={section} className="hero" aria-labelledby="hero-title">
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
            <p className="intro-word">GetCko</p>
            <p className="intro-badge">Gets mo na.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm intro-skip" tabIndex={-1}>
            Skip intro
          </button>
        </div>
      )}

      <h1 id="hero-title" className="hero-title">
        Your manual. Your screen.
      </h1>
      <p className="hero-sub">One gecko in between. Every model runs on your laptop.</p>
      <div className="hero-actions">
        <button type="button" className="btn btn-primary btn-hero" onClick={onWatch}>
          <PlayIcon /> Watch the 1-min demo
        </button>
      </div>

      <div className="hero-pair">
        {playIntro && (
          <article className="hero-manual" aria-hidden="true">
            <header className="manual-bar">
              <span className="pdf-tag">PDF</span>
              <span className="manual-name">
                Office Grading Manual <span className="muted">· p. 4</span>
              </span>
              <span className="sample-tag">Sample</span>
            </header>
            <div className="manual-body">
              <h3 className="manual-h">
                <span className="mono">2.3</span> Computing the Final Grade
              </h3>
              <p ref={passage} className="passage">
                Final grade = 40% written work + 60% performance tasks.
              </p>
            </div>
          </article>
        )}
        <GeckoSlot
          id="hero"
          section={section}
          target={field}
          source={playIntro ? passage : undefined}
          className="slot-hero"
          label="GetCko pointing at the empty Final grade field"
        />
        <div className="hero-window" role="img" aria-label="A Student Record window for Cruz, Juan. The Final grade field is empty, and GetCko points at it.">
          <div className="hw-bar">
            <span className="lights" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span className="hw-title">Student Record</span>
          </div>
          <div className="hw-body">
            <div className="hw-row">
              <span className="hw-label">Student</span>
              <span className="hw-value">Cruz, Juan</span>
            </div>
            <div className="hw-row">
              <span className="hw-label">Final grade</span>
              <div ref={field} className="hw-field gc-target">
                <span className="caret" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
