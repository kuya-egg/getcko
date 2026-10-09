import { useCallback, useEffect, useRef, useState } from "react";
import { MOMENT_POSE, pointPoseFor } from "../brand/mascot";
import { speakLoop } from "../brand/motion";
import { T } from "../brand/lexicon";
import { Icon } from "../brand/icons";
import { Button, ChatBubble, CitationChip, Kw, SessionBar, Surface } from "../components/ui";
import { SectionHead } from "../components/SectionHead";
import { director } from "../gecko/director";
import { GeckoSlot } from "../gecko/react";
import { SITE } from "../copy";

/** Hold to talk, let go, GetcKo answers out loud in Taglish. On the banig weave: the language band. */
export function Voice() {
  const section = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const loop = useRef<gsap.core.Timeline | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const c = SITE.voice;

  const stop = useCallback(() => {
    if (canSpeak) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [canSpeak]);

  const speak = useCallback(() => {
    if (!canSpeak) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(c.answer);
    const fil = synth.getVoices().find((v) => /^(fil|tl)/i.test(v.lang));
    if (fil) u.voice = fil;
    u.onend = u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }, [canSpeak, c.answer]);

  // Poses: listening while held, speaking ↔ pointing while the voice plays (speakLoop), else pointing.
  useEffect(() => {
    loop.current?.kill();
    if (listening) director.setPose("voice", MOMENT_POSE.listening);
    else if (speaking) loop.current = speakLoop((p) => director.setPose("voice", p));
    else director.setPose("voice", pointPoseFor("right"));
    if (!speaking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, speaking, stop]);

  useEffect(() => () => void (canSpeak && window.speechSynthesis.cancel()), [canSpeak]);

  return (
    <Surface ref={section} id="voice" texture="weave" intensity="subtle" tone="paper" aria-labelledby="voice-title" className="site-section seam">
      <div className="site-wrap grid items-center gap-12 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-6">
          <SectionHead id="voice-title" eyebrow={c.eyebrow} title={c.title}>
            <Kw>{T.actions.holdToTalk}</Kw>, ask in English, Filipino or <Kw>Taglish</Kw>. GetcKo answers out loud.
          </SectionHead>
          <div className="voice-bar-row">
            <GeckoSlot
              id="voice"
              section={section}
              target={() => bar.current?.querySelector<HTMLElement>('[role="toolbar"] button[aria-pressed]')}
              className="slot-voice"
              label={T.mascot.pointingAt(T.aria.holdToTalk)}
            />
            <div ref={bar} className="voice-bar">
              <SessionBar
                agent={T.templates.taglishExplainer.name}
                listening={listening}
                speaking={speaking}
                onTalkStart={() => {
                  stop();
                  setListening(true);
                }}
                onTalkEnd={() => {
                  setListening(false);
                  speak();
                }}
                onStop={stop}
                platform="mac"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5 shadow-overlay lg:col-span-6">
          <ChatBubble from="user" lang="fil">
            “{c.question}”
          </ChatBubble>
          <ChatBubble from="getcko" lang="fil">
            {c.answer}
          </ChatBubble>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <CitationChip source="Manual" page={4} />
            {canSpeak && (
              <Button variant="secondary" size="sm" icon={speaking ? Icon.stop : Icon.readAloud} onClick={speaking ? stop : speak}>
                {speaking ? c.stop : c.answerOutLoud}
              </Button>
            )}
          </div>
          <p className="text-caption text-text-3">{c.voiceNote}</p>
        </div>
      </div>
    </Surface>
  );
}
