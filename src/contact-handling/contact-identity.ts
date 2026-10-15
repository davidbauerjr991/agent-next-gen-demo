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

export { normalizePhone } from "@/domain";
