// Left pane: the knowledge bases, one button each. The open one is a surface-2 tile with the gecko
// dot at its end (same language as the sidebar's NavLink, no side stripe).
import type { KnowledgeBase } from "../../bindings/KnowledgeBase";
import type { KnowledgeBaseId } from "../../bindings/KnowledgeBaseId";
import { GeckoDot, Panel, cn } from "../../components/ui";
import { KB_COPY } from "./copy";
import { T } from "../../brand/lexicon";
import { NameForm } from "./NameForm";

export interface KbListProps {
  kbs: readonly KnowledgeBase[];
  selected: KnowledgeBaseId | null;
  onSelect: (id: KnowledgeBaseId) => void;
  /** Show the inline create form at the top. */
  creating: boolean;
  onCreate: (name: string) => Promise<void>;
  onCancelCreate: () => void;
}

export function KbList({ kbs, selected, onSelect, creating, onCreate, onCancelCreate }: KbListProps) {
  return (
    <Panel as="aside" padding="none" aria-label={KB_COPY.listLabel} className="w-48 shrink-0 p-2">
      {creating && (
        <NameForm
          others={kbs.map((k) => k.name)}
          onSubmit={onCreate}
          onCancel={onCancelCreate}
          className="mb-2 rounded-tile bg-surface-2 p-3"
        />
      )}
      <ul className="flex flex-col gap-1">
        {kbs.map((kb) => {
          const active = kb.id === selected;
          return (
            <li key={kb.id}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(kb.id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-tile px-3 py-2 text-left transition-colors",
                  active ? "bg-surface-2" : "hover:bg-surface-2",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate text-label text-text", active && "font-semibold")}>{kb.name}</span>
                  <span className="nums truncate text-caption text-text-3">{T.knowledgeBase.documentsCount(kb.documentCount)}</span>
                  {/* Own line so the live status never truncates in the narrow column. */}
                  {kb.status === "processing" && <span className="text-caption text-text-2">{KB_COPY.processingSuffix}</span>}
                </span>
                {active && <GeckoDot />}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
