import { useEffect, useState } from "react";
import { Icon } from "./brand/icons";
import { T } from "./brand/lexicon";
import { Button, Dialog, Wordmark, cn } from "./components/ui";
import { GeckoCanvas } from "./gecko/react";
import { DEMO_VIDEO_URL, REPO_PUBLIC, REPO_URL } from "./config";
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
        title={DEMO_VIDEO_URL ? SITE.watchDemo : SITE.demoRecording.title}
        body={DEMO_VIDEO_URL ? undefined : SITE.demoRecording.body}
        actions={
          REPO_PUBLIC && !DEMO_VIDEO_URL ? (
            <a className="text-label text-accent-text" href={REPO_URL} target="_blank" rel="noreferrer">
              {SITE.readCode}
            </a>
          ) : undefined
        }
      >
        {DEMO_VIDEO_URL && <video className="demo-video" src={DEMO_VIDEO_URL} controls playsInline preload="metadata" />}
      </Dialog>

      <GeckoCanvas />
    </>
  );
}
