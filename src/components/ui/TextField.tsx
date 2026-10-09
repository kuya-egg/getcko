import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

interface FieldBase {
  /** Always visible. Sentence case. */
  label: ReactNode;
  /** Caption under the field. Replaced by `error` when set. */
  helper?: ReactNode;
  /** Error message: what happened and what to do. Sets aria-invalid. */
  error?: ReactNode;
  /** Classes for the outer wrapper. */
  className?: string;
  /** Classes for the input / textarea itself. */
  inputClassName?: string;
}

export type TextFieldProps =
  | (FieldBase & { multiline?: false; ref?: Ref<HTMLInputElement> } & Omit<InputHTMLAttributes<HTMLInputElement>, "className">)
  | (FieldBase & { multiline: true; rows?: number; ref?: Ref<HTMLTextAreaElement> } & Omit<
        TextareaHTMLAttributes<HTMLTextAreaElement>,
        "className"
      >);

const FIELD =
  "w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-body text-text placeholder:text-text-3 " +
  "transition-[border-color,outline-color] hover:border-text-3 " +
  "disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-text " +
  "focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-solid focus-visible:outline-focus-wash " +
  "aria-invalid:border-danger";

/** Labeled text input (h44, radius 8) with helper or error caption. `multiline` renders a textarea. */
export function TextField(props: TextFieldProps) {
  const auto = useId();
  const { label, helper, error, className, inputClassName, id: idProp, multiline, ...rest } = props as FieldBase & {
    id?: string;
    multiline?: boolean;
    [k: string]: unknown;
  };
  const id = idProp ?? auto;
  const noteId = `${id}-note`;
  const note = error ?? helper;
  const shared = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": note ? noteId : undefined,
  };

  let control: ReactNode;
  if (multiline) {
    const { rows = 3, ...ta } = rest as { rows?: number } & TextareaHTMLAttributes<HTMLTextAreaElement>;
    control = <textarea {...ta} {...shared} rows={rows} className={cn(FIELD, "min-h-11 resize-y py-2.5", inputClassName)} />;
  } else {
    const inp = rest as InputHTMLAttributes<HTMLInputElement>;
    control = <input type="text" {...inp} {...shared} className={cn(FIELD, "h-11", inputClassName)} />;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label text-text">
        {label}
      </label>
      {control}
      {note && (
        <p id={noteId} className={cn("flex items-start gap-1.5 text-caption", error ? "text-danger" : "text-text-3")}>
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}
