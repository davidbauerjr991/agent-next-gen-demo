import type {
  AgentPresence,
  AgentState,
  ChannelKind,
  EntityId,
  Interaction,
  InteractionId,
  InteractionOutcome,
  JourneyId,
  Message,
  MessageId,
  Participant,
  Utterance,
} from "../domain";
import type { EventSource, ProviderLifecycle } from "./events";

/**
 * What a provider can do, limited to controls this workspace actually shows,
 * so the UI can hide the ones that don't apply. Static for the provider's
 * lifetime. Calling a command whose flag is `false` rejects with
 * `"not-supported"`. Vendor-only features (barge, whisper, conference,
 * callbacks, queue views) are deliberately absent — add a flag when a screen
 * shows the control.
 */
export interface InteractionCapabilities {
  /** Channels that can be offered to the agent (`incoming`) and that the
   *  agent can start (`dial`, the New Outbound channel picker). */
  channels: { inbound: ChannelKind[]; outbound: ChannelKind[] };
  /** Decline on a ringing/offered tile. */
  decline: boolean;
  /** Hold / resume (voice bar). */
  hold: boolean;
  /** Mute the agent's microphone (voice bar). */
  mute: boolean;
  /** Record / Stop (voice bar). */
  record: boolean;
  /** Mask (voice bar) — hide sensitive audio, pausing the recording. */
  mask: boolean;
  /** Keypad tones sent into the call (voice bar). */
  dtmf: boolean;
  /** Consult / Transfer. `blind` hands off immediately; `consult` talks to the
   *  target first. Merge/cancel-consult flows are adapter work, not here. */
  transfer: { blind: boolean; consult: boolean };
  /** Typing indicators, both directions. */
  typing: boolean;
  /** `Message.delivery` advances past "sent" (delivered/read). */
  deliveryReceipts: boolean;
  /** A separate agent softphone leg that connects/disconnects (AgentProfile). */
  agentLeg: boolean;
  /** `end` moves the contact into "wrap-up" until `completeWrapUp`. When
   *  `false`, `end` goes straight to "ended" and the outcome is optional. */
  wrapUp: boolean;
  /** The provider stores the case status (session status pill, Resolution). */
  caseStatus: boolean;
}

/** Starts an agent-initiated contact (New Outbound, dial pad, redial). */
export interface DialRequest {
  channel: ChannelKind;
  /** Phone number, email address, or handle to reach. */
  address: string;
  /** The known record being contacted; omitted for an ad-hoc address. */
  entityId?: EntityId;
  /** Outbound skill, from `listOutboundSkills(channel)`. */
  skillId: string;
  /** Adds the contact to an existing left-nav card instead of a new one. */
  journeyId?: JourneyId;
}

/** Where a transfer goes — the same groups New Outbound offers. */
export type TransferTarget =
  | { kind: "agent" | "team" | "skill"; id: string; label: string }
  | { kind: "address"; value: string };

/** Why an interaction ended. "declined" covers a declined offer. */
export type EndReason = "agent" | "customer" | "transfer" | "declined" | "timeout" | "error";

/** An outbound skill as the New Outbound skill picker lists it. */
export interface OutboundSkill {
  id: string;
  name: string;
}

/** Event payloads, by name. */
export interface InteractionEvents {
  /** A routed contact is being offered (`state: "offered"`): the ringing tile
   *  with Accept/Decline. Agent-initiated contacts never fire this — they
   *  first appear through `stateChanged`. */
  incoming: { interaction: Interaction };
  /** Full snapshot of whatever changed: an interaction (state, hold, mute,
   *  record, mask, case status, entity, outcome — and its first appearance
   *  after `dial`) or the agent (presence, agent leg). Upsert by id. */
  stateChanged:
    | { kind: "interaction"; interaction: Interaction }
    | { kind: "agent"; agent: AgentState };
  /** A digital message was added or updated (e.g. delivery advanced). Upsert
   *  by id. The agent's own messages arrive here too. */
  message: { message: Message };
  /** A voice utterance was added or revised. Upsert by id; partial text
   *  arrives with `isFinal: false` and is replaced as it firms up. */
  transcript: { utterance: Utterance };
  /** Someone started or stopped typing on a digital interaction. */
  typing: { interactionId: InteractionId; role: Participant["role"]; isTyping: boolean };
  /** Fired once, after the `stateChanged` that set `state: "ended"`. Media
   *  stops playback on this. */
  ended: { interactionId: InteractionId; reason: EndReason };
}

/**
 * The contact-center connection: offers, call/chat control, and the agent's
 * own state. The UI's only path to interactions — vendor payloads are mapped
 * to domain types inside the implementation.
 */
export interface InteractionProvider extends EventSource<InteractionEvents>, ProviderLifecycle {
  /** What this provider supports; the UI hides controls that are `false`. */
  readonly capabilities: InteractionCapabilities;

  // ── Reads (hydration) ──────────────────────────────────────────────────

  /** Current agent state and every non-ended interaction, for a fresh mount.
   *  Subscribe first, then read, so nothing between the two is missed. */
  getSnapshot(): Promise<{ agent: AgentState; interactions: Interaction[] }>;
  /** Messages and utterances already on an interaction (e.g. a scripted
   *  case's setup messages), oldest first. */
  getTranscript(interactionId: InteractionId): Promise<{ messages: Message[]; utterances: Utterance[] }>;
  /** The presence statuses the agent can pick (AgentProfile's status menu). */
  listPresenceOptions(): Promise<AgentPresence[]>;
  /** Skills the agent may place an outbound contact under on `channel` (New
   *  Outbound's skill picker; `dial` requires one). */
  listOutboundSkills(channel: ChannelKind): Promise<OutboundSkill[]>;

  // ── Agent ──────────────────────────────────────────────────────────────

  /** Sets presence by status code from `listPresenceOptions`. */
  setAgentState(code: string, reasonCode?: string): Promise<void>;
  /** Connects the agent leg; state passes through "connecting". */
  connectAgentLeg(): Promise<void>;
  /** Disconnects the agent leg. */
  disconnectAgentLeg(): Promise<void>;

  // ── Offer and lifecycle ────────────────────────────────────────────────

  /** Accepts an offered interaction (Accept on the ringing tile). */
  accept(interactionId: InteractionId): Promise<void>;
  /** Declines an offered interaction; it ends with reason "declined". */
  decline(interactionId: InteractionId): Promise<void>;
  /** Starts an agent-initiated contact on any channel (named for the dial
   *  pad, also used by New Outbound for SMS/WhatsApp/email). Resolves with
   *  the new id so the caller can correlate; the interaction itself arrives
   *  via `stateChanged` with `origin: "agent-initiated"`. */
  dial(request: DialRequest): Promise<InteractionId>;
  /** Ends the contact (hang up / end chat). Goes to "wrap-up" when
   *  `capabilities.wrapUp`, otherwise to "ended". */
  end(interactionId: InteractionId): Promise<void>;
  /** Saves the outcome (Outcome popover / Wrap-up card) and finishes wrap-up.
   *  Without wrap-up support, records the outcome on an ended contact. */
  completeWrapUp(interactionId: InteractionId, outcome: InteractionOutcome): Promise<void>;

  // ── In-contact controls ────────────────────────────────────────────────
  // Explicit values, not toggles: repeating a call is a no-op.

  /** Puts the contact on hold (`true`) or resumes it (`false`). */
  hold(interactionId: InteractionId, onHold: boolean): Promise<void>;
  /** Mutes (`true`) or unmutes the agent's microphone. Voice only. */
  mute(interactionId: InteractionId, muted: boolean): Promise<void>;
  /** Starts (`true`) or stops call recording. Voice only. */
  setRecording(interactionId: InteractionId, recording: boolean): Promise<void>;
  /** Masks (`true`) or unmasks sensitive audio. Voice only. */
  setMasked(interactionId: InteractionId, masked: boolean): Promise<void>;
  /** Sends keypad tones ("0"–"9", "*", "#") into the call. Voice only. */
  sendDtmf(interactionId: InteractionId, digits: string): Promise<void>;
  /** Transfers to `target`; `mode` must be enabled in `capabilities.transfer`. */
  transfer(interactionId: InteractionId, target: TransferTarget, mode: "blind" | "consult"): Promise<void>;
  /** Sends an agent message. Resolves with its id; the message itself arrives
   *  via `message` (never append it locally). Digital channels only. */
  sendMessage(interactionId: InteractionId, text: string): Promise<MessageId>;
  /** Reports whether the agent is typing. Digital channels only. */
  setTyping(interactionId: InteractionId, isTyping: boolean): Promise<void>;
  /** Sets the case status from the profile's vocabulary (session status
   *  pill, Outcome's Resolution). Independent of connection `state`. */
  setCaseStatus(interactionId: InteractionId, status: string): Promise<void>;
  /** Links the interaction to a record — e.g. after the agent saves the Draft
   *  card for an unknown contact. */
  associateEntity(interactionId: InteractionId, entityId: EntityId): Promise<void>;
}
