import { useCallback, useMemo, type ReactNode } from "react";
import { AddChannelButton, type ChannelType, type CreateNewOutboundConfig } from "@nicecxone/lyra-ui";
import { useInteractions } from "@/provider-context";
import { alreadyOpenReasons, customerChannelAddresses, liveAddressesFor, unusedAddresses, type CustomerAddresses } from "./already-open";

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
 *  an unused one. The nav card's "+" and the record header's are this one
 *  control. */
export function useCardAddChannel({ outboundConfig, findCustomer }: UseCardAddChannelOptions) {
  const contacts = useInteractions();
  const contactsById = useMemo(
    () => new Map(outboundConfig.groups.flatMap((g) => g.contacts ?? []).map((c) => [c.id, c])),
    [outboundConfig],
  );
  return useCallback(
    (
      entityId: string,
      className?: string,
      options?: { label?: string; showLabel?: boolean; icon?: ReactNode; initialChannel?: ChannelType },
    ): ReactNode => {
      const contact = contactsById.get(entityId);
      if (!contact) return null;
      const record = findCustomer(entityId);
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
          channelDisabledReasons={{ ...alreadyOpenReasons(record, live), ...outboundConfig.channelDisabledReasons }}
        />
      );
    },
    [contactsById, outboundConfig, findCustomer, contacts],
  );
}
