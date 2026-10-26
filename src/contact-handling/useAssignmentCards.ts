// The assignments list's order, drag and chip rule (P-PROFILES 0b), shared by
// the left nav and the interior panel so both render one implementation. The
// left nav keeps its own `.map` (LeftNav's overlay mode clones `expanded` onto
// `header`'s top-level children only), so this is a hook; each card's drag
// target is `DraggableAssignment` (src/components/workspace/AssignmentCardList.tsx).
import * as React from "react";
import { useListReorder, type ListReorderItemProps } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { useSettings } from "@/settings";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { sortAssignmentCards } from "./assignment-sort";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "./assignments-working-state";
import { useWorkspace } from "./workspace/WorkspaceContext";
import { useScheduleLegCardKeys } from "./home/useScheduleCards";

export type AssignmentsMount = "leftNav" | "interiorPanel";

/** Whether a mount shows the channel chip: "auto" shows it in the left nav
 *  and hides it in the interior panel. */
export function useChannelChipsShown(mount: AssignmentsMount): boolean {
  const [{ channelChips }] = useSettings("assignments");
  return channelChips === "show" || (channelChips === "auto" && mount === "leftNav");
}

/** The sorted cards and the drag wiring. A drag (or Ctrl+Shift+Up / Down on a
 *  card) in any mode switches the sort to Custom, seeded with the order on
 *  screen; the order is kept per browser, pruned to the cards that exist. */
export function useAssignmentCards(enabled: boolean): {
  cards: Interaction[];
  itemProps: (id: string) => ListReorderItemProps;
} {
  const { interactions, assignmentSort, assignmentSortDirection } = useWorkspace();
  const [, updateAssignments] = useSettings("assignments");
  const { order } = useAssignmentsWorkingState();
  // P-HOME-1e: a call joined to an open schedule item's card is that card's leg: the kind card renders it.
  const legCardKeys = useScheduleLegCardKeys();
  const cards = React.useMemo(
    () =>
      sortAssignmentCards(
        interactions.filter((i) => !legCardKeys.has(i.id)),
        { mode: assignmentSort, direction: assignmentSortDirection },
        order,
      ),
    [interactions, legCardKeys, assignmentSort, assignmentSortDirection, order],
  );
  const ids = React.useMemo(() => cards.map((c) => c.id), [cards]);
  const names = React.useMemo(() => new Map(cards.map((c) => [c.id, c.customerName ?? ""])), [cards]);
  const onReorder = React.useCallback(
    (next: string[]) => {
      setAssignmentsWorkingState({ order: next });
      if (assignmentSort !== "custom") updateAssignments((a) => ({ sort: { ...a.sort, mode: "custom" } }));
    },
    [assignmentSort, updateAssignments],
  );
  const { itemProps } = useListReorder({
    order: ids,
    onReorder,
    keyboardReorder: true,
    disabled: !enabled,
    getLabel: (id) => names.get(id) || t("Assignment"),
  });
  return { cards, itemProps };
}
