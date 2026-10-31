// The content card's side panels and their PageHeader toggles (P-LAYOUT-F1 A1): lyra's `useSidePanelToggle` (the
// wiring AdminShell has), one instance per panel for the whole content card, so the toggle in whichever page header
// shows and the panel it opens share their state (an unpinned panel's hover flyout; a pinned one opens on a click,
// with no hover preview: `WorkspacePageHeader`'s `withoutPinnedPreview`).
// - Left: the assignments in the interior-panel slot. Open, pinned and width are the per-browser working state
//   (`assignments-working-state.ts`); pinned, it pushes the content while it fits (`assignmentsPanelDocks`), and
//   where it doesn't it renders unpinned, as lyra's `pinDisabled`.
// - Right: the reference column's overlay while the column doesn't fit, and otherwise the docked AI panel (AI display
//   "panel": its AI Overview): `rightPanelTarget`, with the page header saying whether it has a reference column
//   (`WorkspacePageHeader`'s `referenceColumn`). Under "main" the docked panel is a thread, picked from the record
//   header's channel icons, so it has no header toggle.
import * as React from "react";
import { useSidePanelToggle, type UseSidePanelToggleReturn } from "@nicecxone/lyra-ui";
import { useSlotFor } from "@/layout/useSlot";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "./assignments-working-state";
import { useWorkspaceUiField } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

/** Which right panel the page header's right toggle drives: the reference column's overlay while the column is
 *  mounted and doesn't fit; else the docked panel where the active assignment has one; else none (no toggle). */
export type RightPanelTarget = "reference" | "docked" | null;

export function rightPanelTarget({
  referenceColumn,
  referenceColumnFits,
  dockedPanel,
}: {
  referenceColumn: boolean;
  referenceColumnFits: boolean;
  dockedPanel: boolean;
}): RightPanelTarget {
  if (referenceColumn && !referenceColumnFits) return "reference";
  return dockedPanel ? "docked" : null;
}

/** The active assignment has a docked panel: the one test for both its render (`WorkspaceRightPanel`) and the page
 *  header's right toggle, so the toggle never drives a panel that isn't there. */
export function hasDockedPanel({
  showPanelToggle,
  contactSubject,
  activeInteractionIsAgentCall,
}: {
  showPanelToggle: boolean;
  contactSubject: unknown;
  activeInteractionIsAgentCall: boolean;
}): boolean {
  return showPanelToggle && !!contactSubject && !activeInteractionIsAgentCall;
}

interface PanelToggles {
  /** The assignments panel's toggle, while the assignments are in the interior-panel slot. */
  assignments: UseSidePanelToggleReturn | null;
  /** The reference column's overlay (always instantiated: the column reads its panel props). */
  reference: UseSidePanelToggleReturn;
  /** The docked panel (always instantiated: WorkspaceRightPanel reads its panel props). */
  docked: UseSidePanelToggleReturn;
  /** The active assignment has the docked AI panel to toggle (AI display "panel": its AI Overview). Under "main" the
   *  docked panel only shows a thread, picked from the record header's channel icons, and closes without one. */
  dockedPanel: boolean;
  /** Whether the reference column doesn't fit beside the main column (it's the overlay). */
  referenceColumnFits: boolean;
}

const PanelTogglesContext = React.createContext<PanelToggles | null>(null);

/** The panels' toggle state, or null outside the content card. */
export function usePanelToggles(): PanelToggles | null {
  return React.useContext(PanelTogglesContext);
}

export const ASSIGNMENTS_PANEL_ID = "assignments-panel";

export function PanelTogglesProvider({ children }: { children: React.ReactNode }) {
  const inPanel = useSlotFor("assignments") === "interior-panel";
  const [fits] = useWorkspaceUiField("assignmentsPanelDocks");
  const { panelOpen, panelPinned } = useAssignmentsWorkingState();
  const assignments = useSidePanelToggle({
    side: "left",
    id: ASSIGNMENTS_PANEL_ID,
    open: panelOpen,
    onOpenChange: (open) => setAssignmentsWorkingState({ panelOpen: open }),
    pinned: panelPinned,
    onPinnedChange: (pinned) => setAssignmentsWorkingState({ panelPinned: pinned }),
    pinDisabled: inPanel && !fits,
  });

  const [referenceColumnFits] = useWorkspaceUiField("referenceColumnFits");
  const [summariesOverlayOpen, setSummariesOverlayOpen] = useWorkspaceUiField("summariesOverlayOpen");
  const reference = useSidePanelToggle({
    side: "right",
    open: !referenceColumnFits && summariesOverlayOpen,
    onOpenChange: setSummariesOverlayOpen,
    pinned: false,
  });

  const {
    activeInteractionIsAgentCall, aiInPanel, channelPreviewThreadKey, contactSubject, effectiveSidePanelPinned, handleSidePanelClose,
    setSidePanelOpen, showPanelToggle, sidePanelOpen,
  } = useWorkspace();
  const docked = useSidePanelToggle({
    side: "right",
    // As WorkspaceRightPanel renders it: open, or showing a channel's thread (AI display "main").
    open: sidePanelOpen || !!channelPreviewThreadKey,
    onOpenChange: (open) => (open ? setSidePanelOpen(true) : handleSidePanelClose()),
    pinned: effectiveSidePanelPinned,
  });

  const dockedPanel = aiInPanel && hasDockedPanel({ showPanelToggle, contactSubject, activeInteractionIsAgentCall });
  const value: PanelToggles = { assignments: inPanel ? assignments : null, reference, docked, dockedPanel, referenceColumnFits };
  return <PanelTogglesContext.Provider value={value}>{children}</PanelTogglesContext.Provider>;
}
