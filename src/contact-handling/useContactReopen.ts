import { useCallback } from "react";
import type { AgentNotification, ChannelType } from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { threadKey, type NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { ChannelKind, Direction, EntityId, InteractionId, JourneyId } from "@/domain";
import type { ReopenRequest } from "@/providers";
import { useInteractionProvider, useInteractions } from "@/provider-context";
import { getCaseRecord } from "@/components/agent-next-gen-case-database";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { NOTIFICATION_CHANNEL, NOTIFICATION_ENTITY_ID, NOTIFICATION_INTERACTION_ID } from "@/components/agent-next-gen-interaction-dashboard";
import type { InteractionHistoryRecord } from "@/components/agent-next-gen-interactions-table";
import { synthesizeChannelAddress } from "@/components/agent-next-gen-shared-utils";
import { historyEntityId, knownOrSynthesizedAddress } from "./contact-identity";
import type { ActivationMode } from "./useContactActivation";
import type { CardOverlay } from "./nav-card-overlay";
import { useTouchThread } from "./touched-threads";

// Contacts that come back rather than get dialed (P0.5b.2): Contact History
// reopen (row 18), the Search row, and opening an assignment notification.
// All go through the provider; the card appears when the contact reaches the
// store.

export interface UseContactReopenOptions {
  findOpenCard: (target: { entityId?: string; address?: string }) => NavCard | undefined;
  activateWhenReady: (id: InteractionId, mode: ActivationMode, isNewCard: boolean, overlay?: CardOverlay) => void;
  /** Skill id for a stored skill name (`useOutboundSkills().idForName`). */
  skillIdForName: (name: string | undefined) => string | undefined;
}

export function useContactReopen({ findOpenCard, activateWhenReady, skillIdForName }: UseContactReopenOptions) {
  const provider = useInteractionProvider();
  const interactions = useInteractions();
  const touchThread = useTouchThread();

  const reopen = useCallback(
    async (request: ReopenRequest) => {
      try {
        return await provider.reopen(request);
      } catch (error) {
        if (import.meta.env.DEV) console.warn("[reopen] failed", error);
        return undefined;
      }
    },
    [provider],
  );

  /** Contact History reopen (row 18): fresh timers and awaiting state, the
   *  clicked channel selected. A case with a stored record comes back thread
   *  by thread, its live messages restored; otherwise the row's own channel
   *  reopens, at the row's status. */
  const reopenHistoryEntry = useCallback(
    async (entry: ContactHistoryEntry) => {
      const entityId = historyEntityId(entry);
      const card = findOpenCard({ entityId });
      const stored = card ? undefined : getCaseRecord(entry.caseId);

      if (stored && stored.threads.length > 0) {
        const clicked = stored.threads.find((t) => t.type === entry.channelType) ?? stored.threads[stored.threads.length - 1];
        const liveMessages: NonNullable<CardOverlay["liveMessages"]> = {};
        for (const t of stored.threads) {
          const messages = stored.liveMessages?.[t.id];
          if (messages?.length) liveMessages[t.value ? `${t.type}:${t.value}` : t.type] = messages;
        }
        // Sequential: the first reopen starts the journey with this case id;
        // the rest join it by case id.
        for (const t of stored.threads) {
          const id = await reopen({
            channel: t.type as ChannelKind,
            direction: (t.direction ?? entry.direction ?? "inbound") as Direction,
            ...(t.value ? { address: t.value, addressLabel: t.addressLabel ?? t.value } : {}),
            entityId: entityId as EntityId,
            contactName: stored.customerName ?? entry.name,
            caseId: entry.caseId,
            skillId: skillIdForName(t.preview),
            caseStatus: stored.threadStatuses?.[t.id],
          });
          if (!id) return;
          const isClicked = t === clicked;
          activateWhenReady(
            id,
            isClicked ? "focus" : "none",
            true,
            isClicked && Object.keys(liveMessages).length > 0 ? { liveMessages } : undefined,
          );
        }
        return;
      }

      // A thread of this channel already on the open card is the one being
      // reopened (it folds in, earlier messages dimmed); otherwise the row's
      // own address.
      const sameChannel = card?.threads.find((t) => t.type === entry.channelType);
      const address = sameChannel ? sameChannel.value : knownOrSynthesizedAddress(entry, entry.channelType);
      const id = await reopen({
        channel: entry.channelType as ChannelKind,
        direction: (sameChannel?.direction ?? entry.direction ?? "inbound") as Direction,
        ...(address ? { address, addressLabel: sameChannel?.addressLabel ?? address } : {}),
        entityId: entityId as EntityId,
        contactName: entry.name,
        caseId: entry.caseId,
        caseStatus: entry.statusLabel,
        ...(card ? { journeyId: card.id as JourneyId } : {}),
      });
      if (id) activateWhenReady(id, "focus", !card);
    },
    [findOpenCard, reopen, activateWhenReady, skillIdForName],
  );

  /** A Search/Interactions row (the "Takeover Assignment"/Redial footer). */
  const reopenSearchRow = useCallback(
    async (record: InteractionHistoryRecord) => {
      const customer = CREATE_NEW_CUSTOMERS.find((c) => c.customerId === record.caseId) ?? CREATE_NEW_CUSTOMERS[0];
      const card = findOpenCard({ entityId: customer.id });
      const address = synthesizeChannelAddress(record.type, record.caseId, record.customerName);
      const id = await reopen({
        channel: record.type as ChannelKind,
        direction: record.direction as Direction,
        address,
        addressLabel: address,
        entityId: customer.id as EntityId,
        contactName: record.customerName,
        caseId: record.caseId,
        skillId: skillIdForName(record.skill),
        ...(card ? { journeyId: card.id as JourneyId } : {}),
      });
      if (id) activateWhenReady(id, "focus", !card);
    },
    [findOpenCard, reopen, activateWhenReady, skillIdForName],
  );

  /** An assignment notification: accept the waiting offer, switch to it if
   *  it's already live, or reopen it if it was dismissed. Resolves true when
   *  a new card is on its way (the page may expand the nav for it). */
  const openNotification = useCallback(
    async (notification: AgentNotification): Promise<boolean> => {
      const customerIdx = Number(notification.id) % CREATE_NEW_CUSTOMERS.length;
      const customer = CREATE_NEW_CUSTOMERS[Number.isFinite(customerIdx) ? customerIdx : 0];
      const channel = (NOTIFICATION_CHANNEL[notification.id] ?? "email") as ChannelType;
      const seedId = NOTIFICATION_INTERACTION_ID[notification.id];
      const seed = seedId ? interactions.find((i) => i.id === seedId) : undefined;

      // A customer who already has a card open gets the notification's
      // channel on that card, as before P0.5b.2 (accept or reopen into its
      // journey), not a second card.
      // A seeded assignment is its own pseudo-entity, never another customer's record (k5 F).
      const entityId = seed?.entityId ?? NOTIFICATION_ENTITY_ID[notification.id] ?? customer.id;
      const openCard = findOpenCard({ entityId });

      // Opening it from its notification is the agent opening the thread (touched-threads.ts).
      if (seed && seed.state !== "ended") touchThread(openCard?.id ?? seed.journeyId, threadKey(seed));
      if (seed?.state === "offered") {
        try {
          await provider.accept(seed.id, openCard ? { journeyId: openCard.id as JourneyId } : undefined);
          activateWhenReady(seed.id, "focus", !openCard);
          return !openCard;
        } catch (error) {
          if (import.meta.env.DEV) console.warn("[notification] accept failed", error);
          return false;
        }
      }
      if (seed && seed.state !== "ended") {
        activateWhenReady(seed.id, "focus", false);
        return false;
      }
      const id = await reopen({
        channel: channel as ChannelKind,
        direction: "inbound",
        entityId: entityId as EntityId,
        contactName: seed?.contactName ?? notification.subtitle,
        ...(openCard ? { journeyId: openCard.id as JourneyId } : seed?.caseId ? { caseId: seed.caseId } : {}),
      });
      if (id) activateWhenReady(id, "focus", !openCard);
      return !!id && !openCard;
    },
    [interactions, provider, reopen, activateWhenReady, findOpenCard, touchThread],
  );

  return { reopenHistoryEntry, reopenSearchRow, openNotification };
}
