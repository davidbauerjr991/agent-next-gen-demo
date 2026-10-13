// Shared contract plumbing for every provider. Types only — this folder
// imports nothing but `src/domain` (no React, lyra-ui, components, vendors).
//
// Conventions every provider follows:
// - Every method is async. The only sync members are `on()` (registering a
//   listener is not a state change) and a provider's static `capabilities`.
// - A command resolves once the provider has ACCEPTED the request. The
//   resulting state change arrives only as an event — to the caller too.
//   Components never apply optimistic state from a resolved promise.
// - State events carry full snapshots, upserted by id, never diffs, so
//   reducers are idempotent and a replayed event is harmless.
// - Snapshot reads (`getSnapshot`, `getTranscript`, …) let a late mount
//   hydrate — e.g. a tier switch that remounts the page.
// - Every method rejects only with a `ProviderError`.

/** Stops a listener registered with `on()`. Safe to call more than once. */
export type Unsubscribe = () => void;

/** A typed event emitter. `E` maps each event name to its payload. */
export interface EventSource<E extends object> {
  /** Registers `handler` for `type`; returns the function that removes it.
   *  Events emitted before registration are not replayed — hydrate with the
   *  provider's snapshot read first. */
  on<K extends keyof E>(type: K, handler: (event: E[K]) => void): Unsubscribe;
}

/** Teardown shared by every provider. */
export interface ProviderLifecycle {
  /** Releases transports, timers, and listeners. Must be safe to call twice
   *  (StrictMode double-mounts effects); methods called after it reject with
   *  `"invalid-state"`. */
  dispose(): Promise<void>;
}

/**
 * Why a provider call failed.
 * - `not-supported` — the provider can't do this at all; always the result of
 *   calling a command whose capability flag is `false`.
 * - `invalid-state` — the command doesn't fit the current state (e.g.
 *   `accept` on an active contact, `hold` on an ended one).
 * - `not-found` — the id doesn't exist (or no longer exists) on this provider.
 * - `network` — the transport failed; usually `retryable`.
 */
export type ProviderErrorCode = "not-supported" | "invalid-state" | "not-found" | "network";

/** The only value a provider promise rejects with. A plain type, not a
 *  class, so this folder stays types-only; a runtime `isProviderError` guard
 *  arrives with the first implementation (P0.4). */
export interface ProviderError {
  code: ProviderErrorCode;
  /** Developer-facing detail; the UI words its own message from `code`. */
  message: string;
  /** Whether repeating the same call might succeed. Commands take explicit
   *  values rather than toggles, so a retry is safe. Normally `true` only for
   *  `network`. */
  retryable: boolean;
}
