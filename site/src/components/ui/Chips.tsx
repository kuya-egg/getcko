import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { ICON_PROPS, Icon, STATUS_ICON } from "../../brand/icons";
import { T, sourceLabel, statusLabel, type Status } from "../../brand/lexicon";
import { cn } from "./cn";

const CHIP =
  "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-keys font-sans font-medium";

/** Chip icons are 24px in a 28px chip; pull the box into the padding so the glyph, not the box, sits 8px from the edge. */
const CHIP_ICON = "-my-0.5 -ml-1";

/** The live dot: an 8px gecko-green pixel square. Marks GetcKo (and the current agent) in headers. Static, never pulsing. */
export function GeckoDot({ className, size = 8 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-none bg-accent", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Neutral metadata chip (knowledge base names, language). Not a status. */
export function Tag({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...rest} className={cn(CHIP, "bg-surface-2 text-text-2", className)}>
      {children}
    </span>
  );
}

function Spinner() {
  return <STATUS_ICON.processing {...ICON_PROPS} className={cn(CHIP_ICON, "gc-icon-spin")} />;
}

export interface OfflineBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Optional where-it-runs suffix, e.g. "on this Mac". */
  detail?: ReactNode;
  children?: ReactNode;
}

/** Inverse pill with the unplugged plug. The honest "nothing leaves this computer" signal. */
export function OfflineBadge({ detail, children = T.status.offline, className, ...rest }: OfflineBadgeProps) {
  return (
    <span {...rest} className={cn(CHIP, "bg-inverse text-inverse-text", className)}>
      <Icon.offline {...ICON_PROPS} className={CHIP_ICON} />
      {children}
      {detail ? <span className="font-normal">· {detail}</span> : null}
    </span>
  );
}

/** Single source: src/brand/lexicon.ts. Re-exported here for component imports. */
export type { Status };

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  status: Status;
  /** Failed reason (or processing detail), shown after the label: "Failed · scanned image". */
  reason?: ReactNode;
  /** Override the default label (Processing, Ready, Failed, Offline). */
  children?: ReactNode;
}

/** Real state only: processing, ready, failed, offline. Color plus a word, never color alone. */
export function StatusChip({ status, reason, children, className, ...rest }: StatusChipProps) {
  if (status === "offline") {
    return (
      <OfflineBadge className={className} {...rest}>
        {children ?? statusLabel("offline")}
      </OfflineBadge>
    );
  }
  return (
    <span
      {...rest}
      className={cn(
        CHIP,
        status === "processing" && "bg-surface-2 text-text-2",
        status === "ready" && "bg-accent-wash text-accent-text",
        status === "failed" && "bg-danger-wash text-danger",
        className,
      )}
    >
      {status === "processing" && <Spinner />}
      {status === "ready" && <STATUS_ICON.ready {...ICON_PROPS} className={CHIP_ICON} />}
      {status === "failed" && <STATUS_ICON.failed {...ICON_PROPS} className={CHIP_ICON} />}
      {children ?? statusLabel(status)}
      {reason ? <span className="font-normal">· {reason}</span> : null}
    </span>
  );
}

export interface CitationChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Short source name: "Manual", "Grading guide". */
  source: string;
  /** Page number (renders "p. 4") or a section label. */
  page?: number | string;
}

const HIT_EXTEND = "relative before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']";

/**
 * Source chip: `Manual · p. 4`. Renders a button when onClick is set (its hit area extends to 44px
 * without growing the chip), otherwise a static span. Every grounded answer shows at least one.
 */
export function CitationChip({ source, page, onClick, className, type = "button", ...rest }: CitationChipProps) {
  const text = page == null ? source : sourceLabel(source, page);
  const cls = cn(CHIP, "border-[1.5px] border-accent-text text-accent-text", className);
  const inner = (
    <>
      <Icon.source {...ICON_PROPS} className={CHIP_ICON} />
      <span className="nums">{text}</span>
    </>
  );
  if (!onClick) return <span className={cls}>{inner}</span>;
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={T.aria.openSource(text)}
      {...rest}
      className={cn(cls, HIT_EXTEND, "cursor-pointer transition-colors hover:bg-accent-wash")}
    >
      {inner}
    </button>
  );
}
