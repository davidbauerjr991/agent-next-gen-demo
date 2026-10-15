import { useCallback, useMemo, useRef, useState } from "react";
import { buildNavCards, threadKey, tickClock, type NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { Interaction as DomainInteraction, InteractionId } from "@/domain";
import { useInteractions } from "@/provider-context";
import { diffCardOverlay, mergeCardOverlay, type CardOverlay } from "./nav-card-overlay";

// The left nav's cards (P0.5b.2). Every contact the provider knows about comes
// from the interaction store through `buildNavCards`, scripted scenario cases
// included since P0.5c; the page's own UI state for those cards lives in an
// overlay (nav-card-overlay.ts).
//
// `setCards` takes the same `prev => next` updater the pages used with
// `useState<Interaction[]>`, so existing update sites keep working:
//   - a store card's overlay fields are kept; any other change is dropped
//     (it belongs to the provider) with a dev warning naming the field;
//   - adding or removing a card is not possible here — that's `dial`,
//     `reopen`, `accept` or dismiss through the provider.

export interface UseNavCardsOptions {
  /** The page clock's `anchorMs` (tick 0), so `startTick`s share its scale. */
  anchorMs: number;
  /** Customer name for a contact: the page's directory lookup by `entityId`. */
  displayName?: (interaction: DomainInteraction) => string | undefined;
}

export interface NavCards {
  /** The store's cards, in the order this page first saw them. */
  cards: NavCard[];
  setCards: (update: (prev: NavCard[]) => NavCard[]) => void;
  /** True for a card backed by provider contacts. */
  isStoreCard: (id: string) => boolean;
  /** The open (not `closed`) store card for a contact, by entity or address. */
  findOpenCard: (target: { entityId?: string; address?: string }) => NavCard | undefined;
  /** Seeds overlay fields for a journey before its card appears (e.g. stored
   *  live messages restored by a reopen). */
  seedOverlay: (journeyId: string, overlay: CardOverlay) => void;
}

interface LocalState {
  overlay: Record<string, CardOverlay>;
}

/** Drops each thread whose newest contact has ended (dismissed, declined,
 *  abandoned) — and so any card left empty — keeping earlier ended contacts of
 *  a live thread for reopen folding. Ended contacts leave the store only when
 *  the provider forgets them, so this is what makes a dismissed card stay
 *  gone, including across tier switches. A ringing voice offer is kept (it's
 *  the incoming tile); digital offers are notifications, not cards. */
export function visibleContacts(interactions: readonly DomainInteraction[]): DomainInteraction[] {
  const newest = new Map<string, DomainInteraction>();
  for (const i of interactions) {
    if (i.state === "offered" && i.channel !== "voice") continue;
    const key = `${i.journeyId}|${threadKey(i)}`;
    const current = newest.get(key);
    if (!current || i.startedAt >= current.startedAt) newest.set(key, i);
  }
  return interactions.filter((i) => {
    const latest = newest.get(`${i.journeyId}|${threadKey(i)}`);
    return latest !== undefined && latest.state !== "ended";
  });
}

export function useNavCards({ anchorMs, displayName }: UseNavCardsOptions): NavCards {
  const interactions = useInteractions();
  const [local, setLocal] = useState<LocalState>({ overlay: {} });

  // First-seen order, so new cards append like they did when the page owned
  // the list.
  const order = useRef(new Map<string, number>());
  const orderOf = (id: string) => {
    let n = order.current.get(id);
    if (n === undefined) {
      n = order.current.size;
      order.current.set(id, n);
    }
    return n;
  };

  // The thread's live-message count when a reopening contact first appeared,
  // so earlier messages stay under their own (dimmed) session.
  const reopenMarks = useRef(new Map<InteractionId, number>());
  const overlayRef = useRef(local.overlay);
  overlayRef.current = local.overlay;

  const storeCards = useMemo(() => {
    const visible = visibleContacts(interactions);
    return buildNavCards(visible, {
      toTick: tickClock(anchorMs),
      displayName,
      voiceOffers: true,
      messagesBeforeReopen: (c) => {
        let mark = reopenMarks.current.get(c.id);
        if (mark === undefined) {
          mark = overlayRef.current[c.journeyId]?.liveMessages?.[threadKey(c)]?.length ?? 0;
          reopenMarks.current.set(c.id, mark);
        }
        return mark;
      },
    });
  }, [interactions, anchorMs, displayName]);

  const storeIdsRef = useRef(new Set<string>());
  storeIdsRef.current = new Set(storeCards.map((c) => c.id));
  const storeCardsRef = useRef(storeCards);
  storeCardsRef.current = storeCards;

  const cards = useMemo(() => {
    const merged = storeCards.map((card) => withMessageCounts(mergeCardOverlay(card, local.overlay[card.id])));
    return merged
      .map((card) => ({ card, n: orderOf(card.id) }))
      .sort((a, b) => a.n - b.n)
      .map(({ card }) => card);
  }, [storeCards, local]);

  const setCards = useCallback(
    (update: (prev: NavCard[]) => NavCard[]) => {
      setLocal((prev) => {
        const storeById = new Map(storeCardsRef.current.map((c) => [c.id, c]));
        const before = storeCardsRef.current.map((c) => withMessageCounts(mergeCardOverlay(c, prev.overlay[c.id])));
        const after = update(before);
        if (after === before) return prev;

        const beforeById = new Map(before.map((c) => [c.id, c]));
        const afterIds = new Set(after.map((c) => c.id));
        let overlay = prev.overlay;
        const ignored: string[] = [];

        for (const card of after) {
          if (!storeById.has(card.id)) {
            ignored.push(`${card.id} (added; contacts come from dial/reopen/accept)`);
            continue;
          }
          const prior = beforeById.get(card.id)!;
          if (prior === card) continue;
          const diff = diffCardOverlay(prior, card, overlay[card.id]);
          ignored.push(...diff.ignored.map((field) => `${card.id}.${field}`));
          overlay = { ...overlay, [card.id]: diff.overlay };
        }
        for (const id of storeById.keys()) {
          if (!afterIds.has(id)) ignored.push(`${id} (removed; dismiss through the provider)`);
        }
        if (ignored.length > 0 && import.meta.env.DEV) {
          console.warn(`[nav-cards] provider-owned changes ignored: ${ignored.join(", ")}`);
        }
        return overlay === prev.overlay ? prev : { overlay };
      });
    },
    [],
  );

  const isStoreCard = useCallback((id: string) => storeIdsRef.current.has(id), []);

  const findOpenCard = useCallback(
    (target: { entityId?: string; address?: string }) =>
      storeCardsRef.current.find(
        (card) =>
          !card.closed &&
          !card.offered &&
          (target.entityId !== undefined
            ? card.entityId === target.entityId
            : !card.entityId && target.address !== undefined && card.threads.some((t) => t.value === target.address)),
      ),
    [],
  );

  const seedOverlay = useCallback((journeyId: string, seed: CardOverlay) => {
    setLocal((prev) => ({ ...prev, overlay: { ...prev.overlay, [journeyId]: { ...prev.overlay[journeyId], ...seed } } }));
  }, []);

  // findOpenCard returns the derived card; callers only need its id/threads.
  return { cards, setCards, isStoreCard, findOpenCard, seedOverlay };
}

/** Digital threads show a message count; a freshly started one shows 0, as
 *  the pages did when they built the thread themselves. */
function withMessageCounts(card: NavCard): NavCard {
  let changed = false;
  const threads = card.threads.map((t) => {
    if (t.type === "voice" || t.messageCount !== undefined) return t;
    const live = card.liveMessages?.[t.id]?.length;
    if (live === undefined && !t.startedFresh) return t;
    changed = true;
    return { ...t, messageCount: live ?? 0 };
  });
  return changed ? { ...card, threads } : card;
}
