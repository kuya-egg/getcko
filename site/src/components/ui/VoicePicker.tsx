import { useId } from "react";
import { Icon } from "../../brand/icons";
import { T, type AgentLanguage } from "../../brand/lexicon";
import { IconButton } from "./Button";
import { cn } from "./cn";
import { Notice } from "./Notice";
import { SegmentedControl } from "./SegmentedControl";
import { Select, type SelectOption } from "./Select";

export interface Voice {
  id: string;
  /** OS voice name as macOS reports it ("Samantha"). */
  name: string;
  /** BCP 47 tag ("en-US", "fil-PH"). */
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
  /** The agent's answer language. Filipino or Taglish without a Filipino voice shows the notice. */
  language?: AgentLanguage;
  /** Whether the OS has a Filipino voice. Default: any voice whose lang starts with "fil" or "tl". */
  hasFilipinoVoice?: boolean;
  className?: string;
}

/** Voice row: native Select of OS voices + a play-sample IconButton, and the no-Filipino-voice notice. */
export function VoicePicker({
  voices,
  value,
  onChange,
  onPlaySample,
  playing = false,
  onStopSample,
  language = "English",
  hasFilipinoVoice,
  className,
}: VoicePickerProps) {
  const id = useId();
  const filipino = hasFilipinoVoice ?? voices.some((v) => /^(fil|tl)\b/i.test(v.lang ?? ""));
  const current = voices.find((v) => v.id === value);
  const options: SelectOption[] = voices.map((v) => ({ value: v.id, label: v.name }));
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-end gap-2">
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
      {language !== "English" && !filipino && <Notice tone="info">{T.agent.noFilipinoVoice}</Notice>}
    </div>
  );
}

export interface LanguagePickerProps {
  value: AgentLanguage;
  onChange: (value: AgentLanguage) => void;
  className?: string;
}

const LANGS: AgentLanguage[] = ["English", "Filipino", "Taglish"];

/** Answer language: English / Filipino / Taglish as a SegmentedControl with a visible label. */
export function LanguagePicker({ value, onChange, className }: LanguagePickerProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span aria-hidden="true" className="text-label text-text">
        {T.agent.languageLabel}
      </span>
      <SegmentedControl
        label={T.agent.languageLabel}
        value={value}
        onChange={onChange}
        options={LANGS.map((l) => ({ value: l, label: T.languages[l] }))}
      />
    </div>
  );
}
