// GetCko pixel sprite, verbatim from docs/getcko-design-system.md §6.

export const PALETTE: Record<string, string> = {
  K: "#0E0F0C",
  G: "#39D86F",
  L: "#9BF2B6",
  B: "#D6F8E0",
  W: "#FFFFFF",
  P: "#FF9DB0",
  D: "#0E5E2E",
};

export const POINTING: readonly string[] = [
  "......KKKK..KKKK......",
  ".....KWWWWKKWWWWK.....",
  ".....KWKKWKKWKKWK.....",
  ".....KWKKWKKWKKWK.....",
  "....KGWWWWGGWWWWGK....",
  "...KGGGGGGGGGGGGGGK...",
  "...KGLGGGGGGGGGGPGK...",
  "...KGGKGGGGGGGGKGGK...",
  "...KGGGKKKKKKKKGGGK...",
  "....KGGGGGGGGGGGGK..KK",
  ".....KKGGGGGGGGKK..KGK",
  "......KGGGGGGGGK..KGK.",
  "......KGBBBBGGGK.KGK..",
  "......KGBBBBGGGGKGK...",
  ".....KGGBBBBGGGGK.....",
  "....KGKGBBBBGGGK......",
  "...KGK.KGBBBBGGK......",
  "..KGGK.KGBBBBGGK......",
  "..KKK..KGBBBBGGK......",
  ".......KGGBBBGGK......",
  ".KK....KGGGGGGGK......",
  "KGK...KGGGGGGGGGK.....",
  "KGK..KGGGGGGGGGGK.....",
  "KGGKKGGGGGGGGGGK......",
  ".KKKKKKGGK..KGGK......",
  "......KGGGK.KGGGK.....",
  "......KKKKK.KKKKK.....",
];

export const COLS = POINTING[0].length; // 22
export const ROWS = POINTING.length; // 27

export type Pose = "pointing" | "thinking" | "speaking" | "blink";

const OVERRIDES: Record<Exclude<Pose, "pointing">, Record<number, string>> = {
  thinking: {
    2: ".....KKKWWKKKKWWK.....",
    3: ".....KWWWWKKWWWWK.....",
    7: "...KGGGGGGGGGGGGGGK...",
    8: "...KGGGGKKKKKGGGGGK...",
  },
  speaking: {
    8: "...KGGGKDDDDDDKGGGK...",
    9: "....KGGGKKKKKKGGGK..KK",
  },
  // Eyes closed: green lids with an ink seam (site-only idle blink).
  blink: {
    1: ".....KGGGGKKGGGGK.....",
    2: ".....KKKKKKKKKKKK.....",
    3: ".....KGGGGKKGGGGK.....",
  },
};

export function poseRows(pose: Pose, flip = false): string[] {
  const rows = [...POINTING];
  if (pose !== "pointing") {
    for (const [i, row] of Object.entries(OVERRIDES[pose])) rows[Number(i)] = row;
  }
  return flip ? rows.map((r) => [...r].reverse().join("")) : rows;
}

/** Rows 0–10: head mark used for the app icon and menu-bar mark. */
export const HEAD_ROWS = POINTING.slice(0, 11);

export interface Cell {
  x: number;
  y: number;
  color: string;
}

export function cellsOf(rows: readonly string[]): Cell[] {
  const out: Cell[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (color) out.push({ x, y, color });
    }
  });
  return out;
}
