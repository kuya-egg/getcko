import { useId } from "react";
import { Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { IconButton } from "./Button";
import { cn } from "./cn";
import { Select, type SelectOption } from "./Select";

export interface Voice {
  id: string;
  /** OS voice name as macOS reports it ("Samantha"). */
  name: string;
  /** BCP 47 tag ("en-US", "en-GB"). */
  lang?: string;
}

export interface VoicePickerProps {
  voices: readonly Voice[];
  value: string;
  onChange: (id: string) => void;
  /** Play a short sample in the chosen voice. */
  onPlaySample?: (id: string) => void;
  /** A sample is playing: the button becomes Stop. */
  playing?: boolean;
  onStopSample?: () => void;
  className?: string;
}

/** Voice row: native Select of OS voices + a play-sample IconButton. */
export function VoicePicker({
  voices,
  value,
  onChange,
  onPlaySample,
  playing = false,
  onStopSample,
  className,
}: VoicePickerProps) {
  const id = useId();
  const current = voices.find((v) => v.id === value);
  const options: SelectOption[] = voices.map((v) => ({ value: v.id, label: v.name }));
  return (
    <div className={cn("flex min-w-0 items-end gap-2", className)}>
      <Select
        id={id}
        className="min-w-0 flex-1"
        label={T.settings.voice}
        options={options}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      {onPlaySample &&
        (playing ? (
          <IconButton icon={Icon.stop} label={T.aria.stopSample} size="sm" onClick={onStopSample} noTooltip />
        ) : (
          <IconButton
            icon={Icon.voice}
            label={T.aria.playSample(current?.name ?? T.settings.voice)}
            size="sm"
            onClick={() => onPlaySample(value)}
            noTooltip
          />
        ))}
    </div>
  );
}
