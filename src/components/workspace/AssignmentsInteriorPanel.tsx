// Settings → Assignments "Show as interior panel" (P-PROFILES 0c): the
// assignment cards in lyra's left `InteriorPanel`, the first child of the
// content card's row, beside the main column (action area + reference column):
// three columns at wide widths. It docks while the three fit
// (`assignmentsPanelDocks`, counting the reference slot, which widens with an
// open slide-over) and the agent has it pinned; otherwise it's lyra's overlay,
// opened from the left nav's Assignments rail item.
import * as React from "react";
import { InteriorPanel, LYRA_CARD_MAX_WIDTH, PanelPinButton } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { useSlotHas } from "@/layout/useSlot";
import { assignmentsPanelDocks, availableForAssignmentsPanel } from "@/contact-handling/assignments-panel-placement";
import { useAssignmentsPanel } from "@/contact-handling/useAssignmentsPanel";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { AssignmentsStack } from "./AssignmentCardList";

/** The content card's row. Under "Show as interior panel" it's `relative`
 *  (the panel's overlay positions against it) and holds the panel first. */
export function AssignmentsPanelRow({ children }: { children: React.ReactNode }) {
  const inPanel = useSlotHas("interior-panel", "assignments");
  return (
    <div className={cn("flex flex-1 overflow-hidden min-h-0", inPanel && "relative")}>
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
  }, [docks, setDocks]);

  return (
    <>
      {/* Measures the content card's row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      <InteriorPanel
        side="left"
        open={panel.open}
        onClose={panel.close}
        headerTitle={t("Assignments")}
        headerActions={
          <PanelPinButton
            pinned={panel.docked}
            onToggle={() => panel.setPinned(!panel.docked)}
            pinnedLabel={t("Unpin Assignments")}
            unpinnedLabel={t("Pin Assignments")}
          />
        }
        width={LYRA_CARD_MAX_WIDTH}
        minWidth={LYRA_CARD_MAX_WIDTH}
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
