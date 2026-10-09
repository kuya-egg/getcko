import type { GeckoPose } from "../types";

export const SPRITE_COLS = 22;
export const SPRITE_ROWS = 27;

/** Design system §6 palette; `.` is transparent. */
export const SPRITE_PALETTE: Readonly<Record<string, string>> = {
  K: "#0E0F0C",
  G: "#39D86F",
  L: "#9BF2B6",
  B: "#D6F8E0",
  W: "#FFFFFF",
  P: "#FF9DB0",
  D: "#0E5E2E",
};

/** Pointing pose, faces right (design system §6). */
const BASE: readonly string[] = [
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

const OVERRIDES: Readonly<Record<GeckoPose, Readonly<Record<number, string>>>> = {
  idle: {},
  pointing: {},
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
};

export function spriteRows(pose: GeckoPose): string[] {
  const overrides = OVERRIDES[pose];
  return BASE.map((row, i) => overrides[i] ?? row);
}

export function flipRows(rows: readonly string[]): string[] {
  return rows.map((row) => [...row].reverse().join(""));
}
