import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { LYRA_CARD_MAX_WIDTH, SidePanel } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "@/contact-handling/canvas-registry";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";

/** P-CANVAS: the reference column, a lyra `SidePanel` (the same component as
 *  Contact Details) at lyra's max card width, on the main column's right
 *  edge. Docked (pinned) while the main column fits the action area's minimum
 *  plus the column; otherwise an overlay over the action area, opened by the
 *  record header's "Summaries" toggle and closed by its close button or a
 *  click outside it. Docked vs. overlay is derived from the measured width,
 *  never a setting. Mount it as the last child of the main column's row,
 *  which must be `relative` (the overlay positions against it). */
export function ReferenceColumn({ children }: { children: ReactNode }) {
  const { activeInteraction } = useWorkspace();
  const [fits, setFits] = useWorkspaceUiField("referenceColumnFits");
  const [overlayOpen, setOverlayOpen] = useWorkspaceUiField("summariesOverlayOpen");
  const anchorRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  // The row this column shares with the action area (the content card minus
  // the docked Contact Details / thread panel, so an open thread panel under
  // "main" counts). A zero width (not laid out; jsdom) keeps the last answer.
  useLayoutEffect(() => {
    const row = anchorRef.current?.parentElement;
    if (!row) return;
    const measure = (width: number) => {
      if (width > 0) setFits(width >= ACTION_AREA_MIN_WIDTH + LYRA_CARD_MAX_WIDTH);
    };
    measure(row.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(row);
    return () => ro.disconnect();
  }, [setFits]);

  // The overlay closes when the column docks again and when the card changes.
  useEffect(() => {
    if (fits) setOverlayOpen(false);
  }, [fits, setOverlayOpen]);
  useEffect(() => {
    setOverlayOpen(false);
  }, [activeInteraction?.id, setOverlayOpen]);

  // Outside click closes the overlay (the toggle handles its own clicks).
  const open = !fits && overlayOpen;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || columnRef.current?.contains(target) || target.closest("[data-summaries-toggle]")) return;
      setOverlayOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOverlayOpen]);

  return (
    <div ref={anchorRef} className="contents">
      <SidePanel
        ref={columnRef}
        side="right"
        pinned={fits}
        open={fits || open}
        resizable={false}
        width={LYRA_CARD_MAX_WIDTH}
        headerTitle={t("Summaries")}
        showCloseButton={!fits}
        onClose={() => setOverlayOpen(false)}
        data-canvas-region="reference"
        data-docked={fits || undefined}
      >
        <div className="flex flex-col gap-3 p-4">{children}</div>
      </SidePanel>
    </div>
  );
}
