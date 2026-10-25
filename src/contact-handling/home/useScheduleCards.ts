import { useMemo } from "react";
import { scheduleItemIdOf } from "@/domain";
import { useScheduleSnapshot } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { useWorkspace } from "../workspace/WorkspaceContext";

/** The schedule items open in the rail (state `active`): opening a row on
 *  the feed moves it here, completing it takes it out (P-HOME-1). */
export function useScheduleCards(): readonly ScheduleItem[] {
  const snapshot = useScheduleSnapshot();
  return useMemo(() => (snapshot?.items ?? []).filter((i) => i.state === "active").sort((a, b) => a.dueAt - b.dueAt), [snapshot]);
}

/** The schedule item whose cell the main column shows, if the active card is one. */
export function useActiveScheduleItem(): ScheduleItem | null {
  const { activeInteractionId } = useWorkspace();
  const cards = useScheduleCards();
  const id = activeInteractionId ? scheduleItemIdOf(activeInteractionId) : null;
  return id ? (cards.find((c) => c.id === id) ?? null) : null;
}
