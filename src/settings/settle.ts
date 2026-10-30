// Where every settings read and write ends (P-LAYOUT): the layout map and the legacy placement fields reconciled,
// then the constraints, then — if a constraint moved a part — the map validated and projected again. Its own module
// so the store and the built-in profiles (which the store reaches through the profile library) share it.
import { legacyFromLayout, settleLayout, validateLayout, type LayoutParts } from "@/layout/layout-section";
import { applyConstraints } from "./constraints";
import type { SectionKey, SettingsState } from "./settings-schema";

/** `prev` null for a read, with the stored map if there is one (possibly partial); otherwise a write from `prev` to
 *  `next`. `touched`: every section that changed besides the ones the caller wrote. `derived`: the ones the
 *  layout reconciliation changed — the agent's own choice reaching another section, so a profile lock on one of
 *  them blocks the write (a constraint's forced value doesn't: it isn't the agent's choice; PLAN Decisions
 *  2026-10-29, 2026-10-30). */
export function settle(
  prev: SettingsState | null,
  next: SettingsState,
  storedLayout?: Partial<LayoutParts>,
): { values: SettingsState; touched: SectionKey[]; derived: SectionKey[] } {
  const layout = settleLayout(prev, next, storedLayout);
  const constrained = applyConstraints(layout.values);
  let values = constrained.values;
  const touched = new Set<SectionKey>([...layout.touched, ...constrained.touched]);
  if (constrained.touched.includes("layout")) {
    const parts = validateLayout(values.layout.parts);
    if (parts !== values.layout.parts) values = { ...values, layout: { ...values.layout, parts } };
    const projected = legacyFromLayout(values);
    values = projected.values;
    for (const key of projected.touched) touched.add(key);
  }
  return { values, touched: [...touched], derived: layout.touched };
}

/** A full settings state with its layout map derived from its own legacy fields (a built-in profile, defaults). */
export function withDerivedLayout(values: SettingsState): SettingsState {
  return settle(null, values).values;
}
