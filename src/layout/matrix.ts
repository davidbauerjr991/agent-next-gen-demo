// The layout matrix (P-LAYOUT): `docs/layout-matrix.md`, generated from the registries rather than kept by hand.
// Pure and deterministic — every list sorted by id, no dates — so `npm run docs` (scripts/layout-matrix.mjs) and
// `matrix.test.ts` (which fails when the committed file is stale) render the same text. Reads the slots and parts
// registries, the legacy placement fields (`LEGACY_FIELDS`, which also give the retirement checklist), the setting
// constraints and the built-in profiles.
import { PROFILES, PROFILE_IDS, PROFILE_LABELS } from "@/settings/profiles";
import { SECTIONS, SETTING_CONSTRAINTS, defaultSettings, type SettingConstraint } from "@/settings/settings-schema";
import { withDerivedLayout } from "@/settings/settle";
import { PARTS, PART_IDS } from "./parts";
import { LEGACY_FIELDS, type LegacyField } from "./presets";
import { SLOTS, SLOT_IDS, type SlotDef } from "./slots";

/** Code-unit order: the same on every machine (`localeCompare` follows the locale). */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byId = <T extends { id: string }>(list: readonly T[]) => [...list].sort((a, b) => compare(a.id, b.id));
const code = (value: unknown) => `\`${typeof value === "string" ? value : JSON.stringify(value)}\``;
const row = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
const table = (head: readonly string[], rows: readonly (readonly string[])[]) =>
  [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");

const profiles = PROFILE_IDS.map((id) => ({ id, label: PROFILE_LABELS[id], values: PROFILES[id] }));
const defaults = withDerivedLayout(defaultSettings());

/** A field's value, as the docs write it. */
const shown = (field: LegacyField, values: typeof defaults) => {
  const value = field.get(values);
  return Array.isArray(value) ? value.join(", ") : String(value);
};

function retirementChecklist(): string {
  const rows = byId(LEGACY_FIELDS).map((field) => {
    const version = SECTIONS[field.section].version;
    // The parts its presets move (over every value, and the current one for a read-through field): what reads the
    // map instead once the field is gone.
    const values = field.values.length > 0 ? field.values : [field.get(defaults)];
    const moves = [...new Set(values.flatMap((v) => Object.keys(field.preset(v, defaults))))].sort(compare);
    return [
      code(field.id),
      `\`${field.section}\` v${version} → v${version + 1}`,
      moves.map(code).join(", "),
      field.values.length > 0 ? field.values.map(code).join(", ") : "read through only",
    ];
  });
  return [
    "## Retirement checklist",
    "",
    "Each field below is read through `layout.parts` until the next step that touches it retires it (PLAN Decisions 2026-10-30). Its projection is its `LEGACY_FIELDS` entry's `project` (`src/layout/presets.ts`), run by `legacyFromLayout` on every write. To retire one: bump its section's version as shown, delete that entry — which removes its preset and its projection — and drop the field from its section. Its row then leaves this list.",
    "",
    table(["Field", "Section version", "Parts it moves", "Preset values"], rows),
  ].join("\n");
}

/** A header app's placement field under a profile that turns the app off. */
function appOff(field: LegacyField, values: typeof defaults): boolean {
  const app = /^header\.apps\.(\w+)\.placement$/.exec(field.id)?.[1] as keyof typeof values.header.apps | undefined;
  return !!app && !values.header.apps[app]?.enabled;
}

function variables(): string {
  const fields = byId(LEGACY_FIELDS.filter((f) => f.values.length > 0));
  const rows = fields.map((field) => {
    const fallback = shown(field, defaults);
    return [
      code(field.id),
      field.values.map((v) => (String(v) === fallback ? `**${String(v)}**` : String(v))).join(", "),
      ...profiles.map((p) => shown(field, p.values) + (appOff(field, p.values) ? " (off)" : "")),
    ];
  });
  const unexercised = fields.flatMap((field) => {
    const used = new Set(profiles.map((p) => shown(field, p.values)));
    const missing = field.values.map(String).filter((v) => !used.has(v));
    return missing.length > 0 ? [`- ${code(field.id)}: ${missing.map(code).join(", ")}`] : [];
  });
  // Slots only the map can express (no legacy value names them): a part in a slot no profile puts it in.
  const unusedSlots = [...PART_IDS].sort(compare).flatMap((id) => {
    const used = new Set(profiles.map((p) => p.values.layout.parts[id].slot));
    const missing = PARTS[id].allowedSlots.filter((slot) => !used.has(slot));
    return missing.length > 0 ? [`- ${code(id)} in ${missing.map(code).join(", ")}`] : [];
  });
  const readThrough = byId(LEGACY_FIELDS.filter((f) => f.values.length === 0)).map((field) => {
    const fallback = shown(field, defaults);
    return [code(field.id), fallback, ...profiles.map((p) => (shown(field, p.values) === fallback ? "= default" : shown(field, p.values)))];
  });
  return [
    "## Variables",
    "",
    "The legacy placement fields offered as presets (Settings → Layout). Default **bold**. A header app the profile turns off (`header.apps.<app>.enabled`) is marked (off): its placement still counts as exercised.",
    "",
    table(["Setting", "Values", ...profiles.map((p) => p.label)], rows),
    "",
    "Read through only (no preset row; the map's order or a cell's region writes them):",
    "",
    table(["Setting", "Default", ...profiles.map((p) => p.label)], readThrough),
    "",
    "## Values no built-in profile exercises",
    "",
    "Legacy fields:",
    "",
    unexercised.length > 0 ? unexercised.join("\n") : "None.",
    "",
    "Parts, by slot (`layout.parts`; Settings → Layout → Advanced reaches every one):",
    "",
    unusedSlots.length > 0 ? unusedSlots.join("\n") : "None.",
  ].join("\n");
}

function parts(): string {
  const ids = [...PART_IDS].sort(compare);
  const rows = ids.map((id) => {
    const def = PARTS[id];
    return [
      code(id),
      def.label,
      def.pages.join(", "),
      code(def.defaultSlot),
      def.allowedSlots.join(", "),
      ...profiles.map((p) => p.values.layout.parts[id].slot),
      def.source ?? "",
    ];
  });
  return [
    "## Parts and slots",
    "",
    "Every part, the slots it allows and where each built-in profile puts it (`layout.parts`).",
    "",
    table(["Part", "Label", "Pages", "Default", "Allowed", ...profiles.map((p) => p.label), "Reads through"], rows),
  ].join("\n");
}

function width(slot: SlotDef): string {
  if (!slot.minWidth && !slot.maxWidth) return "";
  return `${slot.minWidth ?? "—"} – ${slot.maxWidth ?? "—"}`;
}

function slots(): string {
  const ids = [...SLOT_IDS].sort(compare);
  const rows = ids.map((id) => {
    const slot = SLOTS[id];
    return [code(id), slot.label, slot.container, width(slot), String(slot.capacity), slot.pages.join(", "), slot.fitFallback ?? ""];
  });
  return [
    "## Slots",
    "",
    "Widths are tokens the container resolves: `card` (lyra's `LYRA_CARD_MAX_WIDTH`), `container` (the container's own), `action-area` (`ACTION_AREA_MIN_WIDTH`), `row-less-action` (the body row less the action area's minimum).",
    "",
    table(["Slot", "Label", "Container", "Width (min – max)", "Capacity", "Pages", "When it doesn't fit"], rows),
  ].join("\n");
}

const when = (rule: SettingConstraint) => `${code(rule.when.path)} in ${rule.when.in.map(code).join(", ")}`;

function constraints(): string {
  const rules = byId(SETTING_CONSTRAINTS);
  const forced = rules
    .filter((r) => r.forces)
    .map((r) => [code(r.id), when(r), `${code(r.forces!.path)} = ${code(r.forces!.value)}`, r.note ? `${r.reason} ("${r.note}")` : r.reason]);
  const disabled = rules.filter((r) => r.disables).map((r) => [code(r.id), when(r), code(r.disables!.path), r.reason]);
  return [
    "## Forced combinations",
    "",
    "`SETTING_CONSTRAINTS` with `forces`, enforced by the store on every read and write. A forced value is written even through a profile lock on its section (PLAN Decisions 2026-10-29).",
    "",
    table(["Rule", "When", "Forces", "Reason shown in Settings"], forced),
    "",
    "## Combinations that disable a control",
    "",
    "`SETTING_CONSTRAINTS` with `disables`: the setting is unused while the rule holds, and Settings shows it disabled with the reason.",
    "",
    table(["Rule", "When", "Disabled", "Reason"], disabled),
  ].join("\n");
}

/** The whole of `docs/layout-matrix.md`. */
export function renderLayoutMatrix(): string {
  return [
    "# Layout matrix",
    "",
    "Every layout variable in the agent workspace, its values, which built-in profile exercises which value, where each part goes, and the combinations the schema forces or disables.",
    "",
    "Generated by `npm run docs` (`src/layout/matrix.ts`) from the slots and parts registries (`src/layout/`), the legacy placement fields (`src/layout/presets.ts`), `SETTING_CONSTRAINTS` and the built-in profiles (`src/settings/profiles.ts`). Don't edit it by hand: `src/layout/matrix.test.ts` fails when it's stale.",
    "",
    retirementChecklist(),
    "",
    variables(),
    "",
    parts(),
    "",
    slots(),
    "",
    constraints(),
    "",
  ].join("\n");
}
