// The interior-panel slot (P-PROFILES 0c; P-HOME-1n): the assignments part in lyra's left `InteriorPanel`, between
// the left nav and the content, beside the main column (action area + reference column): three columns at wide
// widths. A fixed panel showing only the Assignments header and cards, resizable within lyra's own min/max, with no
// pin and no close: it docks while the three fit (`assignmentsPanelDocks`, counting the reference slot, which widens
// with an open slide-over); only when they don't is it lyra's overlay, opened from the left nav's Assignments item.
import * as React from "react";
import { InteriorPanel, LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { useSlotHas } from "@/layout/useSlot";
import { assignmentsPanelDocks, availableForAssignmentsPanel } from "@/contact-handling/assignments-panel-placement";
import { useAssignmentsPanel } from "@/contact-handling/useAssignmentsPanel";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { AssignmentsStack } from "./AssignmentCardList";

/** The body row's content side: the interior-panel slot, then the content column. With the panel it's `relative`
 *  (the overlay positions against it); its width is the panel's and the content's, what the fit rule measures. */
export function AssignmentsPanelRow({ children }: { children: React.ReactNode }) {
  const inPanel = useSlotHas("interior-panel", "assignments");
  return (
    <div className={cn("flex flex-1 min-w-0 overflow-hidden min-h-0", inPanel && "relative")}>
      {inPanel && <AssignmentsInteriorPanel />}
      {children}
    </div>
  );
}

function AssignmentsInteriorPanel() {
  const panel = useAssignmentsPanel();
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const contentRowWidth = useParentWidth(anchorRef);
  const [panelWidth, setPanelWidth] = React.useState(LYRA_CARD_MAX_WIDTH);
  const [regionsRowWidth] = useWorkspaceUiField("regionsRowWidth");
  const [referenceSlotWidth] = useWorkspaceUiField("referenceSlotWidth");
  const [, setDocks] = useWorkspaceUiField("assignmentsPanelDocks");
  const [, setOverlayOpen] = useWorkspaceUiField("assignmentsPanelOverlayOpen");

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
    // Docking ends the overlay, so a later "doesn't fit" starts closed rather than reopening it.
    if (docks) setOverlayOpen(false);
  }, [docks, setDocks, setOverlayOpen]);

  return (
    <>
      {/* Measures the panel-and-content row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      <InteriorPanel
        side="left"
        open={panel.open}
        // Only the overlay closes; the docked panel goes only by switching placement.
        onClose={panel.overlaid ? panel.close : undefined}
        headerTitle={t("Assignments")}
        // lyra's own min/max (InteriorPanel's 350–425; the cards are laid out at the card width).
        width={LYRA_CARD_MAX_WIDTH}
        onWidthChange={setPanelWidth}
        resizable
        // Docked or overlay is this panel's own rule, not lyra's breakpoint.
        absoluteBreakpoint={panel.docked ? 0 : Number.POSITIVE_INFINITY}
        storageKey="workspace.assignmentsPanel"
        data-slot="assignments-panel"
        data-docked={panel.docked || undefined}
      >
        <AssignmentsStack mount="interiorPanel" className="px-3 pb-3" />
      </InteriorPanel>
    </>
  );
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
