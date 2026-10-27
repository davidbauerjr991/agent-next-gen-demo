import { useMemo } from "react";
import { scheduleCardKey, scheduleItemIdOf } from "@/domain";
import { useScheduleSnapshot } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { useWorkspace } from "../workspace/WorkspaceContext";

/** The schedule items open in the rail (state `active`): opening a row on
 *  the feed moves it here, completing it takes it out (P-HOME-1). */
export function useScheduleCards(): readonly ScheduleItem[] {
  const snapshot = useScheduleSnapshot();
  return useMemo(() => (snapshot?.items ?? []).filter((i) => i.state === "active").sort((a, b) => a.dueAt - b.dueAt), [snapshot]);
}

/** The card keys of the open schedule items: a conversation card with one of
 *  these keys is a call joined to that item's card as its leg (P-HOME-1e). */
export function useScheduleLegCardKeys(): ReadonlySet<string> {
  const cards = useScheduleCards();
  return useMemo(() => new Set(cards.map((c) => scheduleCardKey(c.id))), [cards]);
}

/** The rail's assignment count ("Assignments (n)", My Assignment Queue): the conversation cards plus the open schedule
 *  items' kind cards; a kind card with a joined call is one card, counted once (P-HOME-1b; regression fixed in 1h). */
export function useRailAssignmentCount(): number {
  const { interactions } = useWorkspace();
  const cards = useScheduleCards();
  const keys = new Set(interactions.map((i) => i.id));
  return interactions.length + cards.filter((c) => !keys.has(scheduleCardKey(c.id))).length;
}

/** The call joined to `item`'s card (its voice leg), while there is one. */
export function useScheduleLeg(item: ScheduleItem): Interaction | undefined {
  const { interactions } = useWorkspace();
  const key = scheduleCardKey(item.id);
  return interactions.find((i) => i.id === key);
}

/** The schedule item whose cell the main column shows, if the active card is one. */
export function useActiveScheduleItem(): ScheduleItem | null {
  const { activeInteractionId } = useWorkspace();
  const cards = useScheduleCards();
  const id = activeInteractionId ? scheduleItemIdOf(activeInteractionId) : null;
  return id ? (cards.find((c) => c.id === id) ?? null) : null;
}
