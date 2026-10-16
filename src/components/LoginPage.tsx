import { LoginCard, type LoginCardPreferences } from "@nicecxone/lyra-ui";
import { useBrand, useSectionStored, useSettings } from "@/settings";

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
  const { appName, logoSrc } = useBrand();

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
      {/* The header reads the white-label app name and logo (Settings →
          Appearance, P-AIFIRST); the idle launch button reads a plain
          "Launch" rather than repeating the name (`launchButtonLabel`). */}
      <LoginCard
        appName={appName}
        appIcon={<img src={logoSrc} alt="" className="h-5 w-5 object-contain" />}
        launchButtonLabel="Launch"
        defaultPhoneSetup={phone.setup}
        defaultPhoneNumber={phone.phoneNumber}
        defaultStationId={phone.stationId}
        defaultSavePreferences={phoneStored}
        isDarkMode={appearance.theme === "dark"}
        onDarkModeToggle={() => updateAppearance({ theme: appearance.theme === "dark" ? "light" : "dark" })}
        // Launches into the workspace (its profile decides the layout).
        onLaunch={handleLaunch}
      />
    </div>
  );
}
