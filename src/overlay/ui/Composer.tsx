import { useId, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { MicButton, ScreenHelpToggle } from "./SessionBar";

export interface ComposerProps {
  open: boolean;
  screenHelp: boolean;
  onSubmit(text: string): void;
  onClose(): void;
  onMicDown(): void;
  onMicUp(): void;
  onToggleScreenHelp(): void;
  ref?: Ref<HTMLFormElement>;
}

export function Composer(props: ComposerProps) {
  const [text, setText] = useState("");
  const inputId = useId();
  if (!props.open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    props.onSubmit(trimmed);
    setText("");
  };
  const keyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    props.onClose();
  };

  return (
    <form ref={props.ref} className="gc-composer" onSubmit={submit} onKeyDown={keyDown}>
      <label htmlFor={inputId} className="gc-visually-hidden">
        Ask GetCko
      </label>
      <input
        id={inputId}
        className="gc-composer-input"
        type="text"
        autoComplete="off"
        autoFocus
        placeholder="Ask about this screen"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <MicButton onMicDown={props.onMicDown} onMicUp={props.onMicUp} />
      <ScreenHelpToggle on={props.screenHelp} onToggle={props.onToggleScreenHelp} />
      <button type="submit" className="gc-btn gc-btn--primary">
        Ask
      </button>
    </form>
  );
}
