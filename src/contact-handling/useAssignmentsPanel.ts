// The assignments part's slot state (P-PROFILES 0c; P-HOME-1n; P-LAYOUT fix (a)), read by the interior panel and the
// left nav. In the interior-panel slot the panel is lyra's left SidePanel inside the content card, with a toggle and
// a pin (per-browser working state, open and pinned by default). Pinned, it pushes the content while it fits
// (`assignmentsPanelDocks`, measured by the panel); where it doesn't, it's an overlay that starts closed, opened from
// the toggle or the left nav's Assignments item. Unpinned, it's always the overlay, open or closed by the toggle.
import { useCallback } from "react";
import { useSlotFor } from "@/layout/useSlot";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "./assignments-working-state";
import { useWorkspaceUiField } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

export interface AssignmentsPanelState {
  /** The assignments part is in the interior-panel slot. */
  inPanel: boolean;
  /** Pinned (working state): it pushes the content while it fits. */
  pinned: boolean;
  /** Pushing the content: pinned, it fits, and open. */
  docked: boolean;
  /** It would show as an overlay: unpinned, or pinned where it doesn't fit. */
  overlaid: boolean;
  /** Showing, docked or as the overlay. */
  open: boolean;
  /** The toggle and the rail item: show or hide it. */
  toggle: () => void;
  /** Hides it (the panel's close button). */
  close: () => void;
  /** Its pin button. */
  togglePin: () => void;
  /** Cards needing the agent: new assignments and ones awaiting a reply. */
  attentionCount: number;
}

/** The assignments are rows at the top of Home (placement none, or the part moved there): an offer is its row there,
 *  with Accept / Decline: the feed's Needs a decision leaves it out, and the incoming toast's View goes Home. */
export function useAssignmentsAtHomeTop(): boolean {
  return useSlotFor("assignments") === "home-top";
}

export function useAssignmentsPanel(): AssignmentsPanelState {
  const inPanel = useSlotFor("assignments") === "interior-panel";
  const [fits] = useWorkspaceUiField("assignmentsPanelDocks");
  // Pinned where it doesn't fit: an overlay that starts closed whenever it stops fitting (cleared by the panel).
  const [fitOverlayOpen, setFitOverlayOpen] = useWorkspaceUiField("assignmentsPanelOverlayOpen");
  const { panelOpen, panelPinned } = useAssignmentsWorkingState();
  const { interactions, isNewAssignment } = useWorkspace();
  const fitOverlay = panelPinned && !fits;
  const open = inPanel && (fitOverlay ? fitOverlayOpen : panelOpen);
  const docked = inPanel && panelPinned && fits && panelOpen;
  const overlaid = inPanel && (!panelPinned || !fits);

  const setOpen = useCallback(
    (next: boolean) => (fitOverlay ? setFitOverlayOpen(next) : setAssignmentsWorkingState({ panelOpen: next })),
    [fitOverlay, setFitOverlayOpen],
  );
  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const togglePin = useCallback(() => {
    // Whichever way, a shown panel stays shown: unpinning a fit overlay hands its open state to the working state;
    // pinning where it doesn't fit hands it to the fit overlay.
    if (fitOverlay && open) setAssignmentsWorkingState({ panelOpen: true });
    if (!panelPinned && !fits) setFitOverlayOpen(open);
    setAssignmentsWorkingState({ panelPinned: !panelPinned });
  }, [fitOverlay, fits, open, panelPinned, setFitOverlayOpen]);

  const attentionCount = interactions.filter((i) => isNewAssignment(i.id) || i.threads.some((t) => t.awaitingResponse)).length;
  return { inPanel, pinned: panelPinned, docked, overlaid, open, toggle, close, togglePin, attentionCount };
}
