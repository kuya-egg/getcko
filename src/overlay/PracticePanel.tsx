// Dev-only: a small "Practice" chip that opens scripted questions about the practice sheet,
// so Screen Help can be demoed end to end without the AI. Rendered only when import.meta.env.DEV.

import { useLayoutEffect, useState, type Ref } from "react";
import { Icon, ICON_PROPS } from "../brand/icons";
import { T } from "../brand/lexicon";
import type { Rect } from "../brand/motion";
import { Button, IconButton } from "../components/ui";
import { askPractice, inTauri, openPracticeSheet } from "./bridge";
import { DEV, PRACTICE } from "./demo/script";

export interface PracticePanelProps {
  /** Work area in CSS px; the panel sits at its bottom-left. */
  area: Rect;
  /** Called when a question is asked, before GetCko answers (shows the thinking pose). */
  onAsk: () => void;
  /** Called after the panel changes size, so hit regions follow it. */
  onLayout: () => void;
  ref?: Ref<HTMLDivElement>;
}

export function PracticePanel({ area, onAsk, onLayout, ref }: PracticePanelProps) {
  const [open, setOpen] = useState(false);

  useLayoutEffect(onLayout, [open, onLayout]);

  if (!inTauri) return null;

  const style = { left: area.x + 24, bottom: window.innerHeight - (area.y + area.h) + 24 };

  if (!open) {
    return (
      <div ref={ref} className="pointer-events-auto absolute" style={style}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hit inline-flex h-11 items-center gap-2 rounded-pill bg-inverse pr-4 pl-3 text-label text-inverse-text shadow-overlay transition-opacity hover:opacity-90"
        >
          <Icon.screenHelp {...ICON_PROPS} />
          {DEV.practice}
        </button>
      </div>
    );
  }

  const ask = (id: string) => {
    setOpen(false);
    onAsk();
    void askPractice(id);
  };

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute w-[340px] overflow-hidden rounded-panel border border-border bg-surface text-text shadow-overlay"
      style={style}
    >
      <header className="flex min-h-11 items-center gap-2 py-1.5 pr-1.5 pl-5">
        <p className="eyebrow flex-1 text-text-2">{DEV.practice}</p>
        <IconButton icon={Icon.close} label={T.actions.close} size="sm" onClick={() => setOpen(false)} />
      </header>
      <p className="px-5 pb-2 text-caption text-text-2">{DEV.practiceHint}</p>
      <ul>
        {PRACTICE.map((item) => (
          <li key={item.id} className="border-t border-border">
            <button
              type="button"
              onClick={() => ask(item.id)}
              className="hit flex min-h-11 w-full items-center gap-3 px-5 py-2.5 text-left text-label text-text transition-colors hover:bg-surface-2"
            >
              <Icon.question {...ICON_PROPS} className="shrink-0 text-text-3" />
              {item.question}
            </button>
          </li>
        ))}
      </ul>
      <footer className="border-t border-border px-4 py-1">
        <Button variant="ghost" size="sm" onClick={() => void openPracticeSheet()}>
          {DEV.openSheet}
        </Button>
      </footer>
    </div>
  );
}
