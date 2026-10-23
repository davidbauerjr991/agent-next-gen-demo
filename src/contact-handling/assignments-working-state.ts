// Per-browser working state for the assignments list (P-PROFILES): the
// Custom drag order and the interior panel's pin. Not settings: never in a
// profile, untouched by Reset, kept in this browser only. Every storage access
// is wrapped (private browsing, blocked storage), falling back to defaults.
import { useSyncExternalStore } from "react";

const KEY = "agent-next-gen:working:assignments";

export interface AssignmentsWorkingState {
  /** Card ids in the agent's dragged order (Sort → Custom). */
  order: string[];
  /** The interior panel's pin (Settings → "Show as interior panel"). */
  panelPinned: boolean;
}

const DEFAULTS: AssignmentsWorkingState = { order: [], panelPinned: true };

function parse(raw: string | null): AssignmentsWorkingState {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<AssignmentsWorkingState>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((id): id is string => typeof id === "string") : DEFAULTS.order,
      panelPinned: typeof parsed.panelPinned === "boolean" ? parsed.panelPinned : DEFAULTS.panelPinned,
    };
  } catch {
    return DEFAULTS;
  }
}

function stored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// The parsed value is kept for its stored string, so a stable snapshot comes
// back until the string changes (another tab, a cleared store).
let cache: { raw: string | null; value: AssignmentsWorkingState } | null = null;
let memory: AssignmentsWorkingState | null = null;
const listeners = new Set<() => void>();

function current(): AssignmentsWorkingState {
  const raw = stored();
  if (raw === null && memory) return memory; // storage unavailable: the in-memory value
  if (!cache || cache.raw !== raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

export function setAssignmentsWorkingState(patch: Partial<AssignmentsWorkingState>) {
  const next = { ...current(), ...patch };
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, raw);
    memory = null;
  } catch {
    memory = next; // The in-memory value still applies.
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

export function useAssignmentsWorkingState(): AssignmentsWorkingState {
  return useSyncExternalStore(subscribe, current);
}

/** Tests only: forget the in-memory value. */
export function resetAssignmentsWorkingStateForTests() {
  cache = null;
  memory = null;
}
