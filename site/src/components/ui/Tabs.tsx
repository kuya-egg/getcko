import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem<V extends string> {
  value: V;
  label: ReactNode;
  /** Panel content for this tab. Omit to render panels yourself (then use tabPanelProps). */
  panel?: ReactNode;
}

export interface TabsProps<V extends string> {
  tabs: readonly TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
  /** Classes for the panel. */
  panelClassName?: string;
}

/**
 * Tabs for switching views inside one screen (agent editor sections, settings groups).
 * Underline marks the current tab (2px, text color: no green, no side stripe). Arrow keys move
 * between tabs and select them; one tab stop.
 */
export function Tabs<V extends string>({ tabs, value, onChange, label, className, panelClassName }: TabsProps<V>) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(
    0,
    tabs.findIndex((t) => t.value === value),
  );
  const current = tabs[idx];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next == null) return;
    e.preventDefault();
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-6 border-b border-border">
        {tabs.map((t, i) => {
          const on = t.value === value;
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.value}`}
              aria-selected={on}
              aria-controls={`${base}-panel-${t.value}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.value)}
              className={cn(
                "-mb-px inline-flex h-11 items-center border-b-2 text-label whitespace-nowrap transition-colors",
                on ? "border-text font-semibold text-text" : "border-transparent text-text-2 hover:text-text",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {current?.panel !== undefined && (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.value}`}
          aria-labelledby={`${base}-tab-${current.value}`}
          tabIndex={0}
          className={cn("pt-6 focus-visible:outline-offset-4", panelClassName)}
        >
          {current.panel}
        </div>
      )}
    </div>
  );
}
