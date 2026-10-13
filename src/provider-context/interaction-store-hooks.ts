import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { AgentLegState, AgentState, Interaction, InteractionId } from "../domain";
import type { EndReason, ProviderError } from "../providers";
import { useInteractionProvider } from "./hooks";
import { getInteractionStore, type InteractionStore } from "./interaction-store";
import {
  EMPTY_TRANSCRIPT,
  type InteractionStoreState,
  type InteractionStoreStatus,
  type TranscriptState,
  type TypingState,
} from "./interaction-store-state";

// Read-only hooks over the interaction store (P0.5.0). Each selector returns
// a reference already held in the store's state, so a component re-renders
// only when its own slice changes. Commands still go through
// `useInteractionProvider()`; their effects arrive back here as events.

const NOT_TYPING: TypingState = Object.freeze({});

function useStore(): InteractionStore {
  return getInteractionStore(useInteractionProvider());
}

function useStoreSelector<T>(select: (state: InteractionStoreState) => T): T {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}

/** The agent's presence and leg; undefined until the first snapshot. */
export function useAgentState(): AgentState | undefined {
  return useStoreSelector((s) => s.agent);
}

/** Calls `onSettled` when the agent leg lands on "connected" or
 *  "disconnected" after this component has already seen a different leg
 *  value. The first value it sees (hydrate on load, or the current state
 *  when a page mounts after a tier switch) never fires, and "connecting"
 *  never fires on its own. Compares values, so StrictMode's effect replay
 *  can't fire it either. */
export function useAgentLegTransitions(onSettled: (leg: "connected" | "disconnected") => void): void {
  const leg = useStoreSelector((s) => s.agent?.leg);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });
  const lastSeenRef = useRef<AgentLegState | undefined>(undefined);
  useEffect(() => {
    if (leg === undefined) return;
    const last = lastSeenRef.current;
    lastSeenRef.current = leg;
    if (last === undefined || last === leg || leg === "connecting") return;
    onSettledRef.current(leg);
  }, [leg]);
}

/** Every interaction the store has seen this session, ended ones included,
 *  in `startedAt` order. Filter by `state` as the screen needs. */
export function useInteractions(): readonly Interaction[] {
  return useStoreSelector((s) => s.interactionList);
}

export function useInteraction(id: InteractionId | undefined): Interaction | undefined {
  return useStoreSelector(useCallback((s: InteractionStoreState) => (id ? s.interactions.get(id) : undefined), [id]));
}

/** Who or what ended the interaction, once its `ended` event has arrived. */
export function useEndReason(id: InteractionId | undefined): EndReason | undefined {
  return useStoreSelector(useCallback((s: InteractionStoreState) => (id ? s.endReasons.get(id) : undefined), [id]));
}

/** Messages and utterances for one interaction, oldest first. Loads
 *  `getTranscript` on first use; `hydrated` is false until it has merged. */
export function useTranscript(id: InteractionId | undefined): TranscriptState {
  const store = useStore();
  useEffect(() => {
    if (id) store.ensureTranscript(id);
  }, [store, id]);
  return useStoreSelector(
    useCallback((s: InteractionStoreState) => (id ? s.transcripts.get(id) : undefined) ?? EMPTY_TRANSCRIPT, [id]),
  );
}

/** Who is typing on a digital interaction, by participant role. */
export function useTyping(id: InteractionId | undefined): TypingState {
  return useStoreSelector(useCallback((s: InteractionStoreState) => (id ? s.typing.get(id) : undefined) ?? NOT_TYPING, [id]));
}

/** Hydration status; `error` is set when the snapshot read failed. */
export function useInteractionStoreStatus(): { status: InteractionStoreStatus; error?: ProviderError } {
  const status = useStoreSelector((s) => s.status);
  const error = useStoreSelector((s) => s.error);
  return error ? { status, error } : { status };
}
