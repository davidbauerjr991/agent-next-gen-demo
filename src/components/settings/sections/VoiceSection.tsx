// Settings → Voice (P-HOME-1n grouping). Its one control, the voice controls' location, is a Settings → Layout preset
// since P-LAYOUT-F1 E; the group stays, with an empty state, for the voice settings to come.
import { EmptyState } from "@nicecxone/lyra-ui";
import { PhoneCall } from "lucide-react";
import { t } from "@/i18n";
import { SettingsGroup } from "../settings-parts";

export function VoiceSection() {
  return (
    <SettingsGroup id="voice" title={t("Voice")} lockKey="voice">
      <EmptyState
        icon={<PhoneCall className="h-8 w-8" strokeWidth={1.5} />}
        message={t("Voice settings will appear here")}
        className="h-auto w-full py-6"
        tone="secondary"
      />
    </SettingsGroup>
  );
}
