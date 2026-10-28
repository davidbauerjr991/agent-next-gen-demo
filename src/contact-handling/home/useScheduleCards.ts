import { useEffect, useMemo, useRef } from "react";
import { scheduleCardKey, scheduleItemIdOf } from "@/domain";
import { useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import { useWorkspaceUiField } from "../workspace-ui-store";
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

/** Unread means "arrived since you last looked" (P-HOME-1m): a listed day (the first load, a persona switch) loads
 *  read — its items' card keys join the read set (`previewedAssignments`, which `useNewAssignments` reads) — and an
 *  item that comes due afterwards is unread again. Anything that arrives later (an item the source adds, a new offer)
 *  starts unread. Mount once, at the workspace controller. */
export function useScheduleReadBaseline(): void {
  const snapshot = useScheduleSnapshot();
  const schedule = useScheduleProvider();
  const [, setRead] = useWorkspaceUiField("previewedAssignments");
  const listedRole = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshot || listedRole.current === snapshot.role) return;
    listedRole.current = snapshot.role;
    setRead((prev) => {
      const next = new Set(prev);
      for (const item of snapshot.items) next.add(scheduleCardKey(item.id));
      return next;
    });
  }, [snapshot, setRead]);
  useEffect(() => {
    if (!schedule) return;
    return schedule.on("itemDue", ({ item }) =>
      setRead((prev) => {
        const key = scheduleCardKey(item.id);
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
    );
  }, [schedule, setRead]);
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
