import type { ChannelType, CreateNewOutboundConfig } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

type OutboundContact = NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]>[number];

/** Builds a `tagOpenChannels` closure from the open cards. Each outbound
 *  contact gets the channel types and addresses it already has open
 *  (`openChannelTypes`/`openChannelAddresses`), so New Outbound and "+"
 *  disable them (CLAUDE.md rule #1). Channels the agent closed are skipped,
 *  since reselecting one is how it reopens. Keyed by the card's `entityId`
 *  (the card id is a journey since P0.5b.2); one entity may have several
 *  open cards, so their channels are merged. Shared by both pages. */
export function buildOpenChannelTagger(cards: readonly NavCard[]) {
  const addressesByEntity = new Map<string, Partial<Record<ChannelType, string[]>>>();
  const typesByEntity = new Map<string, Set<ChannelType>>();
  for (const card of cards) {
    const key = card.entityId ?? card.id;
    const byType = addressesByEntity.get(key) ?? {};
    const types = typesByEntity.get(key) ?? new Set<ChannelType>();
    for (const c of card.threads) {
      if (card.threadStatuses?.[c.id] === "Closed") continue;
      types.add(c.type);
      if (!c.value) continue;
      (byType[c.type] ??= []).push(c.value);
    }
    addressesByEntity.set(key, byType);
    typesByEntity.set(key, types);
  }
  return function tagOpenChannels(contact: OutboundContact): OutboundContact {
    const openChannelAddresses = addressesByEntity.get(contact.id);
    const openChannelTypes = typesByEntity.get(contact.id);
    if (!openChannelTypes || openChannelTypes.size === 0) return contact;
    return {
      ...contact,
      ...(openChannelAddresses && Object.keys(openChannelAddresses).length > 0 ? { openChannelAddresses } : {}),
      openChannelTypes: [...openChannelTypes],
    };
  };
}

/** A card known only by an address (a typed number/email, no directory
 *  record) — what the `adhoc:`/`quickdial:` card ids used to signal. */
export function isAddressOnlyCard(card: Pick<NavCard, "entityId">): boolean {
  return !card.entityId;
}
