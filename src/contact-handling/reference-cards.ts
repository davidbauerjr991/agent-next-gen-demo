import { useEffect, useMemo, useState } from "react";
import type { InteractionId } from "@/domain";
import type { ReferenceCardFocus } from "@/providers";
import { useContactAssistCards, useInteraction } from "@/provider-context";
import { journeySummaryFor } from "./journey-summary";
import { useWorkspaceUiField } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

/** How long a contact's Journey Summary reads "Looking up" after it arrives. */
export const JOURNEY_LOOKUP_MS = 800;

/** The reference column's cards in order (P-CANVAS); the column is a single-open accordion over them. */
export const REFERENCE_CARD_ORDER: readonly ReferenceCardFocus[] = ["summary", "journey", "customer"];

/** Which reference card is open on the active card (the Real-Time Summary
 *  until something else is opened), and the setter each card's header uses:
 *  opening one closes the others; closing the open one leaves none open. */
export function useReferenceAccordion(id: ReferenceCardFocus) {
  const { activeInteraction } = useWorkspace();
  const [openByCard, setOpenByCard] = useWorkspaceUiField("referenceOpenByCard");
  const cardId = activeInteraction?.id;
  const openId = cardId && cardId in openByCard ? openByCard[cardId] : "summary";
  return {
    open: openId === id,
    onOpenChange: (open: boolean) => {
      if (!cardId) return;
      setOpenByCard((prev) => {
        const current = cardId in prev ? prev[cardId] : "summary";
        const next = open ? id : current === id ? null : current;
        return next === current ? prev : { ...prev, [cardId]: next };
      });
    },
  };
}

/** The active thread's contact and its Real-Time Summary card. */
export function useActiveContactSummary() {
  const { activeChannel } = useWorkspace();
  return useContactAssistCards(activeChannel?.providerInteractionId).summary;
}

/** The active card's journey (its script's, else its Contact History) and
 *  whether the lookup is still "running" (the contact's first moments). */
export function useActiveJourney() {
  const { activeChannel, activeInteraction, scenarioCases, scenarioKeyOf } = useWorkspace();
  const contact = useInteraction(activeChannel?.providerInteractionId as InteractionId | undefined);
  const key = activeInteraction ? scenarioKeyOf(activeInteraction.id) : undefined;
  const script = key ? scenarioCases.byKey[key]?.script : undefined;
  const journey = useMemo(
    () => journeySummaryFor({ script, customerName: activeInteraction?.customerName, customerId: activeInteraction?.customerId }),
    [script, activeInteraction?.customerName, activeInteraction?.customerId],
  );
  const arrivedAt = contact ? (contact.acceptedAt ?? contact.startedAt) : undefined;
  const [now, setNow] = useState(() => Date.now());
  const remaining = arrivedAt !== undefined ? arrivedAt + JOURNEY_LOOKUP_MS - now : 0;
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), remaining);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  return { journey, lookingUp: remaining > 0 };
}
