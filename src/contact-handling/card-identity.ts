import { useEffect } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

/** Why a card is a known customer (P-EXTRACT, Bug 3). A fact on the card,
 *  stamped the first time it holds and kept in the card's overlay (keyed by
 *  its journey), so it outlives what made it true: a scripted case is a
 *  known customer for the card's whole life, not only while its scripted
 *  contact is live. A card with none is an unknown contact (the Link to
 *  existing customer flow). */
export type CardIdentity = NonNullable<NavCard["identity"]>;

/** Whether the card is a known customer right now, from what's on it. */
export function deriveCardIdentity(
  card: NavCard,
  facts: {
    /** The card's entity is in the static directory. */
    isDirectoryEntity: (entityId: string) => boolean;
    /** The card's entity was created this session ("Create New Customer"). */
    isCreatedEntity: (entityId: string) => boolean;
    /** The card is a scripted case that arrives as a known customer. */
    isKnownScenario: (cardId: string) => boolean;
  },
): CardIdentity | undefined {
  const entityId = card.entityId;
  if (entityId && facts.isDirectoryEntity(entityId)) return "directory";
  if (entityId && facts.isCreatedEntity(entityId)) return "created";
  if (/^(history|seed):/.test(entityId ?? "")) return "history";
  if (facts.isKnownScenario(card.id)) return "scenario";
  return undefined;
}

/** Stamps `identity` on each card the first time `identityOf` gives it one. */
export function useStampCardIdentity(
  cards: readonly NavCard[],
  setCards: (update: (prev: NavCard[]) => NavCard[]) => void,
  identityOf: (card: NavCard) => CardIdentity | undefined,
) {
  const unstamped = cards.filter((c) => !c.identity && identityOf(c)).map((c) => c.id).join("|");
  useEffect(() => {
    if (!unstamped) return;
    const ids = new Set(unstamped.split("|"));
    setCards((prev) =>
      prev.map((c) => {
        if (!ids.has(c.id) || c.identity) return c;
        const identity = identityOf(c);
        return identity ? { ...c, identity } : c;
      }),
    );
    // `identityOf` is read when the set of unstamped cards changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unstamped, setCards]);
}
