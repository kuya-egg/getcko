import { useEffect, useRef, useState } from "react";
import { director } from "../gecko/director";
import { GeckoSlot } from "../gecko/react";
import { CitationChip, Keycap, MicIcon, PointerIcon, SpeakerIcon, StopIcon } from "../components/ui";

const QUESTION = "Saan ko ilalagay ang grade ni Juan, at paano kinukuwenta?";
const ANSWER = "Ilagay sa F12. Final grade is 40% written work plus 60% performance tasks. For Juan, that's 86.";

export function Voice() {
  const section = useRef<HTMLElement>(null);
  const mic = useRef<HTMLButtonElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = () => {
    if (canSpeak) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const speak = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(ANSWER);
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  // Mouth alternates while speech plays; Esc always stops it (design system §9).
  useEffect(() => {
    if (!speaking) {
      director.setPose("voice", "pointing");
      return;
    }
    // Reduced motion: hold the open-mouth pose instead of flapping it.
    let open = true;
    director.setPose("voice", "speaking");
    const t = director.reducedMotion
      ? 0
      : window.setInterval(() => {
          open = !open;
          director.setPose("voice", open ? "speaking" : "pointing");
        }, 170);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [speaking]);

  useEffect(() => () => void (canSpeak && window.speechSynthesis.cancel()), [canSpeak]);

  return (
    <section ref={section} id="voice" className="section voice" aria-labelledby="voice-title">
      <div className="voice-copy">
        <p className="eyebrow">Voice in, voice out</p>
        <h2 id="voice-title" className="h-section">Ask out loud.</h2>
        <p className="lede">
          Hold <Keycap>⌥</Keycap> <Keycap>Space</Keycap> and ask in English, Filipino or Taglish. GetCko transcribes on-device, answers
          with the source, and says it out loud.
        </p>
        <div className="session-row">
          <GeckoSlot id="voice" section={section} target={mic} className="slot-voice" label="GetCko pointing at the mic button" />
          <div className="session-bar" role="group" aria-label="GetCko session bar">
            <span className="session-agent">Office Helper</span>
            <button
              ref={mic}
              type="button"
              className="icon-btn icon-btn-accent gc-target gc-target-dark"
              aria-label={speaking ? "Stop the example answer" : "Play the example answer"}
              aria-pressed={speaking}
              onClick={speaking ? stop : speak}
              disabled={!canSpeak}
            >
              <MicIcon />
            </button>
            <span className={`wave${speaking ? " is-on" : ""}`} aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ ["--i" as string]: i }} />
              ))}
            </span>
            <span className="icon-btn icon-btn-dark" aria-hidden="true">
              <PointerIcon />
            </span>
            <button type="button" className="icon-btn icon-btn-dark" aria-label="Stop speaking" onClick={stop}>
              <StopIcon />
            </button>
            <span className="session-hint mono">⌥ Space</span>
          </div>
        </div>
      </div>

      <div className="chat" aria-label="Example conversation">
        <p className="msg msg-user" lang="fil">
          {QUESTION}
        </p>
        <div className="msg msg-gecko">
          <p>
            <strong>Ilagay sa F12.</strong> Final grade is 40% written work + 60% performance tasks. For Juan: 0.4 × 84 + 0.6 × 88 = 86.4,
            rounded to <strong>86</strong>.
          </p>
        </div>
        <div className="chat-foot">
          <CitationChip>Manual · p. 4</CitationChip>
          {canSpeak && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={speaking ? stop : speak}>
              {speaking ? <StopIcon /> : <SpeakerIcon />}
              {speaking ? "Stop" : "Hear the answer"}
            </button>
          )}
        </div>
        <p className="caption">Plays in your browser's voice. The app speaks with your computer's built-in voices. Esc stops it.</p>
      </div>
    </section>
  );
}
