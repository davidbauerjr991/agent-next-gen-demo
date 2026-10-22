import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { InteriorPanel, LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "@/contact-handling/canvas-registry";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useDetailSlideOverParts } from "@/components/workspace/detail-slide-over-parts";
import { ReferenceColumn } from "@/components/workspace/ReferenceColumn";

/** `InteriorPanel`'s close transition: the slide-over stays mounted (closed)
 *  this long before the reference cards come back. */
export const SLIDE_OVER_CLOSE_MS = 260;

/** P-CANVAS: the reference slot on the main column's right edge (AI display
 *  inline and main). It holds the reference column (`reference`, two-column
 *  canvas only) or, while a slide-over is open in it
 *  (slide-over-placement.ts), a lyra `InteriorPanel` instead. Docked, the
 *  panel is an in-flow sibling of the action area, so dragging its handle
 *  pushes the action area (never below `ACTION_AREA_MIN_WIDTH`); full screen
 *  and the narrow fallback overlay this row only, below the record header.
 *  Mount it as the last child of the main column's row, which must be
 *  `relative` and is what both this slot and the panel measure. */
export function ReferenceSlot({ reference }: { reference?: ReactNode }) {
  const { selectedDetailPanelContent, setSelectedDetailPanelContent, slideOverMode } = useWorkspace();
  const anchorRef = useRef<HTMLDivElement>(null);
  const rowWidth = useRegionsRowWidth(anchorRef);
  const { body, ...header } = useDetailSlideOverParts();

  const open = slideOverMode === "referenceSlot" && !!selectedDetailPanelContent;
  // Closing: keep the panel mounted, closed, through its transition, then
  // give the slot back to the reference cards.
  const [prevOpen, setPrevOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setClosing(!open);
  }
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(false), SLIDE_OVER_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);
  const slideOverMounted = open || closing;

  return (
    <>
      {/* Measures the row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      {slideOverMounted ? (
        // A direct child of the row: the panel measures its parent for docked vs. overlay and full screen.
        <InteriorPanel
          side="right"
          open={open}
          onClose={() => setSelectedDetailPanelContent(null)}
          width={LYRA_CARD_MAX_WIDTH}
          minWidth={LYRA_CARD_MAX_WIDTH}
          maxWidth={Math.max(LYRA_CARD_MAX_WIDTH, rowWidth - ACTION_AREA_MIN_WIDTH)}
          resizable
          allowFullScreen
          autoFullScreen
          absoluteBreakpoint={ACTION_AREA_MIN_WIDTH + LYRA_CARD_MAX_WIDTH}
          storageKey="workspace.slideOver"
          rounded={false}
          margin={false}
          data-slot="reference-slide-over"
          {...header}
        >
          {body}
        </InteriorPanel>
      ) : (
        reference && <ReferenceColumn>{reference}</ReferenceColumn>
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
