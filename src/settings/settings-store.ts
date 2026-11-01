// Settings store (P-SETTINGS). A module singleton rather than provider
// context: settings outlive a provider swap and the launch screen reads them
// too. Same shape as the interaction store (a closure with getState /
// subscribe and a same-reference early exit); only hooks are exported from
// `index.ts`.
import { getProfileLibrary, isSavedProfileId, resetProfileLibraryForTests } from "./saved-profiles";
import { settle } from "./settle";
import { storedPlacementNone, storedRetiredAssignmentsFields, withActiveAssignmentsSection } from "./migrations";
import { lockedSections, resolveLayers, type LayerProfile, type SectionSource } from "./layers";
import { getOrgLayers, resetOrgLayersForTests } from "./org-layers";
import { PROFILE_LABELS, type ProfileId } from "./profiles";
import { deepEqual, profileFieldKeys } from "./scope";
import { SECTIONS, defaultSettings, type SectionKey, type SectionSchemas, type SettingsState } from "./settings-schema";
import { SETTINGS_KEY_PREFIX, safeStorage, type SettingsStorage } from "./settings-storage";

export interface SettingsStoreState {
  /** The resolved values: the org layers, then the agent's own (`stored`), then the constraints (P-CONFIG-LAYERS). */
  values: SettingsState;
  /** Whether each section has a stored value (as of the last read or write): the agent layer sets it. */
  stored: Record<SectionKey, boolean>;
  /** Which layer each section's value comes from, and whose lock holds it. */
  sources: Record<SectionKey, SectionSource>;
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
  /** Re-resolves after the org layers changed (`values` too), or only the applied locks (`sources` alone). */
  refreshLayers(what?: "layers" | "locks"): void;
}

export const sectionStorageKey = (section: string) => `${SETTINGS_KEY_PREFIX}${section}`;

export interface SettingsStoreOptions {
  /** The sections the applied profile locks (P-PROFILES). A write to a locked
   *  section keeps only its personal- and admin-scope fields; the rest is
   *  dropped, with a dev warning. Applying a profile lifts the locks first. */
  lockedSections?: () => readonly SectionKey[];
  /** The org layers above the agent's own (P-CONFIG-LAYERS, ./org-layers.ts); none by default. Their locks refuse
   *  writes exactly as the applied profile's do. */
  layers?: () => readonly LayerProfile[];
  /** The applied profile's name, for "Locked by". */
  appliedName?: () => string | undefined;
}

export function createSettingsStore(
  storage: SettingsStorage = safeStorage(),
  sections: SectionSchemas = SECTIONS,
  storeOptions: SettingsStoreOptions = {},
): SettingsStore {
  const orgLayers = () => storeOptions.layers?.() ?? [];
  const agentLocks = () => storeOptions.lockedSections?.() ?? [];
  const isLocked = (key: SectionKey) => lockedSections(orgLayers(), agentLocks()).includes(key);
  /** The org layers over the agent's own: `stored` says which sections the agent sets. */
  const resolve = (agentState: SettingsState, stored: Record<SectionKey, boolean>) =>
    resolveLayers(agentState, orgLayers(), { sets: (key) => stored[key], locks: agentLocks(), profileName: storeOptions.appliedName?.() }, sections);
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
      console.warn(`[settings] "${key}" is locked by a profile; ignored: ${dropped.join(", ")}`);
    }
    return kept as Partial<SettingsState[K]>;
  }

  /** P-LAYOUT: a write whose layout reconciliation would change a locked section (a placement field moving the
   *  locked map, or a map write projecting onto a locked placement field) is dropped whole, with a dev warning. A
   *  constraint's forced value isn't checked here: it isn't the agent's choice. */
  function blockedByLock(derived: readonly SectionKey[]): boolean {
    const locked = derived.filter(isLocked);
    if (locked.length === 0) return false;
    if (import.meta.env?.DEV) console.warn(`[settings] the layout change would reach a section a profile locks (${locked.join(", ")}); ignored`);
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
    // The org layers over the agent's stored values; nothing is written for them (P-CONFIG-LAYERS). A stored invalid
    // combination heals on load (in memory; the next write stores it). A layout map no layer sets reads through to
    // the legacy placement fields: the first-read migration, written on the next change.
    const { values: all, sources, sets } = resolve(values as SettingsState, stored);
    const settled = settle(null, all, sets.layout ? all.layout.parts : undefined).values;
    // P-LAYOUT-F1 B: a stored placement "none" reads as the left nav with Home's Active assignments section on. Written
    // at once, so a later write to one of these sections can't leave the others behind. A section a profile locks
    // keeps the profile's value (the lock wins over the migration, as over any write), and one an org layer sets
    // isn't copied into the agent's own.
    if (storedPlacementNone(rawValue("assignments"), rawValue("layout"))) {
      const migrated = isLocked("home") ? settled : withActiveAssignmentsSection(settled);
      for (const key of ["assignments", "layout", "home"] as const) {
        if (isLocked(key) || (sources[key].from && sources[key].from.level !== "agent")) continue;
        write(key, migrated[key]);
        stored[key] = true;
      }
      return { values: migrated, stored, sources: sourcesFor(stored) };
    }
    // P-LAYOUT-F3: a retired `assignments` field still in storage is dropped once — the agent's own stored values,
    // rewritten through the reader (which reads only declared fields); nothing they mean changes. After the "none"
    // migration above, which reads the raw value (the reader would turn "none" into the left nav) and writes its own.
    if (stored.assignments && storedRetiredAssignmentsFields(rawValue("assignments"))) write("assignments", values.assignments as SettingsState["assignments"]);
    return { values: settled, stored, sources };
  }

  /** Each section's source once `stored` changed (a write: the agent layer now sets what it wrote). */
  function sourcesFor(stored: Record<SectionKey, boolean>): Record<SectionKey, SectionSource> {
    return resolve(defaultSettings(sections), stored).sources;
  }

  /** A section's stored value as it was written, before its fields are read (for the migrations). */
  function rawValue(key: SectionKey): unknown {
    try {
      const raw = storage.get(sectionStorageKey(key));
      return raw === null ? undefined : (JSON.parse(raw) as { value?: unknown })?.value;
    } catch {
      return undefined;
    }
  }

  let state = readAll();
  const listeners = new Set<() => void>();

  function commit(next: SettingsStoreState) {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  }

  /** A re-read committed so sections (and sources) that didn't change keep their references: inert layers arriving,
   *  or another tab's write under org layers, re-render only what changed. */
  function commitRead(next: SettingsStoreState) {
    const values = keepEqual(state.values, next.values);
    const sources = keepEqual(state.sources, next.sources);
    const stored = keepEqual(state.stored, next.stored);
    if (values !== state.values || sources !== state.sources || stored !== state.stored) commit({ values, stored, sources });
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
      const stored = persist ? { ...state.stored, ...Object.fromEntries(written.map((k) => [k, true])) } : state.stored;
      commit({ values, stored, sources: persist ? sourcesFor(stored) : state.sources });
    },

    updateMany(patches) {
      const nextBySection = new Map<SectionKey, SettingsState[SectionKey]>();
      for (const section of Object.keys(patches) as SectionKey[]) {
        const next = merged(section, unlocked(section, patches[section] as Partial<SettingsState[typeof section]>));
        if (next) nextBySection.set(section, next);
      }
      // A section whose layout reconciliation would reach a locked one is left out, the rest still land (applying a
      // profile under an org lock on the layout); one that reaches a lock alone is refused as in `update`.
      if (lockedSections(orgLayers(), agentLocks()).length > 0) for (const [section, next] of nextBySection) {
        if (blockedByLock(settle(state.values, { ...state.values, [section]: next }).derived)) nextBySection.delete(section);
      }
      const changed = [...nextBySection.keys()];
      if (changed.length === 0) return;
      const candidate = { ...state.values, ...Object.fromEntries(nextBySection) } as SettingsState;
      const { values, touched, derived } = settle(state.values, candidate);
      if (blockedByLock(derived)) return;
      const written = [...new Set<SectionKey>([...changed, ...touched])];
      for (const key of written) write(key, values[key]);
      const stored = { ...state.stored, ...Object.fromEntries(written.map((k) => [k, true])) };
      commit({ values, stored, sources: sourcesFor(stored) });
    },

    resetAll() {
      for (const key of storage.keys()) storage.remove(key);
      for (const key of keys) storage.remove(sectionStorageKey(key));
      // The agent layer is cleared; the org layers still apply.
      if (orgLayers().length > 0) {
        commit(readAll());
        return;
      }
      const stored = Object.fromEntries(keys.map((k) => [k, false])) as Record<SectionKey, boolean>;
      commit({ values: defaultSettings(sections), stored, sources: sourcesFor(stored) });
    },

    syncFromStorage(storageKey) {
      // A null key means another tab cleared all storage. Under org layers a changed section re-resolves whole.
      if (storageKey === null) {
        commit(readAll());
        return;
      }
      if (!storageKey.startsWith(SETTINGS_KEY_PREFIX)) return;
      const key = storageKey.slice(SETTINGS_KEY_PREFIX.length) as SectionKey;
      if (!keys.includes(key)) return;
      if (orgLayers().length > 0) {
        commitRead(readAll());
        return;
      }
      const read = readSection(key);
      const stored = { ...state.stored, [key]: read.stored };
      commit({ values: settle(state.values, { ...state.values, [key]: read.value }).values, stored, sources: sourcesFor(stored) });
    },

    refreshLayers(what = "layers") {
      commitRead(what === "layers" ? readAll() : { ...state, sources: sourcesFor(state.stored) });
    },
  };
}

/** `next` with every entry deep-equal to `prev`'s kept as `prev`'s; `prev` itself when nothing differs. */
function keepEqual<T extends object>(prev: T, next: T): T {
  let changed = false;
  const out = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(next)) {
    const before = (prev as Record<string, unknown>)[key];
    out[key] = deepEqual(before, value) ? before : value;
    if (out[key] !== before) changed = true;
  }
  return changed || Object.keys(prev).length !== Object.keys(next).length ? (out as T) : prev;
}

/** The applied profile's name: a saved one's, else a built-in's label. */
function appliedProfileName(): string | undefined {
  const { applied, saved } = getProfileLibrary().getState();
  if (!applied) return undefined;
  return isSavedProfileId(applied.id) ? saved.find((p) => p.id === applied.id)?.name : PROFILE_LABELS[applied.id as ProfileId];
}

let singleton: SettingsStore | null = null;
let detachStorageListener: (() => void) | null = null;
let detachSubscriptions: (() => void) | null = null;

/** The app's store, created on first use (not at import time). */
export function getSettingsStore(): SettingsStore {
  if (singleton) return singleton;
  const store = createSettingsStore(safeStorage(), SECTIONS, {
    lockedSections: () => getProfileLibrary().getState().applied?.locks ?? [],
    layers: () => getOrgLayers().getState().layers,
    appliedName: appliedProfileName,
  });
  singleton = store;
  // An org-layer change re-resolves the values; a change of the applied profile only who locks what.
  const detachLayers = getOrgLayers().subscribe(() => store.refreshLayers("layers"));
  const detachLibrary = getProfileLibrary().subscribe(() => store.refreshLayers("locks"));
  detachSubscriptions = () => {
    detachLayers();
    detachLibrary();
  };
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
  detachSubscriptions?.();
  detachSubscriptions = null;
  singleton = null;
  resetProfileLibraryForTests();
  resetOrgLayersForTests();
}
