// The interior-panel slot (P-PROFILES 0c; P-HOME-1n; P-LAYOUT fix (a), Dave 2026-10-30): the assignments part in
// lyra's left `SidePanel` inside the content card, its first flex child, before the record header, body, Home and
// Settings — the "Side Panel — Left" story's shape. Pinned, it pushes the content while it, the action area and the
// reference slot fit (`assignmentsPanelDocks`, counting the reference slot, which widens with an open slide-over);
// where they don't, or unpinned, it's SidePanel's own overlay. Its header has the pin and the close; closed (or as an
// overlay), the "Show assignments" toggle sits at the content card's top start. Open, pinned (both on by default,
// `useAssignmentsPanel`) and its dragged width are per-browser working state.
import * as React from "react";
import { ActionIconButton, LYRA_CARD_MAX_WIDTH, SidePanel } from "@nicecxone/lyra-ui";
import { PanelLeftOpen } from "lucide-react";
import { t } from "@/i18n";
import { useSlotHas } from "@/layout/useSlot";
import { assignmentsPanelDocks, availableForAssignmentsPanel } from "@/contact-handling/assignments-panel-placement";
import { useAssignmentsPanel } from "@/contact-handling/useAssignmentsPanel";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "@/contact-handling/assignments-working-state";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { AssignmentsStack } from "./AssignmentCardList";

/** The assignments part in the interior-panel slot: the panel, and its toggle while it isn't pushing the content. */
export function AssignmentsInteriorPanel() {
  return useSlotHas("interior-panel", "assignments") ? <AssignmentsSidePanel /> : null;
}

function AssignmentsSidePanel() {
  const panel = useAssignmentsPanel();
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const contentRowWidth = useParentWidth(anchorRef);
  // The dragged width, kept per browser (the working state; clamped to the panel's bounds on read). Live while
  // dragging, saved once the drag settles.
  const { panelWidth: savedWidth } = useAssignmentsWorkingState();
  const [panelWidth, setPanelWidth] = React.useState(() => clampPanelWidth(savedWidth));
  const pendingWidth = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (panelWidth === clampPanelWidth(savedWidth)) return;
    pendingWidth.current = panelWidth;
    const id = window.setTimeout(() => {
      pendingWidth.current = null;
      setAssignmentsWorkingState({ panelWidth });
    }, SAVE_WIDTH_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [panelWidth, savedWidth]);
  // Unmounted before a drag settled (e.g. a placement switch): its width is still saved.
  React.useEffect(
    () => () => {
      if (pendingWidth.current !== null) setAssignmentsWorkingState({ panelWidth: pendingWidth.current });
    },
    [],
  );
  const [regionsRowWidth] = useWorkspaceUiField("regionsRowWidth");
  const [referenceSlotWidth] = useWorkspaceUiField("referenceSlotWidth");
  const [, setDocks] = useWorkspaceUiField("assignmentsPanelDocks");
  const [, setFitOverlayOpen] = useWorkspaceUiField("assignmentsPanelOverlayOpen");

  const docks = assignmentsPanelDocks({
    available: availableForAssignmentsPanel({
      regionsRowWidth,
      referenceSlotMounted: referenceSlotWidth !== null,
      contentRowWidth,
      panelDocked: panel.docked,
      panelWidth,
    }),
    panelWidth,
    referenceSlotWidth: referenceSlotWidth ?? 0,
  });
  React.useEffect(() => {
    setDocks(docks);
    // Fitting again ends the fit overlay, so a later "doesn't fit" starts closed rather than reopening it.
    if (docks) setFitOverlayOpen(false);
  }, [docks, setDocks, setFitOverlayOpen]);

  const toggleLabel = t("Show assignments");
  return (
    <>
      {/* Measures the panel-and-content row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      {/* Not pushing: the toggle's strip at the card's top start. Its button only while the panel is hidden (open, the
          panel's own close hides it, and an open overlay would cover the button). */}
      {!panel.docked && (
        <div className="w-10 shrink-0 ps-2 pt-3" data-slot="assignments-panel-toggle">
          {!panel.open && (
            <ActionIconButton title={toggleLabel} aria-label={toggleLabel} aria-expanded={false} onClick={panel.toggle}>
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </ActionIconButton>
          )}
        </div>
      )}
      <SidePanel
        side="left"
        open={panel.open}
        pinned={panel.pinned}
        onPinToggle={panel.togglePin}
        showCloseButton
        onClose={panel.close}
        headerTitle={t("Assignments")}
        // The cards are laid out at the card width: SidePanel's 200px minimum would crush them. Its own 425 max.
        minWidth={LYRA_CARD_MAX_WIDTH}
        maxWidth={PANEL_MAX_WIDTH}
        width={panelWidth}
        onWidthChange={setPanelWidth}
        resizable
        // Pinned, it pushes only while the three fit; otherwise SidePanel's overlay.
        absoluteBreakpoint={docks ? 0 : Number.POSITIVE_INFINITY}
        data-slot="assignments-panel"
        data-docked={panel.docked || undefined}
      >
        <AssignmentsStack mount="interiorPanel" className="px-3 pb-3" />
      </SidePanel>
    </>
  );
}

/** SidePanel's own default maximum, passed explicitly so the saved width clamps to the same bound. */
const PANEL_MAX_WIDTH = 425;
/** A drag fires a width per frame: the saved width waits for it to settle. */
const SAVE_WIDTH_AFTER_MS = 250;

/** A saved width within the panel's bounds; the card width when there's none. */
function clampPanelWidth(width: number | null): number {
  return Math.min(PANEL_MAX_WIDTH, Math.max(LYRA_CARD_MAX_WIDTH, width ?? LYRA_CARD_MAX_WIDTH));
}

/** The width of `ref`'s parent, tracked; 0 until laid out (jsdom). */
function useParentWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    setWidth(parent.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(parent);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
