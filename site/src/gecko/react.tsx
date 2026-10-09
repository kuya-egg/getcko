import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { director } from "./director";
import { COLS, HEAD_ROWS, PALETTE, ROWS, type Pose } from "./sprite";

/** The single fixed canvas the one-and-only GetCko is drawn on. */
export function GeckoCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const detach = director.attach(ref.current!);
    director.hold("fonts");
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) director.release("fonts");
    });
    return () => {
      cancelled = true;
      detach();
    };
  }, []);
  return <canvas ref={ref} className="gecko-canvas" aria-hidden="true" />;
}

interface SlotProps {
  id: string;
  section: RefObject<HTMLElement | null>;
  target?: RefObject<HTMLElement | null>;
  source?: RefObject<HTMLElement | null>;
  pose?: Pose;
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
  label: string;
}

/** Reserves a COLS×ROWS box where the gecko lands while this section is active. */
export function GeckoSlot({ id, section, target, source, pose, flip, className, style, label }: SlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      director.register({
        id,
        el: ref.current!,
        section: section.current!,
        target: target?.current,
        source: source?.current,
        pose,
        flip,
      }),
    [id, section, target, source, pose, flip],
  );
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`gecko-slot ${className ?? ""}`}
      style={{ ...style, ["--cols" as string]: COLS, ["--rows" as string]: ROWS }}
    />
  );
}

/** Static head mark (rows 0–10) as inline SVG at a whole-number scale (design system §6). */
export function HeadMark({ scale, title = "GetCko" }: { scale: number; title?: string }) {
  const w = HEAD_ROWS[0].length;
  const h = HEAD_ROWS.length;
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" role="img" aria-label={title}>
      {HEAD_ROWS.flatMap((row, y) =>
        [...row].map((ch, x) => (PALETTE[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PALETTE[ch]} /> : null)),
      )}
    </svg>
  );
}
