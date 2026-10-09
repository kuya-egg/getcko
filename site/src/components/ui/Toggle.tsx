import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "./cn";

interface ChoiceBase extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  label: ReactNode;
  /** Optional one-line caption under the label. */
  description?: ReactNode;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

export type CheckboxProps = ChoiceBase;
export type ToggleProps = ChoiceBase;

function Row(props: { id: string; label: ReactNode; description?: ReactNode; control: ReactNode; className?: string }) {
  const { id, label, description, control, className } = props;
  return (
    <div className={cn("flex min-h-11 items-start gap-3 py-2.5", className)}>
      {control}
      <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5 text-label text-text">
        {label}
        {description && <span className="text-caption text-text-3">{description}</span>}
      </label>
    </div>
  );
}

/** Native checkbox, accent-color = focus token, with a visible label. */
export function Checkbox({ label, description, className, id: idProp, ref, ...rest }: CheckboxProps) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Row
      id={id}
      label={label}
      description={description}
      className={className}
      control={
        <input
          ref={ref}
          id={id}
          type="checkbox"
          {...rest}
          className="mt-0.5 size-5 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus disabled:cursor-not-allowed"
        />
      }
    />
  );
}

const SWITCH = [
  "relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-pill border-[1.5px] border-border-strong bg-surface-2",
  "transition-[background-color,border-color]",
  "before:absolute before:top-[3px] before:left-[3px] before:size-[15px] before:rounded-pill before:bg-text-2 before:content-['']",
  "before:transition-[translate,background-color] before:duration-[var(--gc-dur-fast)] before:ease-gc-out",
  "checked:border-accent checked:bg-accent checked:before:translate-x-4 checked:before:bg-on-accent",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:before:bg-disabled-text",
].join(" ");

/**
 * On/off switch. Still a native checkbox (role="switch"), so keyboard, forms and screen readers work.
 * The track is a gecko fill when on and the thumb is ink. Use for settings that apply immediately.
 */
export function Toggle({ label, description, className, id: idProp, ref, ...rest }: ToggleProps) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Row
      id={id}
      label={label}
      description={description}
      className={className}
      control={<input ref={ref} id={id} type="checkbox" role="switch" {...rest} className={SWITCH} />}
    />
  );
}
