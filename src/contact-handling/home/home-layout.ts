import type { HomeSettings } from "@/settings";

/** Home renders in two columns: the layout is twoColumn and the feed (the
 *  main column) is on. Its feed's History view is Contact History there, so
 *  the right column skips the Contact History card (P-HOME-1e). */
export function homeIsTwoColumn(home: HomeSettings): boolean {
  return home.layout === "twoColumn" && home.sections.some((s) => s.key === "activity" && s.enabled);
}
