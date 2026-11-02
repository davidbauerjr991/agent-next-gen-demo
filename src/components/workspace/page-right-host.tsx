// The page's right-side host (P-LAYOUT-F3 4): a stable node at the end of the content card's row, beside the whole
// page column (header and body), as AdminShell's right SidePanel is a sibling of its main column (admin-shell.tsx
// :283–291 beside :228), so a panel that pushes narrows the page header with the body and runs the card's full
// height. A right panel that docks (Home's queue detail, the Contact Details slide-over) portals into it; one that
// doesn't fit overlays where it is, as before. The host is `display: contents`, so a portaled panel is a flex item of
// the row; lyra InteriorPanel then takes the row's width as its container (`containerWidth`, lyra F3-L2).
import * as React from "react";
import { HostSlot, usePortalHost } from "@/contact-handling/portal-hosts";

interface PageRightHost {
  host: HTMLElement;
  /** The content card row's width (0 until measured, or in jsdom). */
  rowWidth: number;
}

const PageRightHostContext = React.createContext<PageRightHost | null>(null);

/** The page's right host, or null outside the content card's row (a panel then stays inline). */
export function usePageRightHost(): PageRightHost | null {
  return React.useContext(PageRightHostContext);
}

/** The content card's row: `children` (the assignments panel, the page column, the docked AI panel), then the host. */
export function PageRightHostRow({ children }: { children: React.ReactNode }) {
  const host = usePortalHost("contents");
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    setRowWidth(row.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width));
    ro.observe(row);
    return () => ro.disconnect();
  }, []);
  const value = React.useMemo(() => ({ host, rowWidth }), [host, rowWidth]);
  return (
    <PageRightHostContext.Provider value={value}>
      <div ref={rowRef} className="flex flex-1 overflow-hidden min-h-0">
        {children}
        <HostSlot host={host} data-slot="page-right-host" />
      </div>
    </PageRightHostContext.Provider>
  );
}
