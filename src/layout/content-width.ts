// The page's content widths (P-LAYOUT-F3 13; moved from components/home/home-header-width.ts). lyra has no
// content-width token, so the values are named here, once (P-LAYOUT-F1's lyra-review gap).

/** The centred column's max width per page: the interaction's action area (transcript, composer, the pinned band,
 *  a kind cell) and Home's body under `home.contentWidth = "max"`. "full": no cap. */
export const CONTENT_MAX_WIDTH_CLASS = {
  action: "max-w-[768px]",
  home: "max-w-[1024px]",
  full: "",
} as const;

export type ContentWidth = keyof typeof CONTENT_MAX_WIDTH_CLASS;

/** One column's Activity card in table mode: the viewport's height, at least 420px, and no taller than lyra
 *  DashboardCard's own body (`max-h-[600px]`, dashboard-card.tsx), so the table's footer stays at the card's bottom
 *  (P-LAYOUT-F2 4). lyra has no token for either. */
export const ACTIVITY_TABLE_HEIGHT_CLASS = "h-[70vh] min-h-[420px] max-h-[600px]";
