import type { ReactNode, Ref, SVGProps } from "react";

export function Keycap({ children }: { children: ReactNode }) {
  return <kbd className="keycap">{children}</kbd>;
}

export function CitationChip({ children, ref }: { children: ReactNode; ref?: Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} className="chip chip-cite">
      <DocIcon width={14} height={14} />
      {children}
    </span>
  );
}

/** 2px-stroke line icons (design system §5). */
function Icon({ children, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export function PlayIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </Icon>
  );
}

export function DocIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
  );
}

export function MicIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
  );
}

export function PointerIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <path d="M5 3l14 7-6 2-2 6z" />
    </Icon>
  );
}

export function StopIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </Icon>
  );
}

export function SpeakerIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </Icon>
  );
}

export function BriefcaseIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </Icon>
  );
}

export function BoardIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20l4-4 4 4M7 9h6M7 12h9" />
    </Icon>
  );
}

export function BookIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M9 7h6" />
    </Icon>
  );
}

export function ChatIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </Icon>
  );
}

export function WifiOffIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...p}>
      <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.3A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-2.8M11 5.1A15 15 0 0 1 22 9.5" />
      <circle cx="12" cy="20" r="0.5" fill="currentColor" />
    </Icon>
  );
}
