import type { HTMLAttributes, LiHTMLAttributes, ReactNode } from "react";
import { ICON_PROPS, docIcon, type IconComponent } from "../../brand/icons";
import { T, fmtBytes, fmtCount, fmtDate } from "../../brand/lexicon";
import { GetCkoSprite, MOMENT_POSE } from "../../brand/mascot";
import { StatusChip, type Status } from "./Chips";
import { cn } from "./cn";

export interface KnowledgeBaseRowProps extends Omit<LiHTMLAttributes<HTMLLIElement>, "children"> {
  /** File or collection name. */
  name: string;
  pages?: number;
  passages?: number;
  /** File size in bytes: adds "2.3 MB" to the caption. */
  bytes?: number;
  /** When it was added: adds "Added Oct 9" to the caption (never a numeric date). */
  addedAt?: Date | number | string;
  /** Replaces the generated "48 pages · 312 passages · 2.3 MB" caption. */
  meta?: ReactNode;
  status: Exclude<Status, "offline">;
  /** Failed reason or processing detail. */
  reason?: ReactNode;
  /** Override the per-type document icon (default docIcon(name)). */
  icon?: IconComponent;
  /** While Processing, show GetcKo reading the document (3x) instead of the icon. One GetcKo per screen. */
  mascot?: boolean;
  /** Trailing controls (e.g. an IconButton to remove). */
  actions?: ReactNode;
}

/** One knowledge base row: icon 20, name 15/600, caption meta, status chip right. Use inside <KnowledgeBaseList>. */
export function KnowledgeBaseRow({
  name,
  pages,
  passages,
  bytes,
  addedAt,
  meta,
  status,
  reason,
  icon,
  mascot,
  actions,
  className,
  ...rest
}: KnowledgeBaseRowProps) {
  const parts: string[] = [];
  if (pages != null) parts.push(fmtCount(pages, "page"));
  if (passages != null) parts.push(fmtCount(passages, "passage"));
  if (bytes != null) parts.push(fmtBytes(bytes));
  if (addedAt != null) parts.push(T.knowledgeBase.added(fmtDate(addedAt)));
  const DocIcon = icon ?? docIcon(name);
  const caption = meta ?? (parts.length ? parts.join(" · ") : null);
  return (
    <li {...rest} className={cn("flex min-h-14 items-center gap-3 border-b border-border py-3 last:border-b-0", className)}>
      {mascot && status === "processing" ? (
        <span className="shrink-0 rounded-tile bg-surface-2 p-1.5">
          <GetCkoSprite pose={MOMENT_POSE.processing} scale={3} label={T.mascot.moment(T.moments.processing)} />
        </span>
      ) : (
        <DocIcon {...ICON_PROPS} className="shrink-0 text-text-2" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-row text-text">{name}</p>
        {caption && <div className="nums text-caption text-text-3">{caption}</div>}
      </div>
      <StatusChip status={status} reason={reason} />
      {actions}
    </li>
  );
}

/** Plain list wrapper for KnowledgeBaseRow (rows draw their own dividers). */
export function KnowledgeBaseList({ className, children, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul {...rest} className={cn("flex flex-col", className)}>
      {children}
    </ul>
  );
}
