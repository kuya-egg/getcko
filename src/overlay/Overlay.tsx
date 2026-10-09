import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { GetCkoSprite, MOMENT_POSE, POSE_CYCLES, poseSize, type Pose } from "../brand/mascot";
import {
  DUR,
  EASE,
  answerCardIn,
  answerCardOut,
  flyTo,
  frameLoop,
  haloIn,
  haloOut,
  prefersReducedMotion,
  speakLoop,
  thinkingLoop,
  type Rect,
} from "../brand/motion";
import { T } from "../brand/lexicon";
import { AnswerCard } from "../components/ui";
import {
  EVENTS,
  currentTarget,
  hideOverlay,
  on,
  setHitRegions,
  workArea,
  type OverlayAnswer,
  type OverlayTarget,
} from "./bridge";
import { PracticePanel } from "./PracticePanel";
import { placeCard, placeNear } from "./layout";

/** Overlay pointer scale (whole numbers only). */
const SCALE = 3;
/** Hand tip to target edge, px. */
const GAP = 12;

function toRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

/** CSS size of the sprite as GetCkoSprite draws it (whole device pixels per cell). */
function spriteSize(pose: Pose): { w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const cell = Math.max(1, Math.round(SCALE * dpr)) / dpr;
  const s = poseSize(pose);
  return { w: s.w * cell, h: s.h * cell };
}

/** `**word**` → bold, `` `x` `` → code, so answers can name the element and quote formulas. */
function richText(text: string): ReactNode {
  return text.split(/(\*\*.+?\*\*|`.+?`)/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`"))
      return (
        <code key={i} className="rounded-code bg-surface-2 px-1 font-mono text-label">
          {part.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Roughly how long TTS would take, for the speaking loop until real TTS drives it. */
function speakSeconds(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.min(6, Math.max(1.5, words / 2.6));
}

/**
 * Screen Help overlay (PRD S3). Fills the primary monitor, transparent and click-through.
 * Order on screen: GetCko thinks → walks to the target → lands beside it → sun halo → answer card
 * next to them while GetCko speaks. "I don't know" answers have no target: GetCko stands beside
 * the card, unsure, and nothing wears the halo.
 */
export function Overlay() {
  const geckoRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const devRef = useRef<HTMLDivElement>(null);
  const flight = useRef<gsap.core.Timeline | null>(null);
  const loop = useRef<gsap.core.Timeline | null>(null);
  const geckoBox = useRef<Rect | null>(null);
  const geckoShown = useRef(false);
  const haloShown = useRef(false);

  const [target, setTarget] = useState<OverlayTarget | null>(null);
  const [answer, setAnswer] = useState<OverlayAnswer | null>(null);
  const [area, setArea] = useState<Rect | null>(null);
  const [pose, setPose] = useState<Pose>(MOMENT_POSE.screenHelp);
  const [flip, setFlip] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const view = useCallback(
    (): Rect => area ?? { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
    [area],
  );

  const setLoop = useCallback((tl: gsap.core.Timeline | null) => {
    loop.current?.kill();
    loop.current = tl;
  }, []);

  const stopSpeaking = useCallback(() => {
    setLoop(null);
    setSpeaking(false);
    setPose(MOMENT_POSE.screenHelp);
  }, [setLoop]);

  /** Shows the gecko at (x, y) with a 2-step pop if it is not on screen yet. */
  const appear = useCallback((x: number, y: number) => {
    const g = geckoRef.current;
    const p = popRef.current;
    if (!g || !p || geckoShown.current) return;
    geckoShown.current = true;
    gsap.set(g, { x: Math.round(x), y: Math.round(y), autoAlpha: 1 });
    if (!prefersReducedMotion())
      gsap.fromTo(p, { scale: 0 }, { scale: 1, duration: DUR.fast, ease: EASE.step, transformOrigin: "50% 100%" });
  }, []);

  const vanish = useCallback(() => {
    const g = geckoRef.current;
    if (!g || !geckoShown.current) return;
    geckoShown.current = false;
    geckoBox.current = null;
    setLoop(null);
    gsap.to(g, { autoAlpha: 0, duration: DUR.fast });
  }, [setLoop]);

  // ---------------------------------------------------------------- events

  const answerRef = useRef(answer);
  answerRef.current = answer;

  useEffect(() => {
    const refreshArea = () => void workArea().then(setArea);
    refreshArea();
    const offs = [
      on(EVENTS.shown, () => {
        refreshArea();
        // hide() clears the hit regions in Rust; report them again so the panels take clicks.
        reportRegions();
      }),
      on<OverlayTarget>(EVENTS.pointAt, setTarget),
      on<OverlayAnswer | null>(EVENTS.answer, setAnswer),
      on(EVENTS.clearTarget, () => {
        setTarget(null);
        // Never leave GetCko standing with nothing to point at, unless an answer is on its way.
        setTimeout(() => {
          if (!answerRef.current) vanish();
        }, 400);
      }),
      on(EVENTS.hidden, () => {
        setTarget(null);
        setAnswer(null);
        vanish();
      }),
    ];
    // point_at may have fired before this webview mounted.
    currentTarget()
      .then((t) => t && setTarget(t))
      .catch(() => {});
    return () => offs.forEach((p) => p.then((off) => off()));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void hideOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useLayoutEffect(() => {
    if (geckoRef.current) gsap.set(geckoRef.current, { autoAlpha: 0 });
  }, []);

  // ---------------------------------------------------------------- thinking (practice ask)

  const think = useCallback(() => {
    const dev = devRef.current;
    setAnswer(null);
    if (!geckoShown.current && dev) {
      const r = toRect(dev);
      const size = spriteSize(MOMENT_POSE.thinking);
      setFlip(false);
      appear(r.x + r.w + GAP, r.y + r.h - size.h);
    }
    setLoop(thinkingLoop(setPose));
  }, [appear, setLoop]);

  // ---------------------------------------------------------------- target: walk over, land, halo

  useLayoutEffect(() => {
    const g = geckoRef.current;
    const h = haloRef.current;
    if (!g || !h) return;
    flight.current?.kill();
    const tl = gsap.timeline();
    if (haloShown.current) tl.add(haloOut(h));
    haloShown.current = false;

    if (!target || !target.onScreen) {
      // Nothing on this screen to point at: GetCko never stands pointing at nothing.
      if (target) {
        console.warn("[overlay] target is off the primary monitor", target);
        vanish();
      }
      // An "I don't know" answer may follow; the answer effect brings GetCko back beside the card.
      flight.current = tl;
      return () => {
        tl.kill();
      };
    }

    const rect: Rect = { x: target.x, y: target.y, w: target.w, h: target.h };
    const size = spriteSize(MOMENT_POSE.screenHelp);
    const bounds = view();
    if (!geckoShown.current) appear(bounds.x + bounds.w - size.w - 96, bounds.y + bounds.h - size.h - 96);

    tl.set(h, { left: rect.x, top: rect.y, width: rect.w, height: rect.h });
    tl.call(() => setLoop(frameLoop(setPose, POSE_CYCLES.walk)));
    tl.add(
      flyTo(g, rect, {
        size,
        gap: GAP,
        bounds,
        side: target.side ?? "auto",
        onPlace: (p) => {
          setFlip(p.flip);
          geckoBox.current = { x: p.x, y: p.y, ...size };
        },
      }),
    );
    tl.call(() => {
      setLoop(null);
      setPose(MOMENT_POSE.screenHelp);
    });
    tl.add(haloIn(h));
    haloShown.current = true;
    flight.current = tl;
    return () => {
      tl.kill();
    };
  }, [target, view, appear, vanish, setLoop]);

  // ---------------------------------------------------------------- answer card

  const reportRegions = useCallback(() => {
    const rects = [cardRef.current, devRef.current].filter((el): el is HTMLElement => !!el).map(toRect);
    void setHitRegions(rects);
  }, []);

  /** Puts the card beside GetCko and the target, or in a corner when there is no target. */
  const placeAnswer = useCallback((): Rect | null => {
    const card = cardRef.current;
    if (!card) {
      reportRegions();
      return null;
    }
    const size = { w: card.offsetWidth, h: card.offsetHeight };
    const avoid = devRef.current ? [toRect(devRef.current)] : [];
    const pointed = target?.onScreen && !answer?.failed && geckoBox.current;
    const spot = pointed
      ? placeNear(size, [target, geckoBox.current!], view(), avoid)
      : placeCard(size, view(), avoid);
    card.style.left = `${spot.x}px`;
    card.style.top = `${spot.y}px`;
    reportRegions();
    return spot;
  }, [target, answer, view, reportRegions]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !answer) return;
    const spot = placeAnswer();
    const g = geckoRef.current;
    const tl = gsap.timeline();
    // A new answer ends the previous one's speech.
    setSpeaking(false);

    const speak = () => {
      setSpeaking(true);
      const s = speakLoop(setPose, { duration: speakSeconds(answer.answer), restPose: MOMENT_POSE.screenHelp });
      s.eventCallback("onComplete", () => setSpeaking(false));
      setLoop(s);
    };

    if (!(target?.onScreen && !answer.failed) && spot && g) {
      // No target on screen: GetCko stands beside the card instead, facing it. No halo.
      // Unsure for "I don't know"; speaking for answers that explain rather than point.
      const pose = answer.failed ? MOMENT_POSE.failed : MOMENT_POSE.screenHelp;
      const size = spriteSize(pose);
      setLoop(null);
      if (!geckoShown.current) appear(spot.x - size.w - GAP, spot.y + spot.h - size.h);
      tl.add(
        flyTo(g, spot, {
          size,
          gap: GAP,
          side: "left",
          bounds: view(),
          hop: 0,
          onPlace: (p) => setFlip(p.flip),
        }),
      );
      tl.call(() => setPose(pose));
      tl.add(answerCardIn(card), "-=0.12");
      if (!answer.failed) tl.call(speak);
    } else {
      const f = flight.current;
      const wait = f && f.isActive() ? Math.max(0, f.duration() - f.time() - DUR.fast) : 0;
      tl.add(answerCardIn(card), wait);
      tl.call(speak);
    }
    tl.eventCallback("onComplete", reportRegions);
    return () => {
      tl.kill();
    };
    // Re-run per answer only; placement follows target and area through placeAnswer below.
  }, [answer]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return reportRegions();
    const ro = new ResizeObserver(() => placeAnswer());
    ro.observe(card);
    return () => ro.disconnect();
  }, [answer, placeAnswer, reportRegions]);

  const dismissAnswer = useCallback(() => {
    stopSpeaking();
    const done = () => {
      setAnswer(null);
      if (!target) vanish();
    };
    const card = cardRef.current;
    if (!card) return done();
    answerCardOut(card).eventCallback("onComplete", done);
  }, [stopSpeaking, target, vanish]);

  const label = target?.label ? T.mascot.pointingAt(target.label) : T.mascot.name;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div ref={haloRef} aria-hidden className="absolute rounded-input" style={{ left: 0, top: 0, width: 0, height: 0 }} />

      <div ref={geckoRef} className="absolute top-0 left-0 z-[2]">
        <div ref={popRef}>
          <GetCkoSprite pose={pose} scale={SCALE} flip={flip} label={label} />
        </div>
      </div>

      {answer && (
        <AnswerCard
          ref={cardRef}
          className="pointer-events-auto absolute z-[1]"
          style={{ left: 0, top: 0, visibility: "hidden" }}
          agent={answer.agent ?? T.actions.screenHelp}
          question={answer.question}
          citations={answer.citations}
          latency={answer.latency}
          onStopSpeaking={speaking ? stopSpeaking : undefined}
          onClose={dismissAnswer}
        >
          {richText(answer.answer)}
        </AnswerCard>
      )}

      {import.meta.env.DEV && <PracticePanel ref={devRef} area={view()} onAsk={think} onLayout={reportRegions} />}
    </div>
  );
}
