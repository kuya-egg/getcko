import { useEffect, useState } from "react";
import { Icon } from "./brand/icons";
import { T } from "./brand/lexicon";
import { Button, Dialog, Wordmark, buttonClass, cn } from "./components/ui";
import { GeckoCanvas } from "./gecko/react";
import { DEMO_YOUTUBE_ID, RELEASES_URL } from "./config";
import { SITE } from "./copy";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { KnowledgeBases } from "./sections/KnowledgeBases";
import { Voice } from "./sections/Voice";
import { Agents } from "./sections/Agents";
import { Keywords } from "./sections/Keywords";
import { Offline } from "./sections/Offline";
import { Closing } from "./sections/Closing";

const NAV = [
  { href: "#how", label: SITE.nav.how },
  { href: "#knowledge", label: SITE.nav.knowledgeBases },
  { href: "#agents", label: SITE.nav.agents },
  { href: "#offline", label: SITE.nav.offline },
];

export function App() {
  const [demo, setDemo] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const watch = () => setDemo(true);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className={cn("nav z-sticky bg-bg", scrolled && "is-scrolled border-border")}>
        <a href="#top" className="nav-brand" aria-label={`${T.product.name} home`}>
          <Wordmark data-nav-mark="" />
        </a>
        <nav className="nav-links" aria-label={T.nav.label}>
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-label text-text-2 hover:text-text">
              {n.label}
            </a>
          ))}
        </nav>
        <Button size="sm" icon={Icon.start} onClick={watch} className="nav-cta">
          {SITE.watchDemoShort}
        </Button>
      </header>

      <main id="main">
        <Hero onWatch={watch} />
        <HowItWorks />
        <KnowledgeBases />
        <Voice />
        <Agents onWatch={watch} />
        <Keywords />
        <Offline />
      </main>
      <Closing onWatch={watch} />

      <Dialog
        open={demo}
        onClose={() => setDemo(false)}
        title={SITE.watchDemo}
        wide
        actions={
          <a className={buttonClass("secondary", "sm")} href={RELEASES_URL} target="_blank" rel="noreferrer">
            {SITE.download}
          </a>
        }
      >
        {/* Mounted only while open, so closing the dialog stops playback. */}
        {demo && (
          <iframe
            className="demo-video"
            src={`https://www.youtube-nocookie.com/embed/${DEMO_YOUTUBE_ID}?autoplay=1&rel=0`}
            title={SITE.demoTitle}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        )}
      </Dialog>

      <GeckoCanvas />
    </>
  );
}
