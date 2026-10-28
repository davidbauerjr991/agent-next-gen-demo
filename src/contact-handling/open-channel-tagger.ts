import type { ChannelType, CreateNewOutboundConfig } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { Interaction as DomainInteraction } from "@/domain";
import { findCallWith } from "./already-open";

type OutboundContact = NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]>[number];

/** Builds a `tagOpenChannels` closure from the open cards. Each outbound
 *  contact gets the channel types and addresses it already has open
 *  (`openChannelTypes`/`openChannelAddresses`), so New Outbound and "+"
 *  disable them (CLAUDE.md rule #1). Voice is the one-call-per-customer
 *  guard itself (`findCallWith` over the provider's `contacts`: a ringing or
 *  live call, never a held one; P-HOME-1m), not a rule of its own here.
 *  Channels the agent closed are skipped, since reselecting one is how it
 *  reopens. Keyed by the card's `entityId`
 *  (the card id is a journey since P0.5b.2); one entity may have several
 *  open cards, so their channels are merged. Shared by both pages. */
export function buildOpenChannelTagger(cards: readonly NavCard[], contacts: readonly DomainInteraction[]) {
  const addressesByEntity = new Map<string, Partial<Record<ChannelType, string[]>>>();
  const typesByEntity = new Map<string, Set<ChannelType>>();
  for (const card of cards) {
    const key = card.entityId ?? card.id;
    const byType = addressesByEntity.get(key) ?? {};
    const types = typesByEntity.get(key) ?? new Set<ChannelType>();
    for (const c of card.threads) {
      if (card.threadStatuses?.[c.id] === "Closed") continue;
      // Voice is the guard's (below), not a thread's: leaving its numbers out
      // too keeps lyra's "every address already open" rule from blocking it.
      if (c.type === "voice") continue;
      types.add(c.type);
      if (!c.value) continue;
      (byType[c.type] ??= []).push(c.value);
    }
    addressesByEntity.set(key, byType);
    typesByEntity.set(key, types);
  }
  return function tagOpenChannels(contact: OutboundContact): OutboundContact {
    const openChannelAddresses = addressesByEntity.get(contact.id);
    const openChannelTypes = new Set(typesByEntity.get(contact.id));
    // The contact's id is its entity, or its card's journey (a card with no directory record).
    if (findCallWith(contacts, { entityId: contact.id, journeyId: contact.id })) openChannelTypes.add("voice");
    if (openChannelTypes.size === 0) return contact;
    return {
      ...contact,
      ...(openChannelAddresses && Object.keys(openChannelAddresses).length > 0 ? { openChannelAddresses } : {}),
      openChannelTypes: [...openChannelTypes],
    };
  };
}

