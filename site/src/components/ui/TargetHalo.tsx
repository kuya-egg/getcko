import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { haloIn, haloOut } from "../../brand/motion";
import { cn } from "./cn";

export interface TargetHaloProps extends HTMLAttributes<HTMLSpanElement> {
  /** Ring on or off. Only ONE active halo per screen. Default true. */
  active?: boolean;
  /** Use the white+sun double ring for always-dark chrome or ink video frames. */
  onDark?: boolean;
  /** Animate with haloIn / haloOut (GSAP) instead of a static ring. Respects reduced motion. */
  animate?: boolean;
  /** Corner radius of the wrapped element, so the ring follows its shape. Default "var(--gc-r-button)". */
  radius?: string | number;
  /** Render as block (div) instead of inline-block span. */
  block?: boolean;
  children: ReactNode;
}

/**
 * Wraps the one element GetcKo points at with the sun ring. The ring is box-shadow spread only:
 * no blur, no glow. Never the only signal: the answer text also names the element.
 */
export function TargetHalo({
  active = true,
  onDark,
  animate,
  radius = "var(--gc-r-button)",
  block,
  className,
  style,
  children,
  ...rest
}: TargetHaloProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !animate || onDark) return;
    if (first.current && !active) {
      first.current = false;
      return;
    }
    first.current = false;
    const tl = active ? haloIn(el) : haloOut(el);
    return () => {
      tl.kill();
    };
  }, [active, animate, onDark]);

  const Tag = (block ? "div" : "span") as "span";
  const staticRing = !animate || onDark;
  return (
    <Tag
      ref={ref}
      data-gc-target={active ? "" : undefined}
      {...rest}
      className={cn(
        block ? "block" : "inline-block",
        "relative z-[1] transition-shadow",
        staticRing && active && (onDark ? "shadow-halo-dark" : "target-halo"),
        className,
      )}
      style={{ borderRadius: radius, ...style }}
    >
      {children}
    </Tag>
  );
}
