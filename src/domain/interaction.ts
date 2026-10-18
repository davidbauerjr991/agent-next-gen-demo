import type {
  EntityId,
  EpochMs,
  ExternalRef,
  InteractionId,
  JourneyId,
  MessageId,
  UtteranceId,
} from "./ids";

export type ChannelKind = "voice" | "chat" | "sms" | "whatsapp" | "email";

export type Direction = "inbound" | "outbound";

/** Lifecycle of one channel contact, as the provider reports it. */
export type InteractionState = "offered" | "connecting" | "active" | "held" | "wrap-up" | "ended";

/** How the contact reached the agent — orthogonal to `direction`. */
export type InteractionOrigin = "routed" | "agent-initiated" | "reopened";

export interface Participant {
  role: "customer" | "agent" | "bot" | "system";
  /** Agent or entity id when known; free-form so bots/system need none. */
  id?: string;
  displayName: string;
}

export interface InteractionOutcome {
  dispositionCode?: string;
  tags?: string[];
  summary?: string;
}

/**
 * One channel contact: a single call, chat, or email thread — the unit a
 * vendor hands over and the unit accept/hold/mute/end act on. Several
 * Interactions sharing a `journeyId` make up one left-nav card; that card is
 * a view model built by grouping, not a domain type.
 */
export interface Interaction {
  id: InteractionId;
  externalId?: ExternalRef;
  journeyId: JourneyId;
  /** Undefined while the contact is unknown (no match on the handshake identifier). */
  entityId?: EntityId;
  /** How `entityId` was found once the contact arrived: routing matched its
   *  address against the directory, or the agent linked it
   *  (`associateEntity`). Either way the entity's own name is the contact's
   *  name. Undefined when the contact arrived already linked (a dial to a
   *  known customer, a seed). */
  entityMatchedBy?: "routing" | "agent";
  channel: ChannelKind;
  direction: Direction;
  state: InteractionState;
  origin: InteractionOrigin;
  /** The phone number, email address, or handle used for this contact. */
  address?: { value: string; label?: string };
  skill?: { id: string; name: string };
  /** Case status from the active profile's vocabulary (Open, Pending, …).
   *  Business status, independent of the connection `state`. */
  caseStatus?: string;
  /** The case number shown to the agent (e.g. "CS-1234567"). Every contact in
   *  a journey shares it; a reopen finds an open journey by it. */
  caseId?: string;
  /** The name the contact presented (caller-ID name, chat pre-contact name),
   *  independent of the linked entity's own display name. */
  contactName?: string;
  startedAt: EpochMs;
  /** When the agent accepted a routed offer. The handle-time clock runs from
   *  here when set, otherwise from `startedAt`. */
  acceptedAt?: EpochMs;
  endedAt?: EpochMs;
  heldSince?: EpochMs;
  /** Set while the customer's last message is unanswered by the agent. */
  awaitingAgentSince?: EpochMs;
  /** Voice only. */
  muted?: boolean;
  /** Voice only. Call recording is on. */
  recording?: boolean;
  /** Voice only. Audio is masked (e.g. while payment details are read out); recording pauses. */
  masked?: boolean;
  outcome?: InteractionOutcome;
  /** Pre-contact context the routing layer (IVR/ACD) hands over with an
   *  inbound call, one line each: the reason for contact, the customer's last
   *  contact (known callers), the case status. Shown as the contact's
   *  Autosummary; the P2.4 handoff snapshot will be seeded from it. */
  preContactSummary?: string[];
  /** A bot-handled contact routed to the agent to read along on (P0.5c):
   *  the agent isn't on it until `takeOver`. A voice contact in review isn't
   *  the agent's call (it's never auto-held and doesn't block a dial), and
   *  customer lines don't start the awaiting-reply clock. */
  review?: { by: string; since: EpochMs };
  /** The contact is answered without the agent accepting it (auto-answer).
   *  Set already on the offer, so an offer that's about to be auto-answered
   *  is never shown as ringing. */
  autoAnswered?: true;
}

/** A discrete text unit on a digital channel (chat, SMS, WhatsApp, email). */
export interface Message {
  id: MessageId;
  externalId?: ExternalRef;
  interactionId: InteractionId;
  author: Participant;
  /** "event" = a system line in the thread (e.g. "Chat started"). */
  kind: "text" | "event";
  /** A non-text row a scripted scenario puts in the thread: an interstitial
   *  line, an approval-request card or a wrap-up card. `ref` names the
   *  payload in the scenario's content (src/scenarios), never on the wire. */
  annotation?: {
    kind: "instruction" | "approval" | "wrap-up";
    ref: string;
    by?: string;
    link?: string;
    /** An instruction: when the AI finishes performing it (the row shows "performing…" until then). Set by the
     *  provider, so every mount of the row agrees, before and after a remount. */
    performedAt?: EpochMs;
    /** The agent's answer to an approval or wrap-up card (`respondToRequest`). */
    response?: { value: string; note?: string; at: EpochMs };
    /** The card was withdrawn (an unfinished wrap-up card when the agent takes over). */
    withdrawn?: true;
  };
  text: string;
  sentAt: EpochMs;
  delivery?: "sending" | "sent" | "delivered" | "read" | "failed";
}

/** A speech segment on a voice contact. Separate from `Message` because
 *  ASR/TTS revise partial text before it is final and carry timing. */
export interface Utterance {
  id: UtteranceId;
  externalId?: ExternalRef;
  interactionId: InteractionId;
  speaker: Participant;
  text: string;
  startedAt: EpochMs;
  endedAt?: EpochMs;
  isFinal: boolean;
  confidence?: number;
}
