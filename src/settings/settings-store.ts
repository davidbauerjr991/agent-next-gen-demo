// Settings store (P-SETTINGS). A module singleton rather than provider
// context: settings outlive a provider swap and the launch screen reads them
// too. Same shape as the interaction store (a closure with getState /
// subscribe and a same-reference early exit); only hooks are exported from
// `index.ts`.
import { getProfileLibrary, resetProfileLibraryForTests } from "./saved-profiles";
import { settle } from "./settle";
import { profileFieldKeys } from "./scope";
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

export interface SettingsStoreOptions {
  /** The sections the applied profile locks (P-PROFILES). A write to a locked
   *  section keeps only its personal- and admin-scope fields; the rest is
   *  dropped, with a dev warning. Applying a profile lifts the locks first. */
  lockedSections?: () => readonly SectionKey[];
}

export function createSettingsStore(
  storage: SettingsStorage = safeStorage(),
  sections: SectionSchemas = SECTIONS,
  storeOptions: SettingsStoreOptions = {},
): SettingsStore {
  const isLocked = (key: SectionKey) => storeOptions.lockedSections?.().includes(key) ?? false;
  const keys = Object.keys(sections) as SectionKey[];
  const lockedFields = Object.fromEntries(keys.map((k) => [k, new Set(profileFieldKeys(k, sections))])) as Record<SectionKey, Set<string>>;

  /** `patch` without the fields a lock covers. */
  function unlocked<K extends SectionKey>(key: K, patch: Partial<SettingsState[K]>): Partial<SettingsState[K]> {
    if (!isLocked(key)) return patch;
    const kept: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [field, value] of Object.entries(patch)) {
      if (lockedFields[key].has(field)) dropped.push(field);
      else kept[field] = value;
    }
    if (dropped.length > 0 && import.meta.env?.DEV) {
      console.warn(`[settings] "${key}" is locked by the applied profile; ignored: ${dropped.join(", ")}`);
    }
    return kept as Partial<SettingsState[K]>;
  }

  /** P-LAYOUT: a write whose layout reconciliation would change a locked section (a placement field moving the
   *  locked map, or a map write projecting onto a locked placement field) is dropped whole, with a dev warning. A
   *  constraint's forced value isn't checked here: it isn't the agent's choice. */
  function blockedByLock(derived: readonly SectionKey[]): boolean {
    const locked = derived.filter(isLocked);
    if (locked.length === 0) return false;
    if (import.meta.env?.DEV) console.warn(`[settings] the layout change would reach a section the applied profile locks (${locked.join(", ")}); ignored`);
    return true;
  }

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
    // A stored invalid combination heals on load (in memory; the next write stores it). An unstored (or partial)
    // layout map reads through to the legacy placement fields: the first-read migration, written on the next change.
    const all = values as SettingsState;
    return { values: settle(null, all, stored.layout ? all.layout.parts : undefined).values, stored };
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
      const resolved = unlocked(section, typeof patch === "function" ? patch(state.values[section]) : patch);
      if (Object.keys(resolved).length === 0 && isLocked(section)) return;
      const next = merged(section, resolved);
      if (!next && (!persist || state.stored[section])) return;
      // Constraints run before anything is written, so a forced value is never stored unforced; a section a
      // constraint changes is written with this one, through a lock (`SettingConstraint`). So does the layout
      // reconciliation: a legacy placement write moves its parts, a map write projects onto the legacy fields.
      const { values, touched, derived } = settle(state.values, next ? { ...state.values, [section]: next } : state.values);
      if (blockedByLock(derived)) return;
      const written = [...new Set<SectionKey>([section, ...touched])];
      if (persist) for (const key of written) write(key, values[key]);
      commit({
        values,
        stored: persist ? { ...state.stored, ...Object.fromEntries(written.map((k) => [k, true])) } : state.stored,
      });
    },

    updateMany(patches) {
      let candidate = state.values;
      const changed: SectionKey[] = [];
      for (const section of Object.keys(patches) as SectionKey[]) {
        const next = merged(section, unlocked(section, patches[section] as Partial<SettingsState[typeof section]>));
        if (!next) continue;
        candidate = { ...candidate, [section]: next };
        changed.push(section);
      }
      if (candidate === state.values) return;
      const { values, touched, derived } = settle(state.values, candidate);
      if (blockedByLock(derived)) return;
      const written = [...new Set<SectionKey>([...changed, ...touched])];
      for (const key of written) write(key, values[key]);
      commit({ values, stored: { ...state.stored, ...Object.fromEntries(written.map((k) => [k, true])) } });
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
      commit({ values: settle(state.values, { ...state.values, [key]: read.value }).values, stored: { ...state.stored, [key]: read.stored } });
    },
  };
}

let singleton: SettingsStore | null = null;
let detachStorageListener: (() => void) | null = null;

/** The app's store, created on first use (not at import time). */
export function getSettingsStore(): SettingsStore {
  if (singleton) return singleton;
  const store = createSettingsStore(safeStorage(), SECTIONS, {
    lockedSections: () => getProfileLibrary().getState().applied?.locks ?? [],
  });
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
  resetProfileLibraryForTests();
}
