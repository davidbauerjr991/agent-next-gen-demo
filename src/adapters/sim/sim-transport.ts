import type { Unsubscribe } from "../../providers";
import { SIM_PROTOCOL_VERSION, type SimEnvelope } from "./sim-protocol";

// The swap seam between the sim and its bus. BroadcastChannel today; a
// WebSocket transport later implements the same three methods and nothing
// above it changes.

/** A fire-and-forget message pipe, like a socket. Request/reply correlation
 *  lives in the provider, not here. */
export interface SimTransport {
  send(message: SimEnvelope): void;
  onMessage(handler: (message: SimEnvelope) => void): Unsubscribe;
  /** Stops sending and receiving. Safe to call twice. */
  close(): void;
}

export const SIM_CHANNEL_NAME = "agent-sim";

/** A `BroadcastChannel` endpoint. Other endpoints with the same name — in this
 *  window or another same-origin one — receive what it sends; it never
 *  receives its own messages. */
export function createBroadcastTransport(name: string = SIM_CHANNEL_NAME): SimTransport {
  const channel = new BroadcastChannel(name);
  const handlers = new Set<(message: SimEnvelope) => void>();
  let closed = false;

  channel.onmessage = (e: MessageEvent<unknown>) => {
    const data = e.data as Partial<SimEnvelope> | null;
    if (!data || typeof data !== "object" || data.v !== SIM_PROTOCOL_VERSION) return;
    for (const handler of [...handlers]) handler(data as SimEnvelope);
  };

  return {
    send(message) {
      if (!closed) channel.postMessage(message);
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      handlers.clear();
      channel.onmessage = null;
      channel.close();
    },
  };
}

export interface LatencyRange {
  minMs: number;
  maxMs: number;
}

export const DEFAULT_LATENCY: LatencyRange = { minMs: 200, maxMs: 800 };

/** Delays each `send` by a uniform sample from `range`, keeping send order
 *  (a later message never overtakes an earlier one). `{0, 0}` sends
 *  synchronously. Pending sends are dropped on `close()`. */
export function withLatency(inner: SimTransport, range: LatencyRange = DEFAULT_LATENCY): SimTransport {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let lastDeliverAt = 0;
  let closed = false;

  return {
    send(message) {
      if (closed) return;
      const span = Math.max(0, range.maxMs - range.minMs);
      const sample = Math.max(0, range.minMs) + Math.random() * span;
      if (sample === 0 && timers.size === 0) {
        inner.send(message);
        return;
      }
      const now = Date.now();
      const deliverAt = Math.max(lastDeliverAt, now + sample);
      lastDeliverAt = deliverAt;
      const timer = setTimeout(() => {
        timers.delete(timer);
        inner.send(message);
      }, deliverAt - now);
      timers.add(timer);
    },
    onMessage: (handler) => inner.onMessage(handler),
    close() {
      if (closed) return;
      closed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      inner.close();
    },
  };
}
