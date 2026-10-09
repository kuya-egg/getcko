import { useId, useRef, useState, type DragEvent, type HTMLAttributes } from "react";
import { ICON_PROPS, Icon } from "../../brand/icons";
import { T } from "../../brand/lexicon";
import { GetCkoSprite, pointPoseFor } from "../../brand/mascot";
import { Button } from "./Button";
import { cn } from "./cn";
import { Surface } from "./Surface";

/** File types the knowledge-base importer reads (PRD R1, R6). */
export const KB_ACCEPT = ".pdf,.docx,.pptx,.txt,.md";

export interface DropZoneProps extends Omit<HTMLAttributes<HTMLElement>, "onDrop"> {
  /** Called with the dropped or chosen files. */
  onFiles: (files: File[]) => void;
  /** <input accept>. Default ".pdf,.docx,.pptx,.txt,.md". */
  accept?: string;
  /** Force the drag-over look (controlled, or for screenshots). Otherwise tracked internally. */
  dragging?: boolean;
  /** Halo on "Add documents" (default true). Turn off if another halo is on screen. */
  halo?: boolean;
  /** Show GetcKo pointing at the button (default true). One GetcKo per screen. */
  mascot?: boolean;
  multiple?: boolean;
}

/**
 * Knowledge-base drop well: dashed border-strong, subtle footprints, GetcKo (3x) pointing right at
 * "Add documents". Drag-over: border-accent-text on the gecko-wash ground. The button is the keyboard
 * and screen-reader path; dropping is the mouse shortcut.
 */
export function DropZone({
  onFiles,
  accept = KB_ACCEPT,
  dragging,
  halo = true,
  mascot = true,
  multiple = true,
  className,
  ...rest
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const hintId = useId();
  const active = dragging ?? over;

  const take = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length) onFiles(files);
  };

  const onDragEnter = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  const onDragOver = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    take(e.dataTransfer.files);
  };

  return (
    <Surface
      as="div"
      texture="footprints"
      intensity="subtle"
      tone={active ? "green" : "canvas"}
      {...rest}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-dragging={active || undefined}
      className={cn(
        "flex items-center gap-6 rounded-panel border-2 border-dashed px-8 py-6 transition-colors",
        active ? "border-accent-text" : "border-border-strong",
        className,
      )}
    >
      {mascot && (
        <GetCkoSprite pose={pointPoseFor("right")} scale={3} label={T.mascot.pointingAt(T.actions.addDocuments)} className="shrink-0" />
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <p className="flex items-center gap-2 text-row text-text">
          <Icon.drop {...ICON_PROPS} className={active ? "text-accent-text" : "text-text-2"} />
          {active ? T.knowledgeBase.dropActive : T.knowledgeBase.drop}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-label text-text-2">{T.knowledgeBase.dropOr}</span>
          <Button
            icon={Icon.addDocuments}
            className={cn(halo && !active && "target-halo")}
            aria-describedby={hintId}
            onClick={() => inputRef.current?.click()}
          >
            {T.actions.addDocuments}
          </Button>
        </div>
        <p id={hintId} className="text-caption text-text-2">
          {T.knowledgeBase.fileHint()}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(e) => {
          take(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
    </Surface>
  );
}

// ---------------------------------------------------------------------------

export interface ImportProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Pages read so far. */
  page: number;
  total: number;
  /** Squares in the row. Default 16. */
  cells?: number;
  /** Accessible name. Default "Reading the document". */
  label?: string;
}

/**
 * Import progress as a row of pixel squares that fill in whole steps (no smooth bar), the leading
 * square blinking with steps(); then a mono "12 / 48 pages".
 */
export function ImportProgress({ page, total, cells = 16, label = T.aria.importProgress, className, ...rest }: ImportProgressProps) {
  const safeTotal = Math.max(1, total);
  const p = Math.min(Math.max(0, page), safeTotal);
  const filled = Math.floor((p / safeTotal) * cells);
  const done = p >= safeTotal;
  return (
    <div {...rest} className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={p}
        aria-valuetext={T.knowledgeBase.pagesProgress(p, safeTotal)}
        className="flex items-center gap-0.5"
      >
        {Array.from({ length: cells }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              "size-2 shrink-0",
              i < filled ? "bg-accent" : !done && i === filled ? "gc-cell-blink bg-accent" : "bg-border-strong",
            )}
          />
        ))}
      </div>
      <span className="font-mono text-keys nums whitespace-nowrap text-text-2">{T.knowledgeBase.pagesProgress(p, safeTotal)}</span>
    </div>
  );
}
