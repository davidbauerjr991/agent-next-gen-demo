// Opening a schedule item's feed-row preview from elsewhere (P-HOME-1m: the
// work-item toast's View): the first view, the item's row showing (the kinds
// filter cleared if it would hide it), its preview open in Home's detail
// panel, read. A pure transform of the workspace UI store's state.
import { scheduleCardKey, type AssignmentKind } from "@/domain";
import type { WorkspaceUiState } from "../workspace-ui-store";

export function withFeedItemPreview(state: WorkspaceUiState, itemId: string, kind: AssignmentKind): WorkspaceUiState {
  const key = scheduleCardKey(itemId);
  const hidden = state.activityKinds.size > 0 && !state.activityKinds.has(kind);
  return {
    ...state,
    activityView: "assignments",
    ...(hidden ? { activityKinds: new Set<AssignmentKind>() } : {}),
    homePreview: { type: "schedule", itemId },
    previewedAssignments: state.previewedAssignments.has(key) ? state.previewedAssignments : new Set(state.previewedAssignments).add(key),
  };
}
