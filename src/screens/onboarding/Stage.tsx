// The right half of an onboarding step: "your screen", with GetcKo 8x standing at its lower left and
// pointing up-right at the one thing that wears the halo (design system §9.2: gecko faces the target,
// never covers it). Geometry comes from the sprite cells (stageGeometry): the hand tip points at the
// target's lower-left corner, and a pose with a raised hand steps back so nothing touches the target.
import type { ReactNode } from "react";
import { GetCkoSprite, type Moment } from "../../brand";
import { T } from "../../brand/lexicon";
import { Keycap, MockToggle, cn } from "../../components/ui";
import { HOTKEY } from "../../components/ui/platform";
import { PLATFORM } from "../../app/platform";
import { ONBOARDING_COPY } from "./copy";
import { STAGE_SCALE, STEP_ROOM, stageGeometry } from "./stageGeometry";
import { SPRITE_W } from "../../brand/mascot/sprites";

export { STAGE_SCALE } from "./stageGeometry";

/** Gap between GetcKo's feet and the badge beside them, px. */
const ASIDE_GAP = 16;

export interface StageProps {
  /** GetcKo's moment. "screenHelp" points up-right at the target. */
  moment: Moment;
  /** The target card. Put `target-halo` on at most one element inside it. */
  children: ReactNode;
  /** Something for the empty lower right (the "Gets mo na." badge on the last step). */
  aside?: ReactNode;
  /** The target stands on the floor beside GetcKo (no pointing: the models list). */
  grounded?: boolean;
}

export function Stage({ moment, children, aside, grounded = false }: StageProps) {
  const s = STAGE_SCALE;
  const { pose, pointing, left, below, shift } = stageGeometry(moment, s, grounded);
  const label = pointing ? T.mascot.pointingAtAction : T.mascot.moment(T.moments[moment]);

  return (
    // STEP_ROOM is kept on every step, so the target never moves; only GetcKo steps back from it.
    <div className="relative min-w-0" style={{ paddingLeft: STEP_ROOM + left, paddingBottom: below }}>
      {children}
      <GetCkoSprite pose={pose} scale={s} label={label} className="absolute bottom-0" style={{ left: STEP_ROOM - shift }} />
      {aside && (
        <div className="absolute bottom-0 flex items-end pb-2" style={{ left: STEP_ROOM + SPRITE_W * s + ASIDE_GAP }}>
          {aside}
        </div>
      )}
    </div>
  );
}

/**
 * A picture of the OS settings pane the person is about to visit: title bar, the Privacy pane, the
 * permission, and the GetcKo row (MockToggle wears the halo while off). Not interactive; the chrome
 * is hidden from screen readers and the toggle carries the spoken label.
 */
export function MockSettingsWindow({ permission, on }: { permission: string; on: boolean }) {
  const os = ONBOARDING_COPY.settingsWindow[PLATFORM];
  return (
    <div className="w-72 max-w-full overflow-hidden rounded-window border border-border bg-surface shadow-overlay">
      <div aria-hidden="true" className="flex h-9 items-center gap-1.5 border-b border-border bg-surface-2 px-3">
        <span className="size-2.5 rounded-pill bg-border-strong" />
        <span className="size-2.5 rounded-pill bg-border-strong" />
        <span className="size-2.5 rounded-pill bg-border-strong" />
        <span className="ml-2 truncate text-caption text-text-2">{os.app}</span>
      </div>
      {/* The switch row is the window's bottom edge, so the hand under the corner points at it. */}
      <div className="flex flex-col gap-4 px-3 pt-4 pb-3">
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-0.5">
          <span className="text-caption text-text-2">{os.pane}</span>
          {/* Wraps instead of truncating: at 900x600 the window is ~200px and "Screen Recording" needs two lines. */}
          <span className="font-display text-title text-balance text-text">{permission}</span>
        </div>
        <MockToggle
          on={on}
          permission={permission}
          className="w-full"
          // One spacing step tighter than the primitive, so "GetcKo" never truncates in the narrow window.
          style={{ columnGap: "calc(var(--spacing) * 2)", paddingInline: "calc(var(--spacing) * 2)" }}
        />
      </div>
    </div>
  );
}

/**
 * The shortcut as real-looking keys, one key per token (⌥ + Space on a Mac, Ctrl + Space on a PC).
 * The group wears the halo: these are the keys to press.
 */
const isSpace = (k: string) => k.toLowerCase() === "space";

export function ShortcutKeys() {
  const keys = HOTKEY[PLATFORM];
  return (
    <div className="target-halo flex w-72 max-w-full items-center gap-2 rounded-button bg-surface p-2">
      {keys.map((k) => (
        <Keycap
          key={k}
          keys={[k]}
          platform={PLATFORM}
          // Space takes the room that is left (and gives it back on a narrow window).
          className={cn("h-16 rounded-tile px-4", isSpace(k) ? "min-w-0 flex-1" : "min-w-16")}
          style={{
            // One face on both platforms: Keycap's mono would set "Ctrl Space" apart from "⌥ Space".
            fontFamily: "var(--font-display)",
            flexShrink: isSpace(k) ? 1 : 0,
            // Mac modifier glyphs (⌥) read small next to a word: one type step up.
            fontSize: PLATFORM === "mac" && !isSpace(k) ? "var(--text-h1)" : "var(--text-h2)",
          }}
        />
      ))}
    </div>
  );
}

/** A solid card for a status list on the stage (the models step). */
export function StageCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-80 max-w-full flex-col gap-1 rounded-panel border border-border bg-surface px-4 pt-3 pb-2 shadow-overlay">
      <p className="text-label font-semibold text-text-2">{title}</p>
      {children}
    </div>
  );
}
