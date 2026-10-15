import type { ChannelType, CreateNewOutboundConfig } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";

type OutboundContact = NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]>[number];

/** Builds a `tagOpenChannels` closure from the open cards. Each outbound
 *  contact gets the channel types and addresses it already has open
 *  (`openChannelTypes`/`openChannelAddresses`), so New Outbound and "+"
 *  disable them (CLAUDE.md rule #1). Voice counts only while on a call.
 *  Channels the agent closed are skipped, since reselecting one is how it
 *  reopens. Keyed by the card's `entityId`
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
      // Voice counts only while the agent is on the call (ringing out, live
      // or held): a call in wrap-up doesn't stop a new call to the customer.
      // Leaving its number out too keeps lyra's "every address already
      // open" rule from blocking it instead.
      if (c.type === "voice" && !isOnCall(c)) continue;
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

/** A store-built voice thread is on a call per its `onCall`; a scripted
 *  scenario call (no provider contact) until its wrap-up starts. */
function isOnCall(thread: NavCard["threads"][number]): boolean {
  return thread.providerInteractionId ? !!thread.onCall : thread.wrapUpSinceTick === undefined;
}

/** A card known only by an address (a typed number/email, no directory
 *  record) — what the `adhoc:`/`quickdial:` card ids used to signal. */
export function isAddressOnlyCard(card: Pick<NavCard, "entityId">): boolean {
  return !card.entityId;
}
