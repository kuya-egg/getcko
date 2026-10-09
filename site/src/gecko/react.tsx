import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { SPRITE_H, SPRITE_W, type Pose } from "../brand/mascot";
import { director } from "./director";

/** The single fixed canvas the page's GetcKo is drawn on. */
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

type Target = RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined);
const read = (t?: Target) => (t ? (typeof t === "function" ? t : () => t.current) : undefined);

interface SlotProps {
  id: string;
  section: RefObject<HTMLElement | null>;
  /** The one element GetcKo points at (ref, or a getter for elements inside kit components). */
  target?: Target;
  source?: Target;
  /** A MOMENT_POSE value. Default pointing. */
  pose?: Pose;
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
  label: string;
}

/** Reserves a 22×27-cell box where GetcKo lands while this section is active. */
export function GeckoSlot({ id, section, target, source, pose, flip, className, style, label }: SlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest target/source live in refs so inline getters never re-register (which would restart the morph).
  const live = useRef({ target, source });
  live.current = { target, source };
  useEffect(
    () =>
      director.register({
        id,
        el: ref.current!,
        section: section.current!,
        target: () => read(live.current.target)?.(),
        source: () => read(live.current.source)?.(),
        pose,
        flip,
      }),
    [id, section, pose, flip],
  );
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`gecko-slot ${className ?? ""}`}
      style={{ ...style, ["--cols" as string]: SPRITE_W, ["--rows" as string]: SPRITE_H }}
    />
  );
}

/** A section that draws its own GetcKo (the voxel hero): the canvas sprite scatters away there. */
export function useVacantSlot(id: string, section: RefObject<HTMLElement | null>) {
  useEffect(() => director.register({ id, section: section.current! }), [id, section]);
}
