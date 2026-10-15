import { useCallback } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { InteractionId, JourneyId } from "@/domain";
import { useCapability, useInteractionProvider } from "@/provider-context";
import type { ActivationMode } from "./useContactActivation";
import type { NavCards } from "./useNavCards";

// Accept/Decline on a ringing voice offer (P0.5d.1), shared by both pages.
// Accept joins the customer's open card if they have one (as notifications
// do) and activates the call once the store shows it live; a voice accept
// follows the provider's one-active-call rule (the current call is held).
// Decline confirms with a toast once the provider has declined it.

export function useIncomingOffer(options: {
  findOpenCard: NavCards["findOpenCard"];
  activateWhenReady: (id: InteractionId, mode: ActivationMode, isNewCard: boolean) => void;
  /** The offer was declined (the page names the caller and logs the row). */
  onDeclined: (offer: NavCard) => void;
}) {
  const provider = useInteractionProvider();
  const canDecline = useCapability((c) => c.interaction.decline);
  const { findOpenCard, activateWhenReady, onDeclined } = options;

  const accept = useCallback(
    async (offer: NavCard) => {
      const target = offer.threads[0]?.providerInteractionId;
      if (!target) return;
      const openCard = offer.entityId ? findOpenCard({ entityId: offer.entityId }) : undefined;
      try {
        await provider.accept(target, openCard ? { journeyId: openCard.id as JourneyId } : undefined);
        activateWhenReady(target, "focus", !openCard);
      } catch (error) {
        if (import.meta.env.DEV) console.warn("[contact] accept failed", error);
      }
    },
    [provider, findOpenCard, activateWhenReady],
  );

  const decline = useCallback(
    async (offer: NavCard) => {
      const target = offer.threads[0]?.providerInteractionId;
      if (!target) return;
      try {
        await provider.decline(target);
        onDeclined(offer);
      } catch (error) {
        if (import.meta.env.DEV) console.warn("[contact] decline failed", error);
      }
    },
    [provider, onDeclined],
  );

  return { accept, decline, canDecline };
}
