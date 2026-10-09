// GetcKo pixel sprite data. Source of truth: docs/getcko-design-system.md section 10,
// extended pose library documented in docs/brand/mascot-poses.md.
// 22 x 27 cells, faces right by default. Flip (mirror) handles facing left.
//
// Two kinds of poses:
// - Detail frames of the base map (POSE_OVERRIDES): whole rows replaced, silhouette never changes,
//   so frame swaps (blink, mouth, breathe) never shift the outline.
// - Full maps (POSE_MAPS): a deliberate new silhouette per product moment. Same head, same palette,
//   same 22 x 27 canvas, head in the same place (except sleeping, which slumps 4 rows).
// - Derived frames (POSE_DERIVED): blink frames of full maps, and the rotated cling.

export const SPRITE_W = 22;
export const SPRITE_H = 27;

/** Cell key -> color. Fixed hex (same in both themes), mirrors --gc-sprite-* in tokens.css. */
export const PALETTE = {
  ".": "transparent",
  K: "#0E0F0C", // ink outline
  G: "#39D86F", // body (gecko)
  L: "#9BF2B6", // highlight
  B: "#D6F8E0", // belly
  W: "#FFFFFF", // eye white (also paper props: page, plug)
  P: "#FF9DB0", // cheek
  D: "#0E5E2E", // open mouth (speaking)
} as const;

export type CellKey = keyof typeof PALETTE;
export type SpritePalette = Record<CellKey, string>;

/**
 * Base map: pointing (also used for idle). As in the design system, with the outline closed at
 * three cells (row 14 col 17 under the pointing arm, row 24 cols 10-11 between the legs).
 */
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
  ".....KGGBBBBGGGGKK....",
  "....KGKGBBBBGGGK......",
  "...KGK.KGBBBBGGK......",
  "..KGGK.KGBBBBGGK......",
  "..KKK..KGBBBBGGK......",
  ".......KGGBBBGGK......",
  ".KK....KGGGGGGGK......",
  "KGK...KGGGGGGGGGK.....",
  "KGK..KGGGGGGGGGGK.....",
  "KGGKKGGGGGGGGGGK......",
  ".KKKKKKGGKKKKGGK......",
  "......KGGGK.KGGGK.....",
  "......KKKKK.KKKKK.....",
];

/** Row overrides of the base map by 0-based index. */
export const POSE_OVERRIDES = {
  pointing: {},
  idle: {},
  // From the design system: eyes up-left, flat mouth.
  thinking: {
    2: ".....KKKWWKKKKWWK.....",
    3: ".....KWWWWKKWWWWK.....",
    7: "...KGGGGGGGGGGGGGGK...",
    8: "...KGGGGKKKKKGGGGGK...",
  },
  // From the design system: open mouth.
  speaking: {
    8: "...KGGGKDDDDDDKGGGK...",
    9: "....KGGGKKKKKKGGGK..KK",
  },
  // v0.2: eyes closed (lids in body green, lash line in ink). Same silhouette.
  blink: {
    1: ".....KGGGGKKGGGGK.....",
    2: ".....KGGGGKKGGGGK.....",
    3: ".....KKKKKKKKKKKK.....",
    4: "....KGGGGGGGGGGGGK....",
  },
  // v0.2: idle breathe, frame B. Belly widens one cell (inhale). Same silhouette.
  breathe: {
    12: "......KGBBBBBGGK.KGK..",
    13: "......KGBBBBBGGGKGK...",
    14: ".....KGGBBBBBGGGKK....",
    15: "....KGKGBBBBBGGK......",
    16: "...KGK.KGBBBBBGK......",
    17: "..KGGK.KGBBBBBGK......",
    18: "..KKK..KGBBBBBGK......",
  },
} as const satisfies Record<string, Readonly<Record<number, string>>>;

// ---------------------------------------------------------------------------
// Full maps. Each is one product moment; see MOMENT_POSE in ./moments.ts.

export const POSE_MAPS = {
  /** Onboarding welcome, frame A: hand up, palm open, happy eyes, open smile. */
  wave: [
    "......KKKK..KKKK......",
    ".....KGGGGKKGGGGK..KK.",
    ".....KGGGGKKGGGGK.KGGK",
    ".....KGKKGKKGKKGK.KGGK",
    "....KGKGGKGGKGGKGK.KGK",
    "...KGGGGGGGGGGGGGGKKGK",
    "...KGLGGGGGGGGGGPGKKGK",
    "...KGGKGGGGGGGGKGGKKGK",
    "...KGGGKDDDDDDKGGGKKGK",
    "....KGGGKKKKKKGGGK.KGK",
    ".....KKGGGGGGGGKK..KGK",
    "......KGGGGGGGGK..KGK.",
    "......KGBBBBGGGK.KGK..",
    "......KGBBBBGGGGKGK...",
    ".....KGGBBBBGGGGKK....",
    "....KGKGBBBBGGGK......",
    "...KGK.KGBBBBGGK......",
    "..KGGK.KGBBBBGGK......",
    "..KKK..KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Wave frame B: wrist bends in, palm one cell left and up. Alternate with wave at ~4 fps. */
  wave2: [
    "......KKKK..KKKK..KK..",
    ".....KGGGGKKGGGGKKGGK.",
    ".....KGGGGKKGGGGKKGGK.",
    ".....KGKKGKKGKKGK.KGK.",
    "....KGKGGKGGKGGKGK.KGK",
    "...KGGGGGGGGGGGGGGKKGK",
    "...KGLGGGGGGGGGGPGKKGK",
    "...KGGKGGGGGGGGKGGKKGK",
    "...KGGGKDDDDDDKGGGKKGK",
    "....KGGGKKKKKKGGGK.KGK",
    ".....KKGGGGGGGGKK..KGK",
    "......KGGGGGGGGK..KGK.",
    "......KGBBBBGGGK.KGK..",
    "......KGBBBBGGGGKGK...",
    ".....KGGBBBBGGGGKK....",
    "....KGKGBBBBGGGK......",
    "...KGK.KGBBBBGGK......",
    "..KGGK.KGBBBBGGK......",
    "..KKK..KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Push-to-talk active: hand cupped at the side of the head, eyes wide, small mouth. */
  listening: [
    "......KKKK..KKKK..K...",
    ".....KWWWWKKWWWWK..K.K",
    ".....KWWKWKKWWKWK..K.K",
    ".....KWWKWKKWWKWK.K..K",
    "....KGWWWWGGWWWWGK..K.",
    "...KGGGGGGGGGGGGGGKKK.",
    "...KGLGGGGGGGGGGPGKGGK",
    "...KGGGGGGGGGGGGGGKGGK",
    "...KGGGGGKKKKGGGGGKGK.",
    "....KGGGGGGGGGGGGKKGK.",
    ".....KKGGGGGGGGKK.KGK.",
    "......KGGGGGGGGK..KGK.",
    "......KGBBBBGGGK.KGK..",
    "......KGBBBBGGGGKGK...",
    ".....KGGBBBBGGGGKK....",
    "....KGKGBBBBGGGK......",
    "...KGK.KGBBBBGGK......",
    "..KGGK.KGBBBBGGK......",
    "..KKK..KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Knowledge base import / processing: holds a page in both hands, eyes down on it. */
  reading: [
    "......KKKK..KKKK......",
    ".....KWWWWKKWWWWK.....",
    ".....KWWWWKKWWWWK.....",
    ".....KWKKWKKWKKWK.....",
    "....KGWKKWGGWKKWGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGGGGGGGGGGGGGK...",
    "...KGGGGGKKKKGGGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    ".....KKKKKKKKKKKK.....",
    ".....KWWWWWWWWWWK.....",
    "....KKWKKKKKKKWWKK....",
    "...KGKWWWWWWWWWWKGK...",
    "...KGKWKKKKKKKKWKGK...",
    "...KGKWWWWWWWWWWKGK...",
    "....KKWKKKKKWWWWKK....",
    ".....KWWWWWWWWWWK.....",
    ".....KKKKKKKKKKKK.....",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Ready / found it: thumbs up, happy eyes, open smile. */
  success: [
    "......KKKK..KKKK......",
    ".....KGGGGKKGGGGK.....",
    ".....KGGGGKKGGGGK.....",
    ".....KGKKGKKGKKGK.....",
    "....KGKGGKGGKGGKGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGKGGGGGGGGKGGKKK.",
    "...KGGGKDDDDDDKGGGKGGK",
    "....KGGGKKKKKKGGGKKGGK",
    ".....KKGGGGGGGGKKKGGGK",
    "......KGGGGGGGGK.KGGGK",
    "......KGBBBBGGGKKKGGGK",
    "......KGBBBBGGGGGKKKK.",
    ".....KGGBBBBGGGGKK....",
    "....KGKGBBBBGGGK......",
    "...KGK.KGBBBBGGK......",
    "..KGGK.KGBBBBGGK......",
    "..KKK..KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** "Hindi ko alam" / failed / no source: friendly shrug, one eye squints, wavy mouth, a "?". */
  confused: [
    "......KKKK..KKKK...KKK",
    ".....KWKKWKKGGGGK....K",
    ".....KWKKWKKKKKKK...KK",
    ".....KWWWWKKWKKWK...K.",
    "....KGWWWWGGWWWWGK....",
    "...KGGGGGGGGGGGGGGK.K.",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGGGGKKGGKKGGGK...",
    "...KGGGKKGGKKGGGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    "KK....KGGGGGGGGK....KK",
    "KGK...KGBBBBGGGK...KGK",
    "KGKKKKKGBBBBGGGKKKKKGK",
    "KGGGGGGGBBBBGGGGGGGGGK",
    ".KKKKKKGBBBBGGGKKKKKK.",
    ".......KGBBBBGGK......",
    ".......KGBBBBGGK......",
    ".......KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** App idle / paused, frame A: slumped sit, eyes shut, small z. Head is 4 rows lower. */
  sleeping: [
    "......................",
    ".................KKK..",
    "..................K...",
    ".................KKK..",
    "......KKKK..KKKK......",
    ".....KGGGGKKGGGGK.....",
    ".....KGGGGKKGGGGK.....",
    ".....KKKKKKKKKKKK.....",
    "....KGGGGGGGGGGGGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGGGGGGGGGGGGGK...",
    "...KGGGGGKKKKGGGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    "......KGBBBBBBGK......",
    ".....KGGBBBBBBGGK.....",
    "....KGKGBBBBBBGKGK....",
    "....KGKGBBBBBBGKGK....",
    "...KGGKGBBBBBBGKGGK...",
    "...KGKKGGBBBBGGKKGK...",
    "...KGGGGGGGGGGGGGGK.K.",
    "..KGGKKGGGGGGGGKKGGKGK",
    "..KGGGGKKKKKKKKGGGGKGK",
    "...KKKKGGGGGGGGGGGGGGK",
    "......KKKKKKKKKKKKKKK.",
    "......................",
  ],
  /** Sleeping frame B: the big Z replaces the small z. Alternate slowly (1.2 s per frame). */
  sleeping2: [
    "..................KKKK",
    "....................K.",
    "...................K..",
    "..................KKKK",
    "......KKKK..KKKK......",
    ".....KGGGGKKGGGGK.....",
    ".....KGGGGKKGGGGK.....",
    ".....KKKKKKKKKKKK.....",
    "....KGGGGGGGGGGGGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGGGGGGGGGGGGGK...",
    "...KGGGGGKKKKGGGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    "......KGBBBBBBGK......",
    ".....KGGBBBBBBGGK.....",
    "....KGKGBBBBBBGKGK....",
    "....KGKGBBBBBBGKGK....",
    "...KGGKGBBBBBBGKGGK...",
    "...KGKKGGBBBBGGKKGK...",
    "...KGGGGGGGGGGGGGGK.K.",
    "..KGGKKGGGGGGGGKKGGKGK",
    "..KGGGGKKKKKKKKGGGGKGK",
    "...KKKKGGGGGGGGGGGGGGK",
    "......KKKKKKKKKKKKKKK.",
    "......................",
  ],
  /** Offline: holds an unplugged plug (two prongs, loose cord) and looks at it. */
  offline: [
    "......KKKK..KKKK......",
    ".....KWWWWKKWWWWK.....",
    ".....KWWWWKKWWWWK.....",
    ".....KWKKWKKWKKWK.....",
    "....KGWKKWGGWKKWGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGGGGGGGGGGGGGK...",
    "...KGGGGGGKKGGGGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.K.K.",
    "......KGGGGGGGGK..K.K.",
    "......KGBBBBGGGK.KKKKK",
    "......KGBBBBGGGGKKWWWK",
    ".....KGGBBBBGGGGGGWWWK",
    "....KGKGBBBBGGGKKKKKKK",
    "...KGK.KGBBBBGGK...K..",
    "..KGGK.KGBBBBGGK...K..",
    "..KKK..KGBBBBGGK....K.",
    ".......KGGBBBGGK....K.",
    ".KK....KGGGGGGGK...K..",
    "KGK...KGGGGGGGGGK..K..",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Empty states, panel edges: belly-to-glass, limbs splayed, tail down. Head up. */
  cling: [
    "......KKKK..KKKK......",
    ".....KWWWWKKWWWWK.....",
    ".....KWKKWKKWKKWK.....",
    ".....KWKKWKKWKKWK.....",
    "....KGWWWWGGWWWWGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGKGGGGGGGGKGGK...",
    "...KGGGKKKKKKKKGGGK...",
    ".KK.KGGGGGGGGGGGGK.KK.",
    "KGGK.KKGGGGGGGGKK.KGGK",
    "KGGGK.KGGGGGGGGK.KGGGK",
    ".KKGGKKGBBBBBBGKKGGKK.",
    "...KGGGGBBBBBBGGGGK...",
    "....KKGGBBBBBBGGKK....",
    "......KGBBBBBBGK......",
    "......KGBBBBBBGK......",
    "......KGBBBBBBGK......",
    ".....KGGBBBBBBGGK.....",
    "...KKGGGGBBBBGGGGKK...",
    "..KGGGKKGGGGGGKKGGGK..",
    ".KGGKK.KGGGGGGK.KKGGK.",
    "KGGK....KGGGGK....KGGK",
    "KKK......KGGK......KKK",
    "..........KGK.........",
    "...........KGK........",
    "............KK........",
  ],
  /** Screen Help, target straight right of the gecko: arm level at chest height. */
  pointRight: [
    "......KKKK..KKKK......",
    ".....KWWWWKKWWWWK.....",
    ".....KWKKWKKWKKWK.....",
    ".....KWKKWKKWKKWK.....",
    "....KGWWWWGGWWWWGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGKGGGGGGGGKGGK...",
    "...KGGGKKKKKKKKGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    "......KGGGGGGGGK......",
    "......KGBBBBGGGKKKKKK.",
    "......KGBBBBGGGGGGGGGK",
    ".....KGGBBBBGGGGKKKKK.",
    "....KGKGBBBBGGGK......",
    "...KGK.KGBBBBGGK......",
    "..KGGK.KGBBBBGGK......",
    "..KKK..KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Screen Help, target below-right: arm angled down. */
  pointDownRight: [
    "......KKKK..KKKK......",
    ".....KWWWWKKWWWWK.....",
    ".....KWKKWKKWKKWK.....",
    ".....KWKKWKKWKKWK.....",
    "....KGWWWWGGWWWWGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGKGGGGGGGGKGGK...",
    "...KGGGKKKKKKKKGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    "......KGGGGGGGGK......",
    "......KGBBBBGGGKKK....",
    "......KGBBBBGGGGGGK...",
    ".....KGGBBBBGGGGKKGK..",
    "....KGKGBBBBGGGK..KGK.",
    "...KGK.KGBBBBGGK...KGK",
    "..KGGK.KGBBBBGGK....KK",
    "..KKK..KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Hop between targets, frame A: left arm out, left foot up, tail up. */
  walk1: [
    "......KKKK..KKKK......",
    ".....KWWWWKKWWWWK.....",
    ".....KWKKWKKWKKWK.....",
    ".....KWKKWKKWKKWK.....",
    "....KGWWWWGGWWWWGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGKGGGGGGGGKGGK...",
    "...KGGGKKKKKKKKGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    "......KGGGGGGGGK......",
    "......KGBBBBGGGK......",
    "......KGBBBBGGGGK.....",
    ".....KGGBBBBGGGGGK....",
    "....KGKGBBBBGGGKGK....",
    "...KGK.KGBBBBGGKGK....",
    "..KGGK.KGBBBBGGKGGK...",
    "..KKK..KGBBBBGGKKKK...",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKGGGGKKKGGK......",
    ".....KKKKKK.KGGGK.....",
    "............KKKKK.....",
  ],
  /** Hop frame B: right arm out, right foot up, tail tucked. */
  walk2: [
    "......KKKK..KKKK......",
    ".....KWWWWKKWWWWK.....",
    ".....KWKKWKKWKKWK.....",
    ".....KWKKWKKWKKWK.....",
    "....KGWWWWGGWWWWGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGKGGGGGGGGKGGK...",
    "...KGGGKKKKKKKKGGGK...",
    "....KGGGGGGGGGGGGK....",
    ".....KKGGGGGGGGKK.....",
    "......KGGGGGGGGK......",
    "......KGBBBBGGGK......",
    "......KGBBBBGGGGK.....",
    ".....KGGBBBBGGGGGK....",
    "....KGKGBBBBGGGKGK....",
    "....KGKKGBBBBGGKGKK...",
    "....KGGKGBBBBGGKKGGK..",
    "....KKKKGBBBBGGK.KKK..",
    ".......KGGBBBGGK......",
    ".......KGGGGGGGK......",
    "......KGGGGGGGGGK.....",
    ".KK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGGK.....",
    "......KGGGKKKKKK......",
    "......KKKKK...........",
  ],
  /** Demo end card, frame A: both hands up, happy eyes, open smile. */
  celebrate: [
    "......KKKK..KKKK......",
    ".KK..KGGGGKKGGGGK..KK.",
    "KGGK.KGGGGKKGGGGK.KGGK",
    "KGGK.KGKKGKKGKKGK.KGGK",
    "KGK.KGKGGKGGKGGKGK.KGK",
    "KGKKGGGGGGGGGGGGGGKKGK",
    "KGKKGLGGGGGGGGGGPGKKGK",
    "KGKKGGKGGGGGGGGKGGKKGK",
    "KGKKGGGKDDDDDDKGGGKKGK",
    "KGK.KGGGKKKKKKGGGK.KGK",
    "KGK..KKGGGGGGGGKK..KGK",
    ".KGK..KGGGGGGGGK..KGK.",
    "..KGK.KGBBBBGGGK.KGK..",
    "...KGKKGBBBBGGGGKGK...",
    "....KKGGBBBBGGGGKK....",
    "......KGBBBBGGGK......",
    ".......KGBBBBGGK......",
    ".......KGBBBBGGK......",
    ".......KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
  /** Celebrate frame B: arms drop to a V. Alternate with celebrate at ~4 fps for a cheer. */
  celebrate2: [
    "......KKKK..KKKK......",
    ".....KGGGGKKGGGGK.....",
    ".....KGGGGKKGGGGK.....",
    ".....KGKKGKKGKKGK.....",
    "....KGKGGKGGKGGKGK....",
    "...KGGGGGGGGGGGGGGK...",
    "...KGLGGGGGGGGGGPGK...",
    "...KGGKGGGGGGGGKGGK...",
    "...KGGGKDDDDDDKGGGK...",
    "KK..KGGGKKKKKKGGGK..KK",
    "KGK..KKGGGGGGGGKK..KGK",
    ".KGK..KGGGGGGGGK..KGK.",
    "..KGK.KGBBBBGGGK.KGK..",
    "...KGKKGBBBBGGGGKGK...",
    "....KKGGBBBBGGGGKK....",
    "......KGBBBBGGGK......",
    ".......KGBBBBGGK......",
    ".......KGBBBBGGK......",
    ".......KGBBBBGGK......",
    ".......KGGBBBGGK......",
    ".KK....KGGGGGGGK......",
    "KGK...KGGGGGGGGGK.....",
    "KGK..KGGGGGGGGGGK.....",
    "KGGKKGGGGGGGGGGK......",
    ".KKKKKKGGKKKKGGK......",
    "......KGGGK.KGGGK.....",
    "......KKKKK.KKKKK.....",
  ],
} as const satisfies Record<string, readonly string[]>;

/** Closed-eye rows for cols 0-17 of rows 1-4 (cols 18+ keep props such as hands and the "?"). */
const BLINK_EYES = [
  ".....KGGGGKKGGGGK.",
  ".....KGGGGKKGGGGK.",
  ".....KKKKKKKKKKKK.",
  "....KGGGGGGGGGGGGK",
] as const;

type MapPose = keyof typeof POSE_MAPS;

/** Frames derived from another pose: a blink (same silhouette) or a 90 degree rotation. */
export const POSE_DERIVED = {
  listeningBlink: { from: "listening", op: "blink" },
  readingBlink: { from: "reading", op: "blink" },
  confusedBlink: { from: "confused", op: "blink" },
  offlineBlink: { from: "offline", op: "blink" },
  clingBlink: { from: "cling", op: "blink" },
  pointRightBlink: { from: "pointRight", op: "blink" },
  pointDownRightBlink: { from: "pointDownRight", op: "blink" },
  walkBlink: { from: "walk1", op: "blink" },
  /**
   * Cling turned 90 degrees clockwise: head points right, 27 x 22 cells. For horizontal edges
   * (top or bottom of a panel); flip for head-left. The only sanctioned rotation of GetcKo.
   */
  clingSide: { from: "cling", op: "rotate" },
} as const satisfies Record<string, { from: MapPose; op: "blink" | "rotate" }>;

export type Pose = keyof typeof POSE_OVERRIDES | MapPose | keyof typeof POSE_DERIVED;

/** Every pose, in library order. */
export const POSES = [
  ...Object.keys(POSE_OVERRIDES),
  ...Object.keys(POSE_MAPS),
  ...Object.keys(POSE_DERIVED),
] as Pose[];

/** Blink frame for a pose, when its eyes are open and visible. Swap in for ~120 ms every 3-6 s. */
export const BLINK_OF: Partial<Record<Pose, Pose>> = {
  pointing: "blink",
  idle: "blink",
  breathe: "blink",
  listening: "listeningBlink",
  reading: "readingBlink",
  confused: "confusedBlink",
  offline: "offlineBlink",
  cling: "clingBlink",
  pointRight: "pointRightBlink",
  pointDownRight: "pointDownRightBlink",
  walk1: "walkBlink",
};

/** Multi-frame loops: [pose, seconds] pairs, ready for frameLoop() in ../motion. */
export const POSE_CYCLES = {
  wave: [["wave", 0.24], ["wave2", 0.24]],
  walk: [["walk1", 0.16], ["walk2", 0.16]],
  sleep: [["sleeping", 1.2], ["sleeping2", 1.2]],
  celebrate: [["celebrate", 0.22], ["celebrate2", 0.22]],
  idle: [["pointing", 1.6], ["breathe", 1.6]],
} as const satisfies Record<string, ReadonlyArray<readonly [Pose, number]>>;

/** Head mark / app icon: rows 0-10 of the base map. */
export const HEAD_ROWS = 11;

export interface BuildPoseOptions {
  /** Face left (mirror every row). */
  flip?: boolean;
}

const cache = new Map<string, readonly string[]>();

function isOverride(p: Pose): p is keyof typeof POSE_OVERRIDES {
  return p in POSE_OVERRIDES;
}
function isMap(p: Pose): p is MapPose {
  return p in POSE_MAPS;
}

function rawRows(pose: Pose): string[] {
  if (isOverride(pose)) {
    const over = POSE_OVERRIDES[pose] as Readonly<Record<number, string>>;
    return POINTING.map((r, i) => over[i] ?? r);
  }
  if (isMap(pose)) return [...POSE_MAPS[pose]];
  const d = POSE_DERIVED[pose as keyof typeof POSE_DERIVED];
  if (!d) return [...POINTING];
  const src: string[] = [...POSE_MAPS[d.from]];
  if (d.op === "blink") {
    for (let i = 0; i < BLINK_EYES.length; i++) src[i + 1] = BLINK_EYES[i] + src[i + 1].slice(BLINK_EYES[i].length);
    return src;
  }
  // rotate 90 degrees clockwise: new[y][x] = old[H - 1 - x][y]
  const h = src.length;
  const w = src[0].length;
  const out: string[] = [];
  for (let y = 0; y < w; y++) {
    let row = "";
    for (let x = 0; x < h; x++) row += src[h - 1 - x][y];
    out.push(row);
  }
  return out;
}

/**
 * Returns the row strings for a pose (22 x 27 for every pose except clingSide, 27 x 22).
 * Cached and frozen; do not mutate. Unknown poses fall back to pointing.
 */
export function buildPose(pose: Pose = "pointing", { flip = false }: BuildPoseOptions = {}): readonly string[] {
  const key = `${pose}:${flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let rows = rawRows(pose);
  if (flip) rows = rows.map((r) => [...r].reverse().join(""));
  const frozen = Object.freeze(rows);
  cache.set(key, frozen);
  return frozen;
}

/** Cell size of a pose: { w, h }. Every pose is 22 x 27 except clingSide (27 x 22). */
export function poseSize(pose: Pose = "pointing"): { w: number; h: number } {
  const rows = buildPose(pose);
  return { w: rows[0]?.length ?? SPRITE_W, h: rows.length };
}

/** Rows 0-10 for the head mark. */
export function buildHeadMark({ flip = false }: BuildPoseOptions = {}): readonly string[] {
  const key = `head:${flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = Object.freeze(buildPose("pointing", { flip }).slice(0, HEAD_ROWS));
  cache.set(key, rows);
  return rows;
}

/** Hand-tip cell (facing right) of every pose that points. */
export const POSE_TIP: Partial<Record<Pose, { col: number; row: number }>> = {
  pointing: { col: 21, row: 9 },
  idle: { col: 21, row: 9 },
  thinking: { col: 21, row: 9 },
  speaking: { col: 21, row: 9 },
  blink: { col: 21, row: 9 },
  breathe: { col: 21, row: 9 },
  pointRight: { col: 21, row: 13 },
  pointRightBlink: { col: 21, row: 13 },
  pointDownRight: { col: 21, row: 17 },
  pointDownRightBlink: { col: 21, row: 17 },
};

/** Which pointing pose to use for a target direction (gecko faces right; flip for left). */
export function pointPoseFor(direction: "upRight" | "right" | "downRight"): Pose {
  return direction === "right" ? "pointRight" : direction === "downRight" ? "pointDownRight" : "pointing";
}

/**
 * Where the pointing hand tip sits, in cells, for the facing direction.
 * Use it to aim the sprite: place this cell beside the target.
 * `pose` defaults to the up-right pointing pose; non-pointing poses return the up-right tip.
 */
export function handTip(flip = false, pose: Pose = "pointing"): { col: number; row: number } {
  const tip = POSE_TIP[pose] ?? POSE_TIP.pointing!;
  const w = poseSize(pose).w;
  return { col: flip ? w - 1 - tip.col : tip.col, row: tip.row };
}

/**
 * Dev check: every pose is rectangular, uses palette keys only, detail frames keep their
 * parent's silhouette, and every colored cell is closed by ink. Returns problems found.
 */
export function validateSprites(): string[] {
  const problems: string[] = [];
  const mask = (rows: readonly string[]) => rows.map((r) => r.replace(/[^.]/g, "#")).join("\n");
  const base = mask(POINTING);
  for (const p of POSES) {
    const rows = buildPose(p);
    const w = rows[0]?.length ?? 0;
    const expectH = p === "clingSide" ? SPRITE_W : SPRITE_H;
    const expectW = p === "clingSide" ? SPRITE_H : SPRITE_W;
    if (rows.length !== expectH) problems.push(`${p}: ${rows.length} rows`);
    rows.forEach((r, i) => {
      if (r.length !== expectW) problems.push(`${p} row ${i}: width ${r.length}`);
      for (const ch of r) if (!(ch in PALETTE)) problems.push(`${p} row ${i}: unknown cell "${ch}"`);
    });
    if (isOverride(p) && mask(rows) !== base) problems.push(`${p}: silhouette differs from base`);
    const d = POSE_DERIVED[p as keyof typeof POSE_DERIVED];
    if (d?.op === "blink" && mask(rows) !== mask(buildPose(d.from))) problems.push(`${p}: silhouette differs from ${d.from}`);
    const at = (x: number, y: number) => (y < 0 || y >= rows.length || x < 0 || x >= w ? "." : rows[y][x]);
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < w; x++) {
        const c = rows[y][x];
        if (c === "." || c === "K") continue;
        if (at(x + 1, y) === "." || at(x - 1, y) === "." || at(x, y + 1) === "." || at(x, y - 1) === ".")
          problems.push(`${p}: ${c} at row ${y} col ${x} touches transparent`);
      }
  }
  return problems;
}
