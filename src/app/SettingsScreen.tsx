// Settings (design system §9.6): setup status (owned by screens/onboarding), theme, shortcut.
import { useTheme, type ThemePref } from "../brand";
import { T } from "../brand/lexicon";
import { Keycap, PageHeader, Panel, SegmentedControl, Surface } from "../components/ui";
import { SetupPanel } from "../screens/onboarding";
import { APP_COPY } from "./copy";

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
      <Surface texture="none" className="flex max-w-answer flex-col gap-6 rounded-panel border border-border p-6">
        <Panel eyebrow={APP_COPY.settings.setup}>
          <SetupPanel />
        </Panel>
        <Panel eyebrow={T.settings.theme}>
          <div className="flex flex-col items-start gap-2">
            <SegmentedControl<ThemePref>
              label={T.aria.theme}
              options={THEMES}
              value={theme}
              onChange={setTheme}
            />
            <p className="text-label text-text-2">{APP_COPY.settings.themeHelp}</p>
          </div>
        </Panel>
        <Panel eyebrow={T.settings.shortcut}>
          <div className="flex items-center gap-4">
            <Keycap hotkey />
            <p className="text-body text-text-2">{T.settings.shortcutHelp}</p>
          </div>
        </Panel>
      </Surface>
    </>
  );
}
