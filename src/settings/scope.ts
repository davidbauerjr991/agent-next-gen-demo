// Setting scope (P-AIFIRST; personal scope P-PROFILES): walks the schema so
// profiles see only agent-scope settings. A profile snapshot drops admin- and
// personal-scope nodes, the derive comparison ignores them, and applying a
// profile keeps their current values.
import {
  SECTIONS,
  isProfileScope,
  type Field,
  type GroupField,
  type SectionKey,
  type SectionSchemas,
  type SettingScope,
  type SettingsState,
} from "./settings-schema";

/** A profile's values: every agent-scope setting, no admin- or
 *  personal-scope ones (a section outside profiles appears as `{}`). */
export type AgentSettings = { [K in SectionKey]: Partial<SettingsState[K]> };

const OMIT = Symbol("outside-profiles");

type AnyGroup = Field<unknown> & Pick<GroupField<object>, "scope"> & { fields: Record<string, Field<unknown>> };

function isGroup(field: Field<unknown>): field is AnyGroup {
  return "fields" in field;
}

/** A node's own scope (a group's, or a `scoped` field's), else its parent's. */
function scopeOf(field: Field<unknown>, inherited: SettingScope): SettingScope {
  return (field as { scope?: SettingScope }).scope || inherited;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function strip(field: Field<unknown>, value: unknown, inherited: SettingScope): unknown {
  const scope = scopeOf(field, inherited);
  if (!isProfileScope(scope)) return OMIT;
  if (!isGroup(field) || !isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(field.fields)) {
    const next = strip(child, value[key], scope);
    if (next !== OMIT) out[key] = next;
  }
  return out;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

// Returns `current` itself wherever nothing changes, so the store (which
// compares by reference) writes only the sections a profile actually changes.
function overlay(field: Field<unknown>, current: unknown, incoming: unknown, inherited: SettingScope): unknown {
  const scope = scopeOf(field, inherited);
  if (!isProfileScope(scope)) return current;
  if (!isGroup(field) || !isRecord(current)) return incoming === undefined || deepEqual(current, incoming) ? current : incoming;
  const source = isRecord(incoming) ? incoming : {};
  const out: Record<string, unknown> = {};
  let changed = false;
  for (const [key, child] of Object.entries(field.fields)) {
    out[key] = overlay(child, current[key], source[key], scope);
    if (out[key] !== current[key]) changed = true;
  }
  return changed ? out : current;
}

/** The agent-scope part of `values`: what a profile carries and compares. */
export function agentSettings(values: SettingsState, sections: SectionSchemas = SECTIONS): AgentSettings {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(sections) as SectionKey[]) {
    const next = strip(sections[key].read as Field<unknown>, values[key], "agent");
    out[key] = next === OMIT ? {} : next;
  }
  return out as AgentSettings;
}

/** `current` with every agent-scope setting taken from `incoming` (where it
 *  has one) and every admin- and personal-scope setting kept as it is. */
export function withAgentSettings(
  current: SettingsState,
  incoming: AgentSettings,
  sections: SectionSchemas = SECTIONS,
): SettingsState {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(sections) as SectionKey[]) {
    out[key] = overlay(sections[key].read as Field<unknown>, current[key], incoming[key], "agent");
  }
  return out as SettingsState;
}

/** A section's top-level fields that a profile carries (a lock covers these;
 *  its personal and admin fields stay writable). */
export function profileFieldKeys(key: SectionKey, sections: SectionSchemas = SECTIONS): string[] {
  const read = sections[key].read as Field<unknown>;
  const scope = scopeOf(read, "agent");
  if (!isProfileScope(scope) || !isGroup(read)) return [];
  return Object.entries(read.fields)
    .filter(([, child]) => isProfileScope(scopeOf(child, scope)))
    .map(([name]) => name);
}

/** Whether a section has anything a profile carries (false for a section that
 *  is wholly admin or personal, like `phone`). */
export function sectionInProfiles(key: SectionKey, sections: SectionSchemas = SECTIONS): boolean {
  const walk = (field: Field<unknown>, inherited: SettingScope): boolean => {
    const scope = scopeOf(field, inherited);
    if (!isProfileScope(scope)) return false;
    return !isGroup(field) || Object.values(field.fields).some((child) => walk(child, scope));
  };
  return walk(sections[key].read as Field<unknown>, "agent");
}
