// Inline name field for creating or renaming a knowledge base. Enter saves, Esc cancels.
import { useState, type FormEvent } from "react";
import { T } from "../../brand/lexicon";
import { Button, TextField, cn } from "../../components/ui";
import { errorCopy } from "../../app/errors";
import { KB_COPY } from "./copy";
import { validateName } from "./logic";

export interface NameFormProps {
  /** Starting value (rename) or empty (create). */
  initial?: string;
  /** Names already in use, to catch a clash before the backend does. */
  others: readonly string[];
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
  /** Field label. Default "Name"; rename passes "Rename Records office" so the context stays. */
  label?: string;
  className?: string;
}

export function NameForm({ initial = "", others, onSubmit, onCancel, label = KB_COPY.nameLabel, className }: NameFormProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (name === initial.trim() && initial) return onCancel();
    const problem = validateName(name, others);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await onSubmit(name);
    } catch (err) {
      setError(errorCopy(err).title);
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className={cn("flex flex-col gap-3", className)}
    >
      <TextField
        label={label}
        value={value}
        placeholder={initial ? undefined : KB_COPY.namePlaceholder}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setValue(e.currentTarget.value);
          if (error) setError(null);
        }}
        error={error ?? undefined}
        disabled={busy}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          {T.actions.save}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          {T.actions.cancel}
        </Button>
      </div>
    </form>
  );
}
