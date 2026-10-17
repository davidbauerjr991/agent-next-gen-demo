import { useEffect, useRef } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

// Which call the voice bar shows (P0.5d.1, both pages):
// 1. the selected card's call (held or live), in its own state;
// 2. otherwise the call the bar last showed, while it's still a call;
// 3. otherwise the live call, else the most recent held one (shown with
//    Resume — e.g. after the live call ended).
// Selecting a card never changes hold state; only Hold/Resume (the bar or
// the nav row's hold chip) does.

type Thread = NavCard["threads"][number];

export interface VoiceBarCall {
  card: NavCard;
  thread: Thread;
}

const keyOf = (call: VoiceBarCall) => `${call.card.id}:${call.thread.id}`;

/** Every card's current (live or held) call, in card order. */
export function voiceBarCalls(cards: readonly NavCard[], callOf: (card: NavCard) => Thread | undefined): VoiceBarCall[] {
  return cards.flatMap((card) => {
    const thread = callOf(card);
    return thread ? [{ card, thread }] : [];
  });
}

/** Pure pick; `callOf` returns a card's current (live or held) call. */
export function pickVoiceBarCall(
  cards: readonly NavCard[],
  activeCardId: string | null | undefined,
  callOf: (card: NavCard) => Thread | undefined,
  lastShownKey: string | undefined,
): VoiceBarCall | undefined {
  const calls = voiceBarCalls(cards, callOf);
  return (
    calls.find((c) => c.card.id === activeCardId) ??
    calls.find((c) => keyOf(c) === lastShownKey) ??
    calls.find((c) => !c.thread.heldByAgent) ??
    calls[calls.length - 1]
  );
}

export function useVoiceBarCall(
  cards: readonly NavCard[],
  activeCardId: string | null | undefined,
  callOf: (card: NavCard) => Thread | undefined,
): VoiceBarCall | undefined {
  const lastShownKey = useRef<string | undefined>(undefined);
  const call = pickVoiceBarCall(cards, activeCardId, callOf, lastShownKey.current);
  const key = call ? keyOf(call) : undefined;
  useEffect(() => {
    if (key) lastShownKey.current = key;
  }, [key]);
  return call;
}
