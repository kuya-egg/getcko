import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { T } from "../../brand/lexicon";
import { GeckoDot } from "./Chips";
import { cn } from "./cn";
import { Wordmark } from "./Wordmark";

export interface NavItem {
  id: string;
  /** Visible label from T.nav. */
  label: string;
}

export interface NavLinkProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: ReactNode;
  /** Current screen: bg-surface row, semibold, trailing GeckoDot, aria-current="page". */
  active?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One sidebar row, 44px. No icon (the words are the navigation) and no side stripe: the active row
 * is a solid surface tile with the gecko dot at its end.
 */
export function NavLink({ label, active = false, type = "button", className, ref, ...rest }: NavLinkProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-current={active ? "page" : undefined}
      {...rest}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-tile px-3 text-left text-label transition-colors",
        active ? "bg-surface font-semibold text-text shadow-card" : "text-text-2 hover:bg-surface hover:text-text",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && <GeckoDot />}
    </button>
  );
}

export interface AppShellProps {
  /** Sidebar rows, top to bottom. Use T.nav labels. */
  nav: NavItem[];
  /** id of the current screen. */
  active: string;
  onNavigate: (id: string) => void;
  /** Bottom of the sidebar: OfflineBadge, the agent in use, Settings. */
  footer?: ReactNode;
  /** The screen. Scrolls inside <main>, p-8 (32px app gutter). */
  children: ReactNode;
  className?: string;
  /** Fill the parent instead of the viewport (previews, screenshots). Default false = h-dvh. */
  contained?: boolean;
  /** Replaces <main>'s padding classes (default "p-8"); e.g. "p-0" for a full-bleed Surface. */
  mainClassName?: string;
}

/**
 * Main window frame for a 1040 x 680 window (min 900 x 600): a fixed 240px bg-surface-2 sidebar
 * (head mark + wordmark, nav, footer) and a scrollable main pane. Works at 900 wide with no
 * breakpoints: the main pane gets 660px, enough for one 600px column plus gutters.
 */
export function AppShell({ nav, active, onNavigate, footer, children, className, mainClassName, contained }: AppShellProps) {
  return (
    <div className={cn("flex min-h-0 w-full overflow-hidden bg-bg text-text", contained ? "h-full" : "h-dvh", className)}>
      <aside className="z-sticky flex w-sidebar shrink-0 flex-col border-r border-border bg-surface-2">
        <div className="px-5 pt-6 pb-8">
          <Wordmark size="md" />
        </div>
        <nav aria-label={T.nav.label} className="flex-1 overflow-y-auto px-3">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => (
              <li key={item.id}>
                <NavLink label={item.label} active={item.id === active} onClick={() => onNavigate(item.id)} />
              </li>
            ))}
          </ul>
        </nav>
        {footer && <div className="flex flex-col gap-2 border-t border-border p-4">{footer}</div>}
      </aside>
      <main className={cn("min-w-0 flex-1 overflow-y-auto", mainClassName ?? "p-8")}>{children}</main>
    </div>
  );
}
