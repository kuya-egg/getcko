// GetcKo icons: one PIXEL icon per product concept, never shared between concepts.
// Rules, grid and the concept table: docs/brand/icons.md. Vocabulary: src/brand/lexicon.ts.
//
// The icons share the mascot's DNA: square cells, no anti-aliasing, solid ink in currentColor.
// Grid 24 x 24 units, strokes 2 units. At 24px one icon cell (2 units) is 2px, the same as one
// mascot cell at scale 2, so icon and gecko read as one family.
//
// Usage:
//   import { Icon, ICON_PROPS, ICON_SIZE } from "./brand/icons";
//   <Icon.screenHelp {...ICON_PROPS} />                 // 24px, decorative
//   <Icon.source {...ICON_PROPS} size={ICON_SIZE.x2} /> // 48px (empty states, docs)
//
// Sizes snap to whole multiples of 24 (24, 48, 72...). Any other size is rounded to the nearest
// multiple so a unit never lands on a fractional pixel.
//
// Base set: pixelarticons (MIT, Gerrit Halfmann, 24 x 24 pixel grid) for generic actions.
// Signature icons (agent, Screen Help, source, Hold to talk, statuses...) are drawn below as
// string maps on the same grid, like the sprite in src/brand/mascot/sprites.ts.
//
// Not here on purpose:
//   - The product, the mascot, "point" (verb), thinking and speaking states: the GetcKo sprite or
//     head mark (src/brand/mascot) represents them, never an icon.
//   - Shortcuts in context: render the Keycap component; `Icon.hotkey` only labels a settings row.
//   - Banned: sparkles, wand, stars, robot, brain, cpu, zap, rocket. And any smooth line-icon set
//     (lucide, heroicons, feather): they are the default look of generated apps.

import { createElement, type ComponentType, type CSSProperties, type SVGProps } from "react";
import {
  Article,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioWaveform,
  Bulletlist,
  Camera,
  ChevronDown,
  ChevronUp,
  CircleQuestion,
  Comment,
  Copy,
  Dock,
  ExternalLink,
  Hourglass,
  Human,
  InfoBox,
  Languages,
  MessageText,
  Monitor,
  Moon,
  Pencil,
  PictureInPicture,
  Plus,
  PlusBox,
  Presentation,
  Reload,
  Script,
  Search,
  SlidersHorizontal,
  Stop,
  TextAlignLeft,
  TextCursor,
  Trash,
  ZoomOut,
} from "pixelarticons/react";
import type { DocType, Status } from "./lexicon";

/** The grid every icon is drawn on (units). */
export const ICON_GRID = 24;

/** Allowed sizes: whole multiples of the grid. 24 everywhere in the UI; 48 for empty states and docs. */
export const ICON_SIZE = { chip: 24, row: 24, button: 24, x2: 48 } as const;

/** Props every icon accepts. Color is always currentColor; set it on the parent with a text token. */
export interface IconProps {
  /** CSS px. Snapped to a whole multiple of 24. Default 24. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name. When set the icon is announced (role="img"); otherwise pass aria-hidden. */
  title?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

/** Icon component type, so components never import an icon package directly. */
export type IconComponent = ComponentType<IconProps>;

/** Default props: 24px, decorative. */
export const ICON_PROPS = {
  size: ICON_SIZE.row,
  "aria-hidden": true,
} as const satisfies IconProps;

/** Round any requested size to a whole multiple of the grid, so units never blur. */
export function snapIconSize(size: number | undefined): number {
  const s = size ?? ICON_SIZE.row;
  return Math.max(1, Math.round(s / ICON_GRID)) * ICON_GRID;
}

function svgProps({ size, className, style, title, "aria-hidden": hidden }: IconProps): SVGProps<SVGSVGElement> {
  const px = snapIconSize(size);
  const named = !!title && hidden !== true && hidden !== "true";
  return {
    width: px,
    height: px,
    viewBox: `0 0 ${ICON_GRID} ${ICON_GRID}`,
    fill: "currentColor",
    shapeRendering: "crispEdges",
    focusable: "false",
    className: className ? `gc-icon ${className}` : "gc-icon",
    style,
    role: named ? "img" : undefined,
    "aria-label": named ? title : undefined,
    "aria-hidden": named ? undefined : true,
  };
}

// ---------------------------------------------------------------------------
// Pixel maps. "#" = one filled unit, anything else = empty. 24 columns x up to 24 rows.
// Drawing rules (docs/brand/icons.md): 2-unit strokes, 2-unit minimum gaps, notched corners
// (the outer 2 x 2 corner of a box is left empty), diagonals step 2 x 2 like the mascot outline,
// live area 2..21, solid fills allowed for small heavy parts (mic head, speaker, plug).

type PixelMap = readonly string[];

/** Merge each row's filled runs into one path of whole-unit rectangles. */
function mapToPath(map: PixelMap, dx = 0, dy = 0): string {
  let d = "";
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === "#") x++;
      d += `M${start + dx} ${y + dy}h${x - start}v1h${start - x}z`;
    }
  });
  return d;
}

/** Fail loudly in dev when a map is off-grid, so a broken drawing never ships quietly. */
function checkMap(name: string, map: PixelMap) {
  if (!import.meta.env?.DEV) return;
  if (map.length > ICON_GRID || map.some((r) => r.length !== ICON_GRID)) {
    console.warn(`[icons] ${name}: every row must be ${ICON_GRID} wide, at most ${ICON_GRID} rows.`);
  }
}

function pixelIcon(name: string, map: PixelMap): IconComponent {
  checkMap(name, map);
  const d = mapToPath(map);
  const C = (props: IconProps) => createElement("svg", svgProps(props), createElement("path", { d }));
  C.displayName = `PixelIcon(${name})`;
  return C;
}

/** Wrap a pixelarticons component with the shared size snapping and a11y rules. */
type BaseIcon = (props: SVGProps<SVGSVGElement>) => ReturnType<typeof createElement>;
function baseIcon(name: string, Base: BaseIcon): IconComponent {
  const C = (props: IconProps) => createElement(Base, svgProps(props));
  C.displayName = `PixelIcon(${name})`;
  return C;
}

// Rows 0-1 and 22-23 are padding; maps list only the rows they need from row 0.
const _ = "........................";

// --- Statuses -------------------------------------------------------------

const READY: PixelMap = [
  _, _, _, _, _, _,
  "..................####..",
  "..................####..",
  "................####....",
  "................####....",
  "..............####......",
  "..............####......",
  "....####....####........",
  "....####....####........",
  "......########..........",
  "......########..........",
  "........####............",
  "........####............",
];

const FAILED: PixelMap = [
  _, _, _,
  "..........####..........",
  "..........####..........",
  ".........##..##.........",
  ".........##..##.........",
  "........##....##........",
  "........##.##.##........",
  ".......##..##..##.......",
  ".......##..##..##.......",
  "......##...##...##......",
  "......##...##...##......",
  ".....##....##....##.....",
  ".....##..........##.....",
  "....##.....##.....##....",
  "....##.....##.....##....",
  "...##..............##...",
  "...##################...",
  "...##################...",
];

const OFFLINE: PixelMap = [
  _, _, _, _, _,
  ".................####...",
  ".................####...",
  "......####.......####...",
  ".....######......####...",
  ".....#########.....##...",
  ".....#########.....##...",
  ".##########......####...",
  ".##########......####...",
  ".....#########.....##...",
  ".....#########.....##...",
  ".....######......####...",
  "......####.......####...",
  ".................####...",
  ".................####...",
];

/** Processing: 8 squares on a ring, N then clockwise. Animated with steps() by `.gc-icon-spin`. */
const SPIN_CELLS: readonly [x: number, y: number][] = [
  [10, 2],
  [16, 4],
  [18, 10],
  [16, 16],
  [10, 18],
  [4, 16],
  [2, 10],
  [4, 4],
];
/** Static trail (head at N, fading counter-clockwise) so a still spinner still reads as one. */
const SPIN_REST = [1, 0.25, 0.25, 0.25, 0.25, 0.4, 0.55, 0.75];

const Processing: IconComponent = (props) =>
  createElement(
    "svg",
    svgProps(props),
    SPIN_CELLS.map(([x, y], i) =>
      createElement("rect", {
        key: i,
        x,
        y,
        width: 4,
        height: 4,
        "data-step": i,
        style: { opacity: SPIN_REST[i], ["--gc-i" as string]: i } as CSSProperties,
      }),
    ),
  );
(Processing as { displayName?: string }).displayName = "PixelIcon(processing)";

// --- Things -----------------------------------------------------------------

/** The GetcKo head mark as a one-color stencil: bulging eyes, wide head, smile. */
const AGENT: PixelMap = [
  _, _, _, _, _,
  "....######....######....",
  "...########..########...",
  "...##....##..##....##...",
  "...##..####..##..####...",
  "...##..####..##..####...",
  "..####################..",
  "..####################..",
  "..###..##########..###..",
  "..###..##########..###..",
  "..#####..........#####..",
  "..#####..........#####..",
  "..####################..",
  "...##################...",
];

/** A screen, a pixel cursor, and the element it is about. */
const SCREEN_HELP: PixelMap = [
  _, _, _,
  "....################....",
  "....################....",
  "..##................##..",
  "..##................##..",
  "..##..####..........##..",
  "..##..####..#.......##..",
  "..##..####..##......##..",
  "..##..####..###.....##..",
  "..##........####....##..",
  "..##........#####...##..",
  "..##........##......##..",
  "..##................##..",
  "....################....",
  "....################....",
  "..........####..........",
  "..........####..........",
  "......############......",
  "......############......",
];

/** Corner brackets around one element: the halo, drawn as an icon (docs and settings only). */
const TARGET: PixelMap = [
  _, _, _,
  "...#####........#####...",
  "...#####........#####...",
  "...##..............##...",
  "...##..............##...",
  "...##..............##...",
  _,
  _,
  "..........####..........",
  "..........####..........",
  "..........####..........",
  "..........####..........",
  _,
  _,
  "...##..............##...",
  "...##..............##...",
  "...##..............##...",
  "...#####........#####...",
  "...#####........#####...",
];

/** The page every document-like icon is built on: folded corner top right, notched corners. */
function page(inner: Record<number, string> = {}): PixelMap {
  const rows: string[] = [
    _, _,
    "......##########........",
    "......##########........",
    "....##........####......",
    "....##........####......",
    "....##........######....",
    "....##........######....",
  ];
  for (let y = 8; y <= 19; y++) rows.push("....##............##....");
  rows.push("......############......", "......############......");
  // Overlay inner marks: "#" in an inner row adds units; the frame is kept.
  for (const [k, mark] of Object.entries(inner)) {
    const y = Number(k);
    const base = rows[y].split("");
    for (let x = 0; x < mark.length; x++) if (mark[x] === "#") base[x] = "#";
    rows[y] = base.join("");
  }
  return rows;
}

/** Source: the page with a slanted double quote mark. Every grounded answer shows one. */
const SOURCE = page({
  10: "..........##..##........",
  11: "..........##..##........",
  12: ".........##..##.........",
  13: ".........##..##.........",
  14: "........##..##..........",
  15: "........##..##..........",
});

const DOCUMENT = page();

/** Add documents: the page with a plus. Never an upload arrow: nothing is uploaded. */
const ADD_DOCUMENTS = page({
  10: "...........##...........",
  11: "...........##...........",
  12: "...........##...........",
  13: "........########........",
  14: "........########........",
  15: "...........##...........",
  16: "...........##...........",
  17: "...........##...........",
});

const DOC_PDF = page({
  6: "........####............",
  7: "........####............",
  10: "........########........",
  11: "........########........",
  14: "........########........",
  15: "........########........",
});

const DOC_TXT = page({
  10: "........########........",
  11: "........########........",
  12: "...........##...........",
  13: "...........##...........",
  14: "...........##...........",
  15: "...........##...........",
  16: "...........##...........",
  17: "...........##...........",
});

const DOC_MD = page({
  9: ".........##..##.........",
  10: ".........##..##.........",
  11: ".......##########.......",
  12: ".......##########.......",
  13: ".........##..##.........",
  14: ".........##..##.........",
  15: ".......##########.......",
  16: ".......##########.......",
  17: ".........##..##.........",
  18: ".........##..##.........",
});

const DOC_DOCX = page({
  10: "........######..........",
  11: "........######..........",
  12: "........######..........",
  13: "........######..........",
  16: "........########........",
  17: "........########........",
});

/** Knowledge base: a stack of pages, front page square-on. Distinct from one document. */
const KNOWLEDGE_BASE: PixelMap = [
  _, _,
  "..........##########....",
  "..........##########....",
  "....................##..",
  "....................##..",
  "......##########....##..",
  "......##########....##..",
  "................##..##..",
  "................##..##..",
  "....########....##..##..",
  "....########....##..##..",
  "..##........##..####....",
  "..##........##..####....",
  "..##........##..##......",
  "..##........##..##......",
  "..##........####........",
  "..##........####........",
  "..##........##..........",
  "..##........##..........",
  "....########............",
  "....########............",
];

/** A page frame with a header bar and placeholder blocks: a layout to fill in. */
const TEMPLATE: PixelMap = [
  _, _, _,
  "....################....",
  "....################....",
  "..##................##..",
  "..##................##..",
  "..##..############..##..",
  "..##..############..##..",
  "..##................##..",
  "..##................##..",
  "..##..####..######..##..",
  "..##..####..######..##..",
  "..##..####..........##..",
  "..##..####..........##..",
  "..##..####..######..##..",
  "..##..####..######..##..",
  "..##................##..",
  "..##................##..",
  "....################....",
  "....################....",
];

/** A keycap: solid top face inside the cap, deeper bottom edge. In context, render the Keycap component. */
const HOTKEY: PixelMap = [
  _, _, _,
  "....################....",
  "....################....",
  "..##................##..",
  "..##................##..",
  "..##...##########...##..",
  "..##...##########...##..",
  "..##...##########...##..",
  "..##...##########...##..",
  "..##...##########...##..",
  "..##...##########...##..",
  "..##...##########...##..",
  "..##...##########...##..",
  "..##................##..",
  "..##................##..",
  "..####################..",
  "..####################..",
  "....################....",
  "....################....",
];

/** A laptop: everything stays on this Mac. */
const ON_THIS_MAC: PixelMap = [
  _, _, _, _, _,
  "......############......",
  "......############......",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "....##............##....",
  "..####################..",
  "..####################..",
];

/** A head with sound in front of the mouth: the chosen OS voice. */
const VOICE: PixelMap = [
  _, _, _,
  "................##......",
  "....######......##......",
  "....######........##....",
  "..##########......##....",
  "..##########..##..##....",
  "..##########..##..##....",
  "..##########..##..##....",
  "..##########..##..##....",
  "..##########......##....",
  "....######........##....",
  "....######......##......",
  "................##......",
  _,
  "....######..............",
  "....######..............",
  "..##########............",
  "..##########............",
  "..##########............",
  "..##########............",
];

// --- Input and output -------------------------------------------------------

/** Hold to talk: a solid capsule on a stand, the one icon that wears the gecko fill button. */
const PUSH_TO_TALK: PixelMap = [
  _, _,
  "..........####..........",
  "..........####..........",
  "........########........",
  "........########........",
  "........########........",
  "........########........",
  "....##..########..##....",
  "....##..########..##....",
  "....##..########..##....",
  "....##..########..##....",
  "....##....####....##....",
  "....##....####....##....",
  "......##........##......",
  "......##........##......",
  "........########........",
  "........########........",
  "...........##...........",
  "...........##...........",
  ".......##########.......",
  ".......##########.......",
];

const SPEAKER: string[] = [
  _, _, _,
  "..........##............",
  "..........##............",
  "........####............",
  "........####............",
  "......######............",
  "......######............",
  "..##########............",
  "..##########............",
  "..##########............",
  "..##########............",
  "..##########............",
  "..##########............",
  "......######............",
  "......######............",
  "........####............",
  "........####............",
  "..........##............",
  "..........##............",
];

function withMarks(base: readonly string[], marks: Record<number, string>): PixelMap {
  return base.map((row, y) => {
    const m = marks[y];
    if (!m) return row;
    return row
      .split("")
      .map((c, x) => (m[x] === "#" ? "#" : c))
      .join("");
  });
}

/** Answer out loud: the speaker with two pixel waves. */
const READ_ALOUD = withMarks(SPEAKER, {
  5: "................##......",
  6: "................##......",
  7: "..................##....",
  8: "..................##....",
  9: "..............##..##....",
  10: "..............##..##....",
  11: "..............##..##....",
  12: "..............##..##....",
  13: "..............##..##....",
  14: "..............##..##....",
  15: "..................##....",
  16: "..................##....",
  17: "................##......",
  18: "................##......",
});

/** Answer out loud, off: the same speaker with a pixel X. */
const READ_ALOUD_OFF = withMarks(SPEAKER, {
  8: "..............##....##..",
  9: "..............##....##..",
  10: "................####....",
  11: "................####....",
  12: "................####....",
  13: "................####....",
  14: "..............##....##..",
  15: "..............##....##..",
});

// --- Actions ----------------------------------------------------------------

/** Start: a solid play wedge (the base set's outline play reads too faint inside a filled button). */
const START: PixelMap = [
  _, _, _, _, _,
  "........##..............",
  "........##..............",
  "........####............",
  "........####............",
  "........######..........",
  "........######..........",
  "........########........",
  "........########........",
  "........######..........",
  "........######..........",
  "........####............",
  "........####............",
  "........##..............",
  "........##..............",
];

/** Close: an X with the same diagonal weight as the check (4-unit runs stepping 2). */
const CLOSE: PixelMap = [
  _, _, _, _, _,
  "....####........####....",
  "....####........####....",
  "......####....####......",
  "......####....####......",
  "........########........",
  "........########........",
  "..........####..........",
  "..........####..........",
  "........########........",
  "........########........",
  "......####....####......",
  "......####....####......",
  "....####........####....",
  "....####........####....",
];


// --- Pickers, navigation, permissions (v0.3) --------------------------------

/** Switch agent: two arrows passing each other (top goes right, bottom comes back left). */
const SWITCH_AGENT: PixelMap = [
  _, _,
  "................##......",
  "................##......",
  "..................##....",
  "..................##....",
  "..####################..",
  "..####################..",
  "..................##....",
  "..................##....",
  "................##......",
  "................##......",
  "......##................",
  "......##................",
  "....##..................",
  "....##..................",
  "..####################..",
  "..####################..",
  "....##..................",
  "....##..................",
  "......##................",
  "......##................",
];

/** Select disclosure: a solid pixel caret. Not Icon.more (that one expands text). */
const CHEVRON_DOWN: PixelMap = [
  _, _, _, _, _, _, _, _, _,
  "......############......",
  "......############......",
  "........########........",
  "........########........",
  "..........####..........",
  "..........####..........",
];

/** Microphone permission: the mic drawn in outline. The solid capsule is Hold to talk. */
const MIC: PixelMap = [
  _, _,
  "..........####..........",
  "..........####..........",
  "........##....##........",
  "........##....##........",
  "........##....##........",
  "........##....##........",
  "....##..##....##..##....",
  "....##..##....##..##....",
  "....##..##....##..##....",
  "....##..##....##..##....",
  "....##....####....##....",
  "....##....####....##....",
  "......##........##......",
  "......##........##......",
  "........########........",
  "........########........",
  "...........##...........",
  "...........##...........",
  ".......##########.......",
  ".......##########.......",
];

/** Drop documents: an arrow falling into an open tray. Nothing is uploaded; it lands on this Mac. */
const DROP: PixelMap = [
  _, _,
  "...........##...........",
  "...........##...........",
  "...........##...........",
  "...........##...........",
  "...........##...........",
  "...........##...........",
  ".......##..##..##.......",
  ".......##..##..##.......",
  ".........######.........",
  ".........######.........",
  "...........##...........",
  "...........##...........",
  "..##................##..",
  "..##................##..",
  "..##................##..",
  "..##................##..",
  "..##................##..",
  "..##................##..",
  "....################....",
  "....################....",
];

// ---------------------------------------------------------------------------

export const Icon = {
  // Things
  agent: pixelIcon("agent", AGENT),
  template: pixelIcon("template", TEMPLATE),
  knowledgeBase: pixelIcon("knowledgeBase", KNOWLEDGE_BASE),
  document: pixelIcon("document", DOCUMENT), // generic; per type see DOC_ICON
  passage: baseIcon("passage", Article),
  source: pixelIcon("source", SOURCE),
  answer: baseIcon("answer", MessageText),
  question: baseIcon("question", CircleQuestion),
  screenHelp: pixelIcon("screenHelp", SCREEN_HELP),
  target: pixelIcon("target", TARGET),
  overlay: baseIcon("overlay", PictureInPicture),
  sessionBar: baseIcon("sessionBar", Dock),
  composer: baseIcon("composer", TextCursor),
  hotkey: pixelIcon("hotkey", HOTKEY),
  instructions: baseIcon("instructions", Script),
  baseRules: baseIcon("baseRules", Bulletlist),
  language: baseIcon("language", Languages),
  answerLength: baseIcon("answerLength", TextAlignLeft),
  voice: pixelIcon("voice", VOICE),
  latency: baseIcon("latency", Hourglass),
  onThisMac: pixelIcon("onThisMac", ON_THIS_MAC),

  // Input and output
  pushToTalk: pixelIcon("pushToTalk", PUSH_TO_TALK), // UI label: "Hold to talk"
  listening: baseIcon("listening", AudioWaveform),
  readAloud: pixelIcon("readAloud", READ_ALOUD), // UI label: "Answer out loud"
  readAloudOff: pixelIcon("readAloudOff", READ_ALOUD_OFF),

  // Status
  processing: Processing, // add className="gc-icon-spin" to animate (steps, reduced-motion aware)
  ready: pixelIcon("ready", READY),
  failed: pixelIcon("failed", FAILED),
  offline: pixelIcon("offline", OFFLINE),
  bestGuess: baseIcon("bestGuess", Camera),
  dontKnow: baseIcon("dontKnow", ZoomOut),

  // Actions
  ask: baseIcon("ask", ArrowUp),
  start: pixelIcon("start", START),
  newAgent: baseIcon("newAgent", PlusBox),
  addDocuments: pixelIcon("addDocuments", ADD_DOCUMENTS),
  add: baseIcon("add", Plus),
  tryThisAgent: baseIcon("tryThisAgent", Comment),
  stop: baseIcon("stop", Stop), // UI label: "Stop speaking"
  next: baseIcon("next", ArrowRight), // UI label: "Next step"
  retry: baseIcon("retry", Reload), // UI label: "Try again"
  close: pixelIcon("close", CLOSE),
  more: baseIcon("more", ChevronDown),
  less: baseIcon("less", ChevronUp),
  edit: baseIcon("edit", Pencil),
  duplicate: baseIcon("duplicate", Copy),
  delete: baseIcon("delete", Trash),
  openExternal: baseIcon("openExternal", ExternalLink),
  back: baseIcon("back", ArrowLeft), // UI label: "Back"
  search: baseIcon("search", Search),
  drop: pixelIcon("drop", DROP), // drop zone: "Drop documents here"

  // Pickers and help
  switchAgent: pixelIcon("switchAgent", SWITCH_AGENT), // session bar agent chip
  chevronDown: pixelIcon("chevronDown", CHEVRON_DOWN), // Select disclosure only
  info: baseIcon("info", InfoBox), // Notice tone="info", tooltips

  // Settings and onboarding
  settings: baseIcon("settings", SlidersHorizontal),
  theme: baseIcon("theme", Moon),
  permissionAccessibility: baseIcon("permissionAccessibility", Human),
  permissionScreen: baseIcon("permissionScreen", Monitor),
  mic: pixelIcon("mic", MIC), // Microphone permission (onboarding, settings)
} as const satisfies Record<string, IconComponent>;

export type IconName = keyof typeof Icon;

/** Which icons are hand-drawn GetcKo maps (the rest come from pixelarticons). For docs and the contact sheet. */
export const CUSTOM_ICONS: readonly IconName[] = [
  "agent",
  "template",
  "knowledgeBase",
  "document",
  "addDocuments",
  "source",
  "screenHelp",
  "target",
  "hotkey",
  "voice",
  "onThisMac",
  "pushToTalk",
  "readAloud",
  "readAloudOff",
  "processing",
  "ready",
  "failed",
  "offline",
  "start",
  "close",
  "switchAgent",
  "chevronDown",
  "mic",
  "drop",
];

/** Document icon per file type (knowledge-base rows). All share the GetcKo page; the mark inside differs. */
export const DOC_ICON = {
  pdf: pixelIcon("pdf", DOC_PDF),
  txt: pixelIcon("txt", DOC_TXT),
  md: pixelIcon("md", DOC_MD),
  docx: pixelIcon("docx", DOC_DOCX),
  pptx: baseIcon("pptx", Presentation),
} as const satisfies Record<DocType, IconComponent>;

/** Icon for a status chip. */
export const STATUS_ICON = {
  processing: Icon.processing,
  ready: Icon.ready,
  failed: Icon.failed,
  offline: Icon.offline,
} as const satisfies Record<Status, IconComponent>;

/** Icon for a file name, by extension. Unknown types get Icon.document. */
export function docIcon(fileName: string): IconComponent {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (DOC_ICON as Record<string, IconComponent>)[ext] ?? Icon.document;
}
