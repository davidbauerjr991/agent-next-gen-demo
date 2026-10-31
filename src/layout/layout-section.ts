// The `layout` settings section (P-LAYOUT): `layout.parts`, one map from every part to its slot, order and options.
// The map is the source of placement. Until each legacy placement field retires (PLAN Decisions 2026-10-30), the
// legacy fields are read-through: a part the stored map doesn't name is derived from them (the first-read migration),
// a write to a legacy field moves its parts (its preset), and a write to the map projects back onto every legacy
// field whose value it reproduces. `settleLayout` is that reconciliation; the store runs it, then the constraints, on
// every read and write. Types only from the settings schema, so the schema can import this module.
import type { SectionKey, SettingsState } from "@/settings/settings-schema";
import { LEGACY_FIELDS, type PartPatch } from "./presets";
import { PARTS, PART_IDS, type PartId } from "./parts";
import type { SlotId } from "./slots";

export interface LayoutPartEntry {
  slot: SlotId;
  /** Its sort key within its slot, ascending (a key, not a position: presets set it, nothing renumbers it). */
  order: number;
  options: Record<string, string>;
}
export type LayoutParts = Record<PartId, LayoutPartEntry>;
export interface LayoutSettings {
  parts: LayoutParts;
}

const optionDefaults = (id: PartId): Record<string, string> =>
  Object.fromEntries(Object.entries(PARTS[id].options ?? {}).map(([name, o]) => [name, o.default]));

/** Every part at its registry default, in registry order. */
function defaultLayoutParts(): LayoutParts {
  return Object.fromEntries(
    PART_IDS.map((id, index) => [id, { slot: PARTS[id].defaultSlot, order: index, options: optionDefaults(id) }]),
  ) as LayoutParts;
}

/** One stored entry, valid or null: a slot the part allows, a finite order, options among their values. */
function readEntry(id: PartId, raw: unknown): Partial<LayoutPartEntry> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const out: Partial<LayoutPartEntry> = {};
  if (typeof e.slot === "string" && (PARTS[id].allowedSlots as readonly string[]).includes(e.slot)) out.slot = e.slot as SlotId;
  if (typeof e.order === "number" && Number.isFinite(e.order)) out.order = e.order;
  if (typeof e.options === "object" && e.options !== null && !Array.isArray(e.options)) {
    const options: Record<string, string> = {};
    for (const [name, def] of Object.entries(PARTS[id].options ?? {})) {
      const value = (e.options as Record<string, unknown>)[name];
      if (typeof value === "string" && def.values.includes(value)) options[name] = value;
    }
    if (Object.keys(options).length > 0) out.options = options;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** A stored map read part by part: unknown parts and invalid fields dropped. Partial: what's missing reads through
 *  (`settleLayout`). The `layout` section's field reader. */
export function readStoredParts(raw: unknown): Partial<Record<PartId, Partial<LayoutPartEntry>>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<PartId, Partial<LayoutPartEntry>>> = {};
  for (const id of PART_IDS) {
    const entry = readEntry(id, (raw as Record<string, unknown>)[id]);
    if (entry) out[id] = entry;
  }
  return out;
}

/** `parts` with `patch` applied entry by entry (options merged). */
export function patchParts(parts: LayoutParts, patch: PartPatch): LayoutParts {
  let next = parts;
  for (const id of Object.keys(patch) as PartId[]) {
    const p = patch[id]!;
    const prev = next[id];
    const entry: LayoutPartEntry = { slot: p.slot ?? prev.slot, order: p.order ?? prev.order, options: p.options ? { ...prev.options, ...p.options } : prev.options };
    if (entry.slot === prev.slot && entry.order === prev.order && entry.options === prev.options) continue;
    next = { ...next, [id]: entry };
  }
  return next;
}

/** Each part in a slot it allows (else its default), options among their values (else the default), and a finite
 *  order (else its registry position). Orders are sort keys, not positions: `main` holds Home's parts and the
 *  interaction's, so renumbering would make the same layout differ by how it was reached. Ties sort in registry
 *  order (`partsInSlot`). Returns `parts` itself when nothing changes. */
export function validateLayout(parts: LayoutParts): LayoutParts {
  const fixed = {} as LayoutParts;
  for (const id of PART_IDS) {
    const entry = parts[id];
    const def = PARTS[id];
    const slot = entry && def.allowedSlots.includes(entry.slot) ? entry.slot : def.defaultSlot;
    const options = { ...optionDefaults(id) };
    for (const [name, o] of Object.entries(def.options ?? {})) {
      const value = entry?.options?.[name];
      if (value !== undefined && o.values.includes(value)) options[name] = value;
    }
    fixed[id] = { slot, order: entry && Number.isFinite(entry.order) ? entry.order : PART_IDS.indexOf(id), options };
  }
  const same = PART_IDS.every((id) => {
    const a = parts[id];
    const b = fixed[id];
    return a && a.slot === b.slot && a.order === b.order && Object.keys(b.options).every((k) => a.options?.[k] === b.options[k]) && Object.keys(a.options ?? {}).length === Object.keys(b.options).length;
  });
  return same ? parts : fixed;
}

/** The parts in `slot`, in order (ties in registry order). */
export function partsInSlot(parts: LayoutParts, slot: SlotId): PartId[] {
  return PART_IDS.filter((id) => parts[id].slot === slot).sort((a, b) => parts[a].order - parts[b].order || PART_IDS.indexOf(a) - PART_IDS.indexOf(b));
}

/** The map today's legacy settings describe: the defaults with every legacy field's preset applied (the migration). */
export function layoutFromLegacy(values: SettingsState): LayoutParts {
  let parts = defaultLayoutParts();
  for (const field of LEGACY_FIELDS) parts = patchParts(parts, field.preset(field.get(values), values));
  return validateLayout(parts);
}

/** `values` with each legacy field set to the value the map reproduces (left as is where it reproduces none), and
 *  the sections that changed. */
export function legacyFromLayout(values: SettingsState): { values: SettingsState; touched: SectionKey[] } {
  let next = values;
  const touched = new Set<SectionKey>();
  for (const field of LEGACY_FIELDS) {
    const patched = field.project(next.layout.parts, next);
    if (patched === next) continue;
    next = patched;
    touched.add(field.section);
  }
  return { values: next, touched: [...touched] };
}

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Reconciles the map and the legacy fields. `prev` null: a read — the stored map (`stored`, possibly partial or
 *  empty) over the legacy-derived map, then projected onto the legacy fields (the map wins). Otherwise a write
 *  from `prev` to `next`: the incoming map (if changed) is validated, each changed legacy field applies its preset
 *  unless the incoming map is a custom arrangement of its parts, and the result is projected. Returns the same
 *  `next` when nothing changes; `touched` is what the reconciliation changed (the caller's lock check). */
export function settleLayout(
  prev: SettingsState | null,
  next: SettingsState,
  stored?: Partial<Record<PartId, Partial<LayoutPartEntry>>>,
): { values: SettingsState; touched: SectionKey[] } {
  let parts: LayoutParts;
  if (prev === null) {
    const derived = layoutFromLegacy(next);
    parts = validateLayout(patchParts(derived, (stored ?? {}) as PartPatch));
  } else {
    // A partial map (from storage in another tab, or a patch) reads through to what's there now.
    const incoming = next.layout === prev.layout ? prev.layout.parts : validateLayout(patchParts(prev.layout.parts, next.layout.parts as PartPatch));
    parts = incoming;
    // A changed legacy field moves its parts — unless the same write brought a map whose arrangement of those parts
    // reproduces no value of the field (a profile carrying a custom arrangement): then the map wins and the field
    // is left as it is. A map that reproduces some value is overridden by the field (`{ ...profile, ai: {
    // displayLocation } }`: the profile's map says inline, the override says panel — panel).
    for (const field of LEGACY_FIELDS) {
      if (sameValue(field.get(prev), field.get(next))) continue;
      const custom = next.layout !== prev.layout && field.reproduced(incoming, next) === undefined;
      if (!custom) parts = patchParts(parts, field.preset(field.get(next), next));
    }
    parts = validateLayout(parts);
  }
  let values = parts === next.layout.parts ? next : { ...next, layout: { ...next.layout, parts } };
  const touched = new Set<SectionKey>(parts !== next.layout.parts ? ["layout"] : []);
  const projected = legacyFromLayout(values);
  values = projected.values;
  for (const key of projected.touched) touched.add(key);
  return { values, touched: [...touched] };
}
