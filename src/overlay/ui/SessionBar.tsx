import { useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const MicIcon = () => (
  <Icon>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Icon>
);
export const PointIcon = () => (
  <Icon>
    <path d="M4 4l7 17 2.5-7.5L21 11z" />
  </Icon>
);
export const StopIcon = () => (
  <Icon>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

const isTalkKey = (key: string) => key === " " || key === "Enter";

/**
 * Hold to talk with pointer or Space/Enter; key repeat is ignored.
 * `aria-pressed` follows `listening` when given, else the local hold.
 */
export function MicButton({
  listening,
  onMicDown,
  onMicUp,
}: {
  listening?: boolean;
  onMicDown(): void;
  onMicUp(): void;
}) {
  const [held, setHeld] = useState(false);
  const press = () => {
    setHeld(true);
    onMicDown();
  };
  const release = () => {
    if (!held) return;
    setHeld(false);
    onMicUp();
  };
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    press();
  };
  const keyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!isTalkKey(e.key)) return;
    e.preventDefault();
    if (!e.repeat) press();
  };
  const keyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!isTalkKey(e.key)) return;
    e.preventDefault();
    release();
  };
  return (
    <button
      type="button"
      className="gc-icon-btn gc-icon-btn--gecko"
      aria-label="Hold to talk"
      aria-pressed={listening ?? held}
      onPointerDown={down}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
    >
      <MicIcon />
    </button>
  );
}

export function ScreenHelpToggle({ on, onToggle }: { on: boolean; onToggle(): void }) {
  return (
    <button
      type="button"
      className="gc-icon-btn gc-icon-btn--toggle"
      aria-label="Point on screen"
      aria-pressed={on}
      onClick={onToggle}
    >
      <PointIcon />
    </button>
  );
}

export interface SessionBarProps {
  agentName: string | null;
  askLabel: string;
  listening: boolean;
  busy: boolean;
  screenHelp: boolean;
  onMicDown(): void;
  onMicUp(): void;
  onToggleScreenHelp(): void;
  onStop(): void;
  ref?: Ref<HTMLDivElement>;
}

export function SessionBar(props: SessionBarProps) {
  return (
    <div ref={props.ref} className="gc-session-bar" role="toolbar" aria-label="GetCko session">
      <span className="gc-agent-chip">
        <span className="gc-dot" aria-hidden="true" />
        {props.agentName ?? "GetCko"}
      </span>
      <MicButton listening={props.listening} onMicDown={props.onMicDown} onMicUp={props.onMicUp} />
      <ScreenHelpToggle on={props.screenHelp} onToggle={props.onToggleScreenHelp} />
      <button
        type="button"
        className="gc-icon-btn gc-icon-btn--dark"
        aria-label="Stop"
        disabled={!props.busy}
        onClick={props.onStop}
      >
        <StopIcon />
      </button>
      <span className="gc-session-hint">
        <kbd className="gc-keycap">{props.askLabel}</kbd> hold to talk
      </span>
    </div>
  );
}
