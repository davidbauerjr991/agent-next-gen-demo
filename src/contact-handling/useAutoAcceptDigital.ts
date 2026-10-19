import { useEffect, useMemo, useRef } from "react";
import type { InteractionId, JourneyId } from "@/domain";
import { useInteractionProvider, useInteractions } from "@/provider-context";
import { AUTO_ACCEPT_CHANNELS, useSettings, useSetting } from "@/settings";

/** The digital channels whose offers ring like a call (an offer card with
 *  Accept / Decline): Settings → Assignments → Auto-accept turned off. */
export function useDigitalOfferChannels(): readonly string[] {
  const [autoAccept] = useSetting("assignments", "autoAccept");
  return useMemo(() => AUTO_ACCEPT_CHANNELS.filter((c) => !autoAccept[c]), [autoAccept]);
}

/** Settings → Channels' digital channels that are on (P-POLISH 1). An offer
 *  on any other channel — a demo seed in Phase 1 — waits unseen: it's
 *  neither a card nor auto-accepted, and turning its channel on shows it.
 *  A contact already accepted stays whatever the setting does later. */
export function useEnabledDigitalChannels(): readonly string[] {
  const [channels] = useSettings("channels");
  return useMemo(() => AUTO_ACCEPT_CHANNELS.filter((c) => channels[c]), [channels]);
}

/** Digital assignments load as cards (user, 2026-10-16): every non-voice
 *  offer (chat, email, SMS, WhatsApp, the demo seeds included) on a channel
 *  with Auto-accept on (Settings → Assignments, the default) is accepted as
 *  soon as it's offered, joining the customer's open card when there is one,
 *  as a notification click does. Only an inbound call rings for Accept /
 *  Decline. Each offer is accepted once; a failure (the offer withdrawn
 *  meanwhile) is only logged.
 *
 *  `onJoin` runs when an offer is about to join an open card (before the
 *  accept), and `onJoined` once it has: the page holds the card's main
 *  thread in place and activates the new contact "added". */
export function useAutoAcceptDigital(
  findOpenCard: (target: { entityId?: string; address?: string }) => { id: string } | undefined,
  hooks?: { onJoin?: (cardId: string) => void; onJoined?: (cardId: string, id: InteractionId, channel: string) => void },
) {
  const provider = useInteractionProvider();
  const interactions = useInteractions();
  const ringing = useDigitalOfferChannels();
  const enabled = useEnabledDigitalChannels();
  const accepted = useRef(new Set<string>());
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  useEffect(() => {
    for (const offer of interactions) {
      if (offer.state !== "offered" || offer.channel === "voice" || ringing.includes(offer.channel) || accepted.current.has(offer.id)) continue;
      // Its channel is off: it waits, and is accepted once the channel is on.
      if (!enabled.includes(offer.channel)) continue;
      accepted.current.add(offer.id);
      const openCard = findOpenCard({ entityId: offer.entityId, address: offer.address?.value });      if (openCard) hooksRef.current?.onJoin?.(openCard.id);
      provider
        .accept(offer.id, openCard ? { journeyId: openCard.id as JourneyId } : undefined)
        .then(() => {
          if (openCard) hooksRef.current?.onJoined?.(openCard.id, offer.id, offer.channel);
        })
        .catch((error) => {
          if (import.meta.env.DEV) console.warn("[assignments] auto-accept failed", error);
        });
    }
  }, [interactions, provider, findOpenCard, ringing, enabled]);
}
