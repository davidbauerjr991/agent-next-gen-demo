import { useEffect, useSyncExternalStore } from "react";
import type { ScheduleProvider, ScheduleRole, ScheduleSnapshot, Unsubscribe } from "../providers";
import { useScheduleProvider } from "./hooks";

// The schedule store (P-HOME-1): one per ScheduleProvider instance, fed by
// its `reset` and `itemChanged` events, like the interaction store is by the
// interaction provider's. Started by `ProviderRoot` while mounted; the
// listing of the persona's day (`useScheduleDay`) arrives as `reset`.

export interface ScheduleStore {
  getState(): ScheduleSnapshot | null;
  subscribe(listener: () => void): Unsubscribe;
  /** Ref-counted: the first call subscribes to the provider, the last `stop` unsubscribes (state is kept). */
  start(): void;
  stop(): void;
  /** A listing's result, for a listing that didn't replace the day (no `reset`). */
  hydrate(snapshot: ScheduleSnapshot): void;
}

const stores = new WeakMap<ScheduleProvider, ScheduleStore>();

export function getScheduleStore(provider: ScheduleProvider): ScheduleStore {
  let store = stores.get(provider);
  if (!store) {
    store = createScheduleStore(provider);
    stores.set(provider, store);
  }
  return store;
}

function createScheduleStore(provider: ScheduleProvider): ScheduleStore {
  let state: ScheduleSnapshot | null = null;
  const listeners = new Set<() => void>();
  let refs = 0;
  let unsubscribes: Unsubscribe[] = [];

  function commit(next: ScheduleSnapshot) {
    state = next;
    for (const listener of listeners) listener();
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
      if (refs !== 1) return;
      unsubscribes = [
        provider.on("reset", ({ snapshot }) => commit(snapshot)),
        provider.on("itemChanged", ({ item }) => {
          if (!state) return;
          const exists = state.items.some((i) => i.id === item.id);
          commit({ ...state, items: exists ? state.items.map((i) => (i.id === item.id ? item : i)) : [...state.items, item] });
        }),
      ];
    },
    stop() {
      refs = Math.max(0, refs - 1);
      if (refs === 0) {
        for (const unsubscribe of unsubscribes) unsubscribe();
        unsubscribes = [];
      }
    },
    hydrate(snapshot) {
      if (state?.role === snapshot.role) return;
      commit(snapshot);
    },
  };
}

const NO_STORE: ScheduleStore = createScheduleStore({
  on: () => () => {},
  listItems: () => Promise.reject(new Error("no schedule source")),
  open: () => Promise.reject(new Error("no schedule source")),
  complete: () => Promise.reject(new Error("no schedule source")),
  addNote: () => Promise.reject(new Error("no schedule source")),
  dispose: async () => {},
});

/** Lists `role`'s day whenever the role (or the provider) changes; the day
 *  arrives in the store. Mount once, at the workspace controller. */
export function useListScheduleDay(role: ScheduleRole): void {
  const provider = useScheduleProvider();
  useEffect(() => {
    if (!provider) return;
    let live = true;
    provider.listItems({ role }).then(
      (snapshot) => {
        if (live) getScheduleStore(provider).hydrate(snapshot);
      },
      (err) => {
        if (import.meta.env.DEV) console.warn("[schedule] listing failed", err);
      },
    );
    return () => {
      live = false;
    };
  }, [provider, role]);
}

/** The listed day, or `null` before it arrives or when the active providers have no schedule source. */
export function useScheduleSnapshot(): ScheduleSnapshot | null {
  const provider = useScheduleProvider();
  const store = provider ? getScheduleStore(provider) : NO_STORE;
  return useSyncExternalStore(store.subscribe, store.getState);
}
