// Icon contact sheet: every icon at every allowed size, light and dark side by side, next to the
// mascot at the same cell size and inside the parts that use them. Visual QA, not product UI.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import "../../src/brand/index.css";
import { CUSTOM_ICONS, DOC_ICON, ICON_PROPS, ICON_SIZE, Icon, type IconName } from "../../src/brand/icons";
import { GetCkoSprite, MOMENT_POSE } from "../../src/brand/mascot";
import { T } from "../../src/brand/lexicon";
import {
  Button,
  CitationChip,
  IconButton,
  KnowledgeBaseList,
  KnowledgeBaseRow,
  OfflineBadge,
  StatusChip,
  cn,
} from "../../src/components/ui";

/** Copy the dark token block from tokens.css onto a wrapper, so one page shows both themes. */
function darkVars(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (list: CSSRuleList) => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSStyleRule && r.selectorText === ':root[data-theme="dark"]') {
        for (const p of Array.from(r.style)) out[p] = r.style.getPropertyValue(p);
      } else if ("cssRules" in r) {
        walk((r as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      /* cross-origin sheet */
    }
  }
  return out;
}

function Themed({ dark, children }: { dark?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!dark || !ref.current) return;
    for (const [k, v] of Object.entries(darkVars())) ref.current.style.setProperty(k, v);
  }, [dark]);
  return (
    <div ref={ref} className="flex flex-col gap-8 bg-bg p-8 text-text">
      {children}
    </div>
  );
}

const NAMES = Object.keys(Icon) as IconName[];
const isCustom = (n: string) => (CUSTOM_ICONS as readonly string[]).includes(n);

function Cell({ name, children, custom }: { name: string; children: ReactNode; custom?: boolean }) {
  return (
    <li className="flex flex-col items-start gap-2 rounded-tile border border-border bg-surface p-3">
      <div className="flex items-end gap-3">{children}</div>
      <span className={cn("font-mono text-keys", custom ? "text-accent-text" : "text-text-3")}>{name}</span>
    </li>
  );
}

function Panel({ dark }: { dark?: boolean }) {
  return (
    <Themed dark={dark}>
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-h2">{dark ? "Dark" : "Light"}</h2>
        <span className="font-mono text-keys text-text-3">green name = hand-drawn · grey = pixelarticons</span>
      </header>

      <section className="flex flex-col gap-3">
        <p className="eyebrow text-text-2">Family: GetcKo 2x with icons 24, GetcKo 4x with icons 48 (same cell)</p>
        <div className="flex flex-wrap items-end gap-6 rounded-panel border border-border bg-surface p-6 text-text">
          <GetCkoSprite pose={MOMENT_POSE.screenHelp} scale={2} label="GetcKo" />
          <Icon.screenHelp {...ICON_PROPS} />
          <Icon.pushToTalk {...ICON_PROPS} />
          <Icon.source {...ICON_PROPS} />
          <Icon.agent {...ICON_PROPS} />
          <Icon.offline {...ICON_PROPS} />
          <span className="w-6" />
          <GetCkoSprite pose={MOMENT_POSE.offline} scale={4} label="GetcKo offline" />
          <Icon.offline {...ICON_PROPS} size={ICON_SIZE.x2} />
          <Icon.agent {...ICON_PROPS} size={ICON_SIZE.x2} />
          <Icon.knowledgeBase {...ICON_PROPS} size={ICON_SIZE.x2} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="eyebrow text-text-2">In parts</p>
        <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={Icon.addDocuments}>
              {T.actions.addDocuments}
            </Button>
            <Button icon={Icon.start}>{T.actions.start}</Button>
            <Button variant="secondary" size="sm" icon={Icon.retry}>
              {T.actions.tryAgain}
            </Button>
            <IconButton icon={Icon.pushToTalk} label={T.aria.holdToTalk} variant="accent" />
            <IconButton icon={Icon.pushToTalk} label={T.aria.listening} variant="accent" pressed />
            <IconButton icon={Icon.screenHelp} label={T.aria.screenHelp} />
            <IconButton icon={Icon.readAloud} label={T.agent.answerOutLoudLabel} />
            <IconButton icon={Icon.close} label={T.aria.closeAnswer} size="sm" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status="ready" />
            <StatusChip status="processing" />
            <StatusChip status="failed" reason="scanned image" />
            <OfflineBadge detail="on this Mac" />
            <CitationChip source="Grading guide" page={4} />
          </div>
          <KnowledgeBaseList className="rounded-panel border border-border px-4">
            <KnowledgeBaseRow name="Records manual 2026.pdf" pages={48} passages={312} status="ready" />
            <KnowledgeBaseRow name="Barangay clearance steps.md" pages={6} status="processing" />
            <KnowledgeBaseRow name="Front desk script.txt" pages={2} passages={9} status="ready" />
            <KnowledgeBaseRow name="Memo 0423 scan.pdf" meta="3 pages · no text found" status="failed" reason="scanned image" />
          </KnowledgeBaseList>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="eyebrow text-text-2">Every icon at 24 and 48</p>
        <ul className="grid grid-cols-4 gap-3">
          {NAMES.map((n) => {
            const I = Icon[n];
            return (
              <Cell key={n} name={n} custom={isCustom(n)}>
                <I {...ICON_PROPS} className={n === "processing" ? "gc-icon-spin" : undefined} />
                <I {...ICON_PROPS} size={ICON_SIZE.x2} />
              </Cell>
            );
          })}
          {(Object.keys(DOC_ICON) as (keyof typeof DOC_ICON)[]).map((k) => {
            const I = DOC_ICON[k];
            return (
              <Cell key={k} name={`DOC_ICON.${k}`} custom={k !== "pptx"}>
                <I {...ICON_PROPS} />
                <I {...ICON_PROPS} size={ICON_SIZE.x2} />
              </Cell>
            );
          })}
        </ul>
      </section>
    </Themed>
  );
}

function Sheet() {
  return (
    <div className="grid min-h-screen grid-cols-2 bg-bg">
      <Panel />
      <Panel dark />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Sheet />);
