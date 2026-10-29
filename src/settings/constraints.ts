// Schema-level constraints (P-HOME-1n): one setting's value forcing another's. The store runs `applyConstraints`
// on every write and read, so an invalid combination is never stored or shown; Settings reads `activeConstraint`
// to render the target disabled with its reason.
import { SETTING_CONSTRAINTS, type SectionKey, type SettingConstraint, type SettingPath, type SettingsState } from "./settings-schema";

const segments = (path: SettingPath) => path.split(".");

function readPath(values: SettingsState, path: SettingPath): unknown {
  let node: unknown = values;
  for (const key of segments(path)) node = (node as Record<string, unknown> | undefined)?.[key];
  return node;
}

function writePath(node: unknown, [head, ...rest]: string[], value: unknown): Record<string, unknown> {
  const obj = (node ?? {}) as Record<string, unknown>;
  return { ...obj, [head]: rest.length === 0 ? value : writePath(obj[head], rest, value) };
}

const holds = (values: SettingsState, rule: SettingConstraint) => rule.when.in.includes(readPath(values, rule.when.path));

/** `values` with every holding rule's target set to its forced value, and the sections that changed. Returns the
 *  same `values` object when nothing changed. */
export function applyConstraints(
  values: SettingsState,
  rules: readonly SettingConstraint[] = SETTING_CONSTRAINTS,
): { values: SettingsState; touched: SectionKey[] } {
  let next = values;
  const touched = new Set<SectionKey>();
  for (const rule of rules) {
    if (!holds(next, rule) || readPath(next, rule.forces.path) === rule.forces.value) continue;
    next = writePath(next, segments(rule.forces.path), rule.forces.value) as SettingsState;
    touched.add(segments(rule.forces.path)[0] as SectionKey);
  }
  return { values: next, touched: [...touched] };
}

/** The rule currently forcing `path` (its `forces.value` and `reason`), if any. The rule object itself, so a store
 *  selector can return it. */
export function activeConstraint(
  values: SettingsState,
  path: SettingPath,
  rules: readonly SettingConstraint[] = SETTING_CONSTRAINTS,
): SettingConstraint | null {
  return rules.find((r) => r.forces.path === path && holds(values, r)) ?? null;
}
