import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface HoldToTalkOptions {
  onStart?: () => void;
  onEnd?: () => void;
  disabled?: boolean;
}

/**
 * Press-and-hold behavior for the mic: pointer down starts, pointer up / cancel ends.
 * Space or Enter held on the focused button does the same for keyboard users.
 * Returns props to spread on a <button> plus the current `holding` state.
 */
export function useHoldToTalk({ onStart, onEnd, disabled }: HoldToTalkOptions) {
  const [holding, setHolding] = useState(false);
  const active = useRef(false);

  const start = useCallback(() => {
    if (disabled || active.current) return;
    active.current = true;
    setHolding(true);
    onStart?.();
  }, [disabled, onStart]);

  const end = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    setHolding(false);
    onEnd?.();
  }, [onEnd]);

  const bind = {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        start();
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        end();
      }
    },
    onBlur: end,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };

  return { holding, bind };
}
