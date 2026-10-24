import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { InteriorPanel, LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "@/contact-handling/canvas-registry";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useDetailSlideOverParts } from "@/components/workspace/detail-slide-over-parts";
import { ReferenceColumn } from "@/components/workspace/ReferenceColumn";

/** `InteriorPanel`'s close transition: the slide-over stays mounted (closed)
 *  this long after a close. */
const SLIDE_OVER_CLOSE_MS = 260;

/** lyra `InteriorPanel`'s own width transition, so the column eases with it. */
const WIDTH_TRANSITION = "width 250ms cubic-bezier(0.4, 0, 0.2, 1)";

/** Runs `run` after the next frame has painted (two frames), so a panel
 *  mounted closed is laid out before it opens and its width transition plays. */
function afterNextFrame(run: () => void): () => void {
  const raf = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : (cb: () => void) => window.setTimeout(cb, 16);
  const cancel = typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame.bind(window) : window.clearTimeout;
  let inner = 0;
  const outer = raf(() => {
    inner = raf(run);
  });
  return () => {
    cancel(outer);
    cancel(inner);
  };
}

/** P-CANVAS: the reference slot on the main column's right edge (AI display
 *  inline and main): the reference column (two-column canvas) and, while a
 *  slide-over is open in it (slide-over-placement.ts), a lyra
 *  `InteriorPanel` over it — always in lyra's overlay layout, right-aligned
 *  below the record header, sliding in from the right. The cards stay
 *  mounted underneath. The column's slot widens with the panel (its width
 *  from `onWidthChange`), so dragging the panel pushes the action area (never
 *  below `ACTION_AREA_MIN_WIDTH`); full screen covers the row. Mount it as
 *  the last child of the main column's row, which must be `relative`: both
 *  this slot and the panel measure it, and the panel positions against it. */
export function ReferenceSlot({ reference }: { reference?: ReactNode }) {
  const { selectedDetailPanelContent, setSelectedDetailPanelContent, slideOverMode } = useWorkspace();
  const anchorRef = useRef<HTMLDivElement>(null);
  const rowWidth = useRegionsRowWidth(anchorRef);
  const { body, ...header } = useDetailSlideOverParts();

  const wanted = slideOverMode === "referenceSlot" && !!selectedDetailPanelContent;
  // Mounted closed, then opened a frame later (lyra's width transition slides it in); closed by `open`,
  // then unmounted after its transition. Nothing else re-mounts.
  const [mounted, setMounted] = useState(wanted);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (wanted) {
      setMounted(true);
      return afterNextFrame(() => setOpen(true));
    }
    setOpen(false);
    const timer = window.setTimeout(() => setMounted(false), SLIDE_OVER_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [wanted]);

  // The slot follows the panel's width while it's open (a drag pushes the action area); lyra opens it at the card width.
  const [panelWidth, setPanelWidth] = useState(LYRA_CARD_MAX_WIDTH);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!mounted) setPanelWidth(LYRA_CARD_MAX_WIDTH);
  }, [mounted]);
  const slotWidth = open ? Math.max(LYRA_CARD_MAX_WIDTH, panelWidth) : LYRA_CARD_MAX_WIDTH;
  // P-PROFILES: the assignments interior panel's dock rule counts this slot.
  const [, setReferenceSlotWidth] = useWorkspaceUiField("referenceSlotWidth");
  useEffect(() => {
    setReferenceSlotWidth(reference ? slotWidth : 0);
  }, [reference, slotWidth, setReferenceSlotWidth]);
  useEffect(() => () => setReferenceSlotWidth(null), [setReferenceSlotWidth]);

  return (
    <>
      {/* Measures the row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      {reference && (
        <ReferenceColumn width={slotWidth} transition={resizing ? "none" : WIDTH_TRANSITION}>
          {reference}
        </ReferenceColumn>
      )}
      {mounted && (
        // A direct child of the row: the panel measures its parent and positions against it.
        <InteriorPanel
          side="right"
          open={open}
          onClose={() => setSelectedDetailPanelContent(null)}
          overlayHeader
          width={LYRA_CARD_MAX_WIDTH}
          minWidth={LYRA_CARD_MAX_WIDTH}
          maxWidth={Math.max(LYRA_CARD_MAX_WIDTH, rowWidth - ACTION_AREA_MIN_WIDTH)}
          onWidthChange={setPanelWidth}
          onResizeStateChange={setResizing}
          resizable
          allowFullScreen
          autoFullScreen
          storageKey="workspace.slideOver"
          rounded={false}
          margin={false}
          data-slot="reference-slide-over"
          {...header}
        >
          {body}
        </InteriorPanel>
      )}
    </>
  );
}

/** The row's width, and whether it fits the action area's minimum plus the
 *  reference column (`referenceColumnFits`), into the workspace UI store. A
 *  zero width (not laid out; jsdom) keeps the last answer. The row is the
 *  content card minus the docked Contact Details / thread panel, so an open
 *  thread panel under "main" counts. */
function useRegionsRowWidth(anchorRef: React.RefObject<HTMLElement | null>): number {
  const [rowWidth, setRowWidth] = useWorkspaceUiField("regionsRowWidth");
  const [, setFits] = useWorkspaceUiField("referenceColumnFits");
  useLayoutEffect(() => {
    const row = anchorRef.current?.parentElement;
    if (!row) return;
    const measure = (width: number) => {
      if (width <= 0) return;
      setRowWidth(width);
      setFits(width >= ACTION_AREA_MIN_WIDTH + LYRA_CARD_MAX_WIDTH);
    };
    measure(row.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(row);
    return () => ro.disconnect();
  }, [anchorRef, setRowWidth, setFits]);
  return rowWidth;
}
