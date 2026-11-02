// Per-browser working state for the assignments list (P-PROFILES): the Custom drag order, and the interior panel's
// open, pinned and dragged-width state (P-LAYOUT fix (a): lyra's left SidePanel, open and pinned by default). Not
// settings: never in a profile, untouched by Reset, kept in this browser only. Every storage access is wrapped
// (private browsing, blocked storage), falling back to defaults.
import { useSyncExternalStore } from "react";

const KEY = "agent-next-gen:working:assignments";
/** Where P-HOME-1n's InteriorPanel kept its dragged width: lyra InteriorPanel's `storageKey` cookie. Read once into
 *  `panelWidth`, then deleted. */
const LEGACY_WIDTH_COOKIE = "workspace.assignmentsPanel";

export interface AssignmentsWorkingState {
  /** Card ids in the agent's dragged order (Sort → Custom). */
  order: string[];
  /** The interior panel is open (its toggle); `null` until it's set, when it starts open (P-LAYOUT-F3 10). */
  panelOpen: boolean | null;
  /** The interior panel is pinned: it pushes the content while it fits; unpinned, it's an overlay. `null` until it's
   *  set, when it starts pinned (P-LAYOUT-F3 10: pinning is this per-browser state only; no setting). */
  panelPinned: boolean | null;
  /** The interior panel's dragged width, px; `null` until the agent drags it (the reader clamps it to the panel's bounds). */
  panelWidth: number | null;
  /** The reference column is pinned open beside the action area (P-LAYOUT-F4 7); false is closed, its hover flyout
   *  and a click that pins it. `null` until it's set, when it starts pinned (the column as it always was). */
  referencePinned: boolean | null;
  /** The right column's dragged width, px, in every AI display (P-LAYOUT-F4 19); `null` until dragged (the card
   *  width). The reader clamps it to the column's bounds (`useReferenceColumnWidth`). */
  referenceWidth: number | null;
}

const DEFAULTS: AssignmentsWorkingState = { order: [], panelOpen: null, panelPinned: null, panelWidth: null, referencePinned: null, referenceWidth: null };

/** The old panel's width cookie, if any, moved into the stored state (unless that already has a width), then the
 *  cookie is expired. Runs on the first read. */
function migrateLegacyWidth() {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LEGACY_WIDTH_COOKIE.replace(".", "\\.")}=([^;]*)`));
    if (!match) return;
    const width = Number(decodeURIComponent(match[1]));
    const state = parse(window.localStorage.getItem(KEY));
    // An empty or zero cookie isn't a dragged width; a width already stored wins.
    if (Number.isFinite(width) && width > 0 && state.panelWidth === null) {
      window.localStorage.setItem(KEY, JSON.stringify({ ...state, panelWidth: width }));
    }
    // Expired only once storage took the width (or had one), so blocked storage keeps it for a later load.
    document.cookie = `${LEGACY_WIDTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Blocked storage or cookies: nothing to migrate.
  }
}

function parse(raw: string | null): AssignmentsWorkingState {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<AssignmentsWorkingState>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((id): id is string => typeof id === "string") : DEFAULTS.order,
      panelOpen: typeof parsed.panelOpen === "boolean" ? parsed.panelOpen : DEFAULTS.panelOpen,
      panelPinned: typeof parsed.panelPinned === "boolean" ? parsed.panelPinned : DEFAULTS.panelPinned,
      panelWidth: typeof parsed.panelWidth === "number" && Number.isFinite(parsed.panelWidth) ? parsed.panelWidth : DEFAULTS.panelWidth,
      referencePinned: typeof parsed.referencePinned === "boolean" ? parsed.referencePinned : DEFAULTS.referencePinned,
      referenceWidth: typeof parsed.referenceWidth === "number" && Number.isFinite(parsed.referenceWidth) ? parsed.referenceWidth : DEFAULTS.referenceWidth,
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
let migrated = false;

function current(): AssignmentsWorkingState {
  if (!migrated) {
    migrated = true;
    migrateLegacyWidth();
  }
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
  migrated = false;
}
