import { useEffect, useState } from "react";
import { agentActive, kbList, setupStatus } from "./lib/getcko";
import type { Agent } from "./bindings/Agent";
import type { KnowledgeBase } from "./bindings/KnowledgeBase";
import type { SetupStatus } from "./bindings/SetupStatus";

function App() {
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[] | null>(null);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([setupStatus(), kbList(), agentActive()])
      .then(([status, bases, agent]) => {
        setSetup(status);
        setKnowledgeBases(bases);
        setActiveAgent(agent);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, []);

  return (
    <main>
      <h1>GetCko developer status</h1>
      {error !== null && <p role="alert">Error: {error}</p>}
      <section>
        <h2>Components</h2>
        {setup === null ? <p>Loading…</p> : <ul>
          {setup.components.map((component) => (
            <li key={component.component}>
              {component.component}: {String(component.ready)}{component.detail ? ` — ${component.detail}` : ""}
            </li>
          ))}
        </ul>}
      </section>
      <section>
        <h2>Permissions</h2>
        {setup !== null && <ul>
          {setup.permissions.map((permission) => (
            <li key={permission.kind}>{permission.kind}: {permission.status}</li>
          ))}
        </ul>}
      </section>
      <section>
        <h2>Workspace</h2>
        <p>Knowledge bases: {knowledgeBases === null ? "Loading…" : knowledgeBases.length}</p>
        <p>Active agent: {activeAgent?.name ?? "None"}</p>
      </section>
    </main>
  );
}

export default App;
