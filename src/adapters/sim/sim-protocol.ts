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
  Utterance,
} from "../../domain";
import type {
  DialRequest,
  InteractionEvents,
  OutboundSkill,
  ProviderError,
  ReopenRequest,
  RequestResponse,
  TransferTarget,
} from "../../providers";

// Wire format of the "agent-sim" bus (P0.4). Types only. Everything here is
// structured-clone safe, so the same messages work over BroadcastChannel now
// and JSON over a WebSocket later.

/** Bumped on an incompatible change; transports drop other versions. */
export const SIM_PROTOCOL_VERSION = 1;

/** One request per `InteractionProvider` method, reads included. */
export type SimCommand =
  | { name: "getSnapshot" }
  | { name: "getTranscript"; interactionId: InteractionId }
  | { name: "listPresenceOptions" }
  | { name: "listOutboundSkills"; channel: ChannelKind }
  | { name: "setAgentState"; code: string; reasonCode?: string }
  | { name: "connectAgentLeg" }
  | { name: "disconnectAgentLeg" }
  | { name: "accept"; interactionId: InteractionId; journeyId?: JourneyId }
  | { name: "decline"; interactionId: InteractionId }
  | { name: "dial"; request: DialRequest }
  | { name: "reopen"; request: ReopenRequest }
  | { name: "end"; interactionId: InteractionId }
  | { name: "completeWrapUp"; interactionId: InteractionId; outcome: InteractionOutcome }
  | { name: "hold"; interactionId: InteractionId; onHold: boolean }
  | { name: "mute"; interactionId: InteractionId; muted: boolean }
  | { name: "setRecording"; interactionId: InteractionId; recording: boolean }
  | { name: "setMasked"; interactionId: InteractionId; masked: boolean }
  | { name: "sendDtmf"; interactionId: InteractionId; digits: string }
  | { name: "transfer"; interactionId: InteractionId; target: TransferTarget; mode: "blind" | "consult" }
  | { name: "sendMessage"; interactionId: InteractionId; text: string }
  | { name: "setTyping"; interactionId: InteractionId; isTyping: boolean }
  | { name: "setCaseStatus"; interactionId: InteractionId; status: string }
  | { name: "associateEntity"; interactionId: InteractionId; entityId: EntityId }
  | { name: "takeOver"; interactionId: InteractionId; handoff?: boolean }
  | { name: "respondToRequest"; interactionId: InteractionId; response: RequestResponse };

export type SimCommandName = SimCommand["name"];

/** What each command's reply carries; `void` commands are ack-only. */
export interface SimCommandResults {
  getSnapshot: { agent: AgentState; interactions: Interaction[] };
  getTranscript: { messages: Message[]; utterances: Utterance[] };
  listPresenceOptions: AgentPresence[];
  listOutboundSkills: OutboundSkill[];
  setAgentState: void;
  connectAgentLeg: void;
  disconnectAgentLeg: void;
  accept: void;
  decline: void;
  dial: InteractionId;
  reopen: InteractionId;
  end: void;
  completeWrapUp: void;
  hold: void;
  mute: void;
  setRecording: void;
  setMasked: void;
  sendDtmf: void;
  transfer: void;
  sendMessage: MessageId;
  setTyping: void;
  setCaseStatus: void;
  associateEntity: void;
  takeOver: void;
  respondToRequest: void;
}

/** An `InteractionProvider` event, derived from the contract so it can't drift. */
export type SimEvent = {
  [K in keyof InteractionEvents]: { name: K; payload: InteractionEvents[K] };
}[keyof InteractionEvents];

/** The customer side's inputs (the console in P0.6, `__simCustomer` until then). */
export type SimCustomerAction =
  | {
      kind: "startInbound";
      interactionId: InteractionId;
      channel: ChannelKind;
      address: string;
      displayName: string;
      entityId?: EntityId;
      /** The skill the call is routed to; default General Support. */
      skillId?: string;
      /** Custom pre-contact summary lines (voice); default built by the engine. */
      summary?: string[];
      /** The case number to file it under; default a new one. */
      caseId?: string;
      /** The case's status when it arrives (e.g. "Open"). */
      caseStatus?: string;
    }
  /** Plays a scenario script (src/scenarios) as this customer: the engine
   *  routes the contact and plays its steps (P0.5c). `channel` overrides the
   *  script's own. */
  | { kind: "playScenario"; interactionId: InteractionId; scenarioId: string; channel?: ChannelKind }
  | { kind: "message"; interactionId: InteractionId; text: string }
  /** A customer line on a voice call (an utterance). */
  | { kind: "speak"; interactionId: InteractionId; text: string }
  | { kind: "typing"; interactionId: InteractionId; isTyping: boolean }
  | { kind: "hangUp"; interactionId: InteractionId };

export type SimMessage =
  | { type: "command"; requestId: string; command: SimCommand }
  | { type: "reply"; requestId: string; ok: true; result: unknown }
  | { type: "reply"; requestId: string; ok: false; error: ProviderError }
  | { type: "event"; event: SimEvent }
  | { type: "customer"; action: SimCustomerAction };

/** Every message on the bus. `sessionId` scopes it to one agent session, so
 *  two agent tabs on the same channel never answer each other. */
export type SimEnvelope = { v: typeof SIM_PROTOCOL_VERSION; sessionId: string } & SimMessage;
