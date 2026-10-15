import type { ChannelType } from "@nicecxone/lyra-ui";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { synthesizeChannelAddress } from "@/components/agent-next-gen-shared-utils";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { Interaction } from "@/domain";

/** The entity a Contact History row stands for: the directory customer when
 *  there is one, else a per-case pseudo entity, so a redial and a reopen of
 *  the same case find the same open card (it used to be the card id). */
export function historyEntityId(entry: ContactHistoryEntry): string {
  return entry.customerId ?? `history:${entry.caseId}`;
}

/** A Contact History row's address on a channel: the one on record, or a
 *  stable synthesized one. */
export function knownOrSynthesizedAddress(entry: ContactHistoryEntry, channelType: ChannelType): string {
  const known =
    channelType === "email"
      ? entry.email
      : channelType === "whatsapp"
        ? entry.whatsappHandle
        : channelType === "voice" || channelType === "sms"
          ? entry.phone
          : undefined;
  return known ?? synthesizeChannelAddress(channelType, entry.caseId, entry.name);
}

/** `useNavCards`' `displayName`: the record's name wins for a contact matched
 *  to it after arriving (routing's address match, or the agent's Link /
 *  Create customer, `entityMatchedBy`) and for one that presented only its
 *  raw address. The name it presented stays its `contactName`, shown as
 *  "Calling as" when it differs (`NavCard.presentedName`). A contact that
 *  arrived already linked keeps its presented name: the notification seeds,
 *  whose names differ from their linked records (a kept quirk, PLAN.md
 *  P0.5b.1). */
export function directoryDisplayName(findRecord: (entityId: string) => { name: string } | undefined) {
  return (interaction: Interaction): string | undefined => {
    if (!interaction.entityId) return undefined;
    const presentedName = interaction.contactName && interaction.contactName !== interaction.address?.value;
    if (presentedName && !interaction.entityMatchedBy) return undefined;
    return findRecord(interaction.entityId)?.name;
  };
}

/** Who a contact is, for a toast: the name its card shows (else the name it
 *  presented) and its number or address. A name that's only the raw
 *  address is left out. */
export interface CallerLabel {
  name?: string;
  number?: string;
}

export function callerOfCard(card: Pick<NavCard, "customerName" | "threads">, threadKey?: string): CallerLabel {
  const thread = card.threads.find((t) => t.id === threadKey) ?? card.threads.find((t) => t.type === "voice") ?? card.threads[0];
  const number = thread?.addressLabel ?? thread?.value;
  const name = card.customerName && card.customerName !== number && card.customerName !== thread?.value ? card.customerName : undefined;
  return { ...(name ? { name } : {}), ...(number ? { number } : {}) };
}

export function callerOfInteraction(interaction: Interaction, cards: readonly NavCard[]): CallerLabel {
  const card = cards.find((c) => c.threads.some((t) => t.providerInteractionId === interaction.id));
  if (card) {
    const thread = card.threads.find((t) => t.providerInteractionId === interaction.id);
    return callerOfCard(card, thread?.id);
  }
  const number = interaction.address?.label ?? interaction.address?.value;
  const name = interaction.contactName && interaction.contactName !== interaction.address?.value ? interaction.contactName : undefined;
  return { ...(name ? { name } : {}), ...(number ? { number } : {}) };
}

/** "Declined call from Tom Lewis (312) 555-0187" — the name when known, the
 *  number otherwise (or both). */
export function declinedCallMessage({ name, number }: CallerLabel): string {
  return `Declined call from ${[name, number].filter(Boolean).join(" ") || "an unknown caller"}`;
}

export { normalizePhone } from "@/domain";
