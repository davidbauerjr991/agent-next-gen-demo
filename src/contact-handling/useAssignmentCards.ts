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
import { useScheduleCards, useScheduleLegCardKeys } from "./home/useScheduleCards";
import { scheduleCardKey } from "@/domain";
import type { ScheduleItem } from "@/providers";

export type AssignmentsMount = "leftNav" | "interiorPanel" | "homeTop";

/** Whether a mount shows the channel chip: "auto" shows it in the left nav
 *  and hides it in the interior panel and at the top of Home. */
export function useChannelChipsShown(mount: AssignmentsMount): boolean {
  const [{ channelChips }] = useSettings("assignments");
  return channelChips === "show" || (channelChips === "auto" && mount === "leftNav");
}

/** One card in the rail: a conversation card, or an open schedule item's kind card (keyed by its card key,
 *  `schedule:<id>`, so the Custom order holds both). */
export type AssignmentEntry =
  | { type: "conversation"; key: string; interaction: Interaction }
  | { type: "schedule"; key: string; item: ScheduleItem };

/** The sorted cards and the drag wiring, for every card the rail shows (conversations and kind cards, P-HOME-1m).
 *  A drag (or Ctrl+Shift+Up / Down on a card) in any mode switches the sort to Custom, seeded with the order on
 *  screen; the order is kept per browser, pruned to the cards that exist. The other sorts list the conversations
 *  by their rule, then the kind cards by due; Custom places both by the dragged order (new ones on top). */
export function useAssignmentCards(enabled: boolean): {
  entries: AssignmentEntry[];
  itemProps: (id: string) => ListReorderItemProps;
} {
  const { interactions, assignmentSort, assignmentSortDirection } = useWorkspace();
  const [, updateAssignments] = useSettings("assignments");
  const { order } = useAssignmentsWorkingState();
  const scheduleCards = useScheduleCards();
  // P-HOME-1e: a call joined to an open schedule item's card is that card's leg: the kind card renders it.
  const legCardKeys = useScheduleLegCardKeys();
  const entries = React.useMemo(() => {
    const conversations = sortAssignmentCards(
      interactions.filter((i) => !legCardKeys.has(i.id)),
      { mode: assignmentSort, direction: assignmentSortDirection },
      order,
    ).map((interaction): AssignmentEntry => ({ type: "conversation", key: interaction.id, interaction }));
    const kinds = scheduleCards.map((item): AssignmentEntry => ({ type: "schedule", key: scheduleCardKey(item.id), item }));
    if (assignmentSort !== "custom") return [...conversations, ...kinds];
    // Custom: `applyCustomOrder` already put new conversations first; new kind cards follow them, then every placed
    // card by the dragged order.
    const position = new Map(order.map((id, i) => [id, i]));
    const fresh = [...conversations, ...kinds].filter((e) => !position.has(e.key));
    const placed = [...conversations, ...kinds].filter((e) => position.has(e.key)).sort((a, b) => position.get(a.key)! - position.get(b.key)!);
    return [...fresh, ...placed];
  }, [interactions, legCardKeys, scheduleCards, assignmentSort, assignmentSortDirection, order]);
  const ids = React.useMemo(() => entries.map((e) => e.key), [entries]);
  const names = React.useMemo(
    () => new Map(entries.map((e) => [e.key, e.type === "conversation" ? (e.interaction.customerName ?? "") : e.item.title])),
    [entries],
  );
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
  return { entries, itemProps };
}
