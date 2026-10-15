import { LoginCard, type LoginCardPreferences } from "@nicecxone/lyra-ui";
import { useSectionStored, useSettings } from "@/settings";

type Page = "agent-workspace" | "agent-advanced" | "outbound" | "login";

interface LoginPageProps {
  onNavigate?: (page: Page) => void;
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  // P-SETTINGS: the card reads and writes the settings store's `phone` and
  // `appearance` sections. Its phone fields are seeded once on mount (the
  // card's `default*` props).
  const [phone, updatePhone] = useSettings("phone");
  const [appearance, updateAppearance] = useSettings("appearance");
  const phoneStored = useSectionStored("phone");

  const handleLaunch = (preferences: LoginCardPreferences) => {
    // "Save Preferences" persists the phone section; unchecked, the choice
    // still applies to this session but isn't saved.
    updatePhone(
      { setup: preferences.phoneSetup, phoneNumber: preferences.phoneNumber, stationId: preferences.stationId },
      { persist: preferences.savePreferences },
    );
    onNavigate?.("agent-advanced");
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-lyra-bg-surface-shell p-6 animate-in fade-in-0 duration-500">
      {/* Per explicit request: the modal header reads "Agent Workspace"
          (not lyra-ui's own default "Agent Next Gen" — that default is
          left untouched, since other consumers of `LoginCard` may still
          rely on it), and the idle-state launch button reads a plain
          "Launch" instead of repeating the app name a second time right
          below the header (`launchButtonLabel`, LoginCard's own new opt-in
          prop — see that prop's doc comment, login-card.tsx). The
          in-progress "Launching Agent Workspace…" status text is
          untouched. */}
      <LoginCard
        appName="Agent Workspace"
        launchButtonLabel="Launch"
        defaultPhoneSetup={phone.setup}
        defaultPhoneNumber={phone.phoneNumber}
        defaultStationId={phone.stationId}
        defaultSavePreferences={phoneStored}
        isDarkMode={appearance.theme === "dark"}
        onDarkModeToggle={() => updateAppearance({ theme: appearance.theme === "dark" ? "light" : "dark" })}
        // Launches into Advanced ("Agent Workspace 2.0 | Phase 1" by
        // default; the workspace preset decides its layout).
        onLaunch={handleLaunch}
      />
    </div>
  );
}
