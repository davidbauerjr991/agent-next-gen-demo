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
}

/** A discrete text unit on a digital channel (chat, SMS, WhatsApp, email). */
export interface Message {
  id: MessageId;
  externalId?: ExternalRef;
  interactionId: InteractionId;
  author: Participant;
  /** "event" = a system line in the thread (e.g. "Chat started"). */
  kind: "text" | "event";
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
