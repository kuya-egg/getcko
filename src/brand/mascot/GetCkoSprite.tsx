import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  PALETTE,
  SPRITE_W,
  buildHeadMark,
  buildPose,
  type CellKey,
  type Pose,
  type SpritePalette,
} from "./sprites";

// Rendering rules (design system section 6): whole-number scales only, no smoothing,
// never cover the target, one GetcKo per screen, never animate it while the user types.

const sheetCache = new Map<string, HTMLCanvasElement>();

/** Draws rows once at 1px per cell to an offscreen canvas (cached). */
function sheetFor(rows: readonly string[], palette: SpritePalette): HTMLCanvasElement {
  const key = rows.join("|") + "#" + Object.values(palette).join(",");
  const hit = sheetCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = rows[0]?.length ?? SPRITE_W;
  c.height = rows.length;
  const ctx = c.getContext("2d");
  if (ctx) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x] as CellKey];
        if (!color || color === "transparent") continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  sheetCache.set(key, c);
  return c;
}

function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mq: MediaQueryList | null = null;
    const update = () => {
      setDpr(window.devicePixelRatio || 1);
      listen();
    };
    const listen = () => {
      mq?.removeEventListener("change", update);
      try {
        mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        mq.addEventListener("change", update);
      } catch {
        mq = null;
      }
    };
    listen();
    return () => mq?.removeEventListener("change", update);
  }, []);
  return dpr;
}

interface PixelCanvasProps {
  rows: readonly string[];
  scale: number;
  palette: SpritePalette;
  label: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Integer cells in DEVICE pixels, so every cell is crisp even at 125% / 150% Windows scaling.
 * CSS size = cells * deviceCell / dpr, which equals cells * scale whenever scale * dpr is whole.
 */
function PixelCanvas({ rows, scale, palette, label, className, style }: PixelCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = useDevicePixelRatio();
  const s = Math.max(1, Math.round(scale));
  const deviceCell = Math.max(1, Math.round(s * dpr));
  const cols = rows[0]?.length ?? SPRITE_W;
  const w = cols * deviceCell;
  const h = rows.length * deviceCell;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sheetFor(rows, palette), 0, 0, w, h);
  }, [rows, palette, w, h]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{
        display: "block",
        width: `${w / dpr}px`,
        height: `${h / dpr}px`,
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}

export interface GetCkoSpriteProps {
  /**
   * pointing (default) and any Pose in POSES: thinking, speaking, wave, listening, reading, success,
   * confused, sleeping, offline, cling, clingSide (27x22), pointRight, pointDownRight, walk1/2,
   * celebrate, plus blink frames. Map product moments with MOMENT_POSE.
   */
  pose?: Pose;
  /** Whole number. 1 = 22x27 CSS px. Use 2 (pointer), 3 (icons), 6 (cards), 12-16 (hero). */
  scale?: number;
  /** Face left. */
  flip?: boolean;
  /** Accessible name. Pass "" when purely decorative: the canvas is then aria-hidden. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  /** Override cell colors (green family only). Defaults to PALETTE. */
  palette?: Partial<SpritePalette>;
}

export function GetCkoSprite({
  pose = "pointing",
  scale = 4,
  flip = false,
  label = "GetcKo",
  className,
  style,
  palette,
}: GetCkoSpriteProps) {
  const rows = buildPose(pose, { flip });
  const pal = usePalette(palette);
  return <PixelCanvas rows={rows} scale={scale} palette={pal} label={label} className={className} style={style} />;
}

export interface GetCkoHeadMarkProps {
  /** Tile size in CSS px. Default 96 (radius 22 at 96, scales with size). */
  size?: number;
  /** ink = dark icon, paper = light icon with a line border. */
  tile?: "ink" | "paper";
  flip?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function GetCkoHeadMark({
  size = 96,
  tile = "ink",
  flip = false,
  label = "GetcKo",
  className,
  style,
}: GetCkoHeadMarkProps) {
  const rows = buildHeadMark({ flip });
  // Head is 22 cells wide; fill about 70% of the tile, whole-number scale only.
  const scale = Math.max(1, Math.floor((size * 0.7) / SPRITE_W));
  const isInk = tile === "ink";
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round((size * 22) / 96),
        background: isInk ? "var(--gc-ink, #0E0F0C)" : "var(--gc-paper, #FFFFFF)",
        border: isInk ? "none" : "1px solid var(--gc-line, #E6E8E3)",
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
        flex: "none",
        ...style,
      }}
    >
      <PixelCanvas rows={rows} scale={scale} palette={PALETTE} label={label} />
    </div>
  );
}

function usePalette(partial?: Partial<SpritePalette>): SpritePalette {
  // Stable identity per distinct palette so the draw effect does not rerun every render.
  const key = partial ? JSON.stringify(partial) : "";
  const ref = useRef<{ key: string; pal: SpritePalette }>({ key: "", pal: PALETTE });
  if (ref.current.key !== key) ref.current = { key, pal: { ...PALETTE, ...partial } };
  return ref.current.pal;
}
