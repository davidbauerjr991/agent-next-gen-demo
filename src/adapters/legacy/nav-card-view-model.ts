// Domain → left-nav card view model (P0.5.0). Pure: groups domain
// Interactions by `journeyId` into the pages' existing card shape (the
// `Interaction` + `Thread[]` view model in agent-next-gen-interaction-
// dashboard.tsx), so a page can switch to provider state one feature at a
// time without changing its render code. Type-only import of the view model;
// nothing here touches React, providers, or the store.
import type { Interaction as NavCard, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { EpochMs, Interaction, InteractionId } from "@/domain";

export type { NavCard };

export interface NavCardOptions {
  /** Converts an epoch time to the page's `clockTick` scale — see `tickClock`. */
  toTick: (ms: EpochMs) => number;
  /** The entity's display name, once CustomerDataProvider can supply it. */
  displayName?: (interaction: Interaction) => string | undefined;
  /** Message counts per interaction (digital channels; voice stays undefined). */
  messageCounts?: ReadonlyMap<InteractionId, number>;
}

/** Ticks on the page's shared clock (a seconds counter starting at 0 when
 *  the page mounted at `anchorMs`). Contacts that started before the mount
 *  get negative ticks, which still yields the right elapsed time. */
export function tickClock(anchorMs: EpochMs): (ms: EpochMs) => number {
  return (ms) => Math.floor((ms - anchorMs) / 1000);
}

/**
 * One card per `journeyId`, ordered by each journey's earliest `startedAt`;
 * one Thread per domain Interaction, ordered by `startedAt`. Ended contacts
 * stay on their card (the page decides when to dismiss it).
 *
 * UI-only card fields — `currentThreadId`, card-level `startedFresh`,
 * `liveMessages` — are left unset for the page to merge in (PLAN.md P0.1).
 * Earlier ended contacts are not yet folded into `Thread.reopenedContacts`.
 */
export function buildNavCards(interactions: readonly Interaction[], options: NavCardOptions): NavCard[] {
  const journeys = new Map<string, Interaction[]>();
  for (const interaction of [...interactions].sort((a, b) => a.startedAt - b.startedAt)) {
    const group = journeys.get(interaction.journeyId);
    if (group) group.push(interaction);
    else journeys.set(interaction.journeyId, [interaction]);
  }
  return [...journeys.values()].map((group) => toCard(group, options));
}

function toCard(group: Interaction[], options: NavCardOptions): NavCard {
  const first = group[0];
  const named = group.find((i) => i.entityId) ?? first;
  const threadStatuses: Record<string, string> = {};
  for (const i of group) if (i.caseStatus !== undefined) threadStatuses[i.id] = i.caseStatus;

  const card: NavCard = {
    // The nav slot key is the journey, not the customer record: two
    // concurrent journeys with one entity must not collide (PLAN.md P0.5.0).
    id: first.journeyId,
    interactionId: first.journeyId,
    customerId: named.entityId ?? named.address?.value ?? "",
    customerName: options.displayName?.(named) ?? named.address?.label ?? named.address?.value,
    threads: group.map((i) => toThread(i, options)),
  };
  if (Object.keys(threadStatuses).length > 0) card.threadStatuses = threadStatuses;
  if (group.some((i) => i.channel === "voice" && (i.state === "wrap-up" || i.state === "ended"))) card.voiceCallEnded = true;
  if (group.every((i) => i.state === "ended")) card.closed = true;
  return card;
}

function toThread(i: Interaction, { toTick, messageCounts }: NavCardOptions): Thread {
  const thread: Thread = {
    id: i.id,
    type: i.channel,
    startTick: toTick(i.startedAt),
    contactId: i.externalId?.id ?? i.id,
    direction: i.direction,
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
    const count = messageCounts?.get(i.id);
    if (count !== undefined) thread.messageCount = count;
  }
  if (i.origin === "agent-initiated") thread.startedFresh = true;
  if (i.state === "held") {
    thread.heldByAgent = true;
    if (i.heldSince !== undefined) thread.heldSinceTick = toTick(i.heldSince);
  }
  return thread;
}
