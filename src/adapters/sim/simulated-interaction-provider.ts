import type { InteractionCapabilities, InteractionEvents, InteractionProvider, ProviderError } from "../../providers";
import { providerError } from "../provider-error";
import { createSimEngine, type SimEngine } from "./sim-engine";
import { DEFAULT_SIM_TIMINGS, SIM_CAPABILITIES, type SimSeedContact, type SimTimings } from "./sim-fixtures";
import {
  SIM_PROTOCOL_VERSION,
  type SimCommand,
  type SimCommandName,
  type SimCommandResults,
  type SimEnvelope,
} from "./sim-protocol";
import { createBroadcastTransport, DEFAULT_LATENCY, withLatency, type LatencyRange, type SimTransport } from "./sim-transport";
import { simId, unsupportedReason } from "./sim-util";

// The simulated InteractionProvider (P0.4): a pure client of the sim engine.
// It holds no interaction state — every method, reads included, is a
// command sent over the transport, resolved by the engine's reply. State
// arrives only as events. Swapping BroadcastChannel for a WebSocket is a
// different `createTransport`; nothing else here changes.

export interface SimOptions {
  /** Injected delay on every command this provider sends. Default 200–800ms;
   *  `{ minMs: 0, maxMs: 0 }` for tests. */
  latency?: LatencyRange;
  /** Scripted delays inside the engine (ringing, leg connect, delivery). */
  timings?: Partial<SimTimings>;
  /** Overrides on the sim's capabilities, e.g. to exercise "not-supported". */
  capabilities?: Partial<InteractionCapabilities>;
  /** Makes one bus endpoint; called for the provider and for its engine.
   *  Default: a `BroadcastChannel("agent-sim")` endpoint. */
  createTransport?: () => SimTransport;
  /** `false` when the engine runs elsewhere (another window, a server). */
  engine?: boolean;
  /** How long a command waits for its reply before rejecting "network". */
  commandTimeoutMs?: number;
  /** Contacts the engine starts with (e.g. `SIM_DEMO_SEED`). Default none,
   *  so the contract suite starts from an empty engine. */
  seed?: readonly SimSeedContact[];
}

/** The sim provider plus its session id, which the customer side (the P0.6
 *  console, `__simCustomer` until then) addresses its messages to. */
export interface SimulatedInteractionProvider extends InteractionProvider {
  readonly sessionId: string;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: ProviderError) => void;
  timer: ReturnType<typeof setTimeout>;
}

type AnyHandler = (payload: unknown) => void;

export function createSimulatedInteractionProvider(options: SimOptions = {}): SimulatedInteractionProvider {
  const sessionId = simId("session");
  const capabilities: InteractionCapabilities = { ...SIM_CAPABILITIES, ...options.capabilities };
  const createTransport = options.createTransport ?? (() => createBroadcastTransport());
  const commandTimeoutMs = options.commandTimeoutMs ?? 5000;

  const engine: SimEngine | null =
    options.engine === false
      ? null
      : createSimEngine({
          transport: createTransport(),
          sessionId,
          capabilities,
          timings: { ...DEFAULT_SIM_TIMINGS, ...options.timings },
          seed: options.seed ?? [],
        });
  const transport = withLatency(createTransport(), options.latency ?? DEFAULT_LATENCY);

  const pending = new Map<string, Pending>();
  const listeners = new Map<keyof InteractionEvents, Set<AnyHandler>>();
  let disposed = false;
  let disposing: Promise<void> | null = null;

  const unsubscribe = transport.onMessage((envelope: SimEnvelope) => {
    if (disposed || envelope.sessionId !== sessionId) return;
    if (envelope.type === "reply") {
      const request = pending.get(envelope.requestId);
      if (!request) return;
      pending.delete(envelope.requestId);
      clearTimeout(request.timer);
      if (envelope.ok) request.resolve(envelope.result);
      else request.reject(envelope.error);
    } else if (envelope.type === "event") {
      const handlers = listeners.get(envelope.event.name);
      if (!handlers) return;
      for (const handler of [...handlers]) {
        try {
          handler(envelope.event.payload);
        } catch (err) {
          if (import.meta.env.DEV) console.error(`[sim] ${envelope.event.name} listener threw`, err);
        }
      }
    }
  });

  function request<N extends SimCommandName>(command: Extract<SimCommand, { name: N }>): Promise<SimCommandResults[N]> {
    if (disposed) {
      return Promise.reject(providerError("invalid-state", `InteractionProvider.${command.name}: provider is disposed`));
    }
    const unsupported = unsupportedReason(command, capabilities);
    if (unsupported) {
      return Promise.reject(providerError("not-supported", `InteractionProvider.${command.name}: ${unsupported}`));
    }
    return new Promise<SimCommandResults[N]>((resolve, reject) => {
      const requestId = simId("req");
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(providerError("network", `InteractionProvider.${command.name}: no reply within ${commandTimeoutMs}ms`));
      }, commandTimeoutMs);
      pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timer });
      transport.send({ v: SIM_PROTOCOL_VERSION, sessionId, type: "command", requestId, command });
    });
  }

  async function dispose(): Promise<void> {
    if (disposing) return disposing;
    disposing = (async () => {
      disposed = true;
      for (const [, request] of pending) {
        clearTimeout(request.timer);
        request.reject(providerError("invalid-state", "InteractionProvider: provider was disposed before the reply"));
      }
      pending.clear();
      listeners.clear();
      unsubscribe();
      transport.close();
      engine?.dispose();
    })();
    return disposing;
  }

  return {
    sessionId,
    capabilities,
    on(type, handler) {
      if (disposed) return () => {};
      let handlers = listeners.get(type);
      if (!handlers) {
        handlers = new Set();
        listeners.set(type, handlers);
      }
      const entry = handler as AnyHandler;
      handlers.add(entry);
      return () => {
        listeners.get(type)?.delete(entry);
      };
    },
    dispose,

    getSnapshot: () => request({ name: "getSnapshot" }),
    getTranscript: (interactionId) => request({ name: "getTranscript", interactionId }),
    listPresenceOptions: () => request({ name: "listPresenceOptions" }),
    listOutboundSkills: (channel) => request({ name: "listOutboundSkills", channel }),

    setAgentState: (code, reasonCode) => request({ name: "setAgentState", code, reasonCode }),
    connectAgentLeg: () => request({ name: "connectAgentLeg" }),
    disconnectAgentLeg: () => request({ name: "disconnectAgentLeg" }),

    accept: (interactionId) => request({ name: "accept", interactionId }),
    decline: (interactionId) => request({ name: "decline", interactionId }),
    dial: (dialRequest) => request({ name: "dial", request: dialRequest }),
    reopen: (reopenRequest) => request({ name: "reopen", request: reopenRequest }),
    end: (interactionId) => request({ name: "end", interactionId }),
    completeWrapUp: (interactionId, outcome) => request({ name: "completeWrapUp", interactionId, outcome }),

    hold: (interactionId, onHold) => request({ name: "hold", interactionId, onHold }),
    mute: (interactionId, muted) => request({ name: "mute", interactionId, muted }),
    setRecording: (interactionId, recording) => request({ name: "setRecording", interactionId, recording }),
    setMasked: (interactionId, masked) => request({ name: "setMasked", interactionId, masked }),
    sendDtmf: (interactionId, digits) => request({ name: "sendDtmf", interactionId, digits }),
    transfer: (interactionId, target, mode) => request({ name: "transfer", interactionId, target, mode }),
    sendMessage: (interactionId, text) => request({ name: "sendMessage", interactionId, text }),
    setTyping: (interactionId, isTyping) => request({ name: "setTyping", interactionId, isTyping }),
    setCaseStatus: (interactionId, status) => request({ name: "setCaseStatus", interactionId, status }),
    associateEntity: (interactionId, entityId) => request({ name: "associateEntity", interactionId, entityId }),
  } satisfies SimulatedInteractionProvider;
}
