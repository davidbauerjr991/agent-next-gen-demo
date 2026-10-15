import { useCallback, useState } from "react";
import type { ChannelType, CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import type { CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { threadKey, type NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { ChannelKind, EntityId, InteractionId, JourneyId } from "@/domain";
import type { DialRequest } from "@/providers";
import { isProviderError } from "@/adapters/provider-error";
import { useAgentState, useInteractionProvider, useInteractions, useProviders } from "@/provider-context";
import { OUTBOUND_CONFIG } from "@/components/agent-next-gen-outbound-data";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { knownOrSynthesizedAddress, normalizePhone, historyEntityId } from "./contact-identity";
import type { ActivationMode } from "./useContactActivation";

// Every outbound launch on both workspace pages (P0.5b.2): New Outbound, Quick
// Dial, Redial (Contact History), redial from the active card, the dial pad
// with row-16 matching, the ad-hoc "+", and Save & Redial. Each builds one
// `DialRequest`; the card appears when the provider's contact reaches the
// store (useContactActivation), never optimistically.

export interface DialpadRequest {
  phoneNumber: string;
  anchorEl?: HTMLElement | null;
  customerName?: string;
  phoneOptions?: { value: string; label: string }[];
}

export interface UseOutboundDialOptions {
  /** `useNavCards().findOpenCard`. */
  findOpenCard: (target: { entityId?: string; address?: string }) => NavCard | undefined;
  /** Directory lookup by entity id (built-in plus agent-created customers). */
  findCustomer: (entityId: string) => CreateNewCustomerRecord | undefined;
  activateWhenReady: (id: InteractionId, mode: ActivationMode, isNewCard: boolean) => void;
  /** A voice dial was refused because the agent leg isn't connected. */
  onLegDisconnected: () => void;
  /** A Contact History redial was placed (the page may close that row's
   *  panel). */
  onRedial?: (entry: ContactHistoryEntry) => void;
  /** What a voice launch does while the agent is already on a call — a
   *  per-page rule (parity rows 14/15, a temporary exception): "refuse"
   *  (Advanced: one call at a time, on every path — New Outbound, Redial,
   *  Save & Redial, a voice "+") or "auto-hold" (Desk: the provider holds the
   *  first call when the second connects). */
  secondVoiceCall: "refuse" | "auto-hold";
  /** A voice launch was refused by `secondVoiceCall: "refuse"`. */
  onVoiceCallRefused?: () => void;
  /** A voice launch was refused because the agent is already on a live or
   *  held call with that customer (`isOnCallWith`). Only reachable where the
   *  UI can't disable the button first, e.g. a number typed into Quick Dial. */
  onAlreadyOnCall?: () => void;
  /** Save & Redial's new call was placed on `card`; the page completes the
   *  ended call's wrap-up now (not earlier), so the card never empties. */
  onCardRedialPlaced?: (card: NavCard) => void;
}

interface DialTarget {
  channel: ChannelType;
  address: string;
  addressLabel?: string;
  entityId?: string;
  contactName?: string;
  caseId?: string;
  skillId: string;
  /** The open card to add this contact to, if any. */
  card?: NavCard;
  mode: ActivationMode;
}

/** A voice contact the agent is on: ringing out, live, or held. */
const ON_CALL_STATES = new Set(["connecting", "active", "held"]);

/** The tooltip on a voice launch disabled by `isOnCallWith`. */
export const ALREADY_ON_CALL_TOOLTIP = "Already on a call with this customer";

/** Who a voice launch would call: the directory entity, if known, and the
 *  numbers it could dial. */
export interface CallTarget {
  entityId?: string;
  addresses?: readonly string[];
}

/** Whether `interactions` hold a ringing-out, live or held voice call with
 *  the target: the same entity, or (for a call without one) the same number.
 *  A call in wrap-up doesn't count, and neither do digital contacts. */
export function isOnCallWith(
  interactions: readonly { channel: string; state: string; entityId?: string; address?: { value: string } }[],
  target: CallTarget,
): boolean {
  const numbers = new Set((target.addresses ?? []).map(normalizePhone).filter((n) => n !== ""));
  return interactions.some(
    (i) =>
      i.channel === "voice" &&
      ON_CALL_STATES.has(i.state) &&
      ((!!target.entityId && i.entityId === target.entityId) || (!!i.address && numbers.has(normalizePhone(i.address.value)))),
  );
}

export function useOutboundDial({
  findOpenCard,
  findCustomer,
  activateWhenReady,
  onLegDisconnected,
  onRedial,
  secondVoiceCall,
  onVoiceCallRefused,
  onAlreadyOnCall,
  onCardRedialPlaced,
}: UseOutboundDialOptions) {
  const provider = useInteractionProvider();
  const interactions = useInteractions();
  const agentState = useAgentState();
  const outboundChannels = useProviders().capabilities.interaction.channels.outbound;

  const [dialpadRequest, setDialpadRequest] = useState<DialpadRequest | null>(null);
  const [redialEntry, setRedialEntry] = useState<ContactHistoryEntry | null>(null);
  const [redialActiveInteraction, setRedialActiveInteraction] = useState<{ interactionId: string; phoneNumber: string } | null>(null);

  /** True (and reports it) when this page refuses a second voice call and
   *  the agent is already on one. */
  const refuseVoice = useCallback(() => {
    if (secondVoiceCall !== "refuse") return false;
    const onCall =
      interactions.some((i) => i.channel === "voice" && ON_CALL_STATES.has(i.state) && !i.review);
    if (onCall) onVoiceCallRefused?.();
    return onCall;
  }, [secondVoiceCall, interactions, onVoiceCallRefused]);

  const place = useCallback(
    async (target: DialTarget) => {
      const channel = target.channel as ChannelKind;
      if (target.channel === "voice" && refuseVoice()) return false;
      // One call per customer, on every path (the buttons are disabled too;
      // this catches a number typed into Quick Dial).
      if (target.channel === "voice" && isOnCallWith(interactions, { entityId: target.entityId, addresses: [target.address] })) {
        onAlreadyOnCall?.();
        return false;
      }
      if (!outboundChannels.includes(channel)) {
        if (import.meta.env.DEV) console.warn(`[outbound] the provider can't dial out on ${channel}`);
        return false;
      }
      const key = `${target.channel}:${target.address}`;
      // A digital thread that's still live on this card restarts as a reopen,
      // which supersedes the old contact (one live contact per thread).
      // Voice always places a real call (ringing, the agent-leg rule).
      const liveSameThread =
        target.card && target.channel !== "voice"
          ? interactions.find(
              (i) => i.journeyId === target.card!.id && threadKey(i) === key && i.state !== "ended" && i.state !== "offered",
            )
          : undefined;
      try {
        let id: InteractionId;
        if (liveSameThread) {
          id = await provider.reopen({
            channel,
            direction: "outbound",
            address: target.address,
            addressLabel: target.addressLabel,
            entityId: target.entityId as EntityId | undefined,
            contactName: target.contactName,
            journeyId: target.card!.id as JourneyId,
            skillId: target.skillId,
          });
        } else {
          const request: DialRequest = {
            channel,
            address: target.address,
            skillId: target.skillId,
            ...(target.addressLabel !== undefined ? { addressLabel: target.addressLabel } : {}),
            ...(target.entityId ? { entityId: target.entityId as EntityId } : {}),
            ...(target.contactName ? { contactName: target.contactName } : {}),
            ...(target.caseId ? { caseId: target.caseId } : {}),
            ...(target.card ? { journeyId: target.card.id as JourneyId } : {}),
          };
          id = await provider.dial(request);
        }
        activateWhenReady(id, target.mode, !target.card);
        return true;
      } catch (error) {
        if (target.channel === "voice" && isProviderError(error) && error.code === "invalid-state" && agentState?.leg !== "connected") {
          onLegDisconnected();
          return false;
        }
        if (import.meta.env.DEV) console.warn("[outbound] dial failed", error);
        return false;
      }
    },
    [provider, interactions, agentState, outboundChannels, activateWhenReady, onLegDisconnected, refuseVoice, onAlreadyOnCall],
  );

  /** Whether Contact History's Redial is disabled for `entry`: the agent is
   *  already on a live or held call with that customer (any of their numbers). */
  const redialBlocked = useCallback(
    (entry: ContactHistoryEntry) => {
      const customer = entry.customerId ? findCustomer(entry.customerId) : undefined;
      const addresses = customer ? customer.phones.map((p) => p.value) : [knownOrSynthesizedAddress(entry, "voice")];
      return isOnCallWith(interactions, { entityId: historyEntityId(entry), addresses });
    },
    [interactions, findCustomer],
  );

  /** New Outbound's Start Interaction (and the record header's "+", which
   *  passes the card's own contact). */
  const startCall = useCallback(
    (selection: { contact: CreateNewOutboundContact; channel: ChannelType; phone: string; skillId: string }) => {
      const entityId = selection.contact.id.startsWith("adhoc:") ? undefined : selection.contact.id;
      const card = entityId ? findOpenCard({ entityId }) : findOpenCard({ address: selection.phone });
      void place({
        channel: selection.channel,
        address: selection.phone,
        addressLabel: OUTBOUND_CONFIG.phoneOptions.find((o) => o.value === selection.phone)?.label ?? selection.phone,
        entityId,
        contactName: selection.contact.name,
        caseId: selection.contact.subtitle,
        skillId: selection.skillId,
        card,
        mode: card ? "added" : "focus",
      });
    },
    [findOpenCard, place],
  );

  /** A number dialed with no contact record. */
  const quickDial = useCallback(
    (phoneNumber: string, skillId: string) => {
      const card = findOpenCard({ address: phoneNumber });
      void place({ channel: "voice", address: phoneNumber, addressLabel: phoneNumber, contactName: phoneNumber, skillId, card, mode: "focus" });
    },
    [findOpenCard, place],
  );

  /** Redial from a Contact History row. */
  const redial = useCallback(
    (entry: ContactHistoryEntry, skillId: string, phoneNumber?: string) => {
      const entityId = historyEntityId(entry);
      const address = phoneNumber ?? knownOrSynthesizedAddress(entry, "voice");
      const card = findOpenCard({ entityId });
      void place({
        channel: "voice",
        address,
        addressLabel: address,
        entityId,
        contactName: entry.name,
        caseId: entry.caseId,
        skillId,
        card,
        mode: "focus",
      });
      onRedial?.(entry);
    },
    [findOpenCard, place, onRedial],
  );

  /** Redial into an open card (Save & Redial, the card's own redial). */
  const redialCard = useCallback(
    (card: NavCard, phoneNumber: string, skillId: string) => {
      void place({
        channel: "voice",
        address: phoneNumber,
        addressLabel: phoneNumber,
        entityId: card.entityId,
        contactName: card.customerName,
        skillId,
        card,
        mode: "focus",
      }).then((placed) => {
        if (placed) onCardRedialPlaced?.(card);
      });
    },
    [place, onCardRedialPlaced],
  );

  /** The ad-hoc "+" (a typed address added to the active card). */
  const addAdHocChannel = useCallback(
    (card: NavCard, query: string, channel: ChannelType, skillId: string) => {
      void place({
        channel,
        address: query,
        addressLabel: query,
        entityId: card.entityId,
        contactName: card.customerName,
        skillId,
        card,
        mode: "added",
      });
    },
    [place],
  );

  /** Contact History's Redial button: opens the dial pad pre-filled with the
   *  customer's numbers (row 16). */
  const openRedialPad = useCallback(
    (entry: ContactHistoryEntry, anchorEl: HTMLElement | null) => {
      if (refuseVoice() || redialBlocked(entry)) return;
      setRedialEntry(entry);
      const customer = entry.customerId ? findCustomer(entry.customerId) : undefined;
      setDialpadRequest(
        customer
          ? {
              phoneNumber: customer.phones[0]?.value ?? customer.firstPhone,
              anchorEl,
              customerName: customer.name,
              phoneOptions: customer.phones,
            }
          : { phoneNumber: knownOrSynthesizedAddress(entry, "voice"), anchorEl },
      );
    },
    [findCustomer, refuseVoice, redialBlocked],
  );

  /** Save & Redial from a card's Outcome popover. */
  const openCardRedialPad = useCallback(
    (interactionId: string, phoneNumber: string, anchorEl: HTMLElement | null) => {
      if (refuseVoice()) return;
      setRedialActiveInteraction({ interactionId, phoneNumber });
      setDialpadRequest({ phoneNumber, anchorEl });
    },
    [refuseVoice],
  );

  /** The dial pad's submit. A pending Contact History redial matches against
   *  any of the customer's numbers (row 16); a pending card redial against its
   *  number; anything else is a quick dial. */
  const dialpadSubmit = useCallback(
    (phoneNumber: string, skillId: string, resolveCard: (id: string) => NavCard | undefined) => {
      const pendingEntry = redialEntry;
      setRedialEntry(null);
      const pendingCard = redialActiveInteraction;
      setRedialActiveInteraction(null);
      if (pendingEntry) {
        const customer = pendingEntry.customerId ? findCustomer(pendingEntry.customerId) : undefined;
        const candidates = customer ? customer.phones.map((p) => p.value) : [knownOrSynthesizedAddress(pendingEntry, "voice")];
        if (candidates.some((n) => normalizePhone(n) === normalizePhone(phoneNumber))) {
          redial(pendingEntry, skillId, phoneNumber);
          return;
        }
      }
      if (pendingCard && normalizePhone(pendingCard.phoneNumber) === normalizePhone(phoneNumber)) {
        const card = resolveCard(pendingCard.interactionId);
        if (card) {
          redialCard(card, phoneNumber, skillId);
          return;
        }
      }
      quickDial(phoneNumber, skillId);
    },
    [redialEntry, redialActiveInteraction, findCustomer, redial, redialCard, quickDial],
  );

  return {
    redialBlocked,
    startCall,
    quickDial,
    redial,
    redialCard,
    addAdHocChannel,
    openRedialPad,
    openCardRedialPad,
    dialpadSubmit,
    dialpadRequest,
    /** Opens the Dial Pad with a request of the page's own (e.g. a scripted
     *  scenario's call confirm). */
    requestDialpad: setDialpadRequest,
    clearDialpadRequest: useCallback(() => setDialpadRequest(null), []),
    /** Clears a pending redial (e.g. the dial pad was dismissed). */
    cancelPendingRedial: useCallback(() => {
      setRedialEntry(null);
      setRedialActiveInteraction(null);
    }, []),
    setRedialActiveInteraction,
  };
}
