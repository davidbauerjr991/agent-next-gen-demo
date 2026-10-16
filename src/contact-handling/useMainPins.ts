import { useCallback, useState } from "react";

/** A card's main-column thread held in place (PLAN "the one thread that
 *  moves": an offered chat never rearranges anything). When a chat is
 *  auto-accepted onto a card the agent is working, the card's current main
 *  thread stays main and the chat opens beside it; the pin goes when the
 *  agent picks a main-column thread themselves. */
export function useMainPins() {
  const [pins, setPins] = useState<Record<string, string>>({});
  const pin = useCallback(
    (cardId: string, key: string) => setPins((prev) => (prev[cardId] === key ? prev : { ...prev, [cardId]: key })),
    [],
  );
  const unpin = useCallback(
    (cardId: string) =>
      setPins((prev) => {
        if (!(cardId in prev)) return prev;
        const next = { ...prev };
        delete next[cardId];
        return next;
      }),
    [],
  );
  const pinned = useCallback((cardId: string | undefined): string | undefined => (cardId ? pins[cardId] : undefined), [pins]);
  return { pinned, pin, unpin };
}
