// The assignments part's slot state (P-PROFILES 0c; P-HOME-1n; P-LAYOUT fix (a)), read outside the content card (the
// left nav). In the interior-panel slot the panel is lyra's left SidePanel inside the content card, toggled from the
// page header (P-LAYOUT-F1: lyra's PageHeader toggle and `useSidePanelToggle`, in `PanelTogglesProvider`). Open and
// pinned are per-browser working state, both on by default. Pinned, it pushes the content while it fits
// (`assignmentsPanelDocks`, measured by the panel); where it doesn't, or unpinned, it's an overlay.
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
  const { panelOpen, panelPinned } = useAssignmentsWorkingState();
  const { interactions, isNewAssignment } = useWorkspace();
  // Where it doesn't fit it renders unpinned (lyra `useSidePanelToggle`'s `pinDisabled`, `PanelTogglesProvider`),
  // which closes it on the crossing and reopens it pinned when it fits again.
  const open = inPanel && panelOpen;
  const docked = inPanel && panelPinned && fits && panelOpen;
  const overlaid = inPanel && (!panelPinned || !fits);

  const toggle = useCallback(() => setAssignmentsWorkingState({ panelOpen: !open }), [open]);
  const close = useCallback(() => setAssignmentsWorkingState({ panelOpen: false }), []);
  const togglePin = useCallback(() => setAssignmentsWorkingState({ panelPinned: !panelPinned, panelOpen: !panelPinned }), [panelPinned]);

  const attentionCount = interactions.filter((i) => isNewAssignment(i.id) || i.threads.some((t) => t.awaitingResponse)).length;
  return { inPanel, pinned: panelPinned, docked, overlaid, open, toggle, close, togglePin, attentionCount };
}
