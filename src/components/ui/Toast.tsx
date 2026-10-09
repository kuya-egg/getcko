import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from "react";
import { GeckoDot } from "./Chips";
import { cn } from "./cn";

/** How long a toast stays, ms. */
export const TOAST_MS = 4000;

export interface ToastState {
  id: number;
  message: string;
}

/**
 * Toast state: `const toast = useToast(); toast.show(T.toast.saved); <Toast {...toast.props} />`.
 * One at a time; a new one replaces the old. Auto-hides after 4 s, paused while hovered or focused.
 */
export function useToast(duration = TOAST_MS) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const clear = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const dismiss = useCallback(() => {
    clear();
    setCurrent(null);
  }, []);
  const arm = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => setCurrent(null), duration);
  }, [duration]);
  const show = useCallback(
    (message: string) => {
      seq.current += 1;
      setCurrent({ id: seq.current, message });
      arm();
    },
    [arm],
  );

  useEffect(() => clear, []);

  return {
    toast: current,
    show,
    dismiss,
    /** Spread onto <Toast/>. */
    props: { toast: current, onPause: clear, onResume: arm },
  };
}

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  toast: ToastState | null;
  onPause?: () => void;
  onResume?: () => void;
}

/**
 * Ink pill, bottom-left, above everything but the Screen Help overlay. The live region is always
 * mounted (role="status") so screen readers announce each message. Past tense, no period: "Saved".
 */
export function Toast({ toast, onPause, onResume, className, ...rest }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      {...rest}
      className={cn("pointer-events-none fixed bottom-6 left-6 z-toast", className)}
    >
      {toast && (
        <div
          key={toast.id}
          onMouseEnter={onPause}
          onMouseLeave={onResume}
          className="gc-rise-in pointer-events-auto inline-flex h-11 items-center gap-2.5 rounded-pill border border-chrome-border bg-chrome px-4 text-label text-chrome-text shadow-overlay"
        >
          <GeckoDot />
          {toast.message}
        </div>
      )}
    </div>
  );
}
