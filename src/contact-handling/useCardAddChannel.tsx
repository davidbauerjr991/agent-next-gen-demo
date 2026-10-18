import { useCallback, useMemo, type ReactNode } from "react";
import { AddChannelButton, type ChannelType, type CreateNewOutboundConfig, type CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { useInteractions } from "@/provider-context";
import { alreadyOpenReasons, customerChannelAddresses, liveAddressesFor, onCallReasons, unusedAddresses, type CustomerAddresses } from "./already-open";
import { linkedAddresses, useContactMethodsVersion, withLinkedContactMethods } from "./contact-methods";

export interface UseCardAddChannelOptions {
  /** New Outbound's config: its groups (the contacts a card can be), channel options, skills, presence reasons. */
  outboundConfig: Pick<CreateNewOutboundConfig, "groups" | "channelOptions" | "phoneOptions" | "skillOptions" | "onStartCall" | "channelDisabledReasons">;
  /** The directory record behind a card's entity (its phones and email). */
  findCustomer: (entityId: string) => CustomerAddresses | undefined;
}

/** A card's "+" picker (P-AIFIRST (k6) 1, 2): lyra's `AddChannelButton`
 *  for the card's contact, `useAddChannelButton`'s `getHeaderAction` shape,
 *  plus what that hook can't know per card: a channel whose every address of
 *  the customer's already has a live thread is disabled "Already open", and
 *  the phone list is the customer's own numbers, so a second thread opens on
 *  an unused one. Voice is disabled "Already on a call" while the customer
 *  has a ringing, live or held call (k8 6). The nav card's "+" and the
 *  record header's are this one control. */
export function useCardAddChannel({ outboundConfig, findCustomer }: UseCardAddChannelOptions) {
  const contacts = useInteractions();
  const linkedVersion = useContactMethodsVersion();
  const contactsById = useMemo(
    () => new Map(outboundConfig.groups.flatMap((g) => g.contacts ?? []).map((c) => [c.id, c])),
    [outboundConfig],
  );
  const getHeaderAction = useCallback(
    (
      entityId: string,
      className?: string,
      options?: { label?: string; showLabel?: boolean; icon?: ReactNode; initialChannel?: ChannelType },
    ): ReactNode => {
      const contact = contactsById.get(entityId);
      if (!contact) return null;
      // The record plus any address the agent added to it (k8 8).
      const record = withLinkedContactMethods(entityId, findCustomer(entityId));
      const phones = customerChannelAddresses(record, "sms");
      const live = liveAddressesFor(contacts, entityId);
      // The customer's own numbers, in their spelling, with the live ones
      // marked open per channel: lyra then offers (and defaults to) an unused
      // one, never the outbound contact's synthesized number.
      const cardContact =
        phones.length === 0
          ? contact
          : {
              ...contact,
              primaryPhone: undefined,
              openChannelAddresses: {
                ...contact.openChannelAddresses,
                ...Object.fromEntries(
                  (Object.keys(live) as ChannelType[])
                    .filter((ch) => ch !== "email")
                    .map((ch) => [ch, phones.filter((p) => !unusedAddresses(record, ch, live).includes(p))]),
                ),
              },
            };
      return (
        <AddChannelButton
          contact={cardContact}
          channelOptions={outboundConfig.channelOptions.filter((c) => contact.channels.includes(c.id))}
          phoneOptions={phones.length > 0 ? phones.map((value) => ({ value, label: value })) : outboundConfig.phoneOptions ?? []}
          skillOptions={outboundConfig.skillOptions ?? []}
          onStartCall={(selection) => outboundConfig.onStartCall?.(selection)}
          className={className}
          label={options?.label}
          showLabel={options?.showLabel}
          icon={options?.icon}
          initialChannel={options?.initialChannel}
          channelDisabledReasons={{
            ...alreadyOpenReasons(record, live),
            ...onCallReasons(contacts, { entityId }),
            ...outboundConfig.channelDisabledReasons,
          }}
        />
      );
    },
    // `linkedVersion`: an added address re-renders the pickers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contactsById, outboundConfig, findCustomer, contacts, linkedVersion],
  );
  return getHeaderAction;
}

/** The "+" for a card with no directory entity once an address was saved
 *  for it (P-EXTRACT, Bug 3): the channel picker over the card's own
 *  addresses (the saved ones first, then its threads'), launching onto the
 *  card like the ad-hoc "+" does. `null` while nothing is saved for the
 *  card: the ad-hoc "+" (a typed address) stays. */
export function useCardOwnAddChannel({
  outboundConfig,
  onAddToCard,
}: {
  outboundConfig: Pick<CreateNewOutboundConfig, "channelOptions" | "skillOptions" | "channelDisabledReasons">;
  onAddToCard: (card: NavCard, address: string, channel: ChannelType, skillId: string) => void;
}) {
  const contacts = useInteractions();
  const linkedVersion = useContactMethodsVersion();
  return useCallback(
    (card: NavCard, className?: string): ReactNode => {
      const savedPhones = linkedAddresses(card.id, "sms");
      const savedEmails = linkedAddresses(card.id, "email");
      if (savedPhones.length === 0 && savedEmails.length === 0) return null;
      const threadPhones = card.threads.filter((t) => t.type !== "email").map((t) => t.value ?? t.addressLabel ?? "").filter(Boolean);
      const phones = [...new Set([...savedPhones, ...threadPhones])];
      const email = savedEmails[0] ?? card.threads.find((t) => t.type === "email")?.value;
      const channels: ChannelType[] = [...(phones.length ? (["voice", "sms", "whatsapp"] as ChannelType[]) : []), ...(email ? (["email"] as ChannelType[]) : [])];
      const name = card.customerName ?? phones[0] ?? email ?? "";
      const contact: CreateNewOutboundContact = { id: `card:${card.id}`, name, initials: initialsFor(name), channels, ...(email ? { email } : {}) };
      return (
        <AddChannelButton
          contact={contact}
          channelOptions={outboundConfig.channelOptions.filter((c) => channels.includes(c.id))}
          phoneOptions={phones.map((value) => ({ value, label: value }))}
          skillOptions={outboundConfig.skillOptions ?? []}
          onStartCall={({ channel, phone, skillId }) => onAddToCard(card, channel === "email" ? email ?? phone : phone, channel, skillId)}
          className={className}
          channelDisabledReasons={{ ...onCallReasons(contacts, { journeyId: card.id }), ...outboundConfig.channelDisabledReasons }}
        />
      );
    },
    // `linkedVersion`: a saved address re-renders the picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outboundConfig, onAddToCard, contacts, linkedVersion],
  );
}
