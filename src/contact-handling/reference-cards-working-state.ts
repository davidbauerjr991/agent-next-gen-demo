// Per-browser working state for the reference cards pinned at the top of the main column under the stacked canvas
// (P-LAYOUT-F1 D): which ones the agent opened, by card, for every assignment. Like the assignments' working state
// (`assignments-working-state.ts`): not settings, never in a profile, untouched by Reset, kept in this browser only;
// every storage access is wrapped, falling back to memory. The two-column canvas keeps its per-assignment memory
// (`referenceByAssignment`, in memory).
import { useSyncExternalStore } from "react";

const KEY = "agent-next-gen:working:reference-cards";

/** The cards the agent left open (by reference card id); a card not listed is collapsed, as they start. */
export type ReferenceCardsWorkingState = Readonly<Record<string, boolean>>;

const EMPTY: ReferenceCardsWorkingState = Object.freeze({});

function parse(raw: string | null): ReferenceCardsWorkingState {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return EMPTY;
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "boolean")) as ReferenceCardsWorkingState;
  } catch {
    return EMPTY;
  }
}

function stored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let cache: { raw: string | null; value: ReferenceCardsWorkingState } | null = null;
let memory: ReferenceCardsWorkingState | null = null;
const listeners = new Set<() => void>();

function current(): ReferenceCardsWorkingState {
  const raw = stored();
  if (raw === null && memory) return memory;
  if (!cache || cache.raw !== raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

/** Remembers whether the agent left `card` open. */
export function setReferenceCardWorkingOpen(card: string, open: boolean) {
  const next = { ...current(), [card]: open };
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, raw);
    memory = null;
  } catch {
    memory = next;
  }
  cache = { raw, value: next };
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReferenceCardsWorkingState(): ReferenceCardsWorkingState {
  return useSyncExternalStore(subscribe, current);
}

/** Tests only: forget the in-memory value. */
export function resetReferenceCardsWorkingStateForTests() {
  cache = null;
  memory = null;
}
