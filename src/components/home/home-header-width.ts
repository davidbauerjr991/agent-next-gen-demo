// Home's body sizes. The page header is always the page's full width (P-LAYOUT-F3 2; `homeHeaderCentred`, the header
// following the active tab's width, P-LAYOUT-F2 3, is gone).

/** The one-column dashboard's content width (lyra has no content-width token; P-LAYOUT-F1's lyra-review gap). */
export const HOME_DASHBOARD_WIDTH_CLASS = "max-w-[1024px]";

/** One column's Activity card in table mode: the viewport's height, at least 420px, and no taller than lyra
 *  DashboardCard's own body (`max-h-[600px]`, dashboard-card.tsx), so the table's footer stays at the card's bottom
 *  (P-LAYOUT-F2 4). lyra has no token for either. */
export const ACTIVITY_TABLE_HEIGHT_CLASS = "h-[70vh] min-h-[420px] max-h-[600px]";
