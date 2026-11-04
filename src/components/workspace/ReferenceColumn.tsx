import { useEffect, useRef, type ReactNode } from "react";
import { LYRA_CARD_MAX_WIDTH, SidePanel } from "@nicecxone/lyra-ui";
import { CANVAS_CONTENT_TOP_CLASS } from "@/contact-handling/canvas-registry";
import { usePanelToggles } from "@/contact-handling/panel-toggles";
import { useReferenceColumnWidth } from "@/contact-handling/reference-column-width";
import { cn } from "@/lib/utils";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";

/** P-CANVAS: the reference column, at lyra's max card width on the main
 *  column's right edge. Driven by the page header's right toggle (`headerToggle`, P-LAYOUT-F4 7): a lyra `SidePanel`
 *  pinned open beside the action area while it fits, or closed with the toggle's hover flyout; see `panel-toggles.tsx`.
 *  Without it (two-column Home) docked while the main column fits the action area's
 *  minimum plus the column: a plain column, the cards straight on the content
 *  card's background (browser pass, 2026-10-22). Otherwise a lyra `SidePanel`
 *  overlay (the same component as Contact Details, with its header and
 *  background) over the action area, opened by the toolbar's Cards toggle and closed by its close button or a click
 *  outside it. Docked vs. overlay is derived from the measured width,
 *  never a setting. `ReferenceSlot` mounts it (the last child of the main
 *  column's row, which must be `relative`: the overlay positions against it)
 *  and measures the row. */
export function ReferenceColumn({
  children,
  width = LYRA_CARD_MAX_WIDTH,
  transition,
  title,
  headerToggle = false,
  onResizeStateChange,
  instantWidth = false,
  covered = false,
}: {
  /** A detail slide-over is open over this column: its cards and resize edge are out of the tab order and the
   *  accessibility tree while it covers them (a11y-review, P-LAYOUT-F4). */
  covered?: boolean;
  /** No width transition now: a drag is in progress here or in the slide-over over this column. */
  instantWidth?: boolean;
  /** A drag of the column's edge starts or ends (the frame turns its width transition off meanwhile). */
  onResizeStateChange?: (resizing: boolean) => void;
  children: ReactNode;
  /** The page header's right toggle drives this column (an interaction's, a kind cell's; P-LAYOUT-F4 7): always a
   *  lyra `SidePanel` on that toggle's state, pinned open beside the action area or closed with a hover flyout. Off
   *  (two-column Home): the plain column while it fits, else the overlay its own toolbar toggle opens. */
  headerToggle?: boolean;
  /** The docked slot's width: the card width, or wider while a slide-over over it is (ReferenceSlot). */
  width?: number;
  transition?: string;
  /** The overlay's header; default "Summaries" (two-column Home: "Cards"). */
  title?: string;
}) {
  const { activeInteraction } = useWorkspace();
  const size = useReferenceColumnWidth();
  // Measured by whoever mounts this column (`useReferenceColumnFit`, in ReferenceSlotFrame).
  const [docked] = useWorkspaceUiField("referenceColumnFits");
  const [overlayOpen, setOverlayOpen] = useWorkspaceUiField("summariesOverlayOpen");
  const columnRef = useRef<HTMLDivElement>(null);
  // The record header's right toggle (lyra `useSidePanelToggle`, P-LAYOUT-F1): its hover reveal and keyboard focus.
  const toggle = usePanelToggles()?.reference;
  const toggleId = toggle?.panelId;

  // The overlay closes when the column docks again and when the card changes.
  useEffect(() => {
    // (Not with the header toggle: a closed column's hover flyout opens while it still fits.)
    if (docked && !headerToggle) setOverlayOpen(false);
  }, [docked, headerToggle, setOverlayOpen]);
  useEffect(() => {
    setOverlayOpen(false);
  }, [activeInteraction?.id, setOverlayOpen]);

  // Outside click closes the overlay (the toggle handles its own clicks).
  const open = !docked && overlayOpen;
  useEffect(() => {
    if (!open || headerToggle) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || columnRef.current?.contains(target) || target.closest("[data-summaries-toggle]")) return;
      if (toggleId && target.closest(`[aria-controls="${CSS.escape(toggleId)}"]`)) return;
      setOverlayOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, headerToggle, setOverlayOpen, toggleId]);

  if (headerToggle && toggle) {
    // Pinned open: beside the action area, pushing it (a `data-docked` column, its lyra border on the leading edge);
    // closed: nothing in the row, the hover flyout over the action area. No header, pin or close of its own (F4 9):
    // the record header's toggle is the one control, and the cards start at the column's top edge.
    const pinned = toggle.pinned && toggle.open;
    return (
      <SidePanel
        ref={columnRef}
        side="right"
        {...toggle.sidePanelProps}
        onPinToggle={undefined}
        // Resizable in every AI display, from the card width up to what leaves the action area its minimum; the
        // dragged width is kept per browser (`useReferenceColumnWidth`, P-LAYOUT-F4 19). A slide-over wider than the
        // column leaves the column's own width alone.
        resizable
        minWidth={size.minWidth}
        maxWidth={size.maxWidth}
        width={width}
        // A drag's moves are only previewed (the panel follows the pointer itself); the width is written once on
        // release, so nothing else re-renders per move (P-LAYOUT-F4 22b). The keyboard's steps write at once.
        onWidthChange={(next) => {
          if (width === size.width) size.drag.onWidthChange(next);
        }}
        onResizeStateChange={(resizing) => {
          onResizeStateChange?.(resizing);
          size.drag.onResizeStateChange(resizing);
        }}
        instantWidthChange={instantWidth}
        aria-label={title ?? t("Summaries")}
        // The content card's own surface, not SidePanel's grey: the column's structure is its cards and its border
        // (P-LAYOUT-F4 11). Opaque, so the hover flyout still covers the action area.
        className="bg-lyra-bg-surface-base"
        data-canvas-region="reference"
        data-docked={pinned ? "true" : undefined}
        inert={covered || undefined}
      >
        <div className={cn("flex flex-col gap-3 px-4 pb-4", CANVAS_CONTENT_TOP_CLASS)}>{children}</div>
      </SidePanel>
    );
  }

  return (
    <>
      {docked ? (
        // Docked: a plain column on the content card's own background (no panel chrome).
        <div
          ref={columnRef}
          className="h-full shrink-0 overflow-y-auto"
          style={{ width, transition }}
          data-canvas-region="reference"
          data-docked="true"
        >
          <div className={cn("flex flex-col gap-3 px-4 pb-4", CANVAS_CONTENT_TOP_CLASS)}>{children}</div>
        </div>
      ) : (
        // Overlay: the panel (header, close button, background) over the action area.
        <SidePanel
          ref={columnRef}
          side="right"
          pinned={false}
          open={open}
          resizable={false}
          width={LYRA_CARD_MAX_WIDTH}
          headerTitle={title ?? t("Summaries")}
          showCloseButton
          onClose={() => setOverlayOpen(false)}
          id={toggleId}
          tabIndex={toggleId ? -1 : undefined}
          onMouseEnter={toggle?.sidePanelProps.onMouseEnter}
          onMouseLeave={toggle?.sidePanelProps.onMouseLeave}
          data-canvas-region="reference"
        >
          <div className={cn("flex flex-col gap-3 px-4 pb-4", CANVAS_CONTENT_TOP_CLASS)}>{children}</div>
        </SidePanel>
      )}
    </>
  );
}
