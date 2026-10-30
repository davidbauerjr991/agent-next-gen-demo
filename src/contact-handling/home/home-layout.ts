import type { LayoutParts } from "@/layout/layout-section";
import type { HomeSectionKey, HomeSettings } from "@/settings";

/** A Home section's part in `layout.parts` (the feed is `activityFeed`). */
const partOf = (key: HomeSectionKey) => (key === "activity" ? "activityFeed" : key);

/** Two-column Home's right column: every enabled section `layout.parts` puts in the trailing column (P-LAYOUT), in
 *  the map's order. The `home.layout` "twoColumn" preset puts everything there but the feed, Due soon (a one-column
 *  card: the feed beside it already lists what's next) and Contact History (the feed's History view there,
 *  P-HOME-1e), which are allowed in the main column only. */
export function homeSideSections(home: HomeSettings, parts: LayoutParts): HomeSectionKey[] {
  return home.sections
    .filter((s) => s.enabled && s.key !== "activity" && parts[partOf(s.key)].slot === "main-trailing")
    .map((s) => s.key)
    .sort((a, b) => parts[partOf(a)].order - parts[partOf(b)].order);
}

/** Home renders in two columns: a section is in the trailing column and the feed (the main column) is on. Its
 *  feed's History view is Contact History there, so the right column skips the Contact History card (P-HOME-1e). */
export function homeIsTwoColumn(home: HomeSettings, parts: LayoutParts): boolean {
  const feedOn = home.sections.some((s) => s.key === "activity" && s.enabled);
  return feedOn && parts.activityFeed.slot === "main" && home.sections.some((s) => s.key !== "activity" && parts[partOf(s.key)].slot === "main-trailing");
}
