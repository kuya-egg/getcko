import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";
import { ICON_PROPS, Icon } from "../../brand/icons";
import { cn } from "./cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "children"> {
  /** Always visible, sentence case. */
  label: ReactNode;
  options: readonly SelectOption[];
  /** Caption under the field. */
  helper?: ReactNode;
  /** Classes for the wrapper. */
  className?: string;
  /** Hide the visible label (it stays as the accessible name). Use only beside another visible label. */
  hideLabel?: boolean;
  ref?: Ref<HTMLSelectElement>;
}

/**
 * Native <select> styled like TextField (h44, radius 8, 1.5px border-strong), with the pixel caret
 * (Icon.chevronDown). Native keeps keyboard, type-ahead and the OS menu.
 */
export function Select({ label, options, helper, className, hideLabel, id: idProp, ref, ...rest }: SelectProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const noteId = `${id}-note`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-label text-text", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-describedby={helper ? noteId : undefined}
          {...rest}
          className={cn(
            "h-11 w-full cursor-pointer appearance-none truncate rounded-input border-[1.5px] border-border-strong bg-surface pr-10 pl-3 text-body text-text",
            "transition-[border-color] hover:border-text-3",
            "focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-solid focus-visible:outline-focus-wash",
            "disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-text",
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon.chevronDown
          {...ICON_PROPS}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-text-2"
        />
      </div>
      {helper && (
        <p id={noteId} className="text-caption text-text-3">
          {helper}
        </p>
      )}
    </div>
  );
}
