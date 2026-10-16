import type {
  AgentPresence,
  AgentState,
  ChannelKind,
  Direction,
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
  /** The agent can reopen a past contact (Contact History, Search). */
  reopen: boolean;
  /** Bot-handled contacts can arrive in review (`Interaction.review`): the
   *  agent reads along, answers the bot's requests (`respondToRequest`) and
   *  can `takeOver`. */
  review: boolean;
}

/** The agent's answer to a bot's request (an approval card, a proposed
 *  wrap-up, a next-best-action decision). */
export interface RequestResponse {
  /** The decision, e.g. "accept"; a wrap-up card is answered "complete". */
  value: string;
  /** The card being answered, when the request is a message in the thread. */
  requestId?: MessageId;
  /** What the agent typed (decline reason, "something else" instruction). */
  note?: string;
  /** Other values the decision carries (an amount, a percentage). */
  vars?: Record<string, string>;
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
  /** Display form of `address` (e.g. "(456) 383-3329"); stored as `address.label`. */
  addressLabel?: string;
  /** The contact's name as the agent knows it; stored as `contactName`. */
  contactName?: string;
  /** Case number for a new journey (e.g. the customer's own record id). A
   *  dial into an existing journey ignores it and inherits that journey's. */
  caseId?: string;
}

/** Reopens a past contact (Contact History, Search) as a new, active contact
 *  with `origin: "reopened"`. */
export interface ReopenRequest {
  channel: ChannelKind;
  /** The original contact's direction, carried forward. */
  direction: Direction;
  address?: string;
  addressLabel?: string;
  entityId?: EntityId;
  /** The case being reopened. Joins the open journey with this case id, if
   *  there is one; otherwise a new journey keeps it. */
  caseId?: string;
  /** Joins this journey explicitly; takes precedence over `caseId`. */
  journeyId?: JourneyId;
  contactName?: string;
  /** Skill to file the contact under, from `listOutboundSkills(channel)`. */
  skillId?: string;
  /** Case status the reopened contact resumes at. */
  caseStatus?: string;
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
  /** Fired once when the interaction is closed: after the final
   *  `stateChanged` to "ended" — with wrap-up support, that's after
   *  `completeWrapUp`. `reason` is who or what ended the contact, even when
   *  wrap-up came later. Media stops playback when `state` leaves
   *  "active"/"held", not on this event. */
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
  /** Sets the channels the agent takes contacts on (`AgentState.channels`).
   *  Routing stops offering contacts on the others; contacts already open on
   *  them stay until they end. Rejects `"not-supported"` for a provider that
   *  routes no inbound channel (`capabilities.channels.inbound` is empty,
   *  which is every placeholder). */
  setAgentChannels(channels: ChannelKind[]): Promise<void>;
  /** Connects the agent leg; state passes through "connecting". */
  connectAgentLeg(): Promise<void>;
  /** Disconnects the agent leg. */
  disconnectAgentLeg(): Promise<void>;

  // ── Offer and lifecycle ────────────────────────────────────────────────

  /** Accepts an offered interaction (Accept on the ringing tile, or opening a
   *  digital offer from its notification). Sets `acceptedAt`. A voice accept
   *  follows the one-active-call rule (see `hold`).
   *
   *  `journeyId` joins the accepted contact to an existing journey — e.g. the
   *  customer already has a card open — taking that journey's `caseId`. It
   *  must name a journey with a contact that hasn't ended (`not-found`
   *  otherwise). Without it the contact keeps the journey it was offered in. */
  accept(interactionId: InteractionId, options?: { journeyId?: JourneyId }): Promise<void>;
  /** Declines an offered interaction; it ends with reason "declined". */
  decline(interactionId: InteractionId): Promise<void>;
  /** Starts an agent-initiated contact on any channel (named for the dial
   *  pad, also used by New Outbound for SMS/WhatsApp/email). Resolves with
   *  the new id so the caller can correlate; the interaction itself arrives
   *  via `stateChanged` with `origin: "agent-initiated"`. When
   *  `capabilities.agentLeg`, a voice dial needs the leg "connected" and
   *  rejects "invalid-state" otherwise (connecting included). A dial that
   *  joins a journey inherits its `caseId`; a new journey gets a new one. A
   *  voice dial follows the one-active-call rule (see `hold`) when it connects. */
  dial(request: DialRequest): Promise<InteractionId>;
  /** Reopens a past contact as a new active contact (`origin: "reopened"`),
   *  which arrives via `stateChanged`, never `incoming`. Journey: `journeyId`
   *  if given, else the open journey whose `caseId` matches, else a new one.
   *  A non-ended contact in that journey on the same channel and address is
   *  superseded first: it closes ("ended", reason "agent") without wrap-up.
   *  Not a placed call, so the agent-leg rule doesn't apply; a voice reopen
   *  follows the one-active-call rule. Requires `capabilities.reopen`. */
  reopen(request: ReopenRequest): Promise<InteractionId>;
  /** Ends the contact (hang up / end chat). Goes to "wrap-up" when
   *  `capabilities.wrapUp`, otherwise to "ended". The customer hanging up
   *  takes the same path (after-call work happens either way); `ended` then
   *  reports reason "customer". */
  end(interactionId: InteractionId): Promise<void>;
  /** Saves the outcome (Outcome popover / Wrap-up card) and finishes wrap-up.
   *  Without wrap-up support, records the outcome on an ended contact. */
  completeWrapUp(interactionId: InteractionId, outcome: InteractionOutcome): Promise<void>;

  // ── In-contact controls ────────────────────────────────────────────────
  // Explicit values, not toggles: repeating a call is a no-op.

  /** Puts the contact on hold (`true`) or resumes it (`false`).
   *
   *  **One active call.** With `capabilities.hold`, whenever a voice contact
   *  becomes active (a dial connects, accept, reopen, or resume from hold),
   *  every other active voice contact is held first, each with its own
   *  `stateChanged`. Without `hold`, a dial, accept or reopen that would make
   *  a second voice contact live rejects "invalid-state". */
  hold(interactionId: InteractionId, onHold: boolean): Promise<void>;
  /** Mutes (`true`) or unmutes the agent's microphone. Voice only. */
  mute(interactionId: InteractionId, muted: boolean): Promise<void>;
  /** Starts (`true`) or stops call recording. Voice only. */
  setRecording(interactionId: InteractionId, recording: boolean): Promise<void>;
  /** Masks (`true`) or unmasks sensitive audio. Voice only. */
  setMasked(interactionId: InteractionId, masked: boolean): Promise<void>;
  /** Sends keypad tones ("0"–"9", "*", "#") into the call. Voice only. */
  sendDtmf(interactionId: InteractionId, digits: string): Promise<void>;
  /** Transfers to `target`; `mode` must be enabled in `capabilities.transfer`.
   *  The contact leaves this agent like `end` does — into "wrap-up" when
   *  `capabilities.wrapUp` — and `ended` reports reason "transfer". */
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

  // ── Review (bot-handled contacts) ──────────────────────────────────────
  // Both require `capabilities.review`.

  /** Takes a contact in review over from the bot: `review` clears and the
   *  handle clock starts (`acceptedAt`); a voice contact becomes the agent's
   *  call (one-active-call rule). `handoff: false` skips the bot's handoff
   *  line to the customer. "invalid-state" if the contact was never in
   *  review; a second call is a no-op. */
  takeOver(interactionId: InteractionId, options?: { handoff?: boolean }): Promise<void>;
  /** Answers a bot's request. When `requestId` names a card, that message is
   *  updated with `annotation.response`. "not-found" for a decision the
   *  contact has no request for. Answering a card twice is a no-op. */
  respondToRequest(interactionId: InteractionId, response: RequestResponse): Promise<void>;
}
