import { useCallback, useEffect, useState } from "react";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { threadKeyOf } from "./channel-thread";
import { customerMessageCount } from "./omnichannel";

/** The omnichannel slide-out and unread counts (Settings → Assignments →
 *  Omnichannel layout). The open slide-out is kept per card, so it stays
 *  open across card switches only for its own card. A thread's unread count
 *  is the customer messages that arrived while it wasn't showing (in the
 *  main column or the slide-out). */
export function useOmnichannelLayout(card: Interaction | null, mainKey: string | undefined) {
  const [slideOutByCard, setSlideOutByCard] = useState<Record<string, string | null>>({});
  const [seen, setSeen] = useState<Record<string, number>>({});

  const requested = card ? slideOutByCard[card.id] ?? null : null;
  // Never the main thread, and only a thread the card still has.
  const slideOutKey =
    requested && requested !== mainKey && card?.threads.some((t) => threadKeyOf(t) === requested) ? requested : null;

  const open = useCallback((cardId: string, key: string) => setSlideOutByCard((prev) => ({ ...prev, [cardId]: key })), []);
  const close = useCallback((cardId: string) => setSlideOutByCard((prev) => ({ ...prev, [cardId]: null })), []);
  const toggle = useCallback(
    (cardId: string, key: string) => setSlideOutByCard((prev) => ({ ...prev, [cardId]: prev[cardId] === key ? null : key })),
    []
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

  const unread = useCallback(
    (forCardId: string, key: string, messages: readonly TranscriptMessage[] | undefined) =>
      Math.max(0, customerMessageCount(messages) - (seen[`${forCardId}:${key}`] ?? 0)),
    [seen]
  );

  return { slideOutKey, open, close, toggle, unread };
}

export type OmnichannelLayout = ReturnType<typeof useOmnichannelLayout>;
