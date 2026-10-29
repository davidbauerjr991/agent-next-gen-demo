// Settings → Appearance (P-HOME-1n grouping): the theme (personal) and the brand (admin scope, tenant-wide).
import { t } from "@/i18n";
import { useSettings } from "@/settings";
import { BrandSettings } from "../BrandSettings";
import { Section, SettingsGroup, SwitchRow } from "../settings-parts";

export function AppearanceSection() {
  const [appearance, updateAppearance] = useSettings("appearance");
  return (
    <SettingsGroup id="appearance" title={t("Appearance")}>
      <Section title={t("Theme")}>
        <SwitchRow
          label="Dark mode"
          checked={appearance.theme === "dark"}
          onCheckedChange={(dark) => updateAppearance({ theme: dark ? "dark" : "light" })}
        />
      </Section>
      <Section title={t("Brand")} tag={t("Admin")}>
        <BrandSettings />
      </Section>
    </SettingsGroup>
  );
}
