import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { linkedAddresses } from "./contact-methods";
import { contactMethodsOwnerOf, isCardContactMethod, type CardContactMethods } from "./card-contact-methods";

interface PendingOffer {
  contactName?: string;
  channel: ChannelType;
  address: string;
}

const phoneDigits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/** New address → offer to save it (P-AIFIRST (k8) 8). `onPlaced` (pass it
 *  to `useOutboundDial`) notes an agent launch onto a customer or a card;
 *  once its thread is on a card, an AI card asking to add the address to the
 *  customer's contact methods joins that thread's messages
 *  (`SaveAddressCard`), so it shows in the AI feed in every display mode. A
 *  page overlay row, like Copilot's.
 *
 *  The trigger is the card, not the entry path (E2): a known card (a
 *  directory, created, history or scripted customer) gets the offer for any
 *  address that isn't among its contact methods (`cardContactMethods`, what
 *  Contact Details shows plus added ones), whether it came from the picker's
 *  Custom or the ad-hoc box. A card with no identity gets it when a second
 *  address is added to it, with Link to existing customer too (P-EXTRACT,
 *  Bug 3). The address is kept for the entity, else the card. */
export function useSaveAddressOffers({
  cards,
  setCards,
  contactMethodsOf,
}: {
  cards: readonly NavCard[];
  setCards: (update: (prev: NavCard[]) => NavCard[]) => void;
  /** The card's contact methods, and whether it's a known customer. */
  contactMethodsOf: (card: NavCard) => { known: boolean; methods: CardContactMethods };
}) {
  const pending = useRef(new Map<string, PendingOffer>());
  const [queued, setQueued] = useState(0);
  const methodsOf = useRef(contactMethodsOf);
  methodsOf.current = contactMethodsOf;

  const onPlaced = useCallback(
    (id: string, target: { channel: ChannelType; address: string; entityId?: string; contactName?: string; card?: NavCard }) => {
      // A launch with neither a customer nor a card (a typed address from New Outbound) is a new contact itself.
      if (!target.address || (!target.entityId && !target.card)) return;
      pending.current.set(id, { contactName: target.contactName, channel: target.channel, address: target.address });
      setQueued((n) => n + 1);
    },
    [],
  );

  useEffect(() => {
    for (const [id, offer] of pending.current) {
      const card = cards.find((c) => c.threads.some((t) => t.providerInteractionId === id));
      const thread = card?.threads.find((t) => t.providerInteractionId === id);
      if (!card || !thread) continue;
      pending.current.delete(id);
      const ownerId = contactMethodsOwnerOf(card);
      // Its contact methods without the new thread, so the address it was opened on doesn't count as known.
      const { known, methods } = methodsOf.current({ ...card, threads: card.threads.filter((t) => t !== thread) });
      if (known) {
        if (isCardContactMethod(methods, offer.channel, offer.address)) continue;
      } else {
        // No identity: only a second address on the card, and not one of its own (another thread's, or saved).
        const target = offer.channel === "email" ? offer.address.trim().toLowerCase() : phoneDigits(offer.address);
        const own = [
          ...card.threads.filter((t) => t !== thread && t.type === "email" === (offer.channel === "email")).map((t) => t.value ?? t.addressLabel ?? ""),
          ...linkedAddresses(ownerId, offer.channel),
        ].some((a) => (offer.channel === "email" ? a.trim().toLowerCase() : phoneDigits(a)) === target);
        if (own || card.threads.length < 2) continue;
      }
      const key = thread.id ?? thread.type;
      const message: TranscriptMessage = {
        id: `save-address-${id}`,
        sender: "agent",
        name: "Copilot",
        initials: "AI",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        text: "",
        saveAddress: {
          ownerId,
          customerName: card.customerName ?? offer.contactName ?? "this customer",
          kind: offer.channel === "email" ? "email" : "phone",
          value: offer.address,
          ...(known ? {} : { linkable: true }),
        },
      };
      setCards((prev) =>
        prev.map((c) =>
          c.id === card.id ? { ...c, liveMessages: { ...c.liveMessages, [key]: [...(c.liveMessages?.[key] ?? []), message] } } : c,
        ),
      );
    }
  }, [cards, queued, setCards]);

  return onPlaced;
}
