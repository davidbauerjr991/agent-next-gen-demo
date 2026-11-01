// Home's header width (P-LAYOUT-F2 3; reverses P-LAYOUT-F1 C, ce1f660). The greeting and the Home tab strip take the
// active tab's body width, so their edges are the body's: the one-column Dashboard is centred at the dashboard's
// width (home-dashboard's body); an app tab (Customers, Accounts, Tickets), a customer tab and two columns are full
// width. lyra has no "the side panel pushes the page header" mode to do this for us: SidePanel is pinned-inline or an
// overlay (side-panel.tsx), and the headers already sit in the content column beside the panel, as AdminShell's do.

/** The one-column dashboard's content width (lyra has no content-width token; P-LAYOUT-F1's lyra-review gap). */
export const HOME_DASHBOARD_WIDTH_CLASS = "max-w-[1024px]";

/** One column's Activity card in table mode: the viewport's height, at least 420px, and no taller than lyra
 *  DashboardCard's own body (`max-h-[600px]`, dashboard-card.tsx), so the table's footer stays at the card's bottom
 *  (P-LAYOUT-F2 4). lyra has no token for either. */
export const ACTIVITY_TABLE_HEIGHT_CLASS = "h-[70vh] min-h-[420px] max-h-[600px]";

/** Whether Home's header is centred at the dashboard's width: one column, on the Dashboard tab. */
export function homeHeaderCentred(twoColumn: boolean, activeTab: string): boolean {
  return !twoColumn && activeTab === "dashboard";
}
