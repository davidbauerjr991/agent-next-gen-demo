import { useCallback, useSyncExternalStore } from "react";
import { useInteractionProvider } from "@/provider-context";
import type { ReferenceCardFocus } from "@/providers";
import type { DetailPanelContent, OutcomeKey, PanelArtifact } from "./workspace/workspace-types";

// The Workspace's UI state keyed by card or thread id (P-EXTRACT). State that
// used to live in page `useState` or module-scope Sets, keyed by whichever
// mount or DOM node happened to hold it, lives here keyed by what it's about:
// it survives a component moving or remounting (a layout switch, a tab
// switch) and is the same for every instance that shows it. One store per
// interaction provider, like the interaction store, so a provider swap (and
// every test's fresh provider) starts clean.

export interface WorkspaceUiState {
  /** The channel whose Outcome popover is open, app-wide (one at a time).
   *  Which trigger shows it is the trigger's own business (`useOutcomeClaim`). */
  outcomeOpenFor: OutcomeKey | null;
  /** Each card's interior slide-over selection. */
  detailPanelByCard: Readonly<Record<string, DetailPanelContent | null>>;
  /** Each card's Artifacts: every side panel the agent opened on it. */
  artifactsByCard: Readonly<Record<string, readonly PanelArtifact[]>>;
  /** Approval cards that already played their first reveal, `${cardId}:${revealKey}`. */
  revealedApprovals: ReadonlySet<string>;
  /** Threads the agent touched (opened, sent on, opened Outcome on), `${cardId}:${threadKey}` (touched-threads.ts). */
  touchedThreads: ReadonlySet<string>;
  /** P-CANVAS: whether the main column is wide enough to dock the reference
   *  column beside the action area (measured by `ReferenceColumn`). False:
   *  the column is an overlay behind the record header's "Summaries" button. */
  referenceColumnFits: boolean;
  /** P-CANVAS: the main column's row width (action area + reference slot),
   *  measured by `ReferenceSlot`; 0 until laid out. Caps the slide-over's
   *  drag so the action area keeps its minimum. */
  regionsRowWidth: number;
  /** P-CANVAS: the reference column's overlay is open (only while it doesn't fit). */
  summariesOverlayOpen: boolean;
  /** P-CANVAS: text for a thread's chat composer to take once (a Next Best
   *  Action's "Insert into reply"), `${cardId}:${threadKey}`; cleared when taken. */
  composerPrefill: Readonly<Record<string, string>>;
  /** P-CANVAS: the Next Best Action last used on each contact (provider
   *  interaction id), shown as the card's "Used" frame until the next suggestion. */
  nbaUsedByContact: Readonly<Record<string, { title: string; at: string }>>;
  /** P-CANVAS: the one open reference card per card (single-open accordion); absent = the Real-Time Summary. */
  referenceOpenByCard: Readonly<Record<string, ReferenceCardFocus | null>>;
}

export const INITIAL_WORKSPACE_UI_STATE: WorkspaceUiState = Object.freeze({
  outcomeOpenFor: null,
  detailPanelByCard: Object.freeze({}),
  artifactsByCard: Object.freeze({}),
  revealedApprovals: new Set<string>(),
  touchedThreads: new Set<string>(),
  referenceColumnFits: true,
  regionsRowWidth: 0,
  summariesOverlayOpen: false,
  composerPrefill: Object.freeze({}),
  nbaUsedByContact: Object.freeze({}),
  referenceOpenByCard: Object.freeze({}),
});

export interface WorkspaceUiStore {
  getState(): WorkspaceUiState;
  update(change: (state: WorkspaceUiState) => WorkspaceUiState): void;
  subscribe(listener: () => void): () => void;
}

export function createWorkspaceUiStore(initial: WorkspaceUiState = INITIAL_WORKSPACE_UI_STATE): WorkspaceUiStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    update(change) {
      const next = change(state);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const stores = new WeakMap<object, WorkspaceUiStore>();

/** The store for this provider (created on first use). */
export function getWorkspaceUiStore(owner: object): WorkspaceUiStore {
  let store = stores.get(owner);
  if (!store) {
    store = createWorkspaceUiStore();
    stores.set(owner, store);
  }
  return store;
}

export function useWorkspaceUiStore(): WorkspaceUiStore {
  return getWorkspaceUiStore(useInteractionProvider());
}

type Update<T> = T | ((current: T) => T);

/** One field of the store as a `[value, setter]` pair, like `useState`. */
export function useWorkspaceUiField<K extends keyof WorkspaceUiState>(
  key: K,
): [WorkspaceUiState[K], (update: Update<WorkspaceUiState[K]>) => void] {
  const store = useWorkspaceUiStore();
  const value = useSyncExternalStore(store.subscribe, () => store.getState()[key]);
  const set = useCallback(
    (update: Update<WorkspaceUiState[K]>) =>
      store.update((state) => {
        const current = state[key];
        const next = typeof update === "function" ? (update as (c: WorkspaceUiState[K]) => WorkspaceUiState[K])(current) : update;
        return Object.is(next, current) ? state : { ...state, [key]: next };
      }),
    [store, key],
  );
  return [value, set];
}
