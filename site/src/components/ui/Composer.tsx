import { useState, type FormEvent, type Ref } from "react";
import { Icon } from "../../brand/icons";
import { T, say } from "../../brand/lexicon";
import { GetCkoSprite, MOMENT_POSE } from "../../brand/mascot";
import { Button, IconButton } from "./Button";
import { cn } from "./cn";
import { useHoldToTalk } from "./useHoldToTalk";

export interface ComposerProps {
  /** Controlled text. Omit to let the composer hold its own state. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Ask pressed (or Enter). Receives the trimmed text; uncontrolled composers clear after. */
  onSubmit?: (text: string) => void;
  /** Mic pressed down (hold to talk). */
  onTalkStart?: () => void;
  /** Mic released. */
  onTalkEnd?: () => void;
  /** Screen Help: GetcKo looks at the screen and points. */
  onScreenHelp?: () => void;
  /** Force the listening look (e.g. while STT runs from the global hotkey). */
  listening?: boolean;
  placeholder?: string;
  askLabel?: string;
  /** While listening, show GetcKo listening (3x) above the row with `listeningLine`. One GetcKo per screen. */
  mascot?: boolean;
  /** GetcKo's listening line. Default say.listening. */
  listeningLine?: string;
  /** Accessible name of the text input. */
  inputLabel?: string;
  disabled?: boolean;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * The ask row: pill (radius 20, 1.5px border-strong) holding text input, hold-to-talk mic (accent),
 * Screen Help, and the primary Ask button. Never auto-sends; the user asks.
 */
export function Composer({
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  onTalkStart,
  onTalkEnd,
  onScreenHelp,
  listening,
  placeholder = T.composer.placeholder,
  askLabel = T.actions.ask,
  inputLabel = T.composer.label,
  mascot,
  listeningLine = say.listening,
  disabled,
  className,
  inputRef,
}: ComposerProps) {
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const { holding, bind } = useHoldToTalk({ onStart: onTalkStart, onEnd: onTalkEnd, disabled });
  const isListening = listening ?? holding;

  const setText = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit?.(q);
    if (value === undefined) setInner("");
  };

  const form = (
    <form
      onSubmit={submit}
      className={cn(
        "flex min-h-14 w-full items-center gap-1.5 rounded-panel border-[1.5px] border-border-strong bg-surface p-1.5 pl-4",
        "transition-[border-color,outline-color] has-[input:focus-visible]:border-focus",
        "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-focus-wash has-[input:focus-visible]:outline-solid",
        disabled && "border-disabled-border bg-disabled",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isListening ? T.composer.listeningPlaceholder : placeholder}
        aria-label={inputLabel}
        disabled={disabled}
        autoComplete="off"
        className="h-11 min-w-0 flex-1 border-0 bg-transparent text-body text-text placeholder:text-text-3 focus-visible:outline-none disabled:cursor-not-allowed"
      />
      <IconButton
        icon={Icon.pushToTalk}
        label={isListening ? T.aria.listening : T.aria.holdToTalk}
        variant="accent"
        size="sm"
        pressed={isListening}
        disabled={disabled}
        {...bind}
      />
      <IconButton icon={Icon.screenHelp} label={T.aria.screenHelp} size="sm" onClick={onScreenHelp} disabled={disabled} />
      <Button type="submit" size="sm" disabled={disabled}>
        {askLabel}
      </Button>
    </form>
  );

  if (!mascot) return form;
  return (
    <div className="flex w-full flex-col gap-3">
      {isListening && (
        <p className="flex items-end gap-3 text-answer text-text-2" aria-live="polite">
          <span className="shrink-0 rounded-tile bg-surface-2 p-2">
            <GetCkoSprite pose={MOMENT_POSE.listening} scale={3} label={T.mascot.moment(T.status.listening)} />
          </span>
          <span className="pb-2">{listeningLine}</span>
        </p>
      )}
      {form}
    </div>
  );
}
