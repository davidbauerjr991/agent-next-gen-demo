import { useCallback, useEffect, useState } from "react";

/** The nav cards' "New" badge, shared by both pages (nav card convergence,
 *  P0.5b.2): a card is new until it has been the active card once, by any
 *  path (a click, a launch, a notification). Page state, so it resets on a
 *  tier switch like the selected card does. */
export function useNewAssignments(activeCardId: string | null) {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(activeCardId ? [activeCardId] : []));
  useEffect(() => {
    if (!activeCardId) return;
    setSeen((prev) => (prev.has(activeCardId) ? prev : new Set(prev).add(activeCardId)));
  }, [activeCardId]);
  return useCallback((cardId: string) => !seen.has(cardId), [seen]);
}
