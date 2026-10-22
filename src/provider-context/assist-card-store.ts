import { useSyncExternalStore } from "react";
import type { InteractionId } from "../domain";
import type { AssistCard, AssistProvider, Unsubscribe } from "../providers";
import { useAssistProvider } from "./hooks";

// The assist card store (P-CANVAS): one per AssistProvider instance, fed by
// its `card` events, like the interaction store is by the interaction
// provider's. It keeps each contact's always-on cards — its Next Best Action
// (the `nba` card) and its Real-Time Summary (the `text` card with purpose
// "real-time-summary") — for `useSyncExternalStore`. Started by
// `ProviderRoot` while mounted, so no card event is missed.

export type NextBestActionCard = Extract<AssistCard, { kind: "nba" }>;
export type RealTimeSummaryCard = Extract<AssistCard, { kind: "text" }>;

export interface RealTimeSummaryState {
  card: RealTimeSummaryCard;
  /** The text before the latest update (what's new is marked). */
  previous?: string;
  /** When the latest update arrived. */
  updatedAt: number;
}

export interface ContactAssistCards {
  nba?: NextBestActionCard;
  summary?: RealTimeSummaryState;
  /** The last reference card the nba card brought forward, and the step that did — kept past later snapshots, so no focus call is missed. */
  focus?: { stepId: string; card: NonNullable<NextBestActionCard["focus"]> };
}

type State = Readonly<Record<string, ContactAssistCards>>;

export interface AssistCardStore {
  getState(): State;
  subscribe(listener: () => void): Unsubscribe;
  /** Ref-counted: the first call subscribes to the provider, the last `stop` unsubscribes (state is kept). */
  start(): void;
  stop(): void;
}

const stores = new WeakMap<AssistProvider, AssistCardStore>();

export function getAssistCardStore(provider: AssistProvider): AssistCardStore {
  let store = stores.get(provider);
  if (!store) {
    store = createAssistCardStore(provider);
    stores.set(provider, store);
  }
  return store;
}

export function createAssistCardStore(provider: AssistProvider, now: () => number = Date.now): AssistCardStore {
  let state: State = {};
  const listeners = new Set<() => void>();
  let refs = 0;
  let unsubscribe: Unsubscribe | null = null;

  function commit(next: State) {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  }

  function onCard({ interactionId, card }: { interactionId: InteractionId; card: AssistCard }) {
    const current = state[interactionId] ?? {};
    if (card.kind === "nba") {
      const focus = card.focus ? { stepId: card.stepId, card: card.focus } : current.focus;
      commit({ ...state, [interactionId]: { ...current, nba: card, ...(focus ? { focus } : {}) } });
    } else if (card.kind === "text" && card.purpose === "real-time-summary") {
      const before = current.summary?.card.text;
      const changed = before !== card.text;
      const previous = changed ? before : current.summary?.previous;
      const summary: RealTimeSummaryState = {
        card,
        ...(previous !== undefined ? { previous } : {}),
        updatedAt: changed ? now() : (current.summary?.updatedAt ?? now()),
      };
      commit({ ...state, [interactionId]: { ...current, summary } });
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
      if (refs === 1) unsubscribe = provider.on("card", onCard);
    },
    stop() {
      refs = Math.max(0, refs - 1);
      if (refs === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  };
}

const NONE: ContactAssistCards = Object.freeze({});

/** Every contact's cards, by provider interaction id. */
export function useAssistCardsByContact(): State {
  const store = getAssistCardStore(useAssistProvider());
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** A contact's Next Best Action and Real-Time Summary cards (empty until the provider sends them). */
export function useContactAssistCards(interactionId: string | undefined): ContactAssistCards {
  const store = getAssistCardStore(useAssistProvider());
  return useSyncExternalStore(store.subscribe, () => (interactionId ? (store.getState()[interactionId] ?? NONE) : NONE));
}
