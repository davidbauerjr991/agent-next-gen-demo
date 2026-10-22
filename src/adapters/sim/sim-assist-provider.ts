import type { AssistEvents, AssistProvider, AssistRequestId, ProviderError } from "../../providers";
import { providerError } from "../provider-error";
import { SIM_PROTOCOL_VERSION, type SimCommand, type SimEnvelope } from "./sim-protocol";
import type { SimTransport } from "./sim-transport";
import { simId } from "./sim-util";

// The simulated AssistProvider (P-CANVAS): a client of the same sim engine as
// the interaction provider, on its session. It relays the engine's guidance
// cards (each contact's Next Best Action and Real-Time Summary) as `card`
// events and sends the agent's requests (`suggest` with a Next Best Action
// trigger) and answers (`resolveCard`) back. Other suggestions and
// extraction stay unconnected until P4.1.

interface Pending {
  resolve: () => void;
  reject: (error: ProviderError) => void;
  timer: ReturnType<typeof setTimeout>;
}

type AnyHandler = (payload: never) => void;

export function createSimAssistProvider(options: {
  sessionId: string;
  transport: SimTransport;
  commandTimeoutMs?: number;
}): AssistProvider {
  const { sessionId, transport } = options;
  const commandTimeoutMs = options.commandTimeoutMs ?? 5000;
  const pending = new Map<string, Pending>();
  const listeners = new Map<keyof AssistEvents, Set<AnyHandler>>();
  let disposed = false;

  const unsubscribe = transport.onMessage((envelope: SimEnvelope) => {
    if (disposed || envelope.sessionId !== sessionId) return;
    if (envelope.type === "reply") {
      const request = pending.get(envelope.requestId);
      if (!request) return;
      pending.delete(envelope.requestId);
      clearTimeout(request.timer);
      if (envelope.ok) request.resolve();
      else request.reject(envelope.error);
    } else if (envelope.type === "assist") {
      for (const handler of [...(listeners.get("card") ?? [])]) {
        try {
          (handler as (payload: AssistEvents["card"]) => void)(envelope.payload);
        } catch (err) {
          if (import.meta.env.DEV) console.error("[sim] assist card listener threw", err);
        }
      }
    }
  });

  function request(command: Extract<SimCommand, { name: "resolveCard" | "suggest" }>): Promise<void> {
    if (disposed) return Promise.reject(providerError("invalid-state", `AssistProvider.${command.name}: provider is disposed`));
    return new Promise<void>((resolve, reject) => {
      const requestId = simId("req");
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(providerError("network", `AssistProvider.${command.name}: no reply within ${commandTimeoutMs}ms`));
      }, commandTimeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      transport.send({ v: SIM_PROTOCOL_VERSION, sessionId, type: "command", requestId, command });
    });
  }

  const unconnected = (method: string) => () =>
    Promise.reject(
      disposed
        ? providerError("invalid-state", `AssistProvider.${method}: provider is disposed`)
        : providerError("not-supported", `AssistProvider.${method}: not simulated yet`),
    );

  return {
    on(type, handler) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(handler as AnyHandler);
      return () => {
        set.delete(handler as AnyHandler);
      };
    },
    // The Next Best Action triggers ("next-best-action", "pause") are simulated; the engine rejects the rest.
    async suggest(suggestRequest) {
      const requestId = simId("assist") as AssistRequestId;
      await request({ name: "suggest", requestId, request: suggestRequest });
      return requestId;
    },
    extractEntities: unconnected("extractEntities"),
    cancel: unconnected("cancel"),
    resolveCard: (cardId, resolution) => request({ name: "resolveCard", cardId, resolution }),
    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const [, request] of pending) {
        clearTimeout(request.timer);
        request.reject(providerError("invalid-state", "AssistProvider: provider was disposed before the reply"));
      }
      pending.clear();
      listeners.clear();
      unsubscribe();
      transport.close();
    },
  };
}
