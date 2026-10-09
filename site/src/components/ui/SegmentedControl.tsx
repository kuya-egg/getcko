import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
}

export interface SegmentedControlProps<V extends string> {
  options: readonly SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the group (a visible label nearby should say the same). */
  label: string;
  /** Stretch to the container width, segments share it equally. */
  block?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * Two to four mutually exclusive choices that apply at once (theme, answer length, language).
 * A radiogroup: one tab stop, arrow keys move and select. Selected = inverse fill.
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
  block,
  className,
  disabled,
}: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in keys) next = (idx + keys[e.key] + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next == null) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "gap-1 rounded-button border border-border bg-surface p-1",
        block ? "flex w-full" : "inline-flex self-start",
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-window px-3 text-label transition-colors",
              block && "flex-1",
              on ? "bg-inverse font-semibold text-inverse-text" : "text-text-2 hover:bg-surface-2 hover:text-text",
              "disabled:cursor-not-allowed disabled:text-disabled-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
