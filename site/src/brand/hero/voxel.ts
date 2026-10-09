// Voxel GetCko: the real sprite map (buildPose) extruded into cubes, one InstancedMesh, one draw call.
// Flat shading baked per face (front 1.0, top, sides, bottom darker): hard edges, no lights, no
// env map, no bloom, no gradients. Front faces show the exact PALETTE colors (MeshBasicMaterial).
// Loaded with a dynamic import by GetCkoHero, so three.js stays out of the main chunk.

import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type IUniform,
} from "three";
import { PALETTE, SPRITE_H, SPRITE_W, buildPose, type CellKey, type Pose } from "../mascot/sprites";

/** Extrusion depth per cell kind, in cells. Outline sits back; belly, eyes and highlight stand out. */
const DEPTH: Record<Exclude<CellKey, ".">, number> = {
  K: 1.2,
  G: 2.0,
  L: 2.4,
  B: 2.4,
  W: 2.6,
  P: 2.2,
  D: 1.4,
};

/** Face shade, BoxGeometry face order: +x, -x, +y, -y, +z (front), -z. */
const FACE_SHADE = [0.62, 0.62, 0.84, 0.48, 1.0, 0.4];

/** Sprite colors from the theme tokens (--gc-sprite-*), PALETTE as the fallback. Same in both themes. */
const SPRITE_VAR: Record<Exclude<CellKey, ".">, string> = {
  K: "--gc-sprite-outline",
  G: "--gc-sprite-body",
  L: "--gc-sprite-highlight",
  B: "--gc-sprite-belly",
  W: "--gc-sprite-eye",
  P: "--gc-sprite-cheek",
  D: "--gc-sprite-mouth",
};

export interface VoxelTheme {
  /** Read from the element's computed style (CSS variables). */
  from: Element;
  dark: boolean;
}

export interface VoxelFrame {
  /** Sprite box top-left in stage px. */
  x: number;
  y: number;
  pose: Pose;
  flip: boolean;
  yaw: number;
  cell: number;
}

export interface VoxelGecko {
  /** Apply a frame (pose swap rebuilds instances only when the pose or flip changes). Call render() after. */
  set(frame: VoxelFrame): void;
  /** Re-read colors from CSS variables (theme change). */
  recolor(theme: VoxelTheme): void;
  /** Stage size in CSS px and device pixel ratio (capped at 2 by the caller). */
  resize(w: number, h: number, dpr: number): void;
  render(): void;
  dispose(): void;
}

/** True when a WebGL context can be created. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function readColor(el: Element, cssVar: string, fallback: string): Color {
  let v = "";
  try {
    v = getComputedStyle(el).getPropertyValue(cssVar).trim();
  } catch {
    v = "";
  }
  const c = new Color();
  try {
    c.setStyle(v || fallback);
  } catch {
    c.setStyle(fallback);
  }
  return c;
}

/** Throws if WebGL is unavailable; the caller falls back to the 2D sprite. */
export function createVoxelGecko(canvas: HTMLCanvasElement, theme: VoxelTheme): VoxelGecko {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  // Orthographic, stage px units, y down (top = 0). Depth range covers the turned body.
  const camera = new OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  camera.position.set(0, 0, 1000);

  // Unit cube with per-face shade in a color attribute, and a side flag for the dark-theme rim.
  const geo = new BoxGeometry(1, 1, 1);
  const shade: number[] = [];
  const side: number[] = [];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      shade.push(FACE_SHADE[f], FACE_SHADE[f], FACE_SHADE[f]);
      side.push(f === 4 ? 0 : 1);
    }
  geo.setAttribute("color", new Float32BufferAttribute(shade, 3));
  geo.setAttribute("aSide", new Float32BufferAttribute(side, 1));

  const uniforms: Record<string, IUniform> = {
    uRim: { value: new Color(0, 0, 0) },
    uRimMix: { value: 0 },
  };
  const mat = new MeshBasicMaterial({ vertexColors: true });
  // Dark theme: the ink outline's extruded sides take a night-line tone so the silhouette reads on
  // night. Front faces never change: the sprite palette is the same in both themes.
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSide;\nuniform vec3 uRim;\nuniform float uRimMix;")
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  float gcInk = step(dot(instanceColor.rgb, vec3(0.3333)), 0.02);
  vColor.rgb = mix(vColor.rgb, uRim * color.rgb, gcInk * aSide * uRimMix);
#endif`,
      );
  };

  const MAX = SPRITE_W * SPRITE_H;
  const mesh = new InstancedMesh(geo, mat, MAX);
  mesh.count = 0;
  mesh.frustumCulled = false;
  // Allocate the color buffer up front.
  mesh.setColorAt(0, new Color(0, 0, 0));

  const body = new Group(); // turned (yaw/pitch) around the sprite's center
  const holder = new Group(); // placed in stage px
  body.add(mesh);
  holder.add(body);
  scene.add(holder);

  const colors = new Map<string, Color>();
  const m4 = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const sc = new Vector3();
  let key = "";
  let rows: readonly string[] = [];
  let cell = 10;
  let w = 1;
  let h = 1;

  function build() {
    let i = 0;
    const W = rows[0]?.length ?? SPRITE_W;
    const H = rows.length;
    for (let r = 0; r < H; r++)
      for (let c = 0; c < W; c++) {
        const k = rows[r][c] as CellKey;
        if (k === "." || !(k in DEPTH)) continue;
        const d = DEPTH[k as Exclude<CellKey, ".">];
        // Cell center, sprite centered on the origin, y up; extrusion grows toward the camera.
        v.set(c - W / 2 + 0.5, H / 2 - r - 0.5, d / 2);
        sc.set(1, 1, d);
        m4.compose(v, q.identity(), sc);
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, colors.get(k) ?? new Color(PALETTE[k]));
        i++;
      }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  const api: VoxelGecko = {
    set(f) {
      const k = `${f.pose}:${f.flip ? 1 : 0}`;
      cell = f.cell;
      if (k !== key) {
        key = k;
        rows = buildPose(f.pose, { flip: f.flip });
        build();
      }
      const W = rows[0]?.length ?? SPRITE_W;
      const H = rows.length;
      body.scale.set(cell, cell, cell);
      // Turn toward the target (flip = facing left), with a slight downward look at the top face.
      const yaw = ((f.flip ? -1 : 1) * f.yaw * Math.PI) / 180;
      body.rotation.set(0.2, yaw, 0, "YXZ");
      // Keep the leading edge (the pointing hand) where placeBeside put it: the turn narrows the
      // body by (1 - cos yaw), so slide the center toward the target by half of that.
      const shrink = ((1 - Math.cos(yaw)) * W * cell) / 2;
      holder.position.set(f.x + (W * cell) / 2 + (f.flip ? -shrink : shrink), -(f.y + (H * cell) / 2), 0);
    },
    recolor(t) {
      for (const k of Object.keys(SPRITE_VAR) as Exclude<CellKey, ".">[]) {
        colors.set(k, readColor(t.from, SPRITE_VAR[k], PALETTE[k]));
      }
      (uniforms.uRim.value as Color).copy(readColor(t.from, "--gc-night-line-strong", "#474c41"));
      uniforms.uRimMix.value = t.dark ? 1 : 0;
      if (rows.length) build();
    },
    resize(nw, nh, dpr) {
      w = Math.max(1, nw);
      h = Math.max(1, nh);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.left = 0;
      camera.right = w;
      camera.top = 0;
      camera.bottom = -h;
      camera.updateProjectionMatrix();
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  api.recolor(theme);
  return api;
}
