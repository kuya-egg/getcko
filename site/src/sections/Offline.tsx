import { useRef } from "react";
import { GeckoSlot } from "../gecko/react";
import { WifiOffIcon } from "../components/ui";

// Model stack from docs/architecture.md ("Local models and runtime").
const STACK = [
  ["Chat, pointing, screenshots", "Gemma 4 E2B"],
  ["Embeddings", "EmbeddingGemma-300m"],
  ["Vector search", "sqlite-vector"],
  ["Speech to text", "Gemma 4 E2B (audio)"],
  ["Voice", "Your computer's built-in voices"],
] as const;

// Latency budget per question (PRD). Targets, not measurements.
const BUDGET = [
  { step: "Speech to text", s: 1.5 },
  { step: "Screen read + retrieval", s: 0.3 },
  { step: "First token", s: 0.3 },
  { step: "Full answer", s: 1.0 },
  { step: "Voice starts", s: 0.5 },
] as const;

const PRINCIPLES = [
  ["It points, never clicks.", "GetCko shows the way. You stay in control of the mouse and keyboard."],
  ["Visible, never hidden.", "It shows up in screen share. There is no stealth mode."],
  ["Grounded or silent.", "Every answer cites its source. If nothing fits, it says \u201cI don't know.\u201d"],
] as const;

export function Offline() {
  const section = useRef<HTMLElement>(null);
  const chip = useRef<HTMLSpanElement>(null);

  return (
    <section ref={section} id="privacy" className="section offline" aria-labelledby="offline-title">
      <div className="offline-head">
        <p className="eyebrow">Local and honest</p>
        <h2 id="offline-title" className="h-section">
          Wi-Fi off.
          <br />
          Gets mo pa rin.
        </h2>
        <p className="lede">
          Every model runs on your laptop. The internet is used once, to download the models, and never while you work.
        </p>
      </div>

      <div className="monitor">
        <div className="monitor-top">
          <span className="monitor-wifi">
            <WifiOffIcon /> Wi-Fi
          </span>
          <span className="toggle" role="img" aria-label="Wi-Fi switched off">
            <i />
          </span>
          <span ref={chip} className="chip chip-offline gc-target">
            Offline
          </span>
        </div>
        <p className="monitor-read mono" aria-label="Network traffic: zero bytes per second up and down">
          <span>↑ 0 B/s</span>
          <span>↓ 0 B/s</span>
        </p>
        <p className="caption">Illustration. In the demo, Wi-Fi is off and a network monitor stays on screen.</p>
        <GeckoSlot id="offline" section={section} target={chip} className="slot-offline" label="GetCko pointing at the Offline chip" />
      </div>

      <div className="stack">
        <h3 className="h2">What runs where</h3>
        <table className="stack-table">
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Model</th>
              <th scope="col">Runs on</th>
            </tr>
          </thead>
          <tbody>
            {STACK.map(([job, model]) => (
              <tr key={job}>
                <td>{job}</td>
                <td className="mono">{model}</td>
                <td>
                  <span className="chip chip-ready">
                    <span className="live-dot" aria-hidden="true" />
                    Your laptop
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="budget">
        <h3 className="h2">
          About 3 seconds, question to voice <span className="chip chip-plain">Target</span>
        </h3>
        <div className="budget-bar" role="img" aria-label={`Latency budget: ${BUDGET.map((b) => `${b.step} ${b.s} seconds`).join(", ")}`}>
          {BUDGET.map((b) => (
            <span key={b.step} className="budget-seg" style={{ flex: `${b.s} 1 0` }}>
              <span className="mono">{b.s.toFixed(1)} s</span>
            </span>
          ))}
        </div>
        <ol className="budget-legend">
          {BUDGET.map((b) => (
            <li key={b.step}>
              <i aria-hidden="true" />
              {b.step} <span className="mono muted">≤ {b.s.toFixed(1)} s</span>
            </li>
          ))}
        </ol>
        <p className="caption">
          Steps overlap: the voice starts while the answer is still streaming. Measured numbers will be published with the benchmark script.
        </p>
      </div>

      <ul className="principles">
        {PRINCIPLES.map(([t, d]) => (
          <li key={t}>
            <p className="h2">{t}</p>
            <p>{d}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
