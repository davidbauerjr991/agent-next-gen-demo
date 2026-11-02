// The header apps' names and display choices: Settings → Workspace lists the apps (enable), each with its display
// row beside its checkbox (P-LAYOUT-F3 9; in Settings → Layout from P-LAYOUT-F1 E until then).
import type { ExtraHeaderApp } from "@/settings";

export const EXTRA_APP_LABELS: Record<ExtraHeaderApp, string> = {
  customers: "Customers",
  accounts: "Accounts",
  tickets: "Tickets",
  wem: "WEM",
  schedule: "Schedule",
  screenpop: "Screen Pop",
};

// v3's per-app display options; Agent chat is a drawer, so it has no tab.
export const APP_DISPLAY_OPTIONS = [
  { value: "tab", label: "Display in tab" },
  { value: "leftnav", label: "Display in Left Nav" },
  { value: "header", label: "Display in App Header" },
];
export const AGENT_CHAT_DISPLAY_OPTIONS = APP_DISPLAY_OPTIONS.filter((o) => o.value !== "tab");
