import { useRef, type ComponentType, type SVGProps } from "react";
import { GeckoSlot } from "../gecko/react";
import { BoardIcon, BookIcon, BriefcaseIcon, ChatIcon } from "../components/ui";

interface Agent {
  code: string;
  name: string;
  line: string;
  chips: string[];
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const AGENTS: Agent[] = [
  { code: "AGTx001", name: "Office Helper", line: "Learn new office software, step by step.", chips: ["Office manual", "English"], Icon: BriefcaseIcon },
  { code: "AGTx002", name: "Teacher", line: "DepEd forms and grading, explained.", chips: ["DepEd forms", "Taglish"], Icon: BoardIcon },
  { code: "AGTx003", name: "Study Buddy", line: "Answers from your own notes.", chips: ["My notes", "English"], Icon: BookIcon },
  { code: "AGTx004", name: "Taglish Explainer", line: "Any screen, explained the way you talk.", chips: ["Any app", "Taglish"], Icon: ChatIcon },
];

export function Agents({ onWatch }: { onWatch: () => void }) {
  const section = useRef<HTMLElement>(null);
  const start = useRef<HTMLButtonElement>(null);

  return (
    <section ref={section} id="agents" className="section agents" aria-labelledby="agents-title">
      <div className="agents-head">
        <p className="eyebrow">Customizable agents</p>
        <h2 id="agents-title" className="h-section">Pick an agent.</h2>
        <p className="lede">
          An agent is a preset: instructions, up to five knowledge bases, a language and a voice. Start from a template and make it
          yours.
        </p>
      </div>
      {AGENTS.map(({ code, name, line, chips, Icon }, i) => (
        <article key={code} className="agent-card">
          <span className="agent-code mono">{code}</span>
          <span className="agent-tile">
            <Icon width={22} height={22} />
          </span>
          <h3 className="h2">{name}</h3>
          <p className="agent-line">{line}</p>
          <p className="agent-chips">
            {chips.map((c) => (
              <span key={c} className="chip chip-plain">
                {c}
              </span>
            ))}
          </p>
          <div className={`agent-foot${i < 2 ? " is-reserve" : ""}`}>
            {i === 0 && <GeckoSlot id="agents" section={section} target={start} className="slot-agents" label="GetCko pointing at Start on Office Helper" />}
            <button
              ref={i === 0 ? start : undefined}
              type="button"
              className={`btn btn-primary btn-sm${i === 0 ? " gc-target" : ""}`}
              aria-label={`Start ${name}: watch it in the demo`}
              onClick={onWatch}
            >
              Start
            </button>
          </div>
        </article>
      ))}
      <article className="agent-card agent-new" aria-labelledby="new-agent">
        <span className="agent-tile agent-tile-new" aria-hidden="true">
          +
        </span>
        <h3 id="new-agent" className="h2">
          New agent
        </h3>
        <p className="agent-line">Write instructions, attach files, pick a voice.</p>
      </article>
      <p className="caption agents-note">Templates ship with the desktop app. Start plays the demo.</p>
    </section>
  );
}
