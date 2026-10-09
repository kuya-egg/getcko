// Settings (design system §9.6): the two things people change (shortcut, theme) first as plain
// label-left / control-right rows, then setup status (owned by screens/onboarding), then the proof.
import type { ReactNode } from "react";
import { useTheme, type ThemePref } from "../brand";
import { T } from "../brand/lexicon";
import { Keycap, PageHeader, Panel, ProofLine, SegmentedControl, Surface } from "../components/ui";
import { SetupPanel } from "../screens/onboarding";
import { APP_COPY } from "./copy";
import { PLATFORM } from "./platform";

const THEMES = [
  { value: "light", label: T.settings.themeLight },
  { value: "dark", label: T.settings.themeDark },
  { value: "system", label: T.settings.themeSystem },
] as const;

export function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <PageHeader className="min-h-12" title={T.settings.title} />
      {/* Same textured section as Knowledge bases (working screen: subtle), running to the bottom of
          the pane. Like every section it bleeds 24px into the gutter, so the cards line up with the H1. */}
      <Surface texture="footprints" intensity="subtle" className="-mx-6 flex-1 rounded-panel p-6">
        <div className="flex max-w-xl flex-col gap-4">
          <Panel eyebrow={APP_COPY.settings.general}>
            <ul className="flex flex-col divide-y divide-border">
              <SettingRow id="setting-shortcut" label={T.settings.shortcut} help={T.settings.shortcutHelp}>
                <Keycap hotkey />
              </SettingRow>
              <SettingRow id="setting-theme" label={T.settings.theme}>
                <SegmentedControl<ThemePref> label={T.aria.theme} options={THEMES} value={theme} onChange={setTheme} />
              </SettingRow>
            </ul>
          </Panel>
          <Panel eyebrow={APP_COPY.settings.setup}>
            <SetupPanel />
          </Panel>
          <ProofLine className="px-2 py-2" items={[T.product.name, T.offline.nothingLeaves(PLATFORM)]} />
        </div>
      </Surface>
    </>
  );
}

/** One setting: name (and one line of help, when it adds something) left, its control right (wraps under at 900). */
function SettingRow({ id, label, help, children }: { id: string; label: string; help?: string; children: ReactNode }) {
  return (
    <li
      className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p id={id} className="text-row text-text">
          {label}
        </p>
        {help && <p className="text-label text-text-2">{help}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  );
}
