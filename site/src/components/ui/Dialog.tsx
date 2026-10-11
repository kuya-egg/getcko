import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface DialogProps {
  open: boolean;
  /** Esc, scrim click, or a cancel button. The caller sets open=false. */
  onClose: () => void;
  /** ≤ 6 words, a question for confirmations ("Delete Office Helper?"). */
  title: ReactNode;
  /** One line under the title. */
  body?: ReactNode;
  /** Extra content between body and actions (a field, a list). */
  children?: ReactNode;
  /** Buttons, right aligned: secondary first, the one primary last. */
  actions?: ReactNode;
  /** Close when the scrim is clicked. Default true. */
  dismissOnScrim?: boolean;
  /** 768px panel instead of 448px, for media such as the demo video. */
  wide?: boolean;
  className?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal on the native <dialog> (top layer, inert page behind it). Flat bg-ink/40 scrim, no blur;
 * radius 20 panel with shadow-overlay. Focus moves into the dialog, Tab wraps inside it, and focus
 * returns to the opener on close. Use only for destructive confirmations or a task that needs focus.
 */
export function Dialog({ open, onClose, title, body, children, actions, dismissOnScrim = true, wide = false, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      try {
        d.showModal();
      } catch {
        d.setAttribute("open", "");
      }
      // Focus the first control that is not the primary destructive action: the last button is primary,
      // so start on the first (usually Cancel / Keep).
      const first = d.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  // Return focus whenever the dialog closes (Esc, scrim, or a button).
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const restore = () => {
      const el = opener.current as HTMLElement | null;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
    };
    d.addEventListener("close", restore);
    return () => d.removeEventListener("close", restore);
  }, []);

  const trap = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Tab") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={trap}
      onClick={(e) => {
        if (dismissOnScrim && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "z-dialog m-auto w-full overflow-visible rounded-panel border border-border bg-surface p-0 text-text shadow-overlay",
        wide ? "max-w-3xl" : "max-w-md",
        "backdrop:bg-ink/40",
        className,
      )}
    >
      {/* Inner box so clicks on the padding are not read as scrim clicks. */}
      <div className="flex flex-col gap-2 p-6">
        <h2 id={titleId} className="text-title font-display text-text">
          {title}
        </h2>
        {body && (
          <p id={bodyId} className="text-body text-text-2">
            {body}
          </p>
        )}
        {children && <div className="mt-2">{children}</div>}
        {actions && <div className="mt-4 flex flex-wrap items-center justify-end gap-3">{actions}</div>}
      </div>
    </dialog>
  );
}
