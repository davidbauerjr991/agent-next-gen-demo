import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import type { CustomerAddresses } from "./already-open";
import { isKnownAddress, linkedAddresses } from "./contact-methods";

interface PendingOffer {
  /** Whose contact methods it joins: the directory entity, else the card (P-EXTRACT, Bug 3). */
  ownerId?: string;
  customerName: string;
  channel: ChannelType;
  address: string;
  /** Offered on a card with no directory entity: the card it was added to. */
  cardId?: string;
}

const phoneDigits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/** New address → offer to save it (P-AIFIRST (k8) 8). `onPlaced` (pass it
 *  to `useOutboundDial`) notes a launch to a directory customer on an
 *  address that isn't on their record (a "Custom" address); once its thread
 *  is on a card, an AI card asking to add it to the customer's contact
 *  methods joins that thread's messages (`SaveAddressCard`), so it shows in
 *  the AI feed in every display mode. A page overlay row, like Copilot's.
 *
 *  A card with no directory entity (a scripted case like Maya, an ad-hoc
 *  contact) gets the offer too when a second address is added to it: the
 *  address is kept for the card (its owner id is the card's), and a card
 *  that isn't a known customer also offers Link to existing customer
 *  (P-EXTRACT, Bug 3). */
export function useSaveAddressOffers({
  cards,
  setCards,
  findCustomer,
}: {
  cards: readonly NavCard[];
  setCards: (update: (prev: NavCard[]) => NavCard[]) => void;
  findCustomer: (entityId: string) => CustomerAddresses | undefined;
}) {
  const pending = useRef(new Map<string, PendingOffer>());
  const [queued, setQueued] = useState(0);

  const onPlaced = useCallback(
    (id: string, target: { channel: ChannelType; address: string; entityId?: string; contactName?: string; card?: NavCard }) => {
      if (!target.address) return;
      if (target.entityId) {
        const record = findCustomer(target.entityId);
        if (!record || isKnownAddress(target.entityId, record, target.address)) return;
        pending.current.set(id, { ownerId: target.entityId, customerName: target.contactName ?? "this customer", channel: target.channel, address: target.address });
      } else if (target.card) {
        // Only a second address on an existing card: a first launch to a typed address is the contact itself.
        pending.current.set(id, { customerName: target.card.customerName ?? target.contactName ?? "this customer", channel: target.channel, address: target.address, cardId: target.card.id });
      } else {
        return;
      }
      setQueued((n) => n + 1);
    },
    [findCustomer],
  );

  useEffect(() => {
    for (const [id, offer] of pending.current) {
      const card = cards.find((c) => c.threads.some((t) => t.providerInteractionId === id));
      const thread = card?.threads.find((t) => t.providerInteractionId === id);
      if (!card || !thread) continue;
      pending.current.delete(id);
      const ownerId = offer.ownerId ?? card.id;
      if (!offer.ownerId) {
        // Already one of the card's own addresses (another thread on it, or one saved for it): nothing to offer.
        const target = offer.channel === "email" ? offer.address.trim().toLowerCase() : phoneDigits(offer.address);
        const known = [
          ...card.threads.filter((t) => t !== thread && t.type === "email" === (offer.channel === "email")).map((t) => t.value ?? t.addressLabel ?? ""),
          ...linkedAddresses(ownerId, offer.channel),
        ].some((a) => (offer.channel === "email" ? a.trim().toLowerCase() : phoneDigits(a)) === target);
        if (known || card.threads.length < 2) continue;
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
          customerName: offer.customerName,
          kind: offer.channel === "email" ? "email" : "phone",
          value: offer.address,
          ...(offer.ownerId || card.identity ? {} : { linkable: true }),
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
