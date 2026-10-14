import { useCallback } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { EntityId, InteractionId } from "@/domain";
import { useInteractionProvider } from "@/provider-context";

// Commands on an open card's contacts, shared by both pages (P0.5b.2). A store
// card's change goes to the provider and comes back as an event; scenario
// cards (no `providerInteractionId`) keep the page's local update.

function warn(what: string) {
  return (error: unknown) => {
    if (import.meta.env.DEV) console.warn(`[contact] ${what} failed`, error);
  };
}

export function useContactCommands(options: {
  cards: readonly NavCard[];
  /** The page's local status update, for scenario cards. */
  setLocalStatus: (cardId: string, threadKey: string, status: string) => void;
}) {
  const provider = useInteractionProvider();
  const { cards, setLocalStatus } = options;

  const threadOf = useCallback(
    (cardId: string, threadKey: string) => cards.find((c) => c.id === cardId)?.threads.find((t) => t.id === threadKey),
    [cards],
  );

  /** The session status pill (pulled forward from 5d: reopen folding reads
   *  the stored `caseStatus`). */
  const setStatus = useCallback(
    (cardId: string, threadKey: string, status: string) => {
      const target = threadOf(cardId, threadKey)?.providerInteractionId;
      if (!target) {
        setLocalStatus(cardId, threadKey, status);
        return;
      }
      provider.setCaseStatus(target, status).catch(warn("setCaseStatus"));
    },
    [threadOf, provider, setLocalStatus],
  );

  /** Link/Create customer: every contact on the card joins the record. */
  const linkEntity = useCallback(
    (card: NavCard, entityId: string) => {
      const targets = card.threads.map((t) => t.providerInteractionId).filter((id): id is InteractionId => !!id);
      for (const id of targets) provider.associateEntity(id, entityId as EntityId).catch(warn("associateEntity"));
      return targets.length > 0;
    },
    [provider],
  );

  return { setStatus, linkEntity };
}
