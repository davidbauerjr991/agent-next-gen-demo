// Saved workspace profiles (P-PROFILES). The agent's own named snapshots of
// every agent-scope setting, beside the built-in ones (./profiles.ts), with a
// lock flag per section, shared as a JSON file. Kept under their own storage
// key, outside the settings prefix: they're never part of a profile
// themselves, and Reset to defaults leaves them (it clears the applied locks).
// Every section is stored as `{ v, value }`, the same shape as the settings
// store and the export file, so stored and imported profiles go through one
// reader that falls back field by field (`readProfileSections`).
import { t } from "@/i18n";
import { LAYER_LEVELS, type LayerLevel } from "./layers";
import { PROFILE_IDS, PROFILE_LABELS, profileValues, type ProfileId } from "./profiles";
import { agentSettings, sectionInProfiles, type AgentSettings } from "./scope";
import { settle } from "./settle";
import { storedPlacementNone, withActiveAssignmentsSection } from "./migrations";
import { SECTIONS, defaultSettings, type SectionKey, type SectionSchemas, type SettingsState } from "./settings-schema";
import { safeStorage, type SettingsStorage } from "./settings-storage";

export type SavedProfileId = `saved:${string}`;

export interface SavedProfile {
  id: SavedProfileId;
  name: string;
  /** ISO timestamp. */
  createdAt: string;
  values: AgentSettings;
  /** Sections that render read-only once this profile is applied. */
  locks: SectionKey[];
  /** The layer it's for (P-CONFIG-LAYERS): "agent" (the agent's own, every profile before the step) or an org level,
   *  which applying puts in that layer through a change set instead of writing the agent's settings. */
  level: LayerLevel;
}

/** The profile applied last (or saved last) and the locks it carries: the
 *  base the settings read "modified from" once they move off its values (a
 *  built-in's locks are empty). Null once settings are reset or the profile is
 *  deleted. The Phase 7 seam (`./profile-assignment.ts`) sets it the same way
 *  for an assigned profile. */
export interface AppliedProfile {
  id: ProfileId | SavedProfileId;
  locks: SectionKey[];
}

export interface ProfileLibraryState {
  saved: SavedProfile[];
  applied: AppliedProfile | null;
}

export const PROFILES_STORAGE_KEY = "agent-next-gen:profiles";
const LIBRARY_VERSION = 1;

/** The export file's identity. `format` bumps on an incompatible change. */
export const PROFILE_FILE_KIND = "agent-workspace-profile";
export const PROFILE_FILE_FORMAT = 1;

export const isSavedProfileId = (id: string): id is SavedProfileId => id.startsWith("saved:");
export const isBuiltInProfileId = (id: string): id is ProfileId => (PROFILE_IDS as string[]).includes(id);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The sections a profile carries, in schema order. */
export function profileSectionKeys(sections: SectionSchemas = SECTIONS): SectionKey[] {
  return (Object.keys(sections) as SectionKey[]).filter((key) => sectionInProfiles(key, sections));
}

/** Why a section fell back to its defaults while reading a profile. */
export interface ProfileReadWarning {
  section: SectionKey;
  reason: "missing" | "version";
}

/** `{ [section]: { v, value } }` for a profile's values. */
function writeSections(values: AgentSettings, sections: SectionSchemas): Record<string, { v: number; value: unknown }> {
  return Object.fromEntries(profileSectionKeys(sections).map((key) => [key, { v: sections[key].version, value: values[key] }]));
}

/** Reads `{ [section]: { v, value } }` into a profile's values: each section
 *  through its own reader (an invalid field reads as its default), a section
 *  that's missing or has another version as its defaults, and the result
 *  stripped to agent scope. Unknown sections are dropped. */
export function readProfileSections(
  raw: unknown,
  sections: SectionSchemas = SECTIONS,
): { values: AgentSettings; warnings: ProfileReadWarning[] } {
  const source = isRecord(raw) ? raw : {};
  const { full, present, warnings } = readEntries(source, sections, false);
  // A profile saved before P-LAYOUT has no layout map: it's derived from the profile's own placement fields below,
  // not defaulted, so it isn't a warning.
  const order = profileSectionKeys(sections);
  for (const key of order) {
    // A section with a version warning isn't present either, but already has its warning.
    if (key !== "layout" && !present.includes(key) && !warnings.some((w) => w.section === key)) warnings.push({ section: key, reason: "missing" });
  }
  warnings.sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
  // The map (possibly partial) over the one the profile's legacy fields describe, as the store reads it.
  const state = full;
  const settled = settle(null, state, present.includes("layout") ? state.layout.parts : undefined).values;
  // P-LAYOUT-F1 B: a profile saved with placement "none" applies as the left nav with Active assignments on.
  const rawOf = (key: SectionKey) => (isRecord(source[key]) ? (source[key] as { value?: unknown }).value : undefined);
  const values = storedPlacementNone(rawOf("assignments"), rawOf("layout")) ? withActiveAssignmentsSection(settled) : settled;
  return { values: agentSettings(values, sections), warnings };
}

/** Reads an org layer's `{ [section]: { v?, value } }` (P-CONFIG-LAYERS): only the sections present, each through
 *  its own reader and stripped to agent scope; a missing `v` reads as the current version, another one is skipped
 *  with a warning. Unlike a saved profile, a layer is partial: what it leaves out, it doesn't set. */
export function readLayerSections(
  raw: unknown,
  sections: SectionSchemas = SECTIONS,
): { values: Partial<AgentSettings>; warnings: ProfileReadWarning[] } {
  const { full, present, warnings } = readEntries(isRecord(raw) ? raw : {}, sections, true);
  const stripped = agentSettings(full, sections);
  return { values: Object.fromEntries(present.map((key) => [key, stripped[key]])) as Partial<AgentSettings>, warnings };
}

/** Each section a profile carries that `source` has, through its own reader over the defaults: the full state, the
 *  sections read, and a warning for each one of another version (`versionOptional`: a missing `v` is the current
 *  one, as an org layer's file may omit it). */
function readEntries(
  source: Record<string, unknown>,
  sections: SectionSchemas,
  versionOptional: boolean,
): { full: SettingsState; present: SectionKey[]; warnings: ProfileReadWarning[] } {
  const full = defaultSettings(sections) as Record<SectionKey, unknown>;
  const present: SectionKey[] = [];
  const warnings: ProfileReadWarning[] = [];
  for (const key of profileSectionKeys(sections)) {
    const entry = source[key];
    if (!isRecord(entry) || !("value" in entry)) continue;
    if (!(versionOptional && entry.v === undefined) && entry.v !== sections[key].version) {
      warnings.push({ section: key, reason: "version" });
      continue;
    }
    full[key] = sections[key].read(entry.value, sections[key].defaults as never);
    present.push(key);
  }
  return { full: full as SettingsState, present, warnings };
}

/** A profile's level as stored or imported: one of `LAYER_LEVELS`, else (missing, from before P-CONFIG-LAYERS, or
 *  unknown) the agent's own. */
function readLevel(raw: unknown): LayerLevel {
  return typeof raw === "string" && (LAYER_LEVELS as readonly string[]).includes(raw) ? (raw as LayerLevel) : "agent";
}

/** The lock keys that name a section a profile carries; anything else dropped. */
export function readLocks(raw: unknown, sections: SectionSchemas = SECTIONS): SectionKey[] {
  if (!Array.isArray(raw)) return [];
  const keys = profileSectionKeys(sections);
  return [...new Set(raw.filter((k): k is SectionKey => typeof k === "string" && (keys as string[]).includes(k)))];
}

/** `name` trimmed and made unique among `taken` (case-insensitive), by
 *  appending " (2)", " (3)"…; null when it's empty. */
export function uniqueProfileName(name: string, taken: readonly string[]): string | null {
  const base = name.trim();
  if (!base) return null;
  const lower = new Set(taken.map((n) => n.trim().toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

// ── Export / import ──

export interface ProfileFile {
  name: string;
  values: AgentSettings;
  locks: SectionKey[];
  /** Absent: "agent". */
  level?: LayerLevel;
}

/** The share file: every agent-scope section with its version, the locks and the level (P-CONFIG-LAYERS; additive,
 *  so the format stays 1 and a file without one reads as the agent's own). Admin- and personal-scope settings are
 *  never in it. */
export function exportProfile(profile: ProfileFile, sections: SectionSchemas = SECTIONS): string {
  return JSON.stringify(
    {
      kind: PROFILE_FILE_KIND,
      format: PROFILE_FILE_FORMAT,
      name: profile.name,
      level: profile.level ?? "agent",
      locks: readLocks(profile.locks, sections),
      sections: writeSections(profile.values, sections),
    },
    null,
    2,
  );
}

export type ProfileImportError = "malformed" | "notAProfile" | "newerFormat";

export type ProfileImportResult =
  | { ok: true; profile: ProfileFile; warnings: ProfileReadWarning[] }
  | { ok: false; error: ProfileImportError };

/** Reads a share file. Not JSON → "malformed"; not a profile file →
 *  "notAProfile"; a later format → "newerFormat". Otherwise every section
 *  is read field by field (see `readProfileSections`). */
export function importProfile(text: string, sections: SectionSchemas = SECTIONS): ProfileImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!isRecord(parsed) || parsed.kind !== PROFILE_FILE_KIND) return { ok: false, error: "notAProfile" };
  if (typeof parsed.format !== "number" || parsed.format > PROFILE_FILE_FORMAT) return { ok: false, error: "newerFormat" };
  const { values, warnings } = readProfileSections(parsed.sections, sections);
  const name = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : t("Imported profile");
  return { ok: true, profile: { name, values, locks: readLocks(parsed.locks, sections), level: readLevel(parsed.level) }, warnings };
}

// ── The library (a small store, like the settings store) ──

export interface ProfileLibrary {
  getState(): ProfileLibraryState;
  subscribe(listener: () => void): () => void;
  /** Saves `values` (agent scope only) under a unique name, at `level` (default the agent's own); null for an empty
   *  name. */
  saveAs(name: string, values: SettingsState | AgentSettings, locks?: SectionKey[], level?: LayerLevel): SavedProfile | null;
  /** Writes `values` (agent scope only) back into a saved profile, keeping its
   *  name and locks; false for an unknown id. */
  overwrite(id: SavedProfileId, values: SettingsState | AgentSettings): boolean;
  /** Renames a saved profile (built-ins can't be); false for an empty name or an unknown id. */
  rename(id: SavedProfileId, name: string): boolean;
  /** Copies a built-in or saved profile as a new saved one ("Copy of …"). */
  duplicate(id: ProfileId | SavedProfileId): SavedProfile | null;
  /** Deletes a saved profile (built-ins can't be); its locks go with it if applied. */
  remove(id: SavedProfileId): void;
  setLocks(id: SavedProfileId, locks: SectionKey[]): void;
  setApplied(applied: AppliedProfile | null): void;
}

function newId(): SavedProfileId {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `saved:${random}`;
}

/** The names a new or renamed profile mustn't repeat: the built-ins' and
 *  every saved one's except `except`. */
function takenNames(saved: SavedProfile[], except?: SavedProfileId): string[] {
  return [...PROFILE_IDS.map((id) => PROFILE_LABELS[id]), ...saved.filter((p) => p.id !== except).map((p) => p.name)];
}

export function createProfileLibrary(
  storage: SettingsStorage = safeStorage(),
  sections: SectionSchemas = SECTIONS,
): ProfileLibrary {
  function read(): ProfileLibraryState {
    const empty: ProfileLibraryState = { saved: [], applied: null };
    const raw = storage.get(PROFILES_STORAGE_KEY);
    if (raw === null) return empty;
    try {
      const parsed = JSON.parse(raw) as { v?: unknown; value?: unknown };
      if (parsed?.v !== LIBRARY_VERSION || !isRecord(parsed.value)) return empty;
      const savedRaw = Array.isArray(parsed.value.saved) ? parsed.value.saved : [];
      const saved: SavedProfile[] = [];
      for (const entry of savedRaw) {
        if (!isRecord(entry) || typeof entry.id !== "string" || !isSavedProfileId(entry.id)) continue;
        if (typeof entry.name !== "string" || !entry.name.trim() || saved.some((p) => p.id === entry.id)) continue;
        saved.push({
          id: entry.id,
          name: entry.name,
          createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString(),
          values: readProfileSections(entry.sections, sections).values,
          locks: readLocks(entry.locks, sections),
          level: readLevel(entry.level),
        });
      }
      const appliedRaw = parsed.value.applied;
      const appliedId = isRecord(appliedRaw) ? appliedRaw.id : undefined;
      const applied =
        isRecord(appliedRaw) && typeof appliedId === "string" && (isBuiltInProfileId(appliedId) || saved.some((p) => p.id === appliedId))
          ? { id: appliedId as ProfileId | SavedProfileId, locks: readLocks(appliedRaw.locks, sections) }
          : null;
      return { saved, applied };
    } catch {
      return empty;
    }
  }

  let state = read();
  const listeners = new Set<() => void>();

  function commit(next: ProfileLibraryState) {
    state = next;
    storage.set(
      PROFILES_STORAGE_KEY,
      JSON.stringify({
        v: LIBRARY_VERSION,
        value: {
          saved: next.saved.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt, level: p.level, locks: p.locks, sections: writeSections(p.values, sections) })),
          applied: next.applied,
        },
      }),
    );
    for (const listener of [...listeners]) listener();
  }

  function add(name: string, values: AgentSettings, locks: SectionKey[], level: LayerLevel = "agent"): SavedProfile | null {
    const unique = uniqueProfileName(name, takenNames(state.saved));
    if (!unique) return null;
    const profile: SavedProfile = { id: newId(), name: unique, createdAt: new Date().toISOString(), values, locks: readLocks(locks, sections), level };
    commit({ ...state, saved: [...state.saved, profile] });
    return profile;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    saveAs(name, values, locks = [], level = "agent") {
      // Read the values through the section readers so a partial or loose
      // object is stored as a complete agent-scope snapshot.
      return add(name, readProfileSections(writeSections(values as AgentSettings, sections), sections).values, locks, readLevel(level));
    },
    overwrite(id, values) {
      if (!state.saved.some((p) => p.id === id)) return false;
      const next = readProfileSections(writeSections(values as AgentSettings, sections), sections).values;
      commit({ ...state, saved: state.saved.map((p) => (p.id === id ? { ...p, values: next } : p)) });
      return true;
    },
    rename(id, name) {
      if (!state.saved.some((p) => p.id === id)) return false;
      const unique = uniqueProfileName(name, takenNames(state.saved, id));
      if (!unique) return false;
      commit({ ...state, saved: state.saved.map((p) => (p.id === id ? { ...p, name: unique } : p)) });
      return true;
    },
    duplicate(id) {
      if (isBuiltInProfileId(id)) return add(t("Copy of {name}", { name: PROFILE_LABELS[id] }), profileValues(id), []);
      const source = state.saved.find((p) => p.id === id);
      return source ? add(t("Copy of {name}", { name: source.name }), source.values, source.locks, source.level) : null;
    },
    remove(id) {
      if (!state.saved.some((p) => p.id === id)) return;
      commit({ saved: state.saved.filter((p) => p.id !== id), applied: state.applied?.id === id ? null : state.applied });
    },
    setLocks(id, locks) {
      if (!state.saved.some((p) => p.id === id)) return;
      const clean = readLocks(locks, sections);
      commit({
        saved: state.saved.map((p) => (p.id === id ? { ...p, locks: clean } : p)),
        // Editing the applied profile's locks applies them now.
        applied: state.applied?.id === id ? { id, locks: clean } : state.applied,
      });
    },
    setApplied(applied) {
      if (applied === state.applied || (applied === null && state.applied === null)) return;
      commit({ ...state, applied: applied ? { id: applied.id, locks: readLocks(applied.locks, sections) } : null });
    },
  };
}

let singleton: ProfileLibrary | null = null;

/** The app's profile library, created on first use. */
export function getProfileLibrary(): ProfileLibrary {
  if (!singleton) singleton = createProfileLibrary();
  return singleton;
}

/** Tests only: drop the singleton so the next use re-reads storage. */
export function resetProfileLibraryForTests() {
  singleton = null;
}
