import type { ChannelType } from "@nicecxone/lyra-ui";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { synthesizeChannelAddress } from "@/components/agent-next-gen-shared-utils";
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

/** `useNavCards`' `displayName`: the directory name for a contact linked to a
 *  record after it started (Link/Create customer, via `associateEntity`),
 *  whose `contactName` is still the raw address it presented. A contact that
 *  presented a real name keeps it — e.g. the notification seeds, whose names
 *  differ from their linked records (a kept quirk, PLAN.md P0.5b.1). */
export function directoryDisplayName(findRecord: (entityId: string) => { name: string } | undefined) {
  return (interaction: Interaction): string | undefined => {
    if (!interaction.entityId) return undefined;
    const presentedName = interaction.contactName && interaction.contactName !== interaction.address?.value;
    if (presentedName) return undefined;
    return findRecord(interaction.entityId)?.name;
  };
}

/** Digits only, without a leading US country code. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
