// Domain → left-nav card view model (P0.5.0, extended in P0.5b.1). Pure:
// groups domain Interactions by `journeyId` into the pages' existing card
// shape (the `Interaction` + `Thread[]` view model in agent-next-gen-
// interaction-dashboard.tsx), so a page can switch to provider state one
// feature at a time without changing its render code. Type-only import of
// the view model; nothing here touches React, providers, or the store.
import type { Interaction as NavCard, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { EpochMs, Interaction, InteractionId } from "@/domain";

export type { NavCard };

export interface NavCardOptions {
  /** Converts an epoch time to the page's `clockTick` scale — see `tickClock`. */
  toTick: (ms: EpochMs) => number;
  /** The customer name for a card, given the contact that names it. The page
   *  decides precedence (e.g. `contactName` over a directory lookup). When
   *  it returns undefined: `contactName`, then the address label, then the
   *  address value. */
  displayName?: (interaction: Interaction) => string | undefined;
  /** Message counts per interaction (digital channels; voice stays undefined).
   *  A thread's count is the sum over the contacts folded into it. */
  messageCounts?: ReadonlyMap<InteractionId, number>;
  /** Whether a case status means the case was closed, so the next contact on
   *  the same thread counts as a reopen. Default: `status === "Closed"`. */
  isClosedStatus?: (status: string) => boolean;
  /** `reopenedContacts[].messagesBeforeReopen` for a reopening contact (the
   *  page's live-message count for the thread at that moment). Default 0. */
  messagesBeforeReopen?: (reopening: Interaction) => number;
}

/** Ticks on the page's shared clock (a seconds counter starting at 0 when
 *  the page mounted at `anchorMs`). Contacts that started before the mount
 *  get negative ticks, which still yields the right elapsed time. */
export function tickClock(anchorMs: EpochMs): (ms: EpochMs) => number {
  return (ms) => Math.floor((ms - anchorMs) / 1000);
}

/** The page's thread key: `${channel}:${address}`, or just the channel when
 *  there's no address. Stable across reopens of the same thread. */
export function threadKey(interaction: Interaction): string {
  return interaction.address ? `${interaction.channel}:${interaction.address.value}` : interaction.channel;
}

/**
 * One card per `journeyId`, ordered by each journey's earliest `startedAt`.
 * Offered contacts are left out: offers render as the ringing tile (voice)
 * or as notifications (digital), and become cards once accepted.
 *
 * Within a journey, contacts on the same thread key fold into one Thread:
 * the newest drives its state, `contactId` stays the first contact's, and
 * each contact that follows a closed case adds a `reopenedContacts` entry
 * (a reopen of a still-open thread just replaces it, as the pages do today).
 * Threads are ordered by their first contact. Ended contacts stay on their
 * card (the page decides when to dismiss it).
 *
 * UI-only card fields — `currentThreadId`, card-level `startedFresh`,
 * `liveMessages` — are left unset for the page to merge in (PLAN.md P0.1).
 */
export function buildNavCards(interactions: readonly Interaction[], options: NavCardOptions): NavCard[] {
  const journeys = new Map<string, Interaction[]>();
  const sorted = interactions.filter((i) => i.state !== "offered").sort((a, b) => a.startedAt - b.startedAt);
  for (const interaction of sorted) {
    const group = journeys.get(interaction.journeyId);
    if (group) group.push(interaction);
    else journeys.set(interaction.journeyId, [interaction]);
  }
  return [...journeys.values()].map((group) => toCard(group, options));
}

function toCard(group: Interaction[], options: NavCardOptions): NavCard {
  const first = group[0];
  const named = group.find((i) => i.entityId) ?? first;

  const threadGroups = new Map<string, Interaction[]>();
  for (const i of group) {
    const key = threadKey(i);
    const contacts = threadGroups.get(key);
    if (contacts) contacts.push(i);
    else threadGroups.set(key, [i]);
  }
  const threads: Thread[] = [];
  const threadStatuses: Record<string, string> = {};
  const newest: Interaction[] = [];
  for (const [key, contacts] of threadGroups) {
    const current = contacts[contacts.length - 1];
    newest.push(current);
    threads.push(toThread(key, contacts, options));
    if (current.caseStatus !== undefined) threadStatuses[key] = current.caseStatus;
  }

  const card: NavCard = {
    // The nav slot key is the journey, not the customer record: two
    // concurrent journeys with one entity must not collide (PLAN.md P0.5.0).
    id: first.journeyId,
    interactionId: first.journeyId,
    customerId: group.find((i) => i.caseId)?.caseId ?? named.entityId ?? named.address?.value ?? "",
    customerName: options.displayName?.(named) ?? named.contactName ?? named.address?.label ?? named.address?.value,
    threads,
  };
  if (named.entityId) card.entityId = named.entityId;
  if (Object.keys(threadStatuses).length > 0) card.threadStatuses = threadStatuses;
  if (newest.some((i) => i.channel === "voice" && (i.state === "wrap-up" || i.state === "ended"))) card.voiceCallEnded = true;
  if (newest.every((i) => i.state === "ended")) card.closed = true;
  return card;
}

function toThread(key: string, contacts: Interaction[], options: NavCardOptions): Thread {
  const { toTick, messageCounts } = options;
  const isClosed = options.isClosedStatus ?? ((status: string) => status === "Closed");
  const base = contacts[0];
  const i = contacts[contacts.length - 1];
  const thread: Thread = {
    id: key,
    type: i.channel,
    startTick: toTick(i.acceptedAt ?? i.startedAt),
    contactId: base.externalId?.id ?? base.id,
    direction: i.direction,
    providerInteractionId: i.id,
  };
  if (i.skill) thread.preview = i.skill.name;
  if (i.address) {
    thread.value = i.address.value;
    if (i.address.label !== undefined) thread.addressLabel = i.address.label;
  }
  if (i.awaitingAgentSince !== undefined) {
    thread.awaitingResponse = true;
    thread.lastCustomerMessageTick = toTick(i.awaitingAgentSince);
  }
  if (i.channel !== "voice") {
    const counts = contacts.map((c) => messageCounts?.get(c.id)).filter((n): n is number => n !== undefined);
    if (counts.length > 0) thread.messageCount = counts.reduce((sum, n) => sum + n, 0);
  }
  if (i.origin === "agent-initiated") thread.startedFresh = true;
  if (i.state === "held") {
    thread.heldByAgent = true;
    if (i.heldSince !== undefined) thread.heldSinceTick = toTick(i.heldSince);
  }

  const reopened = contacts.slice(1).filter((c, index) => {
    const before = contacts[index].caseStatus;
    return before !== undefined && isClosed(before);
  });
  if (reopened.length > 0) {
    thread.reopenedContacts = reopened.map((c) => {
      const started = new Date(c.startedAt);
      return {
        id: `session-reopened-${c.id}`,
        date: started.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
        startTime: started.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        contactId: c.externalId?.id ?? c.id,
        messagesBeforeReopen: options.messagesBeforeReopen?.(c) ?? 0,
      };
    });
  }
  return thread;
}
