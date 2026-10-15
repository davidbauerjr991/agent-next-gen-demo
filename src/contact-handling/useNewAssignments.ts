import { useCallback, useEffect, useState } from "react";
import { useInteractionProvider } from "@/provider-context";

/** Cards seen as active, per provider set: a tier switch remounts the page
 *  but keeps the provider, so a card the agent already opened isn't "new"
 *  again on the other page. A new provider set (another database) starts
 *  empty. */
const seenByProvider = new WeakMap<object, Set<string>>();

/** The nav cards' "New" badge, shared by both pages (nav card convergence,
 *  P0.5b.2): a card is new until it has been the active card once, by any
 *  path (a click, a launch, a notification), on either page. */
export function useNewAssignments(activeCardId: string | null) {
  const provider = useInteractionProvider();
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => {
    const stored = seenByProvider.get(provider) ?? new Set<string>();
    return new Set(activeCardId ? [...stored, activeCardId] : stored);
  });
  useEffect(() => {
    if (!activeCardId) return;
    let stored = seenByProvider.get(provider);
    if (!stored) seenByProvider.set(provider, (stored = new Set()));
    stored.add(activeCardId);
    setSeen((prev) => (prev.has(activeCardId) ? prev : new Set(prev).add(activeCardId)));
  }, [activeCardId, provider]);
  return useCallback((cardId: string) => !seen.has(cardId), [seen]);
}
