import { useCallback, useState } from "react";
import type { ChannelType, CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import type { CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { threadKey, type NavCard } from "@/adapters/legacy/nav-card-view-model";
import { assignmentIdFor, scheduleCardKey, type AssignmentId, type ChannelKind, type EntityId, type Interaction, type InteractionId, type JourneyId } from "@/domain";
import type { DialRequest } from "@/providers";
import { isProviderError } from "@/adapters/provider-error";
import { useAgentState, useInteractionProvider, useInteractions, useProviders } from "@/provider-context";
import { OUTBOUND_CONFIG } from "@/components/agent-next-gen-outbound-data";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { knownOrSynthesizedAddress, normalizePhone, historyEntityId } from "./contact-identity";
import { useAgentAvailable, UNAVAILABLE_CALL_TOOLTIP } from "./presence-gates";
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
  /** What a voice launch does while the agent is already on a call:
   *  "auto-hold" (the provider holds the first call when the second
   *  connects; what the workspace uses) or "refuse" (one call at a time, on
   *  every path: New Outbound, Redial, Save & Redial, a voice "+"; tested,
   *  unused by the page). */
  secondVoiceCall: "refuse" | "auto-hold";
  /** A voice launch was refused by `secondVoiceCall: "refuse"`. */
  onVoiceCallRefused?: () => void;
  /** A voice launch was refused because the agent is already on a live or
   *  held call with that customer (`isOnCallWith`). Only reachable where the
   *  UI can't disable the button first, e.g. a number typed into Quick Dial,
   *  or a Redial opened anyway. `call` is the call it's on. */
  onAlreadyOnCall?: (call: Interaction) => void;
  /** Save & Redial's new call was placed on `card`; the page completes the
   *  ended call's wrap-up now (not earlier), so the card never empties. */
  onCardRedialPlaced?: (card: NavCard) => void;
  /** Any launch the provider accepted (`id` is its contact): the page offers
   *  to save an address that isn't on the customer's record (k8 8). */
  onPlaced?: (id: InteractionId, target: { channel: ChannelType; address: string; entityId?: string; contactName?: string }) => void;
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
  /** The assignment whose card the contact joins as a leg when no conversation card is open for it yet (a
   *  schedule item's, `assignmentIdFor`; P-HOME-1e). */
  assignmentId?: AssignmentId;
  mode: ActivationMode;
  /** Why the agent is calling (a scheduled callback's reason): the call's summary line. */
  summary?: string[];
}

/** A call the agent is about to place for a schedule item (a callback, or a
 *  task's "Call <customer>"), waiting on the dial pad's skill and submit
 *  (P-HOME-1d). The call carries the item's customer and joins the item's
 *  card as its voice leg (P-HOME-1e). */
export interface ScheduleDial {
  itemId: string;
  phoneNumber: string;
  contactName: string;
  entityId?: string;
  summary: string[];
  /** Runs on submit, before the call is placed: a Home preview's Dial opens the item into the rail first, so the
   *  call joins its card (P-HOME-1i). */
  beforePlace?: () => Promise<unknown>;
}

/** A voice contact the agent is on: ringing (either way), live, or held. */
const ON_CALL_STATES = new Set(["offered", "connecting", "active", "held"]);

/** The tooltip on a voice launch disabled by `isOnCallWith`. */
const ALREADY_ON_CALL_TOOLTIP = "Already on a call with this customer";

/** Who a voice launch would call: the directory entity, if known, and the
 *  numbers it could dial. */
export interface CallTarget {
  entityId?: string;
  addresses?: readonly string[];
  /** The card it would join: a customer with no directory record is its card (k8 6). */
  journeyId?: string;
}

/** A ringing-out, live or held voice call with the target, if any: the same
 *  entity, or (for a call without one) the same number. A call in wrap-up
 *  doesn't count, and neither do digital contacts. */
export function findCallWith<T extends { channel: string; state: string; entityId?: string; journeyId?: string; address?: { value: string } }>(
  interactions: readonly T[],
  target: CallTarget,
): T | undefined {
  const numbers = new Set((target.addresses ?? []).map(normalizePhone).filter((n) => n !== ""));
  return interactions.find(
    (i) =>
      i.channel === "voice" &&
      ON_CALL_STATES.has(i.state) &&
      ((!!target.entityId && i.entityId === target.entityId) ||
        (!!target.journeyId && i.journeyId === target.journeyId) ||
        (!!i.address && numbers.has(normalizePhone(i.address.value)))),
  );
}

/** The warning when a dial is refused because the agent is already on a
 *  call with that customer (Quick Dial, Redial, the dial pad). */
export function alreadyOnCallMessage(name: string | undefined): string {
  return name ? `Already on a call with ${name}` : ALREADY_ON_CALL_TOOLTIP;
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
  onPlaced,
}: UseOutboundDialOptions) {
  const provider = useInteractionProvider();
  const interactions = useInteractions();
  const agentState = useAgentState();
  const available = useAgentAvailable();
  const outboundChannels = useProviders().capabilities.interaction.channels.outbound;

  const [dialpadRequest, setDialpadRequest] = useState<DialpadRequest | null>(null);
  const [redialEntry, setRedialEntry] = useState<ContactHistoryEntry | null>(null);
  const [redialActiveInteraction, setRedialActiveInteraction] = useState<{ interactionId: string; phoneNumber: string } | null>(null);
  const [scheduleDial, setScheduleDial] = useState<ScheduleDial | null>(null);

  /** True (and reports it) when this page refuses a second voice call and
   *  the agent is already on one. */
  const refuseVoice = useCallback(() => {
    if (secondVoiceCall !== "refuse") return false;
    const onCall =
      interactions.some((i) => i.channel === "voice" && ON_CALL_STATES.has(i.state) && !i.review);
    if (onCall) onVoiceCallRefused?.();
    return onCall;
  }, [secondVoiceCall, interactions, onVoiceCallRefused]);

  /** Places the contact; resolves its id, or `null` when it wasn't placed. */
  const place = useCallback(
    async (target: DialTarget): Promise<InteractionId | null> => {
      const channel = target.channel as ChannelKind;
      // Presence blocks calls on every path (the buttons say so; this catches the rest).
      if (target.channel === "voice" && !available) {
        if (import.meta.env.DEV) console.warn("[outbound] a call needs the agent Available");
        return null;
      }
      if (target.channel === "voice" && refuseVoice()) return null;
      // One call per customer, on every path (the buttons are disabled too;
      // this catches a number typed into Quick Dial).
      const onCallWith =
        target.channel === "voice"
          ? findCallWith(interactions, { entityId: target.entityId, addresses: [target.address], journeyId: target.card?.id ?? target.assignmentId })
          : undefined;
      if (onCallWith) {
        onAlreadyOnCall?.(onCallWith);
        return null;
      }
      if (!outboundChannels.includes(channel)) {
        if (import.meta.env.DEV) console.warn(`[outbound] the provider can't dial out on ${channel}`);
        return null;
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
      // A thread that's live on this address isn't restarted: it would supersede the live contact (the page
      // flashed and nothing happened). The pickers disable it ("Already open"); this catches the rest (k6 2).
      if (liveSameThread && ["connecting", "active", "held"].includes(liveSameThread.state)) {
        if (import.meta.env.DEV) console.warn(`[outbound] ${channel} is already open on ${target.address}`);
        return null;
      }
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
            // P0.9's leg-join generalizes this: the journey is the assignment the leg joins.
            ...(target.card || target.assignmentId ? { journeyId: (target.card?.id ?? target.assignmentId) as JourneyId } : {}),
            ...(target.summary?.length ? { summary: target.summary } : {}),
          };
          id = await provider.dial(request);
        }
        activateWhenReady(id, target.mode, !target.card);
        onPlaced?.(id, target);
        return id;
      } catch (error) {
        if (target.channel === "voice" && isProviderError(error) && error.code === "invalid-state" && agentState?.leg !== "connected") {
          onLegDisconnected();
          return null;
        }
        if (import.meta.env.DEV) console.warn("[outbound] dial failed", error);
        return null;
      }
    },
    [provider, interactions, agentState, available, outboundChannels, activateWhenReady, onLegDisconnected, refuseVoice, onAlreadyOnCall, onPlaced],
  );

  /** Whether Contact History's Redial is disabled for `entry`: the agent is
   *  already on a live or held call with that customer (any of their numbers). */
  const redialCallWith = useCallback(
    (entry: ContactHistoryEntry) => {
      const customer = entry.customerId ? findCustomer(entry.customerId) : undefined;
      const addresses = customer ? customer.phones.map((p) => p.value) : [knownOrSynthesizedAddress(entry, "voice")];
      return findCallWith(interactions, { entityId: historyEntityId(entry), addresses });
    },
    [interactions, findCustomer],
  );
  const redialBlocked = useCallback((entry: ContactHistoryEntry) => redialCallWith(entry) !== undefined, [redialCallWith]);
  /** Why Contact History's Redial is disabled, if it is: presence (not
   *  Available), or already on a call with that customer. */
  const redialBlockedReason = useCallback(
    (entry: ContactHistoryEntry) => (!available ? UNAVAILABLE_CALL_TOOLTIP : redialBlocked(entry) ? ALREADY_ON_CALL_TOOLTIP : undefined),
    [available, redialBlocked],
  );

  /** New Outbound's Start Interaction (and the record header's "+", which
   *  passes the card's own contact). `assignmentId` (P-HOME-1m: a kind card's
   *  "+"): the leg joins that assignment's card as a new row, as a schedule
   *  item's Dial does, never a card of its own. */
  const startCall = useCallback(
    (selection: { contact: CreateNewOutboundContact; channel: ChannelType; phone: string; skillId: string }, options?: { assignmentId?: AssignmentId }) => {
      const entityId = selection.contact.id.startsWith("adhoc:") ? undefined : selection.contact.id;
      const card = options?.assignmentId ? undefined : entityId ? findOpenCard({ entityId }) : findOpenCard({ address: selection.phone });
      void place({
        channel: selection.channel,
        address: selection.phone,
        addressLabel: OUTBOUND_CONFIG.phoneOptions.find((o) => o.value === selection.phone)?.label ?? selection.phone,
        entityId,
        contactName: selection.contact.name,
        caseId: selection.contact.subtitle,
        skillId: selection.skillId,
        ...(options?.assignmentId ? { assignmentId: options.assignmentId, mode: "focus" as const } : { card, mode: card ? ("added" as const) : ("focus" as const) }),
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
    /** `mode` "none" adds the channel without showing it (the card's main
     *  thread and selection stay as they are). */
    (card: NavCard, query: string, channel: ChannelType, skillId: string, mode: ActivationMode = "added") => {
      void place({
        channel,
        address: query,
        addressLabel: query,
        entityId: card.entityId,
        contactName: card.customerName,
        skillId,
        card,
        mode,
      });
    },
    [place],
  );

  /** Contact History's Redial button: opens the dial pad pre-filled with the
   *  customer's numbers (row 16). */
  const openRedialPad = useCallback(
    (entry: ContactHistoryEntry, anchorEl: HTMLElement | null) => {
      if (refuseVoice()) return;
      const onCallWith = redialCallWith(entry);
      if (onCallWith) {
        onAlreadyOnCall?.(onCallWith);
        return;
      }
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
    [findCustomer, refuseVoice, redialCallWith, onAlreadyOnCall],
  );

  /** A schedule item's Dial / "Call <customer>" (P-HOME-1d): opens the dial pad
   *  beneath `anchorEl`, prefilled with the customer's number; it never dials
   *  directly — the agent picks the skill and submits. */
  const openScheduleDialPad = useCallback(
    (dial: ScheduleDial, anchorEl: HTMLElement | null) => {
      if (refuseVoice()) return;
      setRedialEntry(null);
      setRedialActiveInteraction(null);
      setScheduleDial(dial);
      setDialpadRequest({ phoneNumber: dial.phoneNumber, anchorEl, customerName: dial.contactName });
    },
    [refuseVoice],
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
      const pendingSchedule = scheduleDial;
      setScheduleDial(null);
      // A schedule item's call keeps its customer (name, record, the reason as the summary line), whatever number
      // was dialed, and joins the item's card as its voice leg.
      if (pendingSchedule) {
        const sameNumber = normalizePhone(pendingSchedule.phoneNumber) === normalizePhone(phoneNumber);
        const before = pendingSchedule.beforePlace?.() ?? Promise.resolve();
        void before.then(() => place({
          channel: "voice",
          address: phoneNumber,
          addressLabel: phoneNumber,
          contactName: pendingSchedule.contactName,
          ...(pendingSchedule.entityId && sameNumber ? { entityId: pendingSchedule.entityId } : {}),
          skillId,
          assignmentId: assignmentIdFor(scheduleCardKey(pendingSchedule.itemId)),
          mode: "focus",
          summary: pendingSchedule.summary,
        }), (err) => {
          if (import.meta.env.DEV) console.warn("[schedule] open before dial failed", err);
        });
        return;
      }
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
    [redialEntry, redialActiveInteraction, scheduleDial, place, findCustomer, redial, redialCard, quickDial],
  );

  return {
    redialBlocked,
    redialBlockedReason,
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
      setScheduleDial(null);
    }, []),
    setRedialActiveInteraction,
    openScheduleDialPad,
  };
}
