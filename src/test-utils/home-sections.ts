import { getSettingsStore } from "@/settings/settings-store";

/** Turns Home's Contact History section on (off by default since P-HOME-1;
 *  today's slice is the Activity feed's History chip). For the tests that
 *  exercise the card itself. Call before showing the page. */
export function showContactHistoryOnHome(): void {
  getSettingsStore().update("home", (prev) => ({
    sections: prev.sections.map((s) => (s.key === "contactHistory" ? { ...s, enabled: true } : s)),
  }));
}
