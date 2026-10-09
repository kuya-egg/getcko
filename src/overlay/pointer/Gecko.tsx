import { useEffect, useRef, type RefObject } from "react";
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

/** Cursor offset of the following gecko, CSS px: beside the pointer, never under its hotspot. */
const FOLLOW_OFFSET = { x: 18, y: 14 };
/** Share of the remaining distance covered per frame: close behind, not rubbery. */
const FOLLOW_EASE = 0.55;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Static sprite (it never animates its pixels, so it stays still while the user types),
 * positioned by a transform. With `follow` it trails the cursor every animation frame,
 * written straight to the element (no React render, no CSS transition). Without it, it
 * glides to `placement` (the flight to a target, 480 ms; reduced motion 80 ms), starting
 * from wherever it is.
 */
export function Gecko({
  pose,
  placement,
  visible = true,
  follow,
}: {
  pose: GeckoPose;
  placement: GeckoPlacement;
  visible?: boolean;
  follow?: RefObject<{ x: number; y: number } | null>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const at = useRef<{ x: number; y: number } | null>(null);
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

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const place = (px: number, py: number) => {
      at.current = { x: px, y: py };
      canvas.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
    };
    if (!follow) {
      canvas.style.transition = `transform ${reducedMotion() ? 80 : 480}ms cubic-bezier(.2,.8,.2,1), opacity 100ms ease`;
      place(x, y);
      return;
    }
    canvas.style.transition = "opacity 100ms ease";
    let frame = 0;
    const step = () => {
      const cursor = follow.current;
      if (cursor) {
        const goal = { x: cursor.x + FOLLOW_OFFSET.x, y: cursor.y + FOLLOW_OFFSET.y };
        const from = at.current ?? goal;
        const k = reducedMotion() ? 1 : FOLLOW_EASE;
        const next = { x: from.x + (goal.x - from.x) * k, y: from.y + (goal.y - from.y) * k };
        if (Math.abs(next.x - from.x) > 0.1 || Math.abs(next.y - from.y) > 0.1 || !at.current) place(next.x, next.y);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [follow, x, y]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="GetCko"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SPRITE_COLS * scale,
        height: SPRITE_ROWS * scale,
        imageRendering: "pixelated",
        opacity: visible ? 1 : 0,
        willChange: "transform",
        pointerEvents: "none",
      }}
    />
  );
}
