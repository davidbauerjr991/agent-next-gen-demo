// The assignments list (P-PROFILES; one component for every slot since P-HOME-1n): one card's drag target (the
// wrapper lyra's `useListReorder` moves), the card itself, the "Assignments (N)" caption with its sort, the empty
// state, and the stack the interior panel and the top of Home mount. The left nav maps `AssignmentEntryCard`
// inline instead (LeftNav clones `expanded` onto its header's top-level children only). The order and drag wiring
// are `useAssignmentCards` (src/contact-handling/).
import * as React from "react";
import { EmptyState, type ListReorderItemProps } from "@nicecxone/lyra-ui";
import { Inbox } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { AssignmentsSectionCaption } from "@/components/agent-next-gen-interaction-dashboard";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import { useAssignmentCards, useChannelChipsShown, type AssignmentEntry, type AssignmentsMount } from "@/contact-handling/useAssignmentCards";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useRailAssignmentCount } from "@/contact-handling/home/useScheduleCards";
import type { AssignmentSortMode } from "@/settings";
import { KindNavCard } from "./KindNavCard";
import { NavCardItem } from "./NavCardItem";
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

/** One rail card in its drag target: a conversation's `NavCardItem` in its own `ClockTick` (a tick re-renders the
 *  card, not the page), or an open schedule item's `KindNavCard`. `slotExpanded` is LeftNav's hover value in the
 *  left nav (undefined inline, so the card falls back to `navOpen`); the panel and Home pass true. */
export function AssignmentEntryCard({
  entry,
  dragProps,
  slotExpanded,
  navOpen = true,
  hideChip,
}: {
  entry: AssignmentEntry;
  dragProps: ListReorderItemProps;
  slotExpanded: boolean | undefined;
  navOpen?: boolean;
  hideChip: boolean;
}) {
  return (
    <DraggableAssignment props={dragProps}>
      {entry.type === "schedule" ? (
        <KindNavCard item={entry.item} expanded={slotExpanded ?? navOpen} />
      ) : (
        <ClockTick>
          {(clockTick) => <NavCardItem interaction={entry.interaction} slotExpanded={slotExpanded} clockTick={clockTick} hideChip={hideChip} />}
        </ClockTick>
      )}
    </DraggableAssignment>
  );
}

export function AssignmentsEmptyState() {
  return (
    <EmptyState
      icon={<Inbox className="h-8 w-8" strokeWidth={1.5} />}
      message={t("Your assignment queue is empty")}
      description={t("New assignments will appear here.")}
      className="h-auto w-full py-6"
      // `EmptyState`'s default tone read too dim next to Contact History's placeholder; secondary matches it.
      tone="secondary"
    />
  );
}

/** The caption, the empty state and every card: the assignments part in the interior panel and at the top of Home. */
export function AssignmentsStack({ mount, className }: { mount: Exclude<AssignmentsMount, "leftNav">; className?: string }) {
  const { entries, itemProps } = useAssignmentCards(true);
  const chipsShown = useChannelChipsShown(mount);
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="assignments-stack" data-mount={mount}>
      <AssignmentsCaption expanded mount={mount} />
      {entries.length === 0 ? (
        <AssignmentsEmptyState />
      ) : (
        entries.map((entry) => (
          <AssignmentEntryCard key={entry.key} entry={entry} dragProps={itemProps(entry.key)} slotExpanded hideChip={!chipsShown} />
        ))
      )}
    </div>
  );
}
