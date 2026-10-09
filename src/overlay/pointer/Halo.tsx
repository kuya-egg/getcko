import type { CSSProperties } from "react";
import type { Rect } from "../../bindings/Rect";
import type { HaloVariant } from "../types";

const SOFT_DIAMETER = 36;

export function Halo({ rect, variant }: { rect: Rect; variant: HaloVariant }) {
  const style: CSSProperties =
    variant === "exact"
      ? {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: 6,
          boxShadow: "0 0 0 3px #FFC83D",
        }
      : {
          left: rect.x + rect.width / 2 - SOFT_DIAMETER / 2,
          top: rect.y + rect.height / 2 - SOFT_DIAMETER / 2,
          width: SOFT_DIAMETER,
          height: SOFT_DIAMETER,
          boxSizing: "border-box",
          borderRadius: "50%",
          border: "2px dashed #FFC83D",
        };
  return <div aria-hidden="true" style={{ position: "absolute", pointerEvents: "none", ...style }} />;
}
