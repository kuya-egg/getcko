import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { fmtSpeed } from "../../brand/lexicon";
import { cn } from "./cn";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "className"> {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Value text, shown in mono and read by screen readers. Default fmtSpeed: "1.0×". */
  format?: (value: number) => string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

const RANGE = [
  "h-11 w-full cursor-pointer appearance-none bg-transparent",
  // track
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-pill [&::-webkit-slider-runnable-track]:bg-border-strong",
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-pill [&::-moz-range-track]:bg-border-strong",
  "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-pill [&::-moz-range-progress]:bg-accent",
  // thumb: 20px inverse square-ish pill with a surface ring, like the Toggle thumb
  "[&::-webkit-slider-thumb]:-mt-1.75 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill",
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-inverse [&::-webkit-slider-thumb]:shadow-card",
  "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-inverse",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

/** Native range with a visible label and the value in mono to its right ("Speaking speed  1.0×"). */
export function Slider({
  label,
  value,
  onChange,
  min = 0.5,
  max = 2,
  step = 0.1,
  format = fmtSpeed,
  className,
  id: idProp,
  ref,
  ...rest
}: SliderProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const text = format(value);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label text-text">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-keys nums text-text-2">
          {text}
        </output>
      </div>
      <input
        ref={ref}
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        {...rest}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className={RANGE}
      />
    </div>
  );
}
