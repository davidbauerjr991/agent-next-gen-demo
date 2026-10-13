import { SIM_PROTOCOL_VERSION, type SimEnvelope } from "./sim-protocol";
import type { SimTransport } from "./sim-transport";

// An in-memory stand-in for the BroadcastChannel bus (P0.8): same delivery
// rules, no browser API, so tests (and Storybook, later) can run the sim
// anywhere. Rules it copies from BroadcastChannel:
// - a message goes to every OTHER open endpoint on the bus, never back to
//   its sender;
// - delivery is asynchronous, each message in its own task, in send order
//   (the provider's ack-before-event guarantee relies on this — a
//   synchronous bus would let events fire before the awaiting caller resumes);
// - a closed endpoint sends and receives nothing.

export interface MemoryBus {
  /** A new endpoint on this bus. */
  createTransport(): SimTransport;
}

export function createMemoryBus(): MemoryBus {
  const endpoints = new Set<Endpoint>();

  interface Endpoint {
    handlers: Set<(message: SimEnvelope) => void>;
    closed: boolean;
  }

  return {
    createTransport() {
      const self: Endpoint = { handlers: new Set(), closed: false };
      endpoints.add(self);
      return {
        send(message) {
          if (self.closed) return;
          // Structured clone, like a real channel: no shared references.
          const copy = structuredClone(message);
          for (const endpoint of endpoints) {
            if (endpoint === self) continue;
            setTimeout(() => {
              if (endpoint.closed || copy.v !== SIM_PROTOCOL_VERSION) return;
              for (const handler of [...endpoint.handlers]) handler(copy);
            }, 0);
          }
        },
        onMessage(handler) {
          self.handlers.add(handler);
          return () => {
            self.handlers.delete(handler);
          };
        },
        close() {
          if (self.closed) return;
          self.closed = true;
          self.handlers.clear();
          endpoints.delete(self);
        },
      };
    },
  };
}
