import type { ReactNode } from "react";
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { AddChannelAdHocButton, type AddChannelAdHocButtonProps } from "@/components/agent-next-gen-add-channel-button";

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
    onAddAdHocChannel: (card: NavCard, query: string, channel: ChannelType, skillId: string) => void;
    skillOptions: AddChannelAdHocButtonProps["skillOptions"];
  },
): ReactNode {
  if (card.offered || card.closed) return null;
  return (
    (card.entityId ? options.getHeaderAction(card.entityId) : null) ?? (
      <AddChannelAdHocButton
        onLaunch={(query, channel, skillId) => options.onAddAdHocChannel(card, query, channel, skillId)}
        skillOptions={options.skillOptions}
        // Shrinks the ad-hoc trigger's solid "icon-md" look to the picker's
        // plain ghost h-6 "+", so both read as the same control.
        className="h-6 w-6 px-0 bg-transparent text-lyra-fg-secondary hover:bg-lyra-state-hover active:bg-lyra-state-pressed"
      />
    )
  );
}
