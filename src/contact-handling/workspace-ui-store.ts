import { useCallback, useSyncExternalStore } from "react";
import { useInteractionProvider } from "@/provider-context";
import type { ReferenceCardFocus } from "@/providers";
import type { DetailPanelContent, OutcomeKey, PanelArtifact } from "./workspace/workspace-types";
import type { AssignmentToast } from "./toasts/assignment-toasts";
import { assignmentIdFor, type AssignmentKind } from "@/domain";
import type { ContactHistoryDateFilterValue } from "@/components/agent-next-gen-contact-history";

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
  /** P-HOME-1g: each assignment's reference slot, keyed `assignmentIdFor(cardKey)`: its reference cards' open state
   *  and the slide-over over them (`AssignmentReferenceState`). */
  referenceByAssignment: Readonly<Record<string, AssignmentReferenceState>>;
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
  /** P-CANVAS: contacts (provider interaction ids) whose Next Best Action the
   *  agent asked for and that haven't answered yet: their "Nothing to suggest" shows as a row. */
  nbaRequested: ReadonlySet<string>;
  /** P-CANVAS: the Next Best Action steps already put in the conversation as a row, `${contactId}:${stepId}`. */
  nbaRowsShown: ReadonlySet<string>;
  /** P-CANVAS: a scripted agent turn the agent inserted into the composer, waiting for the send that is that turn:
   *  `${cardId}:${threadKey}` → the nba card id to answer (`agentTyped`) on send. */
  nbaAwaitingSend: Readonly<Record<string, string>>;
  /** P-CANVAS: when the Journey Summary's lookup started for each contact (first shown); it resolves 800ms later. */
  journeyLookupStartedAt: Readonly<Record<string, number>>;
  /** P-CANVAS: cards whose call transcript the agent hid ("Hide Transcript", AI display inline, voice): the main
   *  column keeps only the AI rows, and Contact Details offers the Transcript tab. */
  transcriptHiddenByCard: Readonly<Record<string, boolean>>;
  /** P-POLISH 3: the assignments list's collapse state, kept here so it outlives the cards (a left-nav collapse to
   *  the rail, the placement swap): the next bulk click's direction (`false`: collapsed, only the active card open), */
  navChannelsAllExpanded: boolean;
  /** ... the nonce each bulk click bumps ... */
  navChannelsOverrideVersion: number;
  /** ... and each card's own expanded state (what a remounted card restores). */
  navChannelsExpandedById: Readonly<Record<string, boolean>>;
  /** P-PROFILES: the reference slot's width while `ReferenceSlot` shows the
   *  reference column (the card width, or the open slide-over's slot width);
   *  0 with no column (stacked); null while the slot isn't mounted (no canvas). */
  referenceSlotWidth: number | null;
  /** P-PROFILES: the assignments interior panel fits docked beside the action
   *  area and the reference slot (`assignmentsPanelDocks`); false: an overlay. */
  assignmentsPanelDocks: boolean;
  /** P-PROFILES: the assignments panel is open as an overlay (it doesn't dock,
   *  or the agent unpinned it), from the rail's Assignments item. */
  assignmentsPanelOverlayOpen: boolean;
  /** P-HOME-1e: the Activity feed's view (Assignments / History). */
  activityView: "assignments" | "history";
  /** P-HOME-1f: History's search (Contact History's own search box). */
  activityHistoryQuery: string;
  /** P-HOME-1f: the schedule card (its key) whose kind row is selected while a call is joined to it: the main column
   *  shows the kind's cell, not the call. The main column follows the selected row, as a channel row's does. */
  kindCellShownFor: string | null;
  /** P-HOME-1b: the feed's kind chips (empty: every kind). */
  activityKinds: ReadonlySet<AssignmentKind>;
  /** P-HOME-1b: History's range, Contact History's date control. */
  activityHistoryRange: ContactHistoryDateFilterValue;
  /** P-HOME-1: toasts for events on other assignments, in raise order; dismissed ones stay for the drawer's rows. */
  assignmentToasts: readonly AssignmentToast[];
}

/** A reference card's id in an assignment's open state: the guidance's focus vocabulary for a conversation's cards
 *  (`ReferenceCardFocus`), the canvas cell id for a kind cell's. */
export type ReferenceCardKey = ReferenceCardFocus | (string & {});

/** P-CANVAS: an assignment's reference cards — which are open and who opened each (absent: collapsed, P-HOME-1g),
 *  the guidance step a manual header click happened on (AI focus waits until the step advances), and the card the AI
 *  just brought forward (highlighted briefly). */
export interface ReferenceFocusState {
  open: Readonly<Partial<Record<ReferenceCardKey, "ai" | "user">>>;
  manualStepId?: string;
  highlight?: { card: ReferenceCardKey; at: number };
}

/** P-HOME-1g: the slide-over over an assignment's reference slot: what it shows (null: closed), whether it's full
 *  screen (lyra's ⤢) and its dragged width (null: the card width). */
export interface SlideOverState {
  content: DetailPanelContent | null;
  fullScreen: boolean;
  width: number | null;
}

/** P-HOME-1g: one assignment's reference slot, as the agent left it. In memory only: it outlives a switch to another
 *  assignment or Home, never a reload. A new assignment starts with every card collapsed and nothing open. */
export interface AssignmentReferenceState {
  cards: ReferenceFocusState;
  slideOver: SlideOverState;
}

export const EMPTY_ASSIGNMENT_REFERENCE: AssignmentReferenceState = Object.freeze({
  cards: Object.freeze({ open: Object.freeze({}) }),
  slideOver: Object.freeze({ content: null, fullScreen: false, width: null }),
});

/** `cardKey`'s assignment's reference slot. */
export function assignmentReferenceOf(state: WorkspaceUiState, cardKey: string): AssignmentReferenceState {
  return state.referenceByAssignment[assignmentIdFor(cardKey)] ?? EMPTY_ASSIGNMENT_REFERENCE;
}

/** Changes `cardKey`'s assignment's reference slot. */
export function updateAssignmentReference(
  store: WorkspaceUiStore,
  cardKey: string,
  change: (current: AssignmentReferenceState) => AssignmentReferenceState,
) {
  store.update((s) => {
    const current = assignmentReferenceOf(s, cardKey);
    const next = change(current);
    return next === current ? s : { ...s, referenceByAssignment: { ...s.referenceByAssignment, [assignmentIdFor(cardKey)]: next } };
  });
}

export const INITIAL_WORKSPACE_UI_STATE: WorkspaceUiState = Object.freeze({
  outcomeOpenFor: null,
  referenceByAssignment: Object.freeze({}),
  artifactsByCard: Object.freeze({}),
  revealedApprovals: new Set<string>(),
  touchedThreads: new Set<string>(),
  referenceColumnFits: true,
  regionsRowWidth: 0,
  summariesOverlayOpen: false,
  composerPrefill: Object.freeze({}),
  nbaRequested: new Set<string>(),
  nbaRowsShown: new Set<string>(),
  nbaAwaitingSend: Object.freeze({}),
  journeyLookupStartedAt: Object.freeze({}),
  transcriptHiddenByCard: Object.freeze({}),
  navChannelsAllExpanded: true,
  navChannelsOverrideVersion: 0,
  navChannelsExpandedById: Object.freeze({}),
  referenceSlotWidth: null,
  assignmentsPanelDocks: true,
  assignmentsPanelOverlayOpen: false,
  activityView: "assignments",
  activityHistoryQuery: "",
  kindCellShownFor: null,
  activityKinds: new Set<AssignmentKind>(),
  activityHistoryRange: "today",
  assignmentToasts: Object.freeze([]),
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
