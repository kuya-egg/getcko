import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { mainShow } from "../../lib/getcko";
function Icon({ children }: { children: ReactNode }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
export const MicIcon = () => <Icon><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3m-4 0h8" /></Icon>;
export const PointIcon = () => <Icon><path d="M4 4l7 17 2.5-7.5L21 11z" /></Icon>;
export const StopIcon = () => <Icon><rect x="6" y="6" width="12" height="12" rx="2" /></Icon>;
export const CloseIcon = () => <Icon><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const isTalkKey = (key: string) => key === " " || key === "Enter";
export function MicButton({ listening, onMicDown, onMicUp }: { listening?: boolean; onMicDown(): void; onMicUp(): void }) {
  const [held, setHeld] = useState(false);
  const press = () => { setHeld(true); onMicDown(); };
  const release = () => { if (!held) return; setHeld(false); onMicUp(); };
  const down = (e: PointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture(e.pointerId); press(); };
  const keyDown = (e: KeyboardEvent<HTMLButtonElement>) => { if (!isTalkKey(e.key)) return; e.preventDefault(); if (!e.repeat) press(); };
  const keyUp = (e: KeyboardEvent<HTMLButtonElement>) => { if (!isTalkKey(e.key)) return; e.preventDefault(); release(); };
  return <button type="button" className="gc-icon-btn gc-icon-btn--gecko" aria-label="Hold to talk" aria-pressed={listening ?? held} onPointerDown={down} onPointerUp={release} onPointerCancel={release} onKeyDown={keyDown} onKeyUp={keyUp}><MicIcon /></button>;
}
export function ScreenHelpToggle({ on, onToggle }: { on: boolean; onToggle(): void }) {
  return <button type="button" className="gc-icon-btn gc-icon-btn--toggle" aria-label="Point on screen" aria-pressed={on} onClick={onToggle}><PointIcon /></button>;
}
export interface SessionBarProps {
  agentName: string | null; askLabel: string; listening: boolean; busy: boolean; screenHelp: boolean;
  onMicDown(): void; onMicUp(): void; onToggleScreenHelp(): void; onStop(): void;
  compact?: boolean; onCompact(): void; onHide(): void; onDragStart?(event: PointerEvent<HTMLDivElement>): void;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}
export function SessionBar(props: SessionBarProps) {
  return <div ref={props.ref} style={props.style} className={`gc-session-bar${props.compact ? " gc-session-bar--compact" : ""}`} role="toolbar" aria-label="GetCko session" onPointerDown={props.onDragStart}>
    <span className="gc-session-grip" role="button" aria-label="Move" title="Move" tabIndex={0}>⠿</span>
    <button type="button" className="gc-agent-chip" aria-label="Open GetCko" onPointerDown={(e) => e.stopPropagation()} onClick={() => void mainShow()}><span className="gc-dot" aria-hidden="true" />{!props.compact && (props.agentName ?? "GetCko")}</button>
    <button type="button" className="gc-icon-btn gc-icon-btn--toggle" aria-label={props.compact ? "Expand" : "Compact"} onPointerDown={(e) => e.stopPropagation()} onClick={props.onCompact}><span aria-hidden="true">{props.compact ? "＋" : "−"}</span></button>
    <span onPointerDown={(e) => e.stopPropagation()}><MicButton listening={props.listening} onMicDown={props.onMicDown} onMicUp={props.onMicUp} /></span>
    {!props.compact && <><span onPointerDown={(e) => e.stopPropagation()}><ScreenHelpToggle on={props.screenHelp} onToggle={props.onToggleScreenHelp} /></span><button type="button" className="gc-icon-btn gc-icon-btn--dark" aria-label="Stop" disabled={!props.busy} onPointerDown={(e) => e.stopPropagation()} onClick={props.onStop}><StopIcon /></button><span className="gc-session-hint"><kbd className="gc-keycap">{props.askLabel}</kbd> hold to talk</span></>}
    <button type="button" className="gc-icon-btn gc-icon-btn--dark" aria-label="Hide GetCko bar" onPointerDown={(e) => e.stopPropagation()} onClick={props.onHide}><CloseIcon /></button>
  </div>;
}
