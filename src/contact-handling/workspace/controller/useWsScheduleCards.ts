// Workspace controller, slice 1's schedule / kind-card part (P-HOME-1n housekeeping, moved from `useWsCards`
// as-is; hook order unchanged): the open schedule items on the rail, and the active card's Contact Details subject.
import { useMemo } from "react";
import type { CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import type { Thread, Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { useScheduleSnapshot } from "@/provider-context";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { scheduleItemCustomer } from "@/contact-handling/contact-identity";
import type { ContactSubject } from "@/contact-handling/workspace/workspace-types";
import { scheduleCardKey, scheduleItemIdOf } from "@/domain";
import { useScheduleCards } from "@/contact-handling/home/useScheduleCards";

/** A schedule item's customer has no threads (Contact Details' subject, P-HOME-1m); one array, so the record's
 *  fields memo holds. */
const NO_THREADS: Thread[] = [];

/** Every rail card's key: the conversation cards and the open schedule items' kind cards (P-HOME-1m: both sit in
 *  the same collapse state; a kind card with a joined call is its leg, whose id is the same key). */
export function useRailScheduleCards(interactions: Interaction[]) {
  const scheduleSnapshot = useScheduleSnapshot();
  const railScheduleCards = useScheduleCards();
  const railCardKeys = useMemo(
    () => [...new Set([...interactions.map((i) => i.id), ...railScheduleCards.map((i) => scheduleCardKey(i.id))])],
    [interactions, railScheduleCards],
  );
  return { scheduleSnapshot, railCardKeys };
}

/** The active conversation (P-HOME-1f: a schedule card's kind row, selected over its joined call, shows the kind's
 *  cell instead) and Contact Details' subject (P-HOME-1m): the active conversation, or the active schedule item's
 *  customer when the directory has their record (a kind cell, its kind row picked over a joined call included). A
 *  schedule item has no thread: its Contact Details is its record's tabs alone (`hasThread`, the tab registry's
 *  `applies`). */
export function useActiveCardSubject({
  activeInteractionId,
  interactions,
  scheduleSnapshot,
  findDirectoryCustomer,
}: {
  activeInteractionId: string | null;
  interactions: Interaction[];
  scheduleSnapshot: ReturnType<typeof useScheduleSnapshot>;
  findDirectoryCustomer: (entityId: string) => CreateNewCustomerRecord | undefined;
}) {
  const [kindCellShownFor] = useWorkspaceUiField("kindCellShownFor");
  const activeInteraction = kindCellShownFor === activeInteractionId ? null : interactions.find((i) => i.id === activeInteractionId) ?? null;
  const [linkedItemCustomers] = useWorkspaceUiField("linkedItemCustomers");
  const activeScheduleItemId = !activeInteraction && activeInteractionId ? scheduleItemIdOf(activeInteractionId) : undefined;
  const activeScheduleItem = activeScheduleItemId ? scheduleSnapshot?.items.find((i) => i.id === activeScheduleItemId) : undefined;
  const scheduleRecord = activeScheduleItem
    ? scheduleItemCustomer(activeScheduleItem.customer, findDirectoryCustomer, linkedItemCustomers[activeScheduleItem.id])?.record
    : undefined;
  const contactSubject: ContactSubject | null = activeInteraction
    ? { key: activeInteraction.id, customerName: activeInteraction.customerName, customerId: activeInteraction.customerId, threads: activeInteraction.threads, hasThread: true }
    : scheduleRecord && activeInteractionId
      ? { key: activeInteractionId, customerName: scheduleRecord.name, customerId: scheduleRecord.customerId, entityId: scheduleRecord.id, threads: NO_THREADS, hasThread: false }
      : null;
  return { activeInteraction, contactSubject };
}
