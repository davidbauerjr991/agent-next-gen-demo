import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { InteriorPanel, LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "@/contact-handling/canvas-registry";
import { fitsBeside } from "@/contact-handling/assignments-panel-placement";
import { assignmentIdFor } from "@/domain";
import {
  updateAssignmentReference,
  useWorkspaceUiField,
  useWorkspaceUiStore,
  type SlideOverState,
} from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useDetailSlideOverPanel, type DetailSlideOverParts } from "@/components/workspace/detail-slide-over-parts";
import { ReferenceColumn } from "@/components/workspace/ReferenceColumn";
import { usePageRightHost } from "@/components/workspace/page-right-host";

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
 *  `InteriorPanel` over it — in lyra's overlay layout, right-aligned below
 *  the record header, sliding in from the right. The cards stay mounted
 *  underneath. The column's slot widens with the panel (its width from
 *  `onWidthChange`), so dragging the panel pushes the action area (never
 *  below `ACTION_AREA_MIN_WIDTH`); full screen covers the row. While the
 *  panel, the action area's minimum and the column (if any) fit
 *  (`fitsBeside`), it docks beside the whole page column instead, in the
 *  page's right host, pushing the page header with the body (P-LAYOUT-F3 4;
 *  with no column it docked as this row's sibling, P-LAYOUT-F1 D). Mount it as
 *  the last child of the main column's row, which must be `relative`: both
 *  this slot and the panel measure it, and the panel positions against it. */
export function ReferenceSlot({ reference }: { reference?: ReactNode }) {
  const { activeInteractionId, selectedDetailPanelContent, slideOverMode } = useWorkspace();
  const panel = useDetailSlideOverPanel({
    wanted: slideOverMode === "referenceSlot" && !!selectedDetailPanelContent,
    assignmentKey: activeInteractionId ?? undefined,
  });
  // P-PROFILES: the assignments interior panel's dock rule counts this slot.
  const [, setReferenceSlotWidth] = useWorkspaceUiField("referenceSlotWidth");
  // The frame reports the column's width, or 0 (a docked slide-over is outside the measured row).
  const onSlotWidthChange = useCallback((width: number) => setReferenceSlotWidth(width), [setReferenceSlotWidth]);
  useEffect(() => () => setReferenceSlotWidth(null), [setReferenceSlotWidth]);
  return (
    <ReferenceSlotFrame reference={reference} onSlotWidthChange={onSlotWidthChange} panel={panel} />
  );
}

/** A panel over the reference slot: its header parts, body and whether it's wanted open. */
export interface ReferenceSlotPanel {
  wanted: boolean;
  onClose: () => void;
  header: Omit<DetailSlideOverParts, "body">;
  body: ReactNode;
  /** lyra `InteriorPanel`'s width memory (a cookie); for a panel that isn't an assignment's (Home's). */
  storageKey?: string;
  /** `data-slot` on the panel. */
  slot: string;
  /** P-HOME-1g: the assignment (its card key) whose slide-over this is: its full screen and dragged width are kept
   *  per assignment in the workspace UI store (`referenceByAssignment`), in memory only, and come back with it. */
  assignmentKey?: string;
  /** Where focus goes on close when the element that opened it is gone or wasn't focusable (a hover preview's
   *  action): the match nearest this slot's row, e.g. its assignment's Contact Details button. */
  returnFocusSelector?: string;
}

/** The first `selector` match in the closest ancestor of `from` that has one: the one in this slot's own region. */
function nearest(from: Element | null, selector: string | undefined): HTMLElement | null {
  if (!selector) return null;
  for (let el = from?.parentElement; el; el = el.parentElement) {
    const match = el.querySelector<HTMLElement>(selector);
    if (match) return match;
  }
  return null;
}

/** The reference slot's layout, shared by the interaction (ReferenceSlot) and
 *  two-column Home (P-HOME-1e), and one-column Home's detail panel: the
 *  measured reference column and, while `panel` is wanted, the
 *  `InteriorPanel` — docked beside the whole page column (the page's right
 *  host) while it fits (`fitsBeside`, P-LAYOUT-F3 4), else over the column
 *  (widening the slot) or over the body. Mount it as the last child of a
 *  `relative` row. */
export function ReferenceSlotFrame({
  reference,
  referenceTitle,
  panel,
  onSlotWidthChange,
  bodyReserved = 0,
}: {
  reference?: ReactNode;
  referenceTitle?: string;
  panel: ReferenceSlotPanel;
  onSlotWidthChange?: (width: number) => void;
  /** Width the body needs beside the panel on top of the action area's minimum (`fitsBeside`'s `reserved`), for a
   *  body that has its own minimum (one-column Home's card grid). */
  bodyReserved?: number;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const rowWidth = useReferenceColumnFit(anchorRef);
  const { wanted } = panel;
  // Mounted closed, then opened a frame later (lyra's width transition slides it in); closed by `open`,
  // then unmounted after its transition. Nothing else re-mounts.
  const [mounted, setMounted] = useState(wanted);
  const [open, setOpen] = useState(false);
  // Focus comes back to whatever opened it (P-HOME-1n; lyra's InteriorPanel has no focus return of its own): the
  // element focused when it opened, else the `returnFocusSelector` match nearest this row. Only after it was open,
  // and only when focus is in the panel or on the page itself.
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasWanted = useRef(false);
  const returnFocusSelector = useRef(panel.returnFocusSelector);
  returnFocusSelector.current = panel.returnFocusSelector;
  useEffect(() => {
    if (wanted) {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      wasWanted.current = true;
      setMounted(true);
      return afterNextFrame(() => setOpen(true));
    }
    setOpen(false);
    const focusInPanelOrPage = !document.activeElement || document.activeElement === document.body || !!panelRef.current?.contains(document.activeElement);
    if (wasWanted.current && focusInPanelOrPage) {
      const target = opener.current?.isConnected ? opener.current : nearest(anchorRef.current, returnFocusSelector.current);
      target?.focus();
    }
    wasWanted.current = false;
    opener.current = null;
    const timer = window.setTimeout(() => setMounted(false), SLIDE_OVER_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [wanted]);
  // Escape on the element that opened it closes it too, as inside it (the panel's root handler below).
  const onClose = useRef(panel.onClose);
  onClose.current = panel.onClose;
  useEffect(() => {
    if (!wanted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !opener.current || document.activeElement !== opener.current) return;
      onClose.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [wanted]);

  // An assignment's slide-over comes back as the agent left it: full screen, at its dragged width.
  const { assignmentKey } = panel;
  const store = useWorkspaceUiStore();
  const [byAssignment] = useWorkspaceUiField("referenceByAssignment");
  const remembered = assignmentKey ? byAssignment[assignmentIdFor(assignmentKey)]?.slideOver : undefined;
  const openWidth = remembered?.width ?? LYRA_CARD_MAX_WIDTH;
  const remember = (change: Partial<SlideOverState>) => {
    if (!assignmentKey) return;
    updateAssignmentReference(store, assignmentKey, (r) => (r.slideOver.content ? { ...r, slideOver: { ...r.slideOver, ...change } } : r));
  };
  // The slot follows the panel's width while it's open (a drag pushes the action area); lyra opens it at the card width.
  const [panelWidth, setPanelWidth] = useState(openWidth);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!mounted) setPanelWidth(LYRA_CARD_MAX_WIDTH);
  }, [mounted]);
  // P-LAYOUT-F3 4: the panel docks beside the whole page column (the page's right host, so the page header narrows
  // with the body; AdminShell's right SidePanel) while it, the action area's minimum and the reference column (if
  // any) fit — the one fit rule, `fitsBeside` — and overlays where it is when they don't: over the column (which
  // widens with it) or over the body (P-LAYOUT-F1 D). Docked, it's outside this row, so the row's measured width
  // gives its width back to count what's available.
  const right = usePageRightHost();
  const dockedRef = useRef(false);
  const currentPanelWidth = open ? panelWidth : openWidth;
  const available = rowWidth + (dockedRef.current && mounted ? currentPanelWidth : 0);
  // The page row's width must be known too: the docked panel takes it as its container from its first render (a 0
  // there would latch lyra's autoFullScreen).
  const docks =
    !!right &&
    right.rowWidth > 0 &&
    rowWidth > 0 &&
    fitsBeside({ available, panelWidth: currentPanelWidth, reserved: (reference ? LYRA_CARD_MAX_WIDTH : 0) + bodyReserved });
  // Docked at the last commit (read on the next render to give its width back).
  useLayoutEffect(() => {
    dockedRef.current = docks;
  }, [docks]);
  const slotWidth = open && !docks ? Math.max(LYRA_CARD_MAX_WIDTH, panelWidth) : LYRA_CARD_MAX_WIDTH;
  // The slot's width as the assignments panel's dock rule counts it: the column (widened by a panel over it), or
  // nothing (a docked panel is outside the measured row).
  const reportedWidth = reference ? slotWidth : 0;
  const dockOrInline = (node: ReactElement) => (docks && right ? createPortal(node, right.host) : node);
  useEffect(() => {
    onSlotWidthChange?.(reportedWidth);
  }, [reportedWidth, onSlotWidthChange]);

  return (
    <>
      {/* Measures the row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      {reference && (
        <ReferenceColumn width={slotWidth} transition={resizing ? "none" : WIDTH_TRANSITION} title={referenceTitle}>
          {reference}
        </ReferenceColumn>
      )}
      {mounted && dockOrInline(
        // Docked: in the page's right host, a flex item of the content card's row, taking the row's width as its
        // container. Overlaying: a direct child of this row, which it measures and positions against.
        <InteriorPanel
          key={assignmentKey}
          ref={panelRef}
          // Escape inside it closes it (lyra's InteriorPanel has no Escape of its own; its root takes the handler).
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key !== "Escape" || e.defaultPrevented) return;
            e.stopPropagation();
            panel.onClose();
          }}
          side="right"
          open={open}
          onClose={panel.onClose}
          // Docked: a flex sibling of the action area that pushes it; otherwise lyra's overlay layout.
          overlayHeader={!docks}
          absoluteBreakpoint={docks ? 0 : Number.POSITIVE_INFINITY}
          containerWidth={docks ? right!.rowWidth : undefined}
          width={openWidth}
          minWidth={LYRA_CARD_MAX_WIDTH}
          maxWidth={Math.max(LYRA_CARD_MAX_WIDTH, available - ACTION_AREA_MIN_WIDTH - bodyReserved - (docks && reference ? LYRA_CARD_MAX_WIDTH : 0))}
          onWidthChange={(width) => {
            setPanelWidth(width);
            remember({ width });
          }}
          onResizeStateChange={setResizing}
          resizable
          allowFullScreen
          autoFullScreen
          defaultFullScreen={!!remembered?.fullScreen}
          onFullScreenChange={(fullScreen) => remember({ fullScreen })}
          storageKey={panel.storageKey}
          rounded={false}
          margin={false}
          data-slot={panel.slot}
          {...panel.header}
        >
          {panel.body}
        </InteriorPanel>,
      )}
    </>
  );
}

/** The row's width, and whether it fits the action area's minimum plus the
 *  reference column (`referenceColumnFits`), into the workspace UI store. A
 *  zero width (not laid out; jsdom) keeps the last answer. The row is the
 *  content card minus the docked Contact Details / thread panel, so an open
 *  thread panel under "main" counts. */
function useReferenceColumnFit(anchorRef: React.RefObject<HTMLElement | null>): number {
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
