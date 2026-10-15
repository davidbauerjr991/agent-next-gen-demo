// Settings store (P-SETTINGS). A module singleton rather than provider
// context: settings outlive a provider swap and the launch screen reads them
// too. Same shape as the interaction store (a closure with getState /
// subscribe and a same-reference early exit); only hooks are exported from
// `index.ts`.
import { SECTIONS, defaultSettings, type SectionKey, type SectionSchemas, type SettingsState } from "./settings-schema";
import { SETTINGS_KEY_PREFIX, safeStorage, type SettingsStorage } from "./settings-storage";

export interface SettingsStoreState {
  values: SettingsState;
  /** Whether each section has a stored value (as of the last read or write). */
  stored: Record<SectionKey, boolean>;
}

export type SectionPatch<K extends SectionKey> =
  | Partial<SettingsState[K]>
  | ((prev: SettingsState[K]) => Partial<SettingsState[K]>);

export interface UpdateOptions {
  /** false: apply in memory only (e.g. the launch screen with "Save
   *  Preferences" unchecked). Default true. */
  persist?: boolean;
}

export interface SettingsStore {
  getState(): SettingsStoreState;
  subscribe(listener: () => void): () => void;
  update<K extends SectionKey>(section: K, patch: SectionPatch<K>, options?: UpdateOptions): void;
  /** Several sections in one notification (applying a profile). */
  updateMany(patches: { [K in SectionKey]?: Partial<SettingsState[K]> }): void;
  /** Removes every stored settings key and restores the defaults. */
  resetAll(): void;
  /** Re-reads one storage key written by another tab (`storage` event). */
  syncFromStorage(storageKey: string | null): void;
}

export const sectionStorageKey = (section: string) => `${SETTINGS_KEY_PREFIX}${section}`;

export function createSettingsStore(
  storage: SettingsStorage = safeStorage(),
  sections: SectionSchemas = SECTIONS,
): SettingsStore {
  const keys = Object.keys(sections) as SectionKey[];

  function readSection<K extends SectionKey>(key: K): { value: SettingsState[K]; stored: boolean } {
    const def = sections[key];
    const raw = storage.get(sectionStorageKey(key));
    if (raw === null) return { value: def.defaults, stored: false };
    try {
      const parsed = JSON.parse(raw) as { v?: unknown; value?: unknown };
      if (parsed?.v !== def.version) return { value: def.defaults, stored: false };
      return { value: def.read(parsed.value, def.defaults), stored: true };
    } catch {
      return { value: def.defaults, stored: false };
    }
  }

  function readAll(): SettingsStoreState {
    const values = {} as Record<SectionKey, unknown>;
    const stored = {} as Record<SectionKey, boolean>;
    for (const key of keys) {
      const read = readSection(key);
      values[key] = read.value;
      stored[key] = read.stored;
    }
    return { values: values as SettingsState, stored };
  }

  let state = readAll();
  const listeners = new Set<() => void>();

  function commit(next: SettingsStoreState) {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function write<K extends SectionKey>(key: K, value: SettingsState[K]) {
    storage.set(sectionStorageKey(key), JSON.stringify({ v: sections[key].version, value }));
  }

  function merged<K extends SectionKey>(key: K, patch: Partial<SettingsState[K]>): SettingsState[K] | null {
    const prev = state.values[key];
    const next = { ...prev, ...patch };
    const changed = (Object.keys(patch) as (keyof SettingsState[K])[]).some((field) => prev[field] !== next[field]);
    return changed ? next : null;
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    update(section, patch, options) {
      const persist = options?.persist ?? true;
      const resolved = typeof patch === "function" ? patch(state.values[section]) : patch;
      const next = merged(section, resolved);
      if (!next && (!persist || state.stored[section])) return;
      const value = next ?? state.values[section];
      if (persist) write(section, value);
      commit({
        values: next ? { ...state.values, [section]: value } : state.values,
        stored: persist ? { ...state.stored, [section]: true } : state.stored,
      });
    },

    updateMany(patches) {
      let values = state.values;
      let stored = state.stored;
      for (const section of Object.keys(patches) as SectionKey[]) {
        const next = merged(section, patches[section] as Partial<SettingsState[typeof section]>);
        if (!next) continue;
        write(section, next);
        values = { ...values, [section]: next };
        stored = { ...stored, [section]: true };
      }
      if (values !== state.values) commit({ values, stored });
    },

    resetAll() {
      for (const key of storage.keys()) storage.remove(key);
      for (const key of keys) storage.remove(sectionStorageKey(key));
      commit({ values: defaultSettings(sections), stored: Object.fromEntries(keys.map((k) => [k, false])) as Record<SectionKey, boolean> });
    },

    syncFromStorage(storageKey) {
      // A null key means another tab cleared all storage.
      if (storageKey === null) {
        commit(readAll());
        return;
      }
      if (!storageKey.startsWith(SETTINGS_KEY_PREFIX)) return;
      const key = storageKey.slice(SETTINGS_KEY_PREFIX.length) as SectionKey;
      if (!keys.includes(key)) return;
      const read = readSection(key);
      commit({ values: { ...state.values, [key]: read.value }, stored: { ...state.stored, [key]: read.stored } });
    },
  };
}

let singleton: SettingsStore | null = null;
let detachStorageListener: (() => void) | null = null;

/** The app's store, created on first use (not at import time). */
export function getSettingsStore(): SettingsStore {
  if (singleton) return singleton;
  const store = createSettingsStore();
  singleton = store;
  if (typeof window !== "undefined") {
    const onStorage = (event: StorageEvent) => store.syncFromStorage(event.key);
    window.addEventListener("storage", onStorage);
    detachStorageListener = () => window.removeEventListener("storage", onStorage);
  }
  return store;
}

/** Tests only: drop the singleton so the next use re-reads storage. */
export function resetSettingsStoreForTests() {
  detachStorageListener?.();
  detachStorageListener = null;
  singleton = null;
}
