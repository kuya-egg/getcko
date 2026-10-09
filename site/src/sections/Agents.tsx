import { useRef } from "react";
import { pointPoseFor } from "../brand/mascot";
import { T } from "../brand/lexicon";
import { AgentCard, Kw, NewAgentCard, Surface } from "../components/ui";
import { SectionHead } from "../components/SectionHead";
import { GeckoSlot } from "../gecko/react";
import { SITE } from "../copy";

const TEMPLATES = [
  { ...T.templates.officeHelper, kbs: ["Office manual"], language: T.languages.English },
  { ...T.templates.teacher, kbs: ["DepEd forms"], language: T.languages.English },
  { ...T.templates.studyBuddy, kbs: ["My notes"], language: T.languages.English },
];

/** Templates on the canopy edge. GetcKo points down-right at the first card's Start. */
export function Agents({ onWatch }: { onWatch: () => void }) {
  const section = useRef<HTMLElement>(null);
  const first = T.templates.officeHelper.name;

  return (
    <Surface ref={section} id="agents" texture="canopy" tone="paper" aria-labelledby="agents-title" className="site-section site-section--canopy seam-bottom">
      <div className="site-wrap flex flex-col gap-12">
        <SectionHead id="agents-title" eyebrow={SITE.agents.eyebrow} title={SITE.agents.title}>
          An agent is <Kw>instructions</Kw>, your <Kw>documents</Kw> and a voice. Change anything later.
        </SectionHead>
        <div className="agents-row">
          <GeckoSlot
            id="agents"
            section={section}
            pose={pointPoseFor("downRight")}
            target={() => section.current?.querySelector<HTMLElement>(`button[aria-label="${T.aria.startAgent(first)}"]`)}
            className="slot-agents"
            label={T.mascot.pointingAt(T.aria.startAgent(first))}
          />
          <div className="agents-grid">
            {TEMPLATES.map((t, i) => (
              <AgentCard
                key={t.name}
                name={t.name}
                description={t.line}
                knowledgeBases={t.kbs}
                language={t.language}
                onStart={onWatch}
                startVariant={i === 0 ? "primary" : "secondary"}
              />
            ))}
            <NewAgentCard onClick={onWatch} />
          </div>
        </div>
      </div>
    </Surface>
  );
}
