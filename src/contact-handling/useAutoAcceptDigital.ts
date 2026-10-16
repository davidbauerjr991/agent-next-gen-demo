import { useEffect, useRef } from "react";
import type { JourneyId } from "@/domain";
import { useInteractionProvider, useInteractions } from "@/provider-context";

/** Digital assignments load as cards (user, 2026-10-16): every non-voice
 *  offer (chat, email, SMS, WhatsApp, the demo seeds included) is accepted as
 *  soon as it's offered, joining the customer's open card when there is one,
 *  as a notification click does. Only an inbound call rings for Accept /
 *  Decline. Each offer is accepted once; a failure (the offer withdrawn
 *  meanwhile) is only logged. */
export function useAutoAcceptDigital(findOpenCard: (target: { entityId?: string; address?: string }) => { id: string } | undefined) {
  const provider = useInteractionProvider();
  const interactions = useInteractions();
  const accepted = useRef(new Set<string>());
  useEffect(() => {
    for (const offer of interactions) {
      if (offer.state !== "offered" || offer.channel === "voice" || accepted.current.has(offer.id)) continue;
      accepted.current.add(offer.id);
      const openCard = findOpenCard({ entityId: offer.entityId, address: offer.address?.value });
      provider.accept(offer.id, openCard ? { journeyId: openCard.id as JourneyId } : undefined).catch((error) => {
        if (import.meta.env.DEV) console.warn("[assignments] auto-accept failed", error);
      });
    }
  }, [interactions, provider, findOpenCard]);
}
