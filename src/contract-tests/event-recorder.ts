import { expect } from "vitest";
import { isProviderError } from "../adapters/provider-error";
import type { InteractionEvents, InteractionProvider, ProviderErrorCode } from "../providers";

// Helpers for the InteractionProvider contract suite.

type TimelineEntry =
  | { kind: "event"; name: keyof InteractionEvents; payload: unknown }
  | { kind: "ack"; label: string };

export interface Recorder {
  /** Every event and tracked ack, in the order they happened. */
  timeline: TimelineEntry[];
  /** Events only, optionally one name. */
  events<K extends keyof InteractionEvents>(name: K): InteractionEvents[K][];
  /** Adds `ack:<label>` to the timeline when `promise` resolves. */
  track<T>(label: string, promise: Promise<T>): Promise<T>;
  /** Index of the first timeline entry matching `predicate` at or after `from`. */
  indexOf(predicate: (entry: TimelineEntry) => boolean, from?: number): number;
  /** Marks "now"; `since(mark)` is the timeline entries recorded after it. */
  mark(): number;
  since(mark: number): TimelineEntry[];
  stop(): void;
}

export function recordEvents(provider: InteractionProvider): Recorder {
  const timeline: TimelineEntry[] = [];
  const names: (keyof InteractionEvents)[] = ["incoming", "stateChanged", "message", "transcript", "typing", "ended"];
  const stops = names.map((name) =>
    provider.on(name, (payload) => {
      timeline.push({ kind: "event", name, payload });
    }),
  );
  return {
    timeline,
    events: <K extends keyof InteractionEvents>(name: K) =>
      timeline.flatMap((e) => (e.kind === "event" && e.name === name ? [e.payload as InteractionEvents[K]] : [])),
    track: (label, promise) =>
      promise.then((value) => {
        timeline.push({ kind: "ack", label });
        return value;
      }),
    indexOf: (predicate, from = 0) => {
      for (let i = from; i < timeline.length; i++) if (predicate(timeline[i])) return i;
      return -1;
    },
    mark: () => timeline.length,
    since: (mark) => timeline.slice(mark),
    stop: () => stops.forEach((stop) => stop()),
  };
}

/** Polls until `predicate` holds, or fails with `message` after `timeoutMs`. */
export async function waitFor(predicate: () => boolean, message: string, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`waitFor timed out: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

/**
 * Barrier for "nothing else happens": a `getSnapshot()` round trip. With an
 * ordered transport, every event a previous command caused arrives before
 * this reply. `quietMs` adds a quiet window for adapters with slower paths.
 */
export async function settle(provider: InteractionProvider, quietMs = 0): Promise<void> {
  await provider.getSnapshot();
  if (quietMs > 0) await new Promise((resolve) => setTimeout(resolve, quietMs));
}

/** Asserts `promise` rejects with a ProviderError of `code` (non-network
 *  codes must not be retryable). */
export async function expectProviderError(promise: Promise<unknown>, code: ProviderErrorCode): Promise<void> {
  let rejection: unknown;
  try {
    await promise;
  } catch (err) {
    rejection = err;
  }
  expect(rejection, `expected a "${code}" rejection, but the call resolved`).toBeDefined();
  expect(isProviderError(rejection), `rejection is not a ProviderError: ${String(rejection)}`).toBe(true);
  if (isProviderError(rejection)) {
    expect(rejection.code).toBe(code);
    if (code !== "network") expect(rejection.retryable).toBe(false);
  }
}
