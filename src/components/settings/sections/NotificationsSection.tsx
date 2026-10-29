// Settings → Notifications (P-HOME-1n grouping): the toasts and their events, incoming among them.
import { t } from "@/i18n";
import { NotificationSettings } from "../NotificationSettings";
import { Section, SettingsGroup } from "../settings-parts";

export function NotificationsSection() {
  return (
    <SettingsGroup id="notifications" title={t("Notifications")} lockKey="notifications">
      <Section title={t("Toasts")}>
        <NotificationSettings />
      </Section>
    </SettingsGroup>
  );
}
