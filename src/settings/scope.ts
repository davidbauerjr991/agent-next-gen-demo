// Setting scope (P-AIFIRST): walks the schema so profiles see only
// agent-scope settings. A profile snapshot drops admin-scope nodes, the
// derive comparison ignores them, and applying a profile keeps the current
// admin values.
import {
  SECTIONS,
  type Field,
  type GroupField,
  type SectionKey,
  type SectionSchemas,
  type SettingScope,
  type SettingsState,
} from "./settings-schema";

/** A profile's values: every agent-scope setting, no admin-scope ones (an
 *  admin-scope section appears as `{}`). */
export type AgentSettings = { [K in SectionKey]: Partial<SettingsState[K]> };

const OMIT = Symbol("admin-scope");

type AnyGroup = Field<unknown> & Pick<GroupField<object>, "scope"> & { fields: Record<string, Field<unknown>> };

function isGroup(field: Field<unknown>): field is AnyGroup {
  return "fields" in field;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function strip(field: Field<unknown>, value: unknown, inherited: SettingScope): unknown {
  const scope = (isGroup(field) && field.scope) || inherited;
  if (scope === "admin") return OMIT;
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
  const scope = (isGroup(field) && field.scope) || inherited;
  if (scope === "admin") return current;
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
 *  has one) and every admin-scope setting kept as it is. */
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
