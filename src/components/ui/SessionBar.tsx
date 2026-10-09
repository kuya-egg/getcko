import type { HTMLAttributes, Ref } from "react";
import { ICON_PROPS, Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { GetCkoSprite, MOMENT_POSE } from "../../brand/mascot";
import { IconButton } from "./Button";
import { GeckoDot } from "./Chips";
import { cn } from "./cn";
import { Keycap } from "./Keycap";
import type { Platform } from "./platform";
import { useHoldToTalk } from "./useHoldToTalk";

export interface SessionBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Active agent name in the chip. */
  agent: string;
  /** Agent chip pressed (switch agent). Omit for a static chip. */
  onAgentClick?: () => void;
  onTalkStart?: () => void;
  onTalkEnd?: () => void;
  /** Force the listening look (hotkey-driven STT). */
  listening?: boolean;
  onScreenHelp?: () => void;
  /** TTS playing: shows the Stop button. */
  speaking?: boolean;
  onStop?: () => void;
  /** Hotkey hint platform. Default "auto". */
  platform?: Platform | "auto";
  /** Hide the "⌥ Space to ask" hint. */
  hideHint?: boolean;
  /**
   * Seat GetcKo (3x) at the bar's left end, posed for the moment: listening, speaking, or idle (sleeping).
   * Main-window demos only: in the overlay GetcKo is already beside the target (one per screen).
   */
  mascot?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** Floating ink pill (dark in both themes): agent chip, mic (gecko fill), Screen Help, Stop, hotkey hint. */
export function SessionBar({
  agent,
  onAgentClick,
  onTalkStart,
  onTalkEnd,
  listening,
  onScreenHelp,
  speaking,
  onStop,
  platform = "auto",
  hideHint,
  mascot,
  className,
  ref,
  ...rest
}: SessionBarProps) {
  const { holding, bind } = useHoldToTalk({ onStart: onTalkStart, onEnd: onTalkEnd });
  const isListening = listening ?? holding;
  const moment = isListening ? "listening" : speaking ? "speaking" : "idle";
  const chipCls =
    "inline-flex h-11 items-center gap-2 rounded-pill bg-chrome-raised pr-3 pl-3.5 text-label text-chrome-text whitespace-nowrap";

  const bar = (
    <div
      ref={ref}
      role="toolbar"
      aria-label={T.aria.session}
      {...rest}
      className={cn("inline-flex items-center gap-1.5 rounded-pill border border-chrome-border bg-chrome p-2.5 shadow-overlay", className)}
    >
      {onAgentClick ? (
        <button type="button" onClick={onAgentClick} className={cn(chipCls, "transition-colors hover:bg-chrome-hover")}>
          <GeckoDot />
          {agent}
          <Icon.switchAgent {...ICON_PROPS} className="-my-1 -mr-1 text-chrome-text-2" />
        </button>
      ) : (
        <span className={chipCls}>
          <GeckoDot />
          {agent}
        </span>
      )}
      <IconButton
        icon={Icon.pushToTalk}
        label={isListening ? T.aria.listening : T.aria.holdToTalk}
        variant="accent"
        size="sm"
        pressed={isListening}
        {...bind}
      />
      <IconButton icon={Icon.screenHelp} label={T.aria.screenHelp} variant="chrome" size="sm" onClick={onScreenHelp} />
      {speaking && <IconButton icon={Icon.stop} label={T.aria.stopSpeaking} variant="chrome" size="sm" onClick={onStop} />}
      {hideHint ? (
        <span className="sr-only" aria-live="polite">
          {isListening ? T.status.listening : ""}
        </span>
      ) : (
        <span aria-live="polite" className="flex items-center gap-2 pr-2 pl-1 text-caption whitespace-nowrap text-chrome-text-2">
          {isListening ? (
            T.status.listening
          ) : (
            <>
              <Keycap hotkey platform={platform} tone="chrome" />
              {T.sessionBar.shortcutHint}
            </>
          )}
        </span>
      )}
    </div>
  );

  if (!mascot) return bar;
  return (
    <div className="inline-flex items-end gap-3">
      <span className="shrink-0 rounded-tile border border-border bg-surface p-2">
        <GetCkoSprite pose={MOMENT_POSE[moment]} scale={3} label={T.mascot.moment(T.moments[moment])} />
      </span>
      {bar}
    </div>
  );
}
