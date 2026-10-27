import { useCallback, useEffect, useMemo, useState } from "react";
import { useInteractionProvider } from "@/provider-context";

/** The nav cards' "New" badge (P0.5b.2): a card is new until it has been the
 *  active card once, by any path (a click, a launch, a notification), or
 *  its feed row has been previewed (`previewed`, P-HOME-1k: the feed's
 *  unread is this same state). A new provider set (another database) starts over. */
export function useNewAssignments(activeCardId: string | null, previewed: ReadonlySet<string> = NONE) {
  const provider = useInteractionProvider();
  const [seen, setSeen] = useState<{ provider: object; ids: ReadonlySet<string> }>(() => ({
    provider,
    ids: new Set(activeCardId ? [activeCardId] : []),
  }));
  const ids = useMemo(() => (seen.provider === provider ? seen.ids : new Set<string>()), [seen, provider]);
  useEffect(() => {
    setSeen((prev) => {
      const base = prev.provider === provider ? prev.ids : new Set<string>();
      if (!activeCardId) return base === prev.ids ? prev : { provider, ids: base };
      if (base.has(activeCardId)) return base === prev.ids ? prev : { provider, ids: base };
      return { provider, ids: new Set(base).add(activeCardId) };
    });
  }, [activeCardId, provider]);
  return useCallback((cardId: string) => !ids.has(cardId) && !previewed.has(cardId), [ids, previewed]);
}

const NONE: ReadonlySet<string> = new Set();
