import type { SectionKey } from "@/settings";

/** The Settings page's section titles (English source text; render through
 *  `t()`), for profile locks and import warnings. */
export const SECTION_TITLES: Record<SectionKey, string> = {
  header: "Header",
  home: "Home",
  workspace: "Workspace",
  assignments: "Assignments",
  channels: "Channels",
  outbound: "New Outbound",
  voice: "Voice",
  ai: "AI",
  canvas: "Cards",
  phone: "Phone setup",
  appearance: "Appearance",
  connections: "Connections",
};
