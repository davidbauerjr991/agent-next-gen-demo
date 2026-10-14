import { useCallback } from "react";
import { threadKey as threadKeyOf, type NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { EntityId, Interaction, InteractionId, InteractionOutcome } from "@/domain";
import { useInteractionProvider, useInteractions } from "@/provider-context";

// Commands on an open card's contacts, shared by both pages (P0.5b.2). A store
// card's change goes to the provider and comes back as an event; scenario
// cards (no `providerInteractionId`) keep the page's local update — each
// command returns false for them so the page can apply its own.

function warn(what: string) {
  return (error: unknown) => {
    if (import.meta.env.DEV) console.warn(`[contact] ${what} failed`, error);
  };
}

const LIVE_STATES = new Set<Interaction["state"]>(["connecting", "active", "held"]);

export function useContactCommands(options: {
  cards: readonly NavCard[];
  /** The page's local status update, for scenario cards. */
  setLocalStatus: (cardId: string, threadKey: string, status: string) => void;
}) {
  const provider = useInteractionProvider();
  const interactions = useInteractions();
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

  /** Hold or resume a call (the voice bar). Resuming one call holds any
   *  other live call (the provider's one-active-call rule). Returns false
   *  for a scenario card, which the page holds locally. */
  const setHold = useCallback(
    (thread: Pick<NavCard["threads"][number], "providerInteractionId">, onHold: boolean) => {
      const target = thread.providerInteractionId;
      if (!target) return false;
      provider.hold(target, onHold).catch(warn("hold"));
      return true;
    },
    [provider],
  );

  /** Hang up (the voice bar, the nav row's End Call): the call goes to
   *  wrap-up, which shows on the card as ended and switches Outcome to Save &
   *  Dismiss / Save & Redial. Returns false for a scenario card. */
  const hangUp = useCallback(
    (thread: Pick<NavCard["threads"][number], "providerInteractionId">) => {
      const target = thread.providerInteractionId;
      if (!target) return false;
      provider.end(target).catch(warn("end"));
      return true;
    },
    [provider],
  );

  /** The provider contacts behind one thread of a card, oldest first
   *  (folded reopens included). */
  const contactsOf = useCallback(
    (card: NavCard, key: string) =>
      interactions
        .filter((i) => i.journeyId === card.id && threadKeyOf(i) === key)
        .sort((a, b) => a.startedAt - b.startedAt),
    [interactions],
  );

  /** Closes one contact for good: declines a still-offered one, ends a live
   *  one, then completes wrap-up with the outcome. */
  const close = useCallback(
    async (contact: Interaction, outcome: InteractionOutcome) => {
      if (contact.state === "ended") return;
      if (contact.state === "offered") {
        await provider.decline(contact.id);
        return;
      }
      if (LIVE_STATES.has(contact.state)) await provider.end(contact.id);
      await provider.completeWrapUp(contact.id, outcome);
    },
    [provider],
  );

  /** Unassign & Dismiss for one thread (or Save & Dismiss on a one-thread
   *  card): every contact on it is closed with `outcome`. The thread then
   *  leaves the card through `useNavCards`' visibility rule — also after a
   *  tier switch. Resolves true once the provider accepted every command;
   *  false for a scenario thread (the page removes it locally). */
  const dismissThread = useCallback(
    async (card: NavCard, key: string, outcome: InteractionOutcome = {}) => {
      const contacts = contactsOf(card, key);
      if (contacts.length === 0) return false;
      try {
        for (const contact of contacts) await close(contact, outcome);
        return true;
      } catch (error) {
        warn("dismiss")(error);
        return false;
      }
    },
    [contactsOf, close],
  );

  /** Unassign & Dismiss for a whole card: every thread, each with its own
   *  outcome. Same return convention as `dismissThread`. */
  const dismissCard = useCallback(
    async (card: NavCard, outcomeFor: (threadKey: string) => InteractionOutcome = () => ({})) => {
      if (!card.threads.some((t) => t.providerInteractionId)) return false;
      const results = await Promise.all(card.threads.map((t) => dismissThread(card, t.id, outcomeFor(t.id))));
      return results.every(Boolean);
    },
    [dismissThread],
  );

  /** Save & Redial, once the redial is placed: completes the ended call's
   *  wrap-up with its outcome. Only contacts in wrap-up are touched, so the
   *  new call on the same thread (connecting or live) keeps the card — and
   *  the thread — on screen throughout. */
  const completeEndedCalls = useCallback(
    async (card: NavCard, outcomeFor: (threadKey: string) => InteractionOutcome = () => ({})) => {
      try {
        for (const thread of card.threads) {
          if (thread.type !== "voice") continue;
          for (const contact of contactsOf(card, thread.id)) {
            if (contact.state === "wrap-up") await provider.completeWrapUp(contact.id, outcomeFor(thread.id));
          }
        }
      } catch (error) {
        warn("completeWrapUp")(error);
      }
    },
    [contactsOf, provider],
  );

  return { setStatus, linkEntity, setHold, hangUp, dismissThread, dismissCard, completeEndedCalls };
}
