import { useEffect } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

/** Why a card is a known customer (P-EXTRACT, Bug 3). A fact on the card,
 *  stamped the first time it holds and kept in the card's overlay (keyed by
 *  its journey), so it outlives what made it true: a scripted case is a
 *  known customer for the card's whole life, not only while its scripted
 *  contact is live. A card with none is an unknown contact (the Link to
 *  existing customer flow). */
export type CardIdentity = NonNullable<NavCard["identity"]>;

/** What decides a card's identity: the directory, this session's created records, the scripted cases. */
export interface CardIdentityFacts {
  /** The card's entity is in the static directory. */
  isDirectoryEntity: (entityId: string) => boolean;
  /** The card's entity was created this session ("Create New Customer"). */
  isCreatedEntity: (entityId: string) => boolean;
  /** The card is a scripted case that arrives as a known customer. */
  isKnownScenario: (cardId: string) => boolean;
}

/** Whether the card is a known customer right now, from what's on it. */
export function deriveCardIdentity(card: NavCard, facts: CardIdentityFacts): CardIdentity | undefined {
  const entityId = card.entityId;
  if (entityId && facts.isDirectoryEntity(entityId)) return "directory";
  if (entityId && facts.isCreatedEntity(entityId)) return "created";
  if (/^(history|seed):/.test(entityId ?? "")) return "history";
  if (facts.isKnownScenario(card.id)) return "scenario";
  return undefined;
}

/** P-LAYOUT-F3 7: the one rule for "is this contact identified" — a name on file, i.e. the card is linked to a
 *  customer record (its stamped `identity`, or one derivable now, before the stamp lands). Every avatar reads it:
 *  initials when identified, the generic user icon when not, whatever the card's selection (that stays on the
 *  card's border and background). Contact Details shows only for an identified contact (8). A raw address is a
 *  display name, never a name on file. */
export function isIdentifiedContact(card: NavCard, facts: CardIdentityFacts): boolean {
  return !!(card.identity ?? deriveCardIdentity(card, facts));
}

/** The same rule for a work item (a kind card): its customer resolved through the directory and the agent's links
 *  (`useScheduleItemCustomer`) is its name on file; an item with none shows the user icon. */
export function isIdentifiedWorkItem(customer: { name: string } | undefined): boolean {
  return !!customer;
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
