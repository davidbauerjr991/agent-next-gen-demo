import type { HomeSectionKey, HomeSettings } from "@/settings";

/** Two-column Home's right column: every enabled section but the feed, Due soon (a one-column card: the feed beside
 *  it already lists what's next) and Contact History (the feed's History view there, P-HOME-1e). */
export function homeSideSections(home: HomeSettings): HomeSectionKey[] {
  return home.sections.filter((s) => s.enabled && s.key !== "activity" && s.key !== "dueSoon" && s.key !== "contactHistory").map((s) => s.key);
}

/** Home renders in two columns: the layout is twoColumn and the feed (the
 *  main column) is on. Its feed's History view is Contact History there, so
 *  the right column skips the Contact History card (P-HOME-1e). */
export function homeIsTwoColumn(home: HomeSettings): boolean {
  return home.layout === "twoColumn" && home.sections.some((s) => s.key === "activity" && s.enabled);
}
