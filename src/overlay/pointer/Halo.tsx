import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type { Rect } from "../../bindings/Rect";
import { haloIn } from "../../brand/motion";
import type { Size } from "../types";
import { haloShape } from "./haloShape";

const SUN = "var(--gc-sun)";
const INK = "var(--gc-ink)";

/**
 * The one target halo (design system §5.3), fitted to the target by `haloShape`: ring,
 * circle, corner brackets, or the dashed best-guess circle. Rings and circles draw in and
 * pulse twice with `haloIn` (static under reduced motion); `key` it by target so each new
 * target redraws.
 */
export function Halo({ rect, bestGuess, viewport }: { rect: Rect; bestGuess: boolean; viewport: Size }) {
  const shape = haloShape(rect, bestGuess, viewport);
  const ring = useRef<HTMLDivElement>(null);
  const animated = shape.kind === "ring" || shape.kind === "circle";
  useLayoutEffect(() => {
    if (!animated || !ring.current) return;
    // Gap 0: sun ring plus a 1px ink keyline, readable over light and dark apps alike.
    const tl = haloIn(ring.current, { gap: 0 });
    return () => {
      tl.kill();
    };
  }, [animated, rect.x, rect.y, rect.width, rect.height]);

  const box: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    left: shape.rect.x,
    top: shape.rect.y,
    width: shape.rect.width,
    height: shape.rect.height,
    boxSizing: "border-box",
  };
  switch (shape.kind) {
    case "ring":
      return <div ref={ring} aria-hidden="true" className="gc-halo" style={{ ...box, borderRadius: shape.radius }} />;
    case "circle":
      return <div ref={ring} aria-hidden="true" className="gc-halo" style={{ ...box, borderRadius: "50%" }} />;
    case "guess":
      return (
        <div
          aria-hidden="true"
          className="gc-halo gc-halo--guess"
          style={{ ...box, borderRadius: "50%", border: `2px dashed ${SUN}` }}
        />
      );
    case "brackets": {
      const arm = shape.arm;
      const corner = (pos: CSSProperties, sides: CSSProperties): CSSProperties => ({
        position: "absolute",
        width: arm,
        height: arm,
        ...pos,
        ...sides,
        filter: `drop-shadow(0 0 1px ${INK})`,
      });
      const line = `3px solid ${SUN}`;
      return (
        <div aria-hidden="true" className="gc-halo gc-halo--brackets" style={box}>
          <span style={corner({ left: 0, top: 0 }, { borderLeft: line, borderTop: line, borderTopLeftRadius: 6 })} />
          <span style={corner({ right: 0, top: 0 }, { borderRight: line, borderTop: line, borderTopRightRadius: 6 })} />
          <span style={corner({ left: 0, bottom: 0 }, { borderLeft: line, borderBottom: line, borderBottomLeftRadius: 6 })} />
          <span style={corner({ right: 0, bottom: 0 }, { borderRight: line, borderBottom: line, borderBottomRightRadius: 6 })} />
        </div>
      );
    }
  }
}
