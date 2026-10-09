// GetCko first-glance hero: "Ask out loud. GetCko points." beside a mock e-service form (site edit:
// was a grade sheet) where a voxel GetCko (three.js, the real sprite map extruded) hops to the Upload ID button, rings it, answers in
// Taglish and cites the manual, offline. Choreography: ./timeline.ts (shared with the demo video).
// Spec: docs/brand/hero.md.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTheme } from "../theme";
import { prefersReducedMotion } from "../motion";
import { GetCkoSprite } from "../mascot/GetCkoSprite";
import { MOMENT_POSE } from "../mascot/moments";
import type { Pose } from "../mascot/sprites";
import { ICON_PROPS, Icon } from "../icons";
import { T } from "../lexicon";
import { CitationChip, GeckoDot, Keycap, OfflineBadge, StepSquares, Surface, cn } from "../../components/ui";
import { HERO_BEATS, HERO_COPY, HERO_SAMPLE } from "./copy";
import { HERO_TIMING, buildHeroTimeline, geckoAt, measureHero, type GeckoFrame } from "./timeline";
import type { VoxelGecko } from "./voxel";

/** Stage design size (px). The stage is CSS-scaled to its column; coordinates stay in these units. */
export const HERO_STAGE = { w: 760, h: 540, cell: 10 } as const;

export interface GetCkoHeroProps {
  /** Force a theme for this section (marketing captures). Default "auto": follows the app theme. */
  theme?: "auto" | "light" | "dark";
  /** Play the ~6 s story on a loop. false = static final frame. Default true (reduced motion: static). */
  autoplay?: boolean;
  /** Freeze on this time of the story (seconds, 0 to 6.6) for captures and QA. Overrides autoplay. */
  at?: number;
  className?: string;
  /** Primary action row under the support line (marketing CTA). Site addition, upstream candidate. */
  actions?: ReactNode;
}

// ---------------------------------------------------------------------------
// Keyword marker: gecko-wash block, square corners, a 4px gecko pixel foot. Text stays ink/mist.

function Mark({ children, beat }: { children: ReactNode; beat?: string }) {
  return (
    <span className="relative isolate inline-block" data-hero-beat={beat}>
      <span
        aria-hidden="true"
        data-hero-mark={beat ? "" : undefined}
        className="absolute -inset-x-[0.1em] top-[0.14em] bottom-[0.02em] -z-10 bg-accent-wash"
      >
        <span className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
      </span>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mock app window (site edit: was a grade sheet): an LGU e-service form, step 2 of 4. Name and
// TIN are filled, the valid ID is missing, so Next is disabled. Upload ID is the target; it sits
// on the window's right edge so GetCko lands beside it, facing it.

function EServiceForm() {
  const label = "text-caption font-medium text-text-2";
  const box = "flex h-9 items-center rounded-input border border-border-strong bg-surface px-3 text-label text-text";
  return (
    <div data-hero="window" className="relative w-[470px] rounded-window border border-border bg-surface shadow-card" aria-hidden="true">
      <div className="relative flex h-9 items-center rounded-t-window border-b border-border bg-surface-2 px-3">
        <span className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-3 rounded-pill border border-border-strong" />
          ))}
        </span>
        <span className="absolute inset-x-0 text-center text-caption text-text-2">{HERO_SAMPLE.windowTitle}</span>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-label font-semibold text-text">
            <span className="font-mono text-keys nums text-text-3">
              {HERO_SAMPLE.step}/{HERO_SAMPLE.steps}
            </span>{" "}
            {HERO_SAMPLE.stepLabel}
          </span>
          <StepSquares step={HERO_SAMPLE.step} total={HERO_SAMPLE.steps} />
        </div>
        {HERO_SAMPLE.fields.map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <span className={label}>{f.label}</span>
            <span className={cn(box, "mono" in f && f.mono && "font-mono nums")}>{f.value}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <span className={label}>
            {HERO_SAMPLE.idLabel} <span className="text-alert">*</span>
          </span>
          <div className="flex items-center gap-2">
            <span className={cn(box, "flex-1 border-dashed text-text-3")}>{HERO_SAMPLE.idEmpty}</span>
            <span
              data-hero="target"
              className="relative z-[1] inline-flex h-9 items-center gap-1.5 rounded-button border border-border-strong bg-surface px-3 text-label font-semibold text-text"
            >
              <Icon.addDocuments {...ICON_PROPS} className="-my-1 -ml-1" />
              {HERO_SAMPLE.target}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <span className="inline-flex h-9 items-center rounded-button px-3 text-label font-semibold text-text-2">{HERO_SAMPLE.back}</span>
          <span className="inline-flex h-9 items-center rounded-button border border-disabled-border bg-disabled px-4 text-label font-semibold text-disabled-text">
            {HERO_SAMPLE.next}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage: fixed 760 x 540 design, scaled to fit its column (never above 1).

function useFitScale(ref: RefObject<HTMLElement | null>, designW: number) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, Math.max(0.3, el.clientWidth / designW)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, designW]);
  return scale;
}

export function GetCkoHero({ theme = "auto", autoplay = true, at, className, actions }: GetCkoHeroProps) {
  const app = useTheme();
  const dark = theme === "auto" ? app.resolved === "dark" : theme === "dark";
  const rootRef = useRef<HTMLElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const voxelRef = useRef<VoxelGecko | null>(null);
  const frameRef = useRef<GeckoFrame | null>(null);
  const tlRef = useRef<ReturnType<typeof buildHeroTimeline> | null>(null);
  const scale = useFitScale(fitRef, HERO_STAGE.w);
  const titleId = `gc-hero-title-${useId().replace(/:/g, "")}`;
  const [use3d, setUse3d] = useState(false);
  const [sprite, setSprite] = useState<{ pose: Pose; flip: boolean }>({ pose: MOMENT_POSE.listening, flip: true });
  const frozen = typeof at === "number";
  const static_ = !frozen && (!autoplay || prefersReducedMotion());
  const visible = useRef({ inView: true, page: true });

  // GetCko driver: voxel scene when ready, else the 2D sprite (also the no-WebGL fallback).
  const drive = useRef((f: GeckoFrame) => {
    frameRef.current = f;
    const v = voxelRef.current;
    if (v) {
      v.set(f);
      v.render();
      return;
    }
    const el = spriteRef.current;
    if (el) el.style.transform = `translate(${f.x}px, ${f.y}px)`;
    setSprite((s) => (s.pose === f.pose && s.flip === f.flip ? s : { pose: f.pose, flip: f.flip }));
  }).current;

  // Load three.js lazily; keep the 2D sprite if WebGL is missing or the import fails.
  useEffect(() => {
    let cancelled = false;
    let made: VoxelGecko | null = null;
    import("./voxel")
      .then(({ createVoxelGecko, webglAvailable }) => {
        const canvas = canvasRef.current;
        const root = rootRef.current;
        if (cancelled || !canvas || !root || !webglAvailable()) return;
        made = createVoxelGecko(canvas, { from: root, dark });
        voxelRef.current = made;
        setUse3d(true);
      })
      .catch(() => {
        /* stay 2D */
      });
    return () => {
      cancelled = true;
      voxelRef.current = null;
      made?.dispose();
    };
    // Create once; theme and size are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Size the canvas: stage px at the displayed scale, DPR capped at 2.
  useLayoutEffect(() => {
    const v = voxelRef.current;
    if (!v || !use3d) return;
    const dpr = Math.min(2, (window.devicePixelRatio || 1) * scale);
    v.resize(HERO_STAGE.w, HERO_STAGE.h, Math.max(0.5, dpr));
    if (frameRef.current) v.set(frameRef.current);
    v.render();
  }, [use3d, scale]);

  // Theme: re-read voxel colors from CSS variables.
  useLayoutEffect(() => {
    const v = voxelRef.current;
    const root = rootRef.current;
    if (!v || !root) return;
    v.recolor({ from: root, dark });
    v.render();
  }, [dark, use3d]);

  // Timeline: rebuilt on theme change (halo style) and when the 3D scene arrives; keeps its time.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const prev = tlRef.current;
    const t = prev ? prev.time() : 0;
    prev?.kill();
    const target = root.querySelector<HTMLElement>('[data-hero="target"]');
    if (target) target.style.boxShadow = "";
    const tl = buildHeroTimeline(root, { gecko: drive, reduced: static_, paused: true, dark, cell: HERO_STAGE.cell });
    tlRef.current = tl;
    if (frozen) {
      tl.time(at);
      tl.pause();
    } else if (!static_) {
      tl.time(t);
      if (visible.current.inView && visible.current.page) tl.play();
    } else {
      const L = measureHero(root, HERO_STAGE.cell);
      if (L) drive(geckoAt(HERO_TIMING.end, L));
    }
    return () => {
      tl.pause();
    };
  }, [dark, static_, frozen, at, use3d, drive]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
    },
    [],
  );

  // Pause offscreen and when the tab is hidden.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sync = () => {
      const tl = tlRef.current;
      if (!tl || static_ || frozen) return;
      if (visible.current.inView && visible.current.page) tl.play();
      else tl.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      visible.current.inView = e.isIntersecting;
      sync();
    });
    io.observe(root);
    const onVis = () => {
      visible.current.page = document.visibilityState !== "hidden";
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [static_, frozen]);

  const ans = HERO_SAMPLE.answer;
  // Light: footprints read as snowflakes behind the busy stage, so light gets the calm canopy corner only.

  return (
    <Surface
      as="section"
      ref={rootRef}
      texture={dark ? "footprints" : "canopy-corner"}
      intensity="subtle"
      tone="paper"
      mode={theme === "auto" ? "auto" : theme}
      aria-labelledby={titleId}
      className={cn("relative overflow-hidden", className)}
    >
      <div className="relative mx-auto grid w-full max-w-[824px] grid-cols-1 xl:max-w-[1440px] items-center gap-8 px-8 py-8 xl:grid-cols-12 xl:gap-12 xl:px-16 xl:py-20">
        {/* Words: headline, support line, the four beats, the shortcut. */}
        <div data-hero="copy" className="flex flex-col gap-4 xl:col-span-5 xl:gap-6">
          <h1 id={titleId} className="font-display text-h1 text-balance text-text lg:text-display">
            {HERO_COPY.headline.before} <Mark>{HERO_COPY.headline.mark}</Mark>
            {HERO_COPY.headline.after}
          </h1>
          <p className="max-w-[36ch] text-title font-sans font-normal text-text-2">{HERO_COPY.support}</p>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 xl:flex-col xl:items-start xl:gap-6">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 xl:pt-2" aria-label={T.board.how.eyebrow}>
              {HERO_BEATS.map((b, i) => (
                <li key={b} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden="true" className="size-1.5 bg-border-strong" />}
                  <span className="font-display text-h2 text-text">
                    <Mark beat={b}>{HERO_COPY.beats[b]}</Mark>
                  </span>
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-2 text-label text-text-2">
              <Keycap hotkey platform="mac" />
              <span>{T.sessionBar.shortcutHint}</span>
              <span aria-hidden="true" className="text-text-3">·</span>
              <span>{T.offline.nothingLeaves("mac")}</span>
            </p>
          </div>
        </div>

        {/* Picture: the story, played on a fixed-size stage. */}
        <div ref={fitRef} className="w-full xl:col-span-7" style={{ height: HERO_STAGE.h * scale }}>
          <div
            data-hero="stage"
            role="group"
            aria-label={`${HERO_SAMPLE.question} ${T.mascot.pointingAt(`the ${ans.target} button`)}. ${HERO_SAMPLE.sourceText}. ${T.status.offline}.`}
            className="relative origin-top-left"
            style={{ width: HERO_STAGE.w, height: HERO_STAGE.h, transform: `scale(${scale})` }}
          >
            <div className="absolute top-10 left-0">
              <EServiceForm />
            </div>

            {/* Ask: the shortcut pill (ink in both themes), then the question. */}
            <div
              data-hero="ask"
              className="absolute top-0 right-0 inline-flex h-11 items-center gap-2 rounded-pill bg-chrome pr-4 pl-1.5 text-label text-chrome-text"
            >
              <Keycap hotkey platform="mac" tone="chrome" className="h-8 px-2" />
              <Icon.listening {...ICON_PROPS} className="text-gecko" />
              <span>{HERO_COPY.listening}</span>
            </div>
            <p
              data-hero="question"
              className="absolute top-[60px] right-0 max-w-[270px] rounded-bubble rounded-br-code border border-border bg-surface px-4 py-3 text-answer text-text shadow-card"
            >
              “{HERO_SAMPLE.question}”
            </p>

            {/* Source + Offline: the answer card. */}
            <div
              data-hero="answer"
              className="absolute bottom-0 left-6 flex w-[450px] flex-col gap-3 rounded-panel border border-border bg-surface p-4 shadow-overlay"
            >
              <p className="flex items-center gap-2 text-caption text-text-2">
                <GeckoDot />
                {T.answerCard.header(HERO_COPY.agent)}
                <span data-hero="speaking" className="ml-auto inline-flex items-center gap-1 text-accent-text">
                  <Icon.readAloud {...ICON_PROPS} className="-my-1" />
                  {T.moments.speaking}
                </span>
              </p>
              <p className="text-answer text-text">
                {ans.before} <strong className="font-semibold">{ans.target}</strong>
                {ans.after}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span data-hero="source">
                  <CitationChip source={HERO_SAMPLE.source.doc} page={HERO_SAMPLE.source.page} />
                </span>
                <span data-hero="offline">
                  <OfflineBadge detail={HERO_COPY.place} />
                </span>
              </div>
            </div>

            <p
              data-hero="tagline"
              className="absolute right-0 bottom-0 w-[220px] text-center font-pixel text-pixel text-accent-text"
            >
              {HERO_COPY.tagline}
            </p>

            {/* GetCko: voxel canvas over the stage; 2D sprite until three.js loads or without WebGL. */}
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className={cn("pointer-events-none absolute top-0 left-0 z-10", !use3d && "invisible")}
              style={{ width: HERO_STAGE.w, height: HERO_STAGE.h }}
            />
            {!use3d && (
              <div ref={spriteRef} className="pointer-events-none absolute top-0 left-0 z-10">
                <GetCkoSprite pose={sprite.pose} flip={sprite.flip} scale={HERO_STAGE.cell} label="" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
}

export default GetCkoHero;
