import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { InteriorPanel, LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "@/contact-handling/canvas-registry";
import { fitsBeside } from "@/contact-handling/assignments-panel-placement";
import { useReferenceSideGate } from "@/contact-handling/panel-toggles";
import { useReferenceColumnWidth } from "@/contact-handling/reference-column-width";
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
 *  underneath. The panel fills the column's current width (a column the agent
 *  resized, P-LAYOUT-F4 19, 20) or is dragged wider, the column's slot widening
 *  with it so it pushes the action area (never below `ACTION_AREA_MIN_WIDTH`);
 *  full screen covers the row. With no
 *  column (the stacked canvas, or every card in main), while the panel and the
 *  action area's minimum fit (`fitsBeside`), it docks beside the whole page
 *  column instead, in the page's right host, pushing the page header with the
 *  body (P-LAYOUT-F3 4, P-LAYOUT-F1 D); with a column it is the column's, over
 *  it, however wide the row (P-LAYOUT-F4 3). Mount it as
 *  the last child of the main column's row, which must be `relative`: both
 *  this slot and the panel measure it, and the panel positions against it. */
export function ReferenceSlot({ reference, panelColumn = false }: { reference?: ReactNode; panelColumn?: boolean }) {
  const { activeInteractionId, selectedDetailPanelContent, slideOverMode } = useWorkspace();
  const sideOpen = useReferenceSideGate({ hasColumn: !!reference || panelColumn, content: selectedDetailPanelContent });
  const panel = useDetailSlideOverPanel({
    wanted: slideOverMode === "referenceSlot" && !!selectedDetailPanelContent && sideOpen,
    assignmentKey: activeInteractionId ?? undefined,
  });
  // P-PROFILES: the assignments interior panel's dock rule counts this slot.
  const [, setReferenceSlotWidth] = useWorkspaceUiField("referenceSlotWidth");
  // The frame reports the column's width, or 0 (a docked slide-over is outside the measured row).
  const onSlotWidthChange = useCallback((width: number) => setReferenceSlotWidth(width), [setReferenceSlotWidth]);
  useEffect(() => () => setReferenceSlotWidth(null), [setReferenceSlotWidth]);
  return (
    <ReferenceSlotFrame reference={reference} externalColumn={panelColumn} onSlotWidthChange={onSlotWidthChange} panel={panel} headerToggle />
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

/** The reference slot's layout, shared by the interaction (ReferenceSlot), a
 *  kind cell and two-column Home's Cards column (P-HOME-1e; its panel is
 *  Home's, below), and Home's detail panel (a frame with no column, mounted at
 *  the Home level, P-LAYOUT-F4 4): the measured reference column and, while
 *  `panel` is wanted, the `InteriorPanel` — docked beside the whole page column
 *  (the page's right host) while there is no column and it fits (`fitsBeside`,
 *  P-LAYOUT-F3 4), else over the column or over the body. Mount it as the last
 *  child of a `relative` row. */
export function ReferenceSlotFrame({
  reference,
  referenceTitle,
  panel,
  onSlotWidthChange,
  bodyReserved = 0,
  headerToggle = false,
  externalColumn = false,
  publishesRow = true,
}: {
  /** Whether this frame's row width and fit flag are the shared ones (`regionsRowWidth`, `referenceColumnFits`) the
   *  toggle, the column and the assignments panel read. One frame per page does; Home's detail panel beside
   *  two-column Home's own frame does not. */
  publishesRow?: boolean;
  reference?: ReactNode;
  referenceTitle?: string;
  panel: ReferenceSlotPanel;
  onSlotWidthChange?: (width: number) => void;
  /** Width the body needs beside the panel on top of the action area's minimum (`fitsBeside`'s `reserved`), for a
   *  body that has its own minimum (one-column Home's card grid). */
  bodyReserved?: number;
  /** The column is driven by the page header's right toggle (an interaction's, a kind cell's); see `ReferenceColumn`. */
  headerToggle?: boolean;
  /** The row's right column is mounted by the caller, not here (AI display "panel": the Copilot panel, P-LAYOUT-F4
   *  8): the detail opens over it as over `reference`, never docked beside the page column, and the slot counts the
   *  column's width. */
  externalColumn?: boolean;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  // The column's own width (dragged, kept per browser; the card width otherwise) is what a detail slide-over fills and
  // what the action area has to leave room for (P-LAYOUT-F4 19, 20). With no column there's only the card width.
  const column = useReferenceColumnWidth();
  const hasColumn = headerToggle && (!!reference || externalColumn);
  const baseWidth = hasColumn ? column.width : LYRA_CARD_MAX_WIDTH;
  const rowWidth = useReferenceColumnFit(anchorRef, baseWidth, publishesRow);
  const { wanted } = panel;
  // Opened by a click: mounted closed, then opened a frame later (lyra's width transition slides it in); closed by
  // `open`, then unmounted after its transition. Nothing else re-mounts. A frame that mounts already wanted (the
  // agent returning to an assignment, or to Home, whose panel was left open: its state outlives the mount, kept per
  // assignment in the workspace UI store) mounts open, so the entrance isn't replayed (P-LAYOUT-F4 5).
  const [mounted, setMounted] = useState(wanted);
  const [open, setOpen] = useState(wanted);
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
  // The slide-over fills the column at least: its width is the column's current one unless it was dragged wider.
  const openWidth = Math.max(remembered?.width ?? 0, baseWidth);
  const remember = (change: Partial<SlideOverState>) => {
    if (!assignmentKey) return;
    updateAssignmentReference(store, assignmentKey, (r) => (r.slideOver.content ? { ...r, slideOver: { ...r.slideOver, ...change } } : r));
  };
  // The slot follows the panel's width while it's open (a drag pushes the action area); lyra opens it at the card width.
  const [panelWidth, setPanelWidth] = useState(openWidth);
  const [resizing, setResizing] = useState(false);
  // A slide-over drag in progress, and the width it last reported (written to the memory on release).
  const draggingRef = useRef(false);
  const pendingWidth = useRef<number | null>(null);
  // No width transition while anything here is being dragged: the column's edge, the slide-over's, or the Copilot
  // panel's (the controller's `sidePanelResizing`). The slide-over follows the column's width on every pointer move,
  // and the column follows a wider slide-over, so each must jump, never slide (P-LAYOUT-F4 22).
  const { sidePanelResizing } = useWorkspace();
  const instantWidth = resizing || (externalColumn && sidePanelResizing);
  useEffect(() => {
    if (!mounted) setPanelWidth(baseWidth);
  }, [mounted, baseWidth]);
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
  // F4 3 (reverses F3 10's reference-column part): with a reference column the panel is that column's own, over it
  // at its width, never a third column beside it; only with no column does it dock. (Home's panel has no column of
  // its own: it's hoisted out of the dashboard, F4 4.)
  const docks =
    !reference &&
    !externalColumn &&
    !!right &&
    right.rowWidth > 0 &&
    rowWidth > 0 &&
    fitsBeside({ available, panelWidth: currentPanelWidth, reserved: bodyReserved });
  // Docked at the last commit (read on the next render to give its width back).
  useLayoutEffect(() => {
    dockedRef.current = docks;
  }, [docks]);
  const slotWidth = open && !docks ? Math.max(baseWidth, panelWidth) : baseWidth;
  // The slot's width as the assignments panel's dock rule counts it: the column (widened by a panel over it), or
  // nothing (a docked panel is outside the measured row).
  const reportedWidth = reference || externalColumn ? slotWidth : 0;
  const dockOrInline = (node: ReactElement) => (docks && right ? createPortal(node, right.host) : node);
  // Reported (a workspace UI store write the assignments panel's dock rule reads) once a drag ends, not per move.
  useEffect(() => {
    if (resizing) return;
    onSlotWidthChange?.(reportedWidth);
  }, [reportedWidth, onSlotWidthChange, resizing]);

  return (
    <>
      {/* Measures the row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      {reference && (
        <ReferenceColumn width={slotWidth} transition={resizing ? "none" : WIDTH_TRANSITION} title={referenceTitle} headerToggle={headerToggle} onResizeStateChange={setResizing} instantWidth={instantWidth}>
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
          minWidth={baseWidth}
          maxWidth={Math.max(baseWidth, available - ACTION_AREA_MIN_WIDTH - bodyReserved)}
          instantWidthChange={instantWidth}
          // A drag's moves update only this frame's own width (the column follows a wider slide-over); the per-assignment
          // memory (the workspace UI store, which the controller reads) is written once on release, not per move
          // (P-LAYOUT-F4 22b). The keyboard's steps write at once.
          onWidthChange={(width) => {
            setPanelWidth(width);
            if (draggingRef.current) pendingWidth.current = width;
            else remember({ width });
          }}
          onResizeStateChange={(isResizing) => {
            draggingRef.current = isResizing;
            setResizing(isResizing);
            if (!isResizing && pendingWidth.current !== null) {
              remember({ width: pendingWidth.current });
              pendingWidth.current = null;
            }
          }}
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
function useReferenceColumnFit(anchorRef: React.RefObject<HTMLElement | null>, columnWidth: number, publish: boolean): number {
  const [storedWidth, setRowWidth] = useWorkspaceUiField("regionsRowWidth");
  const [, setFits] = useWorkspaceUiField("referenceColumnFits");
  // A frame that doesn't publish (one-column Home's panel, beside two-column Home's own frame) measures for itself
  // only: two frames writing the one shared row width and fit flag would leave whichever measured last (P-LAYOUT-F4 audit).
  const [ownWidth, setOwnWidth] = useState(0);
  useLayoutEffect(() => {
    const row = anchorRef.current?.parentElement;
    if (!row) return;
    const measure = (width: number) => {
      if (width <= 0) return;
      setOwnWidth(width);
      if (!publish) return;
      setRowWidth(width);
      setFits(width >= ACTION_AREA_MIN_WIDTH + columnWidth);
    };
    measure(row.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(row);
    return () => ro.disconnect();
  }, [anchorRef, setRowWidth, setFits, columnWidth, publish]);
  return publish ? storedWidth : ownWidth;
}
