import type { ChannelKind, EntityId, InteractionId } from "../../domain";
import { SIM_PROTOCOL_VERSION, type SimCustomerAction } from "./sim-protocol";
import { createBroadcastTransport, DEFAULT_LATENCY, withLatency, type SimTransport } from "./sim-transport";
import { simId } from "./sim-util";

// The customer's side of the sim bus, bound to one agent session. Exposed as
// `window.__simCustomer` in dev until the customer console (P0.6) builds on
// it. The agent UI never uses it.

export interface SimCustomerClient {
  readonly sessionId: string;
  /** Offers a routed inbound contact to the agent; returns its id. `skillId`
   *  routes it to a skill (default "general", General Support); `summary`
   *  replaces the pre-contact summary the engine builds for a voice call. */
  startInbound(request: {
    channel: ChannelKind;
    address: string;
    displayName: string;
    entityId?: EntityId;
    skillId?: string;
    summary?: string[];
    caseId?: string;
    caseStatus?: string;
  }): InteractionId;
  /** Plays a scenario script as the customer (P0.5c); returns the contact's
   *  id. `channel` overrides the script's own. */
  playScenario(scenarioId: string, options?: { channel?: ChannelKind }): InteractionId;
  message(request: { interactionId: InteractionId; text: string }): void;
  /** A customer line on a voice call. */
  speak(request: { interactionId: InteractionId; text: string }): void;
  typing(request: { interactionId: InteractionId; isTyping: boolean }): void;
  /** The customer hangs up / leaves. Goes to wrap-up like the agent's `end`. */
  hangUp(request: { interactionId: InteractionId }): void;
  dispose(): void;
}

export function createSimCustomerClient(
  sessionId: string,
  transport: SimTransport = withLatency(createBroadcastTransport(), DEFAULT_LATENCY),
): SimCustomerClient {
  const send = (action: SimCustomerAction) =>
    transport.send({ v: SIM_PROTOCOL_VERSION, sessionId, type: "customer", action });

  return {
    sessionId,
    startInbound(request) {
      const interactionId = simId("int") as InteractionId;
      send({ kind: "startInbound", interactionId, ...request });
      return interactionId;
    },
    playScenario(scenarioId, options) {
      const interactionId = simId("int") as InteractionId;
      send({ kind: "playScenario", interactionId, scenarioId, ...(options?.channel ? { channel: options.channel } : {}) });
      return interactionId;
    },
    message: (request) => send({ kind: "message", ...request }),
    speak: (request) => send({ kind: "speak", ...request }),
    typing: (request) => send({ kind: "typing", ...request }),
    hangUp: (request) => send({ kind: "hangUp", ...request }),
    dispose: () => transport.close(),
  };
}
