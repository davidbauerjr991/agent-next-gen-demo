import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import type { CustomerAddresses } from "./already-open";
import { isKnownAddress } from "./contact-methods";

interface PendingOffer {
  entityId: string;
  customerName: string;
  channel: ChannelType;
  address: string;
}

/** New address → offer to save it (P-AIFIRST (k8) 8). `onPlaced` (pass it
 *  to `useOutboundDial`) notes a launch to a directory customer on an
 *  address that isn't on their record (a "Custom" address); once its thread
 *  is on a card, an AI card asking to add it to the customer's contact
 *  methods joins that thread's messages (`SaveAddressCard`), so it shows in
 *  the AI feed in every display mode. A page overlay row, like Copilot's. */
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
    (id: string, target: { channel: ChannelType; address: string; entityId?: string; contactName?: string }) => {
      if (!target.entityId || !target.address) return;
      const record = findCustomer(target.entityId);
      if (!record || isKnownAddress(target.entityId, record, target.address)) return;
      pending.current.set(id, { entityId: target.entityId, customerName: target.contactName ?? "this customer", channel: target.channel, address: target.address });
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
      const key = thread.id ?? thread.type;
      const message: TranscriptMessage = {
        id: `save-address-${id}`,
        sender: "agent",
        name: "Copilot",
        initials: "AI",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        text: "",
        saveAddress: {
          entityId: offer.entityId,
          customerName: offer.customerName,
          kind: offer.channel === "email" ? "email" : "phone",
          value: offer.address,
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
