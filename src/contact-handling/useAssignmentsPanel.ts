// The assignments part's slot state (P-PROFILES 0c; P-HOME-1n), read by the interior panel and the left nav. In the
// interior-panel slot the panel is fixed: docked whenever it fits (`assignmentsPanelDocks`, measured by the panel),
// with no pin and no close; only when it doesn't fit is it an overlay, opened from the left nav's Assignments item.
import { useCallback } from "react";
import { useSlotFor } from "@/layout/useSlot";
import { useWorkspaceUiField } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

export interface AssignmentsPanelState {
  /** The assignments part is in the left nav (its caption and cards). */
  inLeftNav: boolean;
  /** The assignments part is in the interior-panel slot. */
  inPanel: boolean;
  /** Docked beside the main column (it fits). */
  docked: boolean;
  /** In the panel but it doesn't fit: an overlay, opened from the rail item. */
  overlaid: boolean;
  /** Showing: docked, or open as the overlay. */
  open: boolean;
  /** The rail item: opens or closes the overlay. */
  toggle: () => void;
  /** Closes the overlay (a docked panel has no close). */
  close: () => void;
  /** Cards needing the agent: new assignments and ones awaiting a reply. */
  attentionCount: number;
}

export function useAssignmentsPanel(): AssignmentsPanelState {
  const slot = useSlotFor("assignments");
  const [docks] = useWorkspaceUiField("assignmentsPanelDocks");
  const [overlayOpen, setOverlayOpen] = useWorkspaceUiField("assignmentsPanelOverlayOpen");
  const { interactions, isNewAssignment } = useWorkspace();
  const inPanel = slot === "interior-panel";
  const docked = inPanel && docks;
  const overlaid = inPanel && !docks;
  const open = docked || (overlaid && overlayOpen);

  const close = useCallback(() => setOverlayOpen(false), [setOverlayOpen]);
  const toggle = useCallback(() => setOverlayOpen((v) => !v), [setOverlayOpen]);

  const attentionCount = interactions.filter((i) => isNewAssignment(i.id) || i.threads.some((t) => t.awaitingResponse)).length;
  return { inLeftNav: slot === "left-nav", inPanel, docked, overlaid, open, toggle, close, attentionCount };
}
