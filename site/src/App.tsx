import { useEffect, useRef, useState } from "react";
import { GeckoCanvas, HeadMark } from "./gecko/react";
import { PlayIcon } from "./components/ui";
import { DEMO_VIDEO_URL, REPO_PUBLIC, REPO_URL } from "./config";
import { Hero } from "./sections/Hero";
import { Files } from "./sections/Files";
import { ScreenHelp } from "./sections/ScreenHelp";
import { Agents } from "./sections/Agents";
import { Voice } from "./sections/Voice";
import { Offline } from "./sections/Offline";
import { Closing } from "./sections/Closing";

export function App() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const watch = () => dialog.current?.showModal();

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <a className="brand" href="#top" aria-label="GetCko home">
          <span className="brand-tile">
            <HeadMark scale={2} title="" />
          </span>
          <span className="brand-word">GetCko</span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#agents">Agents</a>
          <a href="#privacy">Privacy</a>
          {REPO_PUBLIC && (
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          )}
        </nav>
        <button type="button" className="btn btn-primary btn-nav" onClick={watch}>
          <PlayIcon width={16} height={16} /> Watch the demo
        </button>
      </header>

      <main id="main">
        <span id="top" />
        <Hero onWatch={watch} />
        <ScreenHelp />
        <Files />
        <Agents onWatch={watch} />
        <Voice />
        <Offline />
        <Closing onWatch={watch} />
      </main>

      <footer className="footer">
        <span className="brand">
          <span className="brand-tile brand-tile-sm">
            <HeadMark scale={1} title="" />
          </span>
          <span className="brand-word">GetCko</span>
        </span>
        <p className="caption">Built for AppBuildersPH 2026 · Local AI{REPO_PUBLIC ? ". Open source." : "."}</p>
        {REPO_PUBLIC && (
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        )}
      </footer>

      <dialog ref={dialog} className="demo" aria-labelledby="demo-title" onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        <div className="demo-inner">
          <header className="demo-head">
            <h2 id="demo-title" className="h2">
              GetCko in one minute
            </h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => dialog.current?.close()}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          {DEMO_VIDEO_URL ? (
            <video className="demo-video" src={DEMO_VIDEO_URL} controls playsInline preload="metadata" />
          ) : (
            <div className="demo-empty">
              <p className="h2">The demo is being recorded.</p>
              <p>
                It shows the full flow with Wi-Fi off: ask out loud, GetCko reads the screen, answers from the manual, and points at the
                cell.
              </p>
              {REPO_PUBLIC && (
                <a className="btn btn-secondary" href={REPO_URL} target="_blank" rel="noreferrer">
                  Follow the repo on GitHub
                </a>
              )}
            </div>
          )}
        </div>
      </dialog>

      <GeckoCanvas />
    </>
  );
}
