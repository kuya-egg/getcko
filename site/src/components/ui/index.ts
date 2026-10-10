// GetcKo UI primitives. Semantic tokens only, so every component works in light and dark.
// import { Button, AnswerCard, SessionBar } from "../components/ui" (relative; no @/ alias).

export { cn } from "./cn";
export { detectPlatform, formatKeys, HOTKEY } from "./platform";
export type { Platform } from "./platform";
export { useHoldToTalk } from "./useHoldToTalk";
export type { HoldToTalkOptions } from "./useHoldToTalk";

export { Button, IconButton, buttonClass } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps, IconButtonVariant } from "./Button";
export { Keycap } from "./Keycap";
export type { KeycapProps } from "./Keycap";
export { TextField } from "./TextField";
export type { TextFieldProps } from "./TextField";
export { Toggle, Checkbox } from "./Toggle";
export type { ToggleProps, CheckboxProps } from "./Toggle";
export { Composer } from "./Composer";
export type { ComposerProps } from "./Composer";
export { StatusChip, CitationChip, OfflineBadge, GeckoDot, Tag } from "./Chips";
export type { Status, StatusChipProps, CitationChipProps, OfflineBadgeProps } from "./Chips";
export { AgentCard, NewAgentCard, IconTile } from "./AgentCard";
export type { AgentCardProps, NewAgentCardProps, IconTileProps } from "./AgentCard";
export { KnowledgeBaseRow, KnowledgeBaseList } from "./KnowledgeBaseRow";
export type { KnowledgeBaseRowProps } from "./KnowledgeBaseRow";
export { AnswerCard } from "./AnswerCard";
export type { AnswerCardProps, AnswerVariant, AnswerStep, Citation } from "./AnswerCard";
export { SessionBar } from "./SessionBar";
export type { SessionBarProps } from "./SessionBar";
export { ChatBubble } from "./ChatBubble";
export type { ChatBubbleProps } from "./ChatBubble";
export { TargetHalo } from "./TargetHalo";
export type { TargetHaloProps } from "./TargetHalo";
export { EmptyState, ErrorNotice } from "./EmptyState";
export type { EmptyStateProps, EmptyStateAction, ErrorNoticeProps } from "./EmptyState";
export { Panel } from "./Panel";
export type { PanelProps } from "./Panel";
export { Surface } from "./Surface";
export type { SurfaceProps } from "./Surface";

// v0.3: app frame, onboarding, import, honest numbers, overlays, pickers, explanatory copy.
export { AppShell, NavLink } from "./AppShell";
export type { AppShellProps, NavItem, NavLinkProps } from "./AppShell";
export { Wordmark } from "./Wordmark";
export type { WordmarkProps, WordmarkSize } from "./Wordmark";
export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";
export { OnboardingStep, StepSquares, MockToggle } from "./Onboarding";
export type {
  OnboardingStepProps,
  OnboardingAction,
  PermissionState,
  StepSquaresProps,
  MockToggleProps,
} from "./Onboarding";
export { DropZone, ImportProgress, KB_ACCEPT } from "./DropZone";
export type { DropZoneProps, ImportProgressProps } from "./DropZone";
export { Stat, ProofLine } from "./Stat";
export type { StatProps, ProofLineProps } from "./Stat";
export { Dialog } from "./Dialog";
export type { DialogProps } from "./Dialog";
export { Toast, useToast, TOAST_MS } from "./Toast";
export type { ToastProps, ToastState } from "./Toast";
export { Notice } from "./Notice";
export type { NoticeProps } from "./Notice";
export { SegmentedControl } from "./SegmentedControl";
export type { SegmentedControlProps, SegmentOption } from "./SegmentedControl";
export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";
export { Slider } from "./Slider";
export type { SliderProps } from "./Slider";
export { VoicePicker } from "./VoicePicker";
export type { VoicePickerProps, Voice } from "./VoicePicker";
export { Tabs } from "./Tabs";
export type { TabsProps, TabItem } from "./Tabs";
export { Tooltip } from "./Tooltip";
export type { TooltipProps } from "./Tooltip";
export { Kw, Steps } from "./Kw";
export type { KwProps, StepsProps, StepItem } from "./Kw";
