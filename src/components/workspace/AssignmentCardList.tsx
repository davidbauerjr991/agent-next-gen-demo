// The assignments list (P-PROFILES; one component for every slot since P-HOME-1n): one card's drag target (the
// wrapper lyra's `useListReorder` moves), the card itself, the "Assignments (N)" caption with its sort, the empty
// state, and the stack the interior panel mounts. The left nav maps `AssignmentEntryCard`
// inline instead (LeftNav clones `expanded` onto its header's top-level children only). The order and drag wiring
// are `useAssignmentCards` (src/contact-handling/).
import * as React from "react";
import { EmptyState, KebabMenuButton, type ListReorderItemProps, type MenuEntry } from "@nicecxone/lyra-ui";
import { ChevronsDownUp, ChevronsUpDown, Inbox } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  AssignmentsExpandCollapseAllButton,
  AssignmentsSectionCaption,
  AssignmentsSortButton,
} from "@/components/agent-next-gen-interaction-dashboard";
import { useOverflowSteps } from "@/contact-handling/useOverflowSteps";
import { useAssignmentCards, type AssignmentEntry, type AssignmentsMount } from "@/contact-handling/useAssignmentCards";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useRailAssignmentCount } from "@/contact-handling/home/useScheduleCards";
import type { AssignmentSortMode } from "@/settings";
import { KindNavCard } from "./KindNavCard";
import { NavCardItem } from "./NavCardItem";
import { ADVANCED_ASSIGNMENT_SORT_OPTIONS } from "./workspace-constants";

function DraggableAssignment({ props, children }: { props: ListReorderItemProps; children: React.ReactNode }) {
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

/** The kebab trigger's width (lyra KebabMenuButton's h-6 w-6), for the unfold threshold. */
const KEBAB_WIDTH = 24;
/** The inline group's width before it's been measured (jsdom; the first frame): Sort's button and Collapse all's. */
const INLINE_WIDTH_FALLBACK = 120;
/** Fold once the title would come closer than this to the actions. */
const FOLD_GAP = 8;

/** The caption's controls for the interior panel's header, where SidePanel's own title and count stand for the
 *  caption (P-LAYOUT-F1), with 2+ assignments. Responsive (P-LAYOUT-F3 6; reverses part of P-LAYOUT-F2 1c, which
 *  always used the kebab): Sort and Collapse all inline while they fit beside "Assignments (n)", folded into one lyra
 *  `KebabMenuButton` only when they wouldn't — measured, with the app header's overflow hook (`useOverflowSteps`),
 *  not a breakpoint. The measure is the gap between the actions and the title's natural end (its text's full width;
 *  lyra ContainerHeader truncates it). The kebab's menu: the sort modes (the current one active), the direction (not
 *  for Custom, the agent's own order), then Collapse / Expand all. The left nav's caption keeps its own buttons. */
export function AssignmentsHeaderActions({ titleBadgeRef }: { titleBadgeRef: React.RefObject<HTMLElement | null> }) {
  const {
    assignmentSort, assignmentSortDirection, channelsAllExpanded, handleToggleAllChannelsExpanded,
    noInteractionCollapse, setAssignmentSort, setAssignmentSortDirection,
  } = useWorkspace();
  const count = useRailAssignmentCount();
  const groupRef = React.useRef<HTMLSpanElement>(null);
  // The header's row (title column and actions): its width is the panel's, so a resize re-measures.
  const headerRowRef = React.useRef<HTMLElement | null>(null);
  const inlineWidth = React.useRef(0);
  const folded =
    useOverflowSteps({
      max: 1,
      hideGap: FOLD_GAP,
      // Unfold only once the inline group fits back with room to spare (it's wider than the kebab by this much).
      showGap: (inlineWidth.current || INLINE_WIDTH_FALLBACK) - KEBAB_WIDTH + FOLD_GAP * 2,
      gap: () => {
        // Anchored on the app's own count (SidePanel's `headerTitleBadge`): lyra ContainerHeader renders it right
        // after the truncating title (container-header.tsx:328–331) and the actions in a shrink-0 group
        // (container-header.tsx:343, SidePanel's `actions`, side-panel.tsx:450). Neither exposes a ref; a lyra
        // actions-overflow mode or a title ref would replace this.
        const group = groupRef.current;
        const actions = group?.parentElement;
        const badge = titleBadgeRef.current;
        const title = badge?.previousElementSibling as HTMLElement | null | undefined;
        if (!group || !actions || !badge || !title) return null;
        headerRowRef.current = actions.parentElement;
        if (!group.hasAttribute("data-folded")) inlineWidth.current = group.getBoundingClientRect().width;
        // The title's natural end: its text's full width, the row's gap-2 (8px), then the count.
        const naturalRight = title.getBoundingClientRect().left + title.scrollWidth + 8 + badge.getBoundingClientRect().width;
        return actions.getBoundingClientRect().left - naturalRight;
      },
      observe: [groupRef, headerRowRef],
      active: count >= 2,
    }) > 0;
  if (count < 2) return null;
  if (!folded) {
    return (
      <span ref={groupRef} className="flex items-center gap-1" data-assignments-header-actions="">
        {!noInteractionCollapse && (
          <AssignmentsExpandCollapseAllButton allExpanded={channelsAllExpanded} onToggle={handleToggleAllChannelsExpanded} />
        )}
        <AssignmentsSortButton
          value={assignmentSort}
          onValueChange={(value) => setAssignmentSort(value as AssignmentSortMode)}
          options={ADVANCED_ASSIGNMENT_SORT_OPTIONS}
          direction={assignmentSortDirection}
          onDirectionChange={setAssignmentSortDirection}
        />
      </span>
    );
  }
  const directions =
    assignmentSort === "channel"
      ? [{ value: "asc", label: t("A–Z") }, { value: "desc", label: t("Z–A") }]
      : [{ value: "asc", label: t("Ascending") }, { value: "desc", label: t("Descending") }];
  // lyra's Menu shows `active` as an accent bar only (no aria-checked): the current row's name says so too (WCAG 4.1.2).
  const current = (active: boolean) => (active ? { rightElement: <span className="sr-only">{t(", current")}</span> } : {});
  const items: MenuEntry[] = [
    { sectionLabel: t("Sort by") },
    ...ADVANCED_ASSIGNMENT_SORT_OPTIONS.map((option) => ({
      id: `sort-${option.value}`,
      label: t(option.label),
      active: option.value === assignmentSort,
      ...current(option.value === assignmentSort),
      onClick: () => setAssignmentSort(option.value as AssignmentSortMode),
    })),
  ];
  if (assignmentSort !== "custom") {
    items.push(
      "separator",
      ...directions.map((d) => ({
        id: `direction-${d.value}`,
        label: d.label,
        active: d.value === assignmentSortDirection,
        ...current(d.value === assignmentSortDirection),
        onClick: () => setAssignmentSortDirection(d.value as typeof assignmentSortDirection),
      })),
    );
  }
  if (!noInteractionCollapse) {
    const Icon = channelsAllExpanded ? ChevronsDownUp : ChevronsUpDown;
    items.push("separator", {
      id: "expand-collapse-all",
      label: channelsAllExpanded ? t("Collapse all") : t("Expand all"),
      icon: <Icon className="h-4 w-4" strokeWidth={1.5} />,
      onClick: handleToggleAllChannelsExpanded,
    });
  }
  return (
    <span ref={groupRef} className="flex items-center" data-assignments-header-actions="" data-folded="">
      <KebabMenuButton ariaLabel={t("Assignment options")} items={items} data-slot="assignments-options" />
    </span>
  );
}

/** One rail card in its drag target: a conversation's `NavCardItem` (its timers tick on their own; the card
 *  re-renders when a colour tier changes, P-LAYOUT-F2 8), or an open schedule item's `KindNavCard`. `slotExpanded` is LeftNav's hover value in the
 *  left nav (undefined inline, so the card falls back to `navOpen`); the panel and Home pass true. */
export function AssignmentEntryCard({
  entry,
  dragProps,
  slotExpanded,
  navOpen = true,
}: {
  entry: AssignmentEntry;
  dragProps: ListReorderItemProps;
  slotExpanded: boolean | undefined;
  navOpen?: boolean;
}) {
  return (
    <DraggableAssignment props={dragProps}>
      {entry.type === "schedule" ? (
        <KindNavCard item={entry.item} expanded={slotExpanded ?? navOpen} />
      ) : (
        // No ClockTick: the card ticks only its timers and re-renders when a colour tier changes (P-LAYOUT-F2 8).
        <NavCardItem interaction={entry.interaction} slotExpanded={slotExpanded} />
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

/** The empty state and every card: the assignments part in the interior panel, whose SidePanel header carries the
 *  title, count and the caption's controls (`AssignmentsHeaderActions`; P-LAYOUT-F1). (Home's Active assignments
 *  section has its inline rows, `AssignmentInlineRows`.) */
export function AssignmentsStack({
  mount,
  className,
}: {
  mount: Extract<AssignmentsMount, "interiorPanel">;
  className?: string;
}) {
  const { entries, itemProps } = useAssignmentCards(true);
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="assignments-stack" data-mount={mount}>
      {entries.length === 0 ? (
        <AssignmentsEmptyState />
      ) : (
        entries.map((entry) => (
          <AssignmentEntryCard key={entry.key} entry={entry} dragProps={itemProps(entry.key)} slotExpanded />
        ))
      )}
    </div>
  );
}
