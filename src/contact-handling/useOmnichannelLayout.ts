import { useCallback, useEffect, useState } from "react";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/transcript/InteractionTranscript";
import { threadKeyOf } from "./channel-thread";
import { customerMessageCount } from "./omnichannel";

/** The omnichannel slide-out and unread counts (Settings → Assignments →
 *  Omnichannel layout). The open slide-out is kept per card, so it stays
 *  open across card switches only for its own card. A thread's unread count
 *  is the customer messages that arrived while it wasn't showing (in the
 *  main column or the slide-out).
 *
 *  `defaultKey` (AI display "main", P-AIFIRST): what the panel
 *  shows on a card the agent hasn't picked a thread on yet. Closing the
 *  panel is remembered per card, so it stays closed until a row or icon
 *  opens a thread again. */
export function useOmnichannelLayout(card: Interaction | null, mainKey: string | undefined, options?: { defaultKey?: string }) {
  // Per card: a thread key, null (closed by the agent), or absent (no pick yet).
  const [slideOutByCard, setSlideOutByCard] = useState<Record<string, string | null>>({});
  const [seen, setSeen] = useState<Record<string, number>>({});

  const picked = card ? slideOutByCard[card.id] : undefined;
  const requested = picked === undefined ? options?.defaultKey ?? null : picked;
  // Never the main thread, and only a thread the card still has.
  const slideOutKey =
    requested && requested !== mainKey && card?.threads.some((t) => threadKeyOf(t) === requested) ? requested : null;

  const open = useCallback((cardId: string, key: string) => setSlideOutByCard((prev) => ({ ...prev, [cardId]: key })), []);
  const close = useCallback((cardId: string) => setSlideOutByCard((prev) => ({ ...prev, [cardId]: null })), []);
  // Toggles against the agent's pick; on the shown card with no pick yet,
  // against the default that's showing.
  const shownCardId = card?.id;
  const shownDefault = picked === undefined ? slideOutKey : null;
  const toggle = useCallback(
    (cardId: string, key: string) =>
      setSlideOutByCard((prev) => {
        const current = prev[cardId] !== undefined ? prev[cardId] : cardId === shownCardId ? shownDefault : null;
        return { ...prev, [cardId]: current === key ? null : key };
      }),
    [shownCardId, shownDefault]
  );

  // What's showing counts as seen.
  const cardId = card?.id;
  const liveMessages = card?.liveMessages;
  useEffect(() => {
    if (!cardId) return;
    setSeen((prev) => {
      let next = prev;
      for (const key of [mainKey, slideOutKey]) {
        if (!key) continue;
        const id = `${cardId}:${key}`;
        const count = customerMessageCount(liveMessages?.[key]);
        if (prev[id] !== count) next = { ...next, [id]: count };
      }
      return next;
    });
  }, [cardId, liveMessages, mainKey, slideOutKey]);

  // A thread read elsewhere (its header icon's hover preview): what's there now counts as seen.
  const markSeen = useCallback((forCardId: string, key: string, messages: readonly TranscriptMessage[] | undefined) => {
    const id = `${forCardId}:${key}`;
    const count = customerMessageCount(messages);
    setSeen((prev) => (prev[id] === count ? prev : { ...prev, [id]: count }));
  }, []);

  const unread = useCallback(
    (forCardId: string, key: string, messages: readonly TranscriptMessage[] | undefined) =>
      Math.max(0, customerMessageCount(messages) - (seen[`${forCardId}:${key}`] ?? 0)),
    [seen]
  );

  return { slideOutKey, open, close, toggle, unread, markSeen };
}

export type OmnichannelLayout = ReturnType<typeof useOmnichannelLayout>;
