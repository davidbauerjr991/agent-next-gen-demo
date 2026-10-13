import type {
  AgentState,
  Interaction,
  InteractionId,
  Message,
  Participant,
  Utterance,
} from "../domain";
import type { EndReason, ProviderError } from "../providers";

// Pure state for the interaction store (P0.5.0). No React, no provider —
// every function takes a state and returns the next one. Provider events are
// full snapshots, so every update is an upsert by id; when the incoming
// snapshot equals what's stored, the SAME state object comes back, which
// makes a replayed event a no-op (no new references, no re-render).

export type InteractionStoreStatus = "idle" | "hydrating" | "ready" | "error";

export interface TranscriptState {
  messages: readonly Message[];
  utterances: readonly Utterance[];
  /** `getTranscript` has been merged in (events alone don't set this). */
  hydrated: boolean;
}

export type TypingState = Partial<Record<Participant["role"], boolean>>;

export interface InteractionStoreState {
  status: InteractionStoreStatus;
  error?: ProviderError;
  agent?: AgentState;
  interactions: ReadonlyMap<InteractionId, Interaction>;
  /** `interactions` in `startedAt` order (ties keep arrival order); rebuilt
   *  only when `interactions` changes, so it's a stable hook result. */
  interactionList: readonly Interaction[];
  endReasons: ReadonlyMap<InteractionId, EndReason>;
  transcripts: ReadonlyMap<InteractionId, TranscriptState>;
  typing: ReadonlyMap<InteractionId, TypingState>;
}

export const EMPTY_TRANSCRIPT: TranscriptState = Object.freeze({ messages: [], utterances: [], hydrated: false });

export function initialStoreState(): InteractionStoreState {
  return {
    status: "idle",
    interactions: new Map(),
    interactionList: [],
    endReasons: new Map(),
    transcripts: new Map(),
    typing: new Map(),
  };
}

// ── Status ───────────────────────────────────────────────────────────────

export function setStatus(state: InteractionStoreState, status: InteractionStoreStatus, error?: ProviderError): InteractionStoreState {
  if (state.status === status && state.error === error) return state;
  const next = { ...state, status };
  if (error) next.error = error;
  else delete next.error;
  return next;
}

// ── Agent and interactions ───────────────────────────────────────────────

export function upsertAgent(state: InteractionStoreState, agent: AgentState): InteractionStoreState {
  if (state.agent && sameValue(state.agent, agent)) return state;
  return { ...state, agent };
}

export function upsertInteraction(state: InteractionStoreState, interaction: Interaction): InteractionStoreState {
  return upsertInteractions(state, [interaction]);
}

function upsertInteractions(state: InteractionStoreState, incoming: readonly Interaction[]): InteractionStoreState {
  let interactions: Map<InteractionId, Interaction> | undefined;
  for (const interaction of incoming) {
    const current = (interactions ?? state.interactions).get(interaction.id);
    if (current && sameValue(current, interaction)) continue;
    interactions ??=new Map(state.interactions);
    interactions.set(interaction.id, interaction);
  }
  if (!interactions) return state;
  return { ...state, interactions, interactionList: sortedList(interactions) };
}

function sortedList(interactions: ReadonlyMap<InteractionId, Interaction>): Interaction[] {
  // Array.prototype.sort is stable, so equal `startedAt` keeps insertion order.
  return [...interactions.values()].sort((a, b) => a.startedAt - b.startedAt);
}

/** `ended` fires after the final `stateChanged`; the interaction stays in the
 *  store (state "ended") so the page decides when its card goes away. */
export function applyEnded(state: InteractionStoreState, interactionId: InteractionId, reason: EndReason): InteractionStoreState {
  let next = state;
  if (next.endReasons.get(interactionId) !== reason) {
    const endReasons = new Map(next.endReasons);
    endReasons.set(interactionId, reason);
    next = { ...next, endReasons };
  }
  if (next.typing.has(interactionId)) {
    const typing = new Map(next.typing);
    typing.delete(interactionId);
    next = { ...next, typing };
  }
  return next;
}

/** Merges a `getSnapshot()` result. Upserts only — never deletes: an
 *  interaction that ended while unsubscribed keeps its stored entry rather
 *  than vanishing (the snapshot lists non-ended contacts only). */
export function applyHydrate(
  state: InteractionStoreState,
  snapshot: { agent: AgentState; interactions: readonly Interaction[] },
): InteractionStoreState {
  return upsertInteractions(upsertAgent(state, snapshot.agent), snapshot.interactions);
}

// ── Transcripts ──────────────────────────────────────────────────────────

export function upsertMessage(state: InteractionStoreState, message: Message): InteractionStoreState {
  return updateTranscript(state, message.interactionId, (t) => {
    const messages = upsertById(t.messages, [message], (m) => m.sentAt);
    return messages === t.messages ? t : { ...t, messages };
  });
}

export function upsertUtterance(state: InteractionStoreState, utterance: Utterance): InteractionStoreState {
  return updateTranscript(state, utterance.interactionId, (t) => {
    const utterances = upsertById(t.utterances, [utterance], (u) => u.startedAt);
    return utterances === t.utterances ? t : { ...t, utterances };
  });
}

/** Merges a `getTranscript()` result with whatever events already arrived,
 *  by id, and marks the transcript hydrated. */
export function applyTranscriptHydrate(
  state: InteractionStoreState,
  interactionId: InteractionId,
  transcript: { messages: readonly Message[]; utterances: readonly Utterance[] },
): InteractionStoreState {
  return updateTranscript(state, interactionId, (t) => {
    const messages = upsertById(t.messages, transcript.messages, (m) => m.sentAt);
    const utterances = upsertById(t.utterances, transcript.utterances, (u) => u.startedAt);
    if (messages === t.messages && utterances === t.utterances && t.hydrated) return t;
    return { messages, utterances, hydrated: true };
  });
}

function updateTranscript(
  state: InteractionStoreState,
  interactionId: InteractionId,
  update: (transcript: TranscriptState) => TranscriptState,
): InteractionStoreState {
  const current = state.transcripts.get(interactionId) ?? EMPTY_TRANSCRIPT;
  const next = update(current);
  if (next === current) return state;
  const transcripts = new Map(state.transcripts);
  transcripts.set(interactionId, next);
  return { ...state, transcripts };
}

/** Upserts `incoming` into `list` by id, keeping it ordered by `time` (ties
 *  keep arrival order). Returns `list` itself when nothing changed. */
function upsertById<T extends { id: string }>(list: readonly T[], incoming: readonly T[], time: (item: T) => number): readonly T[] {
  let next: T[] | undefined;
  let reorder = false;
  for (const item of incoming) {
    const source = next ?? list;
    const index = source.findIndex((existing) => existing.id === item.id);
    if (index >= 0 && sameValue(source[index], item)) continue;
    next ??= [...list];
    if (index >= 0) {
      next[index] = item;
      if (time(item) !== time(source[index])) reorder = true;
    } else {
      if (next.length > 0 && time(item) < time(next[next.length - 1])) reorder = true;
      next.push(item);
    }
  }
  if (!next) return list;
  return reorder ? next.sort((a, b) => time(a) - time(b)) : next;
}

// ── Typing ───────────────────────────────────────────────────────────────

export function applyTyping(
  state: InteractionStoreState,
  interactionId: InteractionId,
  role: Participant["role"],
  isTyping: boolean,
): InteractionStoreState {
  const current = state.typing.get(interactionId) ?? {};
  if ((current[role] ?? false) === isTyping) return state;
  const typing = new Map(state.typing);
  typing.set(interactionId, { ...current, [role]: isTyping });
  return { ...state, typing };
}

// ── Equality ─────────────────────────────────────────────────────────────

/** Structural equality for plain event payloads (objects, arrays,
 *  primitives). A key holding `undefined` counts as absent, since a cloned
 *  snapshot may carry `heldSince: undefined` where another omits it. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    return a.length === other.length && a.every((value, i) => sameValue(value, other[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!sameValue(left[key], right[key])) return false;
  }
  return true;
}
