import type { ReactNode } from "react";
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { Interaction as DomainInteraction } from "@/domain";
import { AddChannelAdHocButton, type AddChannelAdHocButtonProps } from "@/components/agent-next-gen-add-channel-button";
import { onCallReasons } from "./already-open";

/** The nav card's "+" (add channel), shared by both pages: on every open
 *  card from the start, like the record header's "+". A directory customer
 *  gets lyra's picker (`getHeaderAction`, which knows the customer's
 *  channels and what's already open); any other card (an unknown caller, a
 *  typed number) gets the ad-hoc "+", bound to that card, not the active
 *  one. None on a ringing offer or a card whose contacts have all ended. */
export function navCardAddChannelAction(
  card: NavCard,
  options: {
    getHeaderAction: (entityId: string) => ReactNode;
    /** A card the directory picker doesn't cover: the picker over its contact methods when it's a known
     *  customer, or over the addresses saved for it (`useCardOwnAddChannel`); `null` for the ad-hoc "+". */
    getCardAction?: (card: NavCard) => ReactNode;
    onAddAdHocChannel: (card: NavCard, query: string, channel: ChannelType, skillId: string) => void;
    skillOptions: AddChannelAdHocButtonProps["skillOptions"];
    /** The card's provider contacts: Voice is disabled while it has a call (one call per customer, k8 6). */
    contacts?: readonly DomainInteraction[];
  },
): ReactNode {
  if (card.offered || card.closed) return null;
  return (
    // The directory picker; else the card's own (a known card's contact methods, or saved addresses); else ad-hoc.
    (card.entityId ? options.getHeaderAction(card.entityId) : null) ?? options.getCardAction?.(card) ?? (
      <AddChannelAdHocButton
        onLaunch={(query, channel, skillId) => options.onAddAdHocChannel(card, query, channel, skillId)}
        skillOptions={options.skillOptions}
        channelDisabledReasons={onCallReasons(options.contacts ?? [], { journeyId: card.id })}
        // Shrinks the ad-hoc trigger's solid "icon-md" look to the picker's
        // plain ghost h-6 "+", so both read as the same control.
        className="h-6 w-6 px-0 bg-transparent text-lyra-fg-secondary hover:bg-lyra-state-hover active:bg-lyra-state-pressed"
      />
    )
  );
}
