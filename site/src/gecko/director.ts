import { BLINK_OF, PALETTE, SPRITE_H, SPRITE_W, buildPose, type Pose } from "../brand/mascot";
import { haloIn, haloOut } from "../brand/motion";

/**
 * One GetcKo per screen (brand rule 7). The director owns the page's canvas GetcKo: sections
 * register slots, the active slot is picked from scroll position, and moving between slots
 * dissolves the sprite into its cells and re-forms it with the slot's pose from MOMENT_POSE.
 * A `vacant` slot (the hero, which draws its own voxel GetcKo) scatters the canvas sprite away.
 *
 * Drawing happens in device pixels so every sprite cell covers whole device pixels (no smoothing
 * seams at fractional DPR). Idle frames skip the redraw.
 */

type ElGetter = () => HTMLElement | null | undefined;

export interface Slot {
  id: string;
  /** Element sized to 22×27 cells via the CSS var --cell (integer px). Omit for a vacant slot. */
  el?: HTMLElement;
  /** Section whose box decides when this slot is active. */
  section: HTMLElement;
  /** The one element that wears the sun halo while GetcKo points at it. Read lazily. */
  target?: ElGetter;
  pose?: Pose;
  flip?: boolean;
  /** First arrival dissolves this element into GetcKo instead of flying in. Read lazily. */
  source?: ElGetter;
}

interface Particle {
  fx: number; fy: number; fs: number; // from, CSS px (viewport)
  cx: number; cy: number;             // bezier control offset
  tx: number; ty: number;             // target cell (cell units)
  color: string; toColor: string;
  delay: number; dur: number;
  x: number; y: number; s: number;    // last drawn position, CSS px
}

interface Spark {
  x: number; y: number; s: number; vx: number; vy: number; color: string; born: number; life: number;
}

interface FlowParticle {
  fx: number; fy: number; tx: number; ty: number; s: number;
  cx: number; cy: number; color: string; delay: number; dur: number; to: number;
}

interface Flow {
  start: number;
  parts: FlowParticle[];
  targets: HTMLElement[];
  arrived: Set<number>;
  onArrive?: (i: number) => void;
}

const MORPH_COLORS = [PALETTE.G, PALETTE.L, PALETTE.B, PALETTE.K];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

function bez(a: number, c: number, b: number, t: number) {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
}

function cellsOf(rows: readonly string[]) {
  const out: { x: number; y: number; color: string }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as keyof typeof PALETTE;
      if (ch !== "." && PALETTE[ch]) out.push({ x, y, color: PALETTE[ch] });
    }
  });
  return out;
}

/** Targets on ink chrome (session bar, ink surfaces) wear the dark two-ring halo. */
function haloOpts(el: HTMLElement) {
  // The page is light only: light halo (gap 0) unless the target sits on ink chrome.
  return el.closest('[role="toolbar"], .surface--ink, [data-halo="dark"]') ? { gap: 6, width: 4 } : { gap: 0 };
}

class Director {
  private slots = new Map<string, Slot>();
  private cells = new Map<string, number>();
  private active: Slot | null = null;
  private visited = new Set<string>();
  private particles: Particle[] = [];
  private sparks: Spark[] = [];
  private morphStart = 0;
  private morphing = false;
  private dissolving: HTMLElement | null = null;
  private landedAt = 0;
  private lastRect: { x: number; y: number; cell: number } | null = null;
  private lastRows: readonly string[] | null = null;
  private flows: Flow[] = [];
  /** The first morph waits until every hold is released (fonts, hero intro, …). */
  private holds = new Set<string>();
  private instantNext = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private raf = 0;
  private ready = false;
  private litTarget: HTMLElement | null = null;
  private haloTl: { kill(): void } | null = null;
  private poses = new Map<string, Pose>();
  private reduced = false;
  private nextBlink = 0;
  private sceneKey = "";

  get reducedMotion() {
    return this.reduced;
  }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = mq.matches;
    const onMotion = (e: MediaQueryListEvent) => {
      this.reduced = e.matches;
      if (e.matches) this.settle();
    };
    mq.addEventListener("change", onMotion);
    this.resize();
    window.addEventListener("resize", this.resize);
    this.raf = requestAnimationFrame(this.frame);
    return () => {
      cancelAnimationFrame(this.raf);
      mq.removeEventListener("change", onMotion);
      window.removeEventListener("resize", this.resize);
      this.canvas = null;
      this.ctx = null;
    };
  }

  /** Block the first morph until `release(key)`; the intro owns when GetcKo is born. */
  hold(key: string) {
    this.holds.add(key);
    this.ready = false;
  }

  /** `instant` lands the next morph without flight (skipped intro). */
  release(key: string, opts?: { instant?: boolean }) {
    this.holds.delete(key);
    if (opts?.instant) this.instantNext = true;
    this.ready = this.holds.size === 0;
  }

  register(slot: Slot) {
    this.slots.set(slot.id, slot);
    this.cells.delete(slot.id);
    return () => {
      this.slots.delete(slot.id);
      this.cells.delete(slot.id);
      if (this.active?.id === slot.id) this.active = null;
    };
  }

  /** Swap a slot's pose (speaking loop, processing → ready). Instant frame swap, never tweened. */
  setPose(id: string, pose: Pose) {
    this.poses.set(id, pose);
  }

  /** Dissolve `from` into pixels that settle into each of `targets`. */
  flow(from: HTMLElement, targets: HTMLElement[], onArrive?: (i: number) => void) {
    if (this.reduced) {
      targets.forEach((_, i) => onArrive?.(i));
      return;
    }
    const fr = from.getBoundingClientRect();
    const parts: FlowParticle[] = [];
    targets.forEach((t, i) => {
      const tr = t.getBoundingClientRect();
      for (let k = 0; k < 7; k++) {
        const s = 6 + Math.round(Math.random() * 4);
        parts.push({
          fx: fr.left + Math.random() * fr.width,
          fy: fr.top + Math.random() * fr.height,
          tx: 6 + Math.random() * Math.max(0, tr.width - 12 - s),
          ty: 6 + Math.random() * Math.max(0, tr.height - 12 - s),
          s,
          cx: (Math.random() - 0.5) * 120,
          cy: -40 - Math.random() * 80,
          color: MORPH_COLORS[(k + i) % MORPH_COLORS.length],
          delay: i * 45 + Math.random() * 220,
          dur: 650 + Math.random() * 350,
          to: i,
        });
      }
    });
    this.flows.push({ start: performance.now(), parts, targets, arrived: new Set(), onArrive });
  }

  /** Land everything immediately (reduced motion turned on, or the intro was skipped). */
  settle() {
    this.particles = [];
    this.sparks = [];
    this.morphing = false;
    this.landedAt = performance.now();
    this.dissolving?.removeAttribute("data-gc-dissolving");
    this.dissolving = null;
    for (const f of this.flows) f.targets.forEach((_, i) => !f.arrived.has(i) && f.onArrive?.(i));
    this.flows = [];
    this.sceneKey = "";
  }

  private resize = () => {
    const c = this.canvas;
    if (!c) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(window.innerWidth * this.dpr);
    c.height = Math.round(window.innerHeight * this.dpr);
    c.style.width = `${window.innerWidth}px`;
    c.style.height = `${window.innerHeight}px`;
    this.cells.clear();
    this.sceneKey = "";
  };

  private cellOf(s: Slot): number {
    let v = this.cells.get(s.id);
    if (v === undefined) {
      v = s.el ? parseInt(getComputedStyle(s.el).getPropertyValue("--cell"), 10) : 0;
      if (!Number.isFinite(v) || v <= 0) v = 4;
      this.cells.set(s.id, v);
    }
    return v;
  }

  private pickActive(): Slot | null {
    const mid = window.innerHeight * 0.5;
    let best: Slot | null = null;
    let bestDist = Infinity;
    for (const s of this.slots.values()) {
      const r = s.section.getBoundingClientRect();
      if (r.height === 0) continue;
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  private slotGeom(s: Slot) {
    const r = s.el!.getBoundingClientRect();
    const cell = this.cellOf(s);
    // Bottom-center the integer-scaled sprite inside the slot box; snap to device px.
    const d = this.dpr;
    const x = Math.round((r.left + (r.width - SPRITE_W * cell) / 2) * d) / d;
    const y = Math.round((r.bottom - SPRITE_H * cell) * d) / d;
    return { x, y, cell };
  }

  private basePose(s: Slot): Pose {
    return this.poses.get(s.id) ?? s.pose ?? "pointing";
  }

  /** The slot's pose, with the kit's blink frame for ~140 ms every 3–6 s (motion.md). */
  private poseFor(s: Slot, now: number): Pose {
    const pose = this.basePose(s);
    const blink = BLINK_OF[pose];
    if (!blink || this.reduced || now < this.nextBlink) return pose;
    if (now > this.nextBlink + 140) {
      this.nextBlink = now + 3000 + Math.random() * 3000;
      return pose;
    }
    return blink;
  }

  /** The outgoing sprite bursts into its cells, which drift up and fade (leaving for a vacant slot). */
  private scatter(now: number) {
    const g = this.lastRect;
    const rows = this.lastRows;
    if (!g || !rows || this.reduced) return;
    const from = this.morphing ? this.particles.map((p) => ({ x: p.x, y: p.y, s: p.s, color: p.toColor })) : cellsOf(rows).map((c) => ({ x: g.x + c.x * g.cell, y: g.y + c.y * g.cell, s: g.cell, color: c.color }));
    for (const c of from) {
      this.sparks.push({
        x: c.x, y: c.y, s: c.s, color: c.color,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.15 - Math.random() * 0.45,
        born: now + Math.random() * 180,
        life: 520 + Math.random() * 380,
      });
    }
  }

  private beginMorph(to: Slot, now: number) {
    this.setHalo(null);
    this.dissolving?.removeAttribute("data-gc-dissolving");
    this.dissolving = null;

    if (!to.el) {
      this.scatter(now);
      this.particles = [];
      this.morphing = false;
      this.lastRect = null;
      this.lastRows = null;
      return;
    }

    const targetCells = cellsOf(buildPose(this.basePose(to), { flip: to.flip }));
    const first = !this.visited.has(to.id);
    this.visited.add(to.id);

    if (this.reduced || this.instantNext) {
      this.instantNext = false;
      this.particles = [];
      this.morphing = false;
      this.landedAt = now;
      return;
    }

    const vh = window.innerHeight;
    const src = first && to.source ? to.source() : null;
    const sr = src?.getBoundingClientRect() ?? null;
    // An interrupted morph re-targets from where its pixels are right now.
    const inFlight = this.morphing ? this.particles : null;
    const prev = this.lastRect;
    if (src) {
      src.setAttribute("data-gc-dissolving", "on");
      this.dissolving = src;
    }
    this.particles = targetCells.map((c, i) => {
      let fx: number, fy: number, fs: number;
      if (inFlight?.length) {
        const p = inFlight[i % inFlight.length];
        fx = p.x; fy = p.y; fs = p.s;
      } else if (sr) {
        fx = sr.left + Math.random() * sr.width;
        fy = sr.top + Math.random() * sr.height;
        fs = 3 + Math.random() * 4;
      } else if (prev) {
        fx = prev.x + c.x * prev.cell;
        fy = Math.max(-prev.cell * 2, Math.min(vh + prev.cell, prev.y + c.y * prev.cell));
        fs = prev.cell;
      } else {
        // Arriving from the hero: the cells rain in from above the viewport.
        fx = window.innerWidth * (0.25 + Math.random() * 0.5);
        fy = -20 - Math.random() * 120;
        fs = 4;
      }
      return {
        fx, fy, fs,
        // A dissolving source pours in a narrow corridor; section hops arc.
        cx: (Math.random() - 0.5) * (sr ? 60 : 160),
        cy: sr ? Math.random() * 40 : -60 - Math.random() * 90,
        tx: c.x, ty: c.y,
        color: sr || !prev ? MORPH_COLORS[i % MORPH_COLORS.length] : c.color,
        toColor: c.color,
        delay: (c.y / SPRITE_H) * 420 + Math.random() * 260,
        dur: 760 + Math.random() * 420,
        x: fx, y: fy, s: fs,
      };
    });
    this.morphStart = now;
    this.morphing = true;
  }

  /** The kit halo: draw 140 ms, two pulses, hold (motion.md). On ink chrome: paper gap + sun ring. */
  private setHalo(el: HTMLElement | null) {
    if (this.litTarget === el) return;
    const prev = this.litTarget;
    if (prev) {
      this.haloTl?.kill();
      prev.removeAttribute("data-gc-target");
      haloOut(prev, haloOpts(prev));
    }
    this.litTarget = el;
    if (el) {
      el.setAttribute("data-gc-target", "on");
      this.haloTl = haloIn(el, haloOpts(el));
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const ctx = this.ctx;
    if (!ctx || !this.ready) return;

    const next = this.pickActive();
    if (next && next !== this.active) {
      this.active = next;
      this.beginMorph(next, now);
    }
    const s = this.active?.el ? this.active : null;
    const g = s ? this.slotGeom(s) : null;
    const pose = s && !this.morphing ? this.poseFor(s, now) : null;

    const animating = this.morphing || this.flows.length > 0 || this.sparks.length > 0;
    const key = s && g ? `${s.id}|${g.x}|${g.y}|${g.cell}|${pose}|${s.flip}` : "vacant";
    if (!animating && key === this.sceneKey) {
      if (s && now - this.landedAt > 80) this.setHalo(s.target?.() ?? null);
      return;
    }
    this.sceneKey = animating ? "" : key;

    const d = this.dpr;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (s && g) {
      if (this.morphing) {
        let done = true;
        for (const p of this.particles) {
          const t = clamp01((now - this.morphStart - p.delay) / p.dur);
          if (t < 1) done = false;
          const e = easeInOut(t);
          const tx = g.x + p.tx * g.cell;
          const ty = g.y + p.ty * g.cell;
          p.x = bez(p.fx, (p.fx + tx) / 2 + p.cx, tx, e);
          p.y = bez(p.fy, (p.fy + ty) / 2 + p.cy, ty, e);
          p.s = p.fs + (g.cell - p.fs) * e;
          ctx.fillStyle = t > 0.62 ? p.toColor : p.color;
          ctx.fillRect(Math.round(p.x * d), Math.round(p.y * d), Math.ceil(p.s * d), Math.ceil(p.s * d));
        }
        if (done) {
          this.morphing = false;
          this.landedAt = now;
          this.nextBlink = now + 1800;
          this.dissolving?.removeAttribute("data-gc-dissolving");
          this.dissolving = null;
        }
      } else {
        const rows = buildPose(pose ?? "pointing", { flip: s.flip });
        const x0 = Math.round(g.x * d);
        const y0 = Math.round(g.y * d);
        const c = Math.round(g.cell * d);
        for (let y = 0; y < rows.length; y++) {
          const row = rows[y];
          for (let x = 0; x < row.length; x++) {
            const ch = row[x] as keyof typeof PALETTE;
            if (ch === ".") continue;
            ctx.fillStyle = PALETTE[ch];
            ctx.fillRect(x0 + x * c, y0 + y * c, c, c);
          }
        }
        this.lastRows = rows;
        if (now - this.landedAt > 80) this.setHalo(s.target?.() ?? null);
      }
      this.lastRect = g;
      if (this.morphing) this.lastRows = buildPose(this.basePose(s), { flip: s.flip });
    }

    this.drawSparks(ctx, now);
    this.drawFlows(ctx, now);
  };

  private drawSparks(ctx: CanvasRenderingContext2D, now: number) {
    const d = this.dpr;
    this.sparks = this.sparks.filter((p) => {
      const t = (now - p.born) / p.life;
      if (t >= 1) return false;
      const k = Math.max(0, t);
      const dt = Math.max(0, now - p.born);
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = p.color;
      const s = Math.max(1, p.s * (1 - k * 0.6));
      ctx.fillRect(Math.round((p.x + p.vx * dt) * d), Math.round((p.y + p.vy * dt) * d), Math.ceil(s * d), Math.ceil(s * d));
      ctx.globalAlpha = 1;
      return true;
    });
  }

  private drawFlows(ctx: CanvasRenderingContext2D, now: number) {
    const d = this.dpr;
    this.flows = this.flows.filter((f) => {
      const rects = f.targets.map((t) => t.getBoundingClientRect());
      let alive = false;
      const remaining = new Set<number>();
      for (const p of f.parts) {
        const t = clamp01((now - f.start - p.delay) / p.dur);
        if (t >= 1) continue;
        alive = true;
        remaining.add(p.to);
        const e = easeInOut(t);
        const r = rects[p.to];
        const tx = r.left + p.tx;
        const ty = r.top + p.ty;
        const x = bez(p.fx, (p.fx + tx) / 2 + p.cx, tx, e);
        const y = bez(p.fy, (p.fy + ty) / 2 + p.cy, ty, e);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(x * d), Math.round(y * d), Math.round(p.s * d), Math.round(p.s * d));
      }
      f.targets.forEach((_, i) => {
        if (!remaining.has(i) && !f.arrived.has(i)) {
          f.arrived.add(i);
          f.onArrive?.(i);
        }
      });
      return alive;
    });
  }
}

export const director = new Director();
