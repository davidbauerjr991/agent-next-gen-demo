// The Dashboard's content width (P-LAYOUT-F3 3, F4-2), read in one place: the Dashboard centres its content with
// `CenteredColumn` at this width, inside its own scroller (so the scrollbar stays at the page's edge). "max" → Home's
// content max width, "full" → no cap. The page header and the app tabs (tables) are always full width.
import { useSetting } from "@/settings";
import type { ContentWidth } from "@/layout/content-width";

export function useHomeContentWidth(): ContentWidth {
  return useSetting("home", "contentWidth")[0] === "max" ? "home" : "full";
}
