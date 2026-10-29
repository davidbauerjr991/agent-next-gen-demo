// The assignments interior panel's open / docked state (P-PROFILES 0c), read
// by the panel and by the left nav's Assignments rail item. Docked = the agent
// pinned it (per-browser working state) and it fits (`assignmentsPanelDocks`,
// measured by the panel); otherwise it's an overlay the rail item opens.
import { useCallback } from "react";
import { useSlotHas } from "@/layout/useSlot";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "./assignments-working-state";
import { useWorkspaceUiField } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

export interface AssignmentsPanelState {
  /** Settings → Assignments "Show as interior panel". */
  inPanel: boolean;
  /** Docked beside the main column (pinned and fits). */
  docked: boolean;
  /** Showing: docked, or open as the overlay. */
  open: boolean;
  /** The agent's pin (kept while it doesn't fit). */
  pinned: boolean;
  /** The rail item: close it if open (a docked panel unpins), else open it —
   *  docked when it fits, the overlay when it doesn't. */
  toggle: () => void;
  /** The panel's pin button. Unpinning keeps it open, as the overlay. */
  setPinned: (pinned: boolean) => void;
  close: () => void;
  /** Cards needing the agent: new assignments and ones awaiting a reply. */
  attentionCount: number;
}

export function useAssignmentsPanel(): AssignmentsPanelState {
  const inPanel = useSlotHas("interior-panel", "assignments");
  const { panelPinned } = useAssignmentsWorkingState();
  const [docks] = useWorkspaceUiField("assignmentsPanelDocks");
  const [overlayOpen, setOverlayOpen] = useWorkspaceUiField("assignmentsPanelOverlayOpen");
  const { interactions, isNewAssignment } = useWorkspace();
  const docked = inPanel && panelPinned && docks;
  const open = docked || (inPanel && overlayOpen);

  const setPinned = useCallback(
    (pinned: boolean) => {
      setAssignmentsWorkingState({ panelPinned: pinned });
      setOverlayOpen(!pinned);
    },
    [setOverlayOpen],
  );
  const close = useCallback(() => {
    if (docked) setAssignmentsWorkingState({ panelPinned: false });
    setOverlayOpen(false);
  }, [docked, setOverlayOpen]);
  const toggle = useCallback(() => {
    if (open) close();
    else if (docks) setAssignmentsWorkingState({ panelPinned: true });
    else setOverlayOpen(true);
  }, [open, close, docks, setOverlayOpen]);

  const attentionCount = interactions.filter((i) => isNewAssignment(i.id) || i.threads.some((t) => t.awaitingResponse)).length;
  return { inPanel, docked, open, pinned: panelPinned, toggle, setPinned, close, attentionCount };
}
