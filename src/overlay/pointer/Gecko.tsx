import { useEffect, useRef } from "react";
import type { GeckoPlacement, GeckoPose } from "../types";
import { flipRows, SPRITE_COLS, SPRITE_PALETTE, SPRITE_ROWS, spriteRows } from "./sprite";

function drawCells(rows: readonly string[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_COLS;
  canvas.height = SPRITE_ROWS;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const color = SPRITE_PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return canvas;
}

/** Static sprite: it never animates, so it stays still while the user types. */
export function Gecko({ pose, placement }: { pose: GeckoPose; placement: GeckoPlacement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { x, y, facing, scale } = placement;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rows = spriteRows(pose);
    const cells = drawCells(facing === "left" ? flipRows(rows) : rows);
    const cellPx = Math.max(1, Math.round(scale * (window.devicePixelRatio || 1)));
    canvas.width = SPRITE_COLS * cellPx;
    canvas.height = SPRITE_ROWS * cellPx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cells, 0, 0, canvas.width, canvas.height);
  }, [pose, facing, scale]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="GetCko"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: SPRITE_COLS * scale,
        height: SPRITE_ROWS * scale,
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
}
