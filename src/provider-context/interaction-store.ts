import { isProviderError, providerError } from "../adapters/provider-error";
import type { InteractionId } from "../domain";
import type { InteractionProvider, ProviderError, Unsubscribe } from "../providers";
import {
  applyEnded,
  applyHydrate,
  applyTranscriptHydrate,
  applyTyping,
  initialStoreState,
  setStatus,
  upsertAgent,
  upsertInteraction,
  upsertMessage,
  upsertUtterance,
  type InteractionStoreState,
} from "./interaction-store-state";

// The interaction store (P0.5.0): one per InteractionProvider instance. It
// subscribes to the provider's events, hydrates with `getSnapshot()` (and
// `getTranscript()` per interaction, lazily), and keeps an immutable state
// for `useSyncExternalStore`. Not exported from the provider-context index:
// components read it only through the hooks in `interaction-store-hooks.ts`.

export interface InteractionStore {
  getState(): InteractionStoreState;
  /** Calls `listener` after each change of the state reference. */
  subscribe(listener: () => void): Unsubscribe;
  /** Ref-counted. The first call subscribes to the provider, then hydrates. */
  start(): void;
  /** Ref-counted. The last call unsubscribes; state is kept, and a later
   *  `start()` re-hydrates (harmless — hydration only upserts). */
  stop(): void;
  /** Loads `getTranscript(id)` once and merges it with events already
   *  received. Safe to call repeatedly; failures other than `not-found` let
   *  a later call retry. */
  ensureTranscript(interactionId: InteractionId): void;
}

const stores = new WeakMap<InteractionProvider, InteractionStore>();

/** The store for `provider`, created on first use. Keyed by provider
 *  instance, so StrictMode remounts reuse it and a provider swap (database or
 *  profile change) starts from an empty one. */
export function getInteractionStore(provider: InteractionProvider): InteractionStore {
  let store = stores.get(provider);
  if (!store) {
    store = createInteractionStore(provider);
    stores.set(provider, store);
  }
  return store;
}

export function createInteractionStore(provider: InteractionProvider): InteractionStore {
  let state = initialStoreState();
  const listeners = new Set<() => void>();
  let refs = 0;
  let unsubscribes: Unsubscribe[] = [];
  /** Bumped on every subscribe/unsubscribe, so a snapshot that resolves after
   *  `stop()` (or after a newer `start()`) is ignored. */
  let generation = 0;
  const transcriptRequests = new Set<InteractionId>();

  function commit(next: InteractionStoreState) {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function subscribeToProvider() {
    unsubscribes = [
      provider.on("incoming", ({ interaction }) => commit(upsertInteraction(state, interaction))),
      provider.on("stateChanged", (event) =>
        commit(event.kind === "agent" ? upsertAgent(state, event.agent) : upsertInteraction(state, event.interaction)),
      ),
      provider.on("message", ({ message }) => commit(upsertMessage(state, message))),
      provider.on("transcript", ({ utterance }) => commit(upsertUtterance(state, utterance))),
      provider.on("typing", ({ interactionId, role, isTyping }) => commit(applyTyping(state, interactionId, role, isTyping))),
      provider.on("ended", ({ interactionId, reason }) => commit(applyEnded(state, interactionId, reason))),
    ];
  }

  async function hydrate(forGeneration: number) {
    commit(setStatus(state, "hydrating"));
    try {
      // Subscribed first (above), then read, so nothing in between is missed.
      const snapshot = await provider.getSnapshot();
      if (forGeneration !== generation) return;
      commit(setStatus(applyHydrate(state, snapshot), "ready"));
    } catch (err) {
      if (forGeneration !== generation) return;
      const error = asProviderError(err);
      if (import.meta.env.DEV) console.warn(`[interaction-store] hydrate failed (${error.code}): ${error.message}`);
      commit(setStatus(state, "error", error));
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start() {
      refs += 1;
      if (refs > 1) return;
      generation += 1;
      subscribeToProvider();
      void hydrate(generation);
    },

    stop() {
      if (refs === 0) return;
      refs -= 1;
      if (refs > 0) return;
      generation += 1;
      for (const unsubscribe of unsubscribes) unsubscribe();
      unsubscribes = [];
    },

    ensureTranscript(interactionId) {
      if (transcriptRequests.has(interactionId) || state.transcripts.get(interactionId)?.hydrated) return;
      transcriptRequests.add(interactionId);
      provider.getTranscript(interactionId).then(
        (transcript) => commit(applyTranscriptHydrate(state, interactionId, transcript)),
        (err) => {
          const error = asProviderError(err);
          if (error.code === "not-found") {
            commit(applyTranscriptHydrate(state, interactionId, { messages: [], utterances: [] }));
            return;
          }
          transcriptRequests.delete(interactionId);
          if (import.meta.env.DEV) console.warn(`[interaction-store] transcript ${interactionId} failed (${error.code}): ${error.message}`);
        },
      );
    },
  };
}

function asProviderError(err: unknown): ProviderError {
  return isProviderError(err) ? err : providerError("network", String(err));
}
