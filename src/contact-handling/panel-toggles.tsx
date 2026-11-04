// The content card's side panels and their PageHeader toggles (P-LAYOUT-F1 A1): lyra's `useSidePanelToggle` (the
// wiring AdminShell has), one instance per panel for the whole content card, so the toggle in whichever page header
// shows and the panel it opens share their state (an unpinned panel's hover flyout; a pinned one opens on a click,
// with no hover preview: `WorkspacePageHeader`'s `withoutPinnedPreview`).
// - Left: the assignments in the interior-panel slot. Open, pinned and width are the per-browser working state
//   (`assignments-working-state.ts`); pinned, it pushes the content while it fits (`assignmentsPanelDocks`), and
//   where it doesn't it renders unpinned, as lyra's `pinDisabled`.
// - Right (P-LAYOUT-F4 7, 16): the right column, always present while the page has one (the reference column, or under
//   AI display "panel" the Copilot panel that takes its place): pinned open beside the action area, or closed with the
//   toggle's hover flyout, a click pinning it (`referencePinned`, per browser; the flyout only where it doesn't fit).
//   `rightPanelTarget`, with the page header saying whether it has a column (`WorkspacePageHeader`'s
//   `referenceColumn`). Without one, the docked panel where the assignment has it; under "main" the docked panel is a
//   thread, picked from the record header's channel icons, so it has no header toggle.
import * as React from "react";
import { useSidePanelToggle, type UseSidePanelToggleReturn } from "@nicecxone/lyra-ui";
import { useSlotFor } from "@/layout/useSlot";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "./assignments-working-state";
import { useRevealOnIncomingCall } from "./reveal-assignments";
import { useRailAssignmentCount } from "./home/useScheduleCards";
import { useWorkspaceUiField } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

/** Which right panel the page header's right toggle drives: the reference column while the page has one (always
 *  present, P-LAYOUT-F4 7); else the docked panel where the active assignment has one; else none (no toggle). */
export type RightPanelTarget = "reference" | "docked" | null;

export function rightPanelTarget({ referenceColumn, dockedPanel }: { referenceColumn: boolean; dockedPanel: boolean }): RightPanelTarget {
  if (referenceColumn) return "reference";
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
  /** The right column's toggle (always instantiated: the column and the Copilot panel read its panel props). */
  reference: UseSidePanelToggleReturn;
  /** The docked panel (always instantiated: WorkspaceRightPanel reads its panel props). */
  docked: UseSidePanelToggleReturn;
  /** The active assignment has the docked AI panel to toggle (AI display "panel": its AI Overview). Under "main" the
   *  docked panel only shows a thread, picked from the record header's channel icons, and closes without one. */
  dockedPanel: boolean;
  /** The right side of a page with a reference column is open (P-LAYOUT-F4 10): the column pinned beside the action
   *  area, or (where it can't pin) the flyout-only mode, in which the detail panel isn't tied to the column. One
   *  state for this and one for which detail is open (the slide-over's content); neither resets the other. */
  referenceSideOpen: boolean;
  /** Every active assignment, the panel's "Assignments (n)": the left toggle's badge (A2). */
  assignmentCount: number;
}

const PanelTogglesContext = React.createContext<PanelToggles | null>(null);

/** The panels' toggle state, or null outside the content card. */
export function usePanelToggles(): PanelToggles | null {
  return React.useContext(PanelTogglesContext);
}

export const ASSIGNMENTS_PANEL_ID = "assignments-panel";

export function PanelTogglesProvider({ children }: { children: React.ReactNode }) {
  const assignmentsSlot = useSlotFor("assignments");
  const inPanel = assignmentsSlot === "interior-panel";
  const [fits] = useWorkspaceUiField("assignmentsPanelDocks");
  const { panelOpen, panelPinned } = useAssignmentsWorkingState();
  // Until this browser has its own open / pinned state, the panel starts open and pinned (P-LAYOUT-F3 10: pinning is
  // per-browser working state only; the `assignments.panelPinned` setting is retired).
  const assignments = useSidePanelToggle({
    side: "left",
    id: ASSIGNMENTS_PANEL_ID,
    open: panelOpen ?? true,
    onOpenChange: (open) => setAssignmentsWorkingState({ panelOpen: open }),
    pinned: panelPinned ?? true,
    onPinnedChange: (pinned) => setAssignmentsWorkingState({ panelPinned: pinned }),
    pinDisabled: inPanel && !fits,
  });

  // The reference column (P-LAYOUT-F4 7): two states, per browser. Pinned open (the default): it's beside the action
  // area, pushing it, while it fits (the toggle shows active). Closed: the toggle's hover reveals it as a flyout
  // (`summariesOverlayOpen`, never stored) and a click on the toggle pins it open; its own header's close, or the
  // toggle while it's pinned, returns it to closed. Where it doesn't fit beside the action area it's the flyout only
  // (lyra's `pinDisabled`), the stored choice untouched.
  const [referenceColumnFits] = useWorkspaceUiField("referenceColumnFits");
  const [flyoutOpen, setFlyoutOpen] = useWorkspaceUiField("summariesOverlayOpen");
  const { referencePinned } = useAssignmentsWorkingState();
  const referenceWanted = referencePinned ?? true;
  const referencePinnedNow = referenceWanted && referenceColumnFits;
  const pinnedNowRef = React.useRef(referencePinnedNow);
  pinnedNowRef.current = referencePinnedNow;
  const setReferencePinned = (pinned: boolean) => {
    setAssignmentsWorkingState({ referencePinned: pinned });
    setFlyoutOpen(false);
  };
  const referenceHook = useSidePanelToggle({
    side: "right",
    open: referencePinnedNow || flyoutOpen,
    onOpenChange: (open) => {
      // Pinned, the open state is the pin: closing is unpinning. Otherwise it's the flyout.
      if (pinnedNowRef.current) {
        if (!open) setReferencePinned(false);
      } else setFlyoutOpen(open);
    },
    pinned: referenceWanted,
    onPinnedChange: setReferencePinned,
    pinDisabled: !referenceColumnFits,
  });
  const reference: UseSidePanelToggleReturn = {
    ...referenceHook,
    pageHeaderProps: {
      ...referenceHook.pageHeaderProps,
      // A click pins the column open (closed or a hover flyout), or closes it while it's pinned; where it can't pin,
      // lyra's own toggle (the flyout).
      onInnerPanelToggle: referenceColumnFits ? () => setReferencePinned(!referencePinnedNow) : referenceHook.toggle,
    },
  };

  const {
    activeInteractionIsAgentCall, aiInPanel, channelPreviewThreadKey, interactions, contactSubject, effectiveSidePanelPinned, handleSidePanelClose,
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
  // A2: a ringing call opens the assignments panel, where its incoming tile is; the nav stays as it was.
  useRevealOnIncomingCall(assignmentsSlot, interactions);
  const assignmentCount = useRailAssignmentCount();
  const value: PanelToggles = { assignments: inPanel ? assignments : null, reference, docked, dockedPanel, referenceSideOpen: referencePinnedNow || !referenceColumnFits, assignmentCount };
  return <PanelTogglesContext.Provider value={value}>{children}</PanelTogglesContext.Provider>;
}

/** The detail slide-over over a page's reference column (Contact Details, Session Details, a Copilot result; P-LAYOUT-F4
 *  10, 12). Returns whether it may show: with a column, only while the right side is open, so the record header's
 *  toggle collapses the column and the open detail together and reopening restores both. Opening a detail (`content`
 *  changes to a new one) while the right side is collapsed opens it, as the toggle's click does, where the column fits;
 *  where it doesn't, the detail overlays on its own. */
export function useReferenceSideGate({ hasColumn, content, scope }: { hasColumn: boolean; content: unknown; scope?: string | null }): boolean {
  const open = usePanelToggles()?.referenceSideOpen ?? true;
  const [fits] = useWorkspaceUiField("referenceColumnFits");
  const previous = React.useRef(content);
  // `scope`: the assignment. The content is per assignment, so switching to one whose detail was left open is not a
  // detail being opened: it must not undo a collapse (commit-check, P-LAYOUT-F4 audit).
  const previousScope = React.useRef(scope);
  React.useEffect(() => {
    const sameScope = previousScope.current === scope;
    if (sameScope && content && content !== previous.current && hasColumn && fits) setAssignmentsWorkingState({ referencePinned: true });
    previous.current = content;
    previousScope.current = scope;
  }, [content, hasColumn, fits, scope]);
  return !hasColumn || open;
}
