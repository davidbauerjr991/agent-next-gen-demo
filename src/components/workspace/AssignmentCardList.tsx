// The assignments list's shared pieces (P-PROFILES), for the left nav and the
// interior panel alike: one card's drag target (the wrapper lyra's
// `useListReorder` moves) and the "Assignments (N)" caption with its sort.
// The order and drag wiring are `useAssignmentCards` (src/contact-handling/).
import * as React from "react";
import type { ListReorderItemProps } from "@nicecxone/lyra-ui";
import { AssignmentsSectionCaption } from "@/components/agent-next-gen-interaction-dashboard";
import type { AssignmentsMount } from "@/contact-handling/useAssignmentCards";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useRailAssignmentCount } from "@/contact-handling/home/useScheduleCards";
import type { AssignmentSortMode } from "@/settings";
import { ADVANCED_ASSIGNMENT_SORT_OPTIONS } from "./workspace-constants";

export function DraggableAssignment({ props, children }: { props: ListReorderItemProps; children: React.ReactNode }) {
  return (
    <div
      {...props}
      data-slot="assignment-card"
      className="rounded-lyra-sm data-[drag-over]:bg-lyra-bg-active-moderate data-[dragging]:opacity-50"
    >
      {children}
    </div>
  );
}

/** "Assignments (N)" with Collapse / Expand all and the sort popover (its
 *  sort modes and direction). */
export function AssignmentsCaption({ expanded, mount }: { expanded: boolean; mount: AssignmentsMount }) {
  const {
    assignmentSort, assignmentSortDirection, channelsAllExpanded, handleToggleAllChannelsExpanded,
    noInteractionCollapse, setAssignmentSort, setAssignmentSortDirection,
  } = useWorkspace();
  const count = useRailAssignmentCount();
  return (
    <AssignmentsSectionCaption
      expanded={expanded}
      count={count}
      sort={assignmentSort}
      // The options exclude Longest Wait, so every value is a settings mode.
      onSortChange={(value) => setAssignmentSort(value as AssignmentSortMode)}
      // See `ADVANCED_ASSIGNMENT_SORT_OPTIONS`'s own doc comment.
      sortOptions={ADVANCED_ASSIGNMENT_SORT_OPTIONS}
      sortDirection={assignmentSortDirection}
      onSortDirectionChange={setAssignmentSortDirection}
      allExpanded={channelsAllExpanded}
      onToggleAllExpanded={handleToggleAllChannelsExpanded}
      hideExpandCollapseAll={noInteractionCollapse}
      // See `AssignmentsSectionCaption`'s own doc comment on `compact`.
      compact
    />
  );
}
