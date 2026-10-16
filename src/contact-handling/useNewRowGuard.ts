import { useCallback, useEffect, useRef } from "react";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { threadKeyOf } from "./channel-thread";

/** lyra's `InteractionNavItem` reports a row that just appeared through
 *  `onCurrentChannelChange`, during render, as if the agent had clicked it
 *  (`interaction-nav-item.tsx`, "Opening a new channel … always takes over
 *  as current"). That would move the main column on its own (and set state
 *  during render). Opening a new contact is the activation path's job
 *  (`useContactActivation`), so the page ignores a row it hasn't rendered
 *  yet: `isNewRow(cardId, key)` is true until the commit after the row first
 *  appears. */
export function useNewRowGuard(cards: readonly Interaction[]) {
  const known = useRef(new Map<string, Set<string>>());
  useEffect(() => {
    const next = new Map<string, Set<string>>();
    for (const card of cards) next.set(card.id, new Set(card.threads.map(threadKeyOf)));
    known.current = next;
  }, [cards]);
  return useCallback((cardId: string, key: string) => {
    const keys = known.current.get(cardId);
    return !!keys && !keys.has(key);
  }, []);
}
