import { useEffect, useRef, type ReactNode } from "react";
import { LYRA_CARD_MAX_WIDTH, SidePanel } from "@nicecxone/lyra-ui";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";

/** P-CANVAS: the reference column, at lyra's max card width on the main
 *  column's right edge. Docked while the main column fits the action area's
 *  minimum plus the column: a plain column, the cards straight on the content
 *  card's background (browser pass, 2026-10-22). Otherwise a lyra `SidePanel`
 *  overlay (the same component as Contact Details, with its header and
 *  background) over the action area, opened by the record header's
 *  "Summaries" toggle and closed by its close button or a click outside it. Docked vs. overlay is derived from the measured width,
 *  never a setting. `ReferenceSlot` mounts it (the last child of the main
 *  column's row, which must be `relative`: the overlay positions against it)
 *  and measures the row. */
export function ReferenceColumn({
  children,
  width = LYRA_CARD_MAX_WIDTH,
  transition,
  collapsed = false,
  onPin,
  title,
}: {
  children: ReactNode;
  /** The docked slot's width: the card width, or wider while a slide-over over it is (ReferenceSlot). */
  width?: number;
  transition?: string;
  /** P-HOME-1c: the agent collapsed the column: it's the overlay even while it fits. */
  collapsed?: boolean;
  /** P-HOME-1c: docks a collapsed column again, from the overlay's pin button (shown only while it fits). */
  onPin?: () => void;
  /** The overlay's header; default "Summaries". */
  title?: string;
}) {
  const { activeInteraction } = useWorkspace();
  // Measured by whoever mounts this column (`useReferenceColumnFit`: ReferenceSlot, two-column Home).
  const [fits] = useWorkspaceUiField("referenceColumnFits");
  const [overlayOpen, setOverlayOpen] = useWorkspaceUiField("summariesOverlayOpen");
  const columnRef = useRef<HTMLDivElement>(null);
  const docked = fits && !collapsed;

  // The overlay closes when the column docks again and when the card changes.
  useEffect(() => {
    if (docked) setOverlayOpen(false);
  }, [docked, setOverlayOpen]);
  useEffect(() => {
    setOverlayOpen(false);
  }, [activeInteraction?.id, setOverlayOpen]);

  // Outside click closes the overlay (the toggle handles its own clicks).
  const open = !docked && overlayOpen;
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
          <div className="flex flex-col gap-3 p-4">{children}</div>
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
          {...(onPin && fits ? { onPinToggle: onPin } : {})}
          data-canvas-region="reference"
        >
          <div className="flex flex-col gap-3 p-4">{children}</div>
        </SidePanel>
      )}
    </>
  );
}
