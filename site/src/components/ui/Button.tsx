import { isValidElement, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { ICON_PROPS, type IconComponent } from "../../brand/icons";
import { cn } from "./cn";
import { Keycap } from "./Keycap";
import type { Platform } from "./platform";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = solid inverse (ink on light, mist on dark). secondary = outlined. ghost = underlined text. */
  variant?: ButtonVariant;
  /** sm 44px, md 48px (default), lg 52px (hero). */
  size?: ButtonSize;
  /** Leading icon from Icon (src/brand/icons), 24px. Only when the icon adds meaning (add, start, try again). */
  icon?: IconComponent;
  /** Keycap slot: a ready <Keycap/>, an array of key tokens, or "hotkey" for Option/Ctrl Space. */
  keycap?: ReactNode | string[] | "hotkey";
  /** Platform for a generated keycap. Default "auto". */
  platform?: Platform | "auto";
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-2 border-inverse bg-inverse text-inverse-text hover:border-text-2 hover:bg-text-2 " +
    "disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-text",
  secondary:
    "border-2 border-text bg-surface text-text hover:bg-surface-2 " +
    "disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-text",
  ghost:
    "border-0 bg-transparent px-1 text-text underline decoration-1 underline-offset-4 hover:decoration-2 " +
    "disabled:text-disabled-text disabled:no-underline",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-label leading-5",
  md: "h-12 px-5 text-body leading-5",
  lg: "h-[52px] px-6 text-body leading-5",
};

/** Primary / secondary / ghost button. Sentence-case labels, one primary per view. */
export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  keycap,
  platform = "auto",
  type = "button",
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  let cap: ReactNode = null;
  if (keycap != null && keycap !== false) {
    const tone = variant === "primary" ? "inverse" : "default";
    if (keycap === "hotkey") cap = <Keycap hotkey platform={platform} tone={tone} />;
    else if (Array.isArray(keycap)) cap = <Keycap keys={keycap as string[]} platform={platform} tone={tone} />;
    else if (isValidElement(keycap) || typeof keycap === "string") cap = keycap;
  }
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cn(
        "inline-flex min-h-11 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-button font-semibold",
        "transition-[background-color,border-color,color,text-decoration-thickness,translate] active:translate-y-px",
        "disabled:cursor-not-allowed disabled:active:translate-y-0",
        variant !== "ghost" && SIZE[size],
        variant === "ghost" && (size === "sm" ? "text-label leading-5" : "text-body leading-5"),
        VARIANT[variant],
        className,
      )}
    >
      {Icon && <Icon {...ICON_PROPS} className="-my-1 -ml-1" />}
      {children}
      {cap && <span className="-mr-1 inline-flex">{cap}</span>}
    </button>
  );
}

export type IconButtonVariant = "default" | "accent" | "chrome";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  icon: IconComponent;
  /** Required accessible name (also the native tooltip). */
  label: string;
  /** default = quiet text-2 icon. accent = gecko fill (mic or the single main action only). chrome = inside the session bar. */
  variant?: IconButtonVariant;
  /** md 48px (default), sm 44px (dense rows, composer, session bar). */
  size?: "sm" | "md";
  /** Toggle / hold state, sets aria-pressed. */
  pressed?: boolean;
  /** Hide the native title tooltip. */
  noTooltip?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const ICON_VARIANT: Record<IconButtonVariant, string> = {
  default: "bg-transparent text-text-2 hover:bg-surface-2 hover:text-text aria-pressed:bg-surface-2 aria-pressed:text-text",
  accent:
    "bg-accent text-on-accent hover:brightness-[.94] active:brightness-90 " +
    "aria-pressed:bg-chrome-raised aria-pressed:text-accent aria-pressed:inset-ring-2 aria-pressed:inset-ring-accent aria-pressed:hover:brightness-100",
  chrome: "bg-transparent text-chrome-text-2 hover:bg-chrome-raised hover:text-chrome-text aria-pressed:bg-chrome-raised aria-pressed:text-chrome-text",
};

/** Square icon-only button, radius 14. Never a circle. */
export function IconButton({
  icon: Icon,
  label,
  variant = "default",
  size = "md",
  pressed,
  noTooltip,
  type = "button",
  className,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      title={noTooltip ? undefined : label}
      {...rest}
      className={cn(
        "inline-grid shrink-0 select-none place-items-center rounded-button transition-[background-color,color,filter,translate] active:translate-y-px",
        size === "md" ? "size-12" : "size-11",
        ICON_VARIANT[variant],
        "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text disabled:hover:brightness-100",
        className,
      )}
    >
      <Icon {...ICON_PROPS} />
    </button>
  );
}
