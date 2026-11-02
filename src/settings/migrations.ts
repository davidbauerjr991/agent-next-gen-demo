// Stored values from before a change of meaning, carried to what they mean now (P-LAYOUT-F1). A field reader turns an
// unknown value into the field's default, which would silently lose what the agent chose; these read the raw stored
// values first and say what the new settings should be. Used by the store's first read and by saved profiles.
import type { SettingsState } from "./settings-schema";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** P-LAYOUT-F1 B: assignments placement "none" (or the layout map's assignments at the top of Home) is gone; it reads
 *  as the left nav with Home's Active assignments section on. From the raw stored `assignments` and `layout` values. */
export function storedPlacementNone(rawAssignments: unknown, rawLayout: unknown): boolean {
  if (isRecord(rawAssignments) && rawAssignments.placement === "none") return true;
  const parts = isRecord(rawLayout) && isRecord(rawLayout.parts) ? rawLayout.parts : undefined;
  const assignments = parts && isRecord(parts.assignments) ? parts.assignments : undefined;
  return assignments?.slot === "home-top";
}

/** Fields retired from the stored `assignments` section (P-LAYOUT-F3): `channelChips` (the chips always show) and
 *  `panelPinned` (the interior panel always starts pinned; pinning is per-browser working state). The readers already
 *  ignore them; a stored one is dropped from storage once, so it doesn't linger. */
export const RETIRED_ASSIGNMENTS_FIELDS = ["channelChips", "panelPinned"] as const;

/** Whether the raw stored `assignments` value still carries a retired field. */
export function storedRetiredAssignmentsFields(rawAssignments: unknown): boolean {
  return isRecord(rawAssignments) && RETIRED_ASSIGNMENTS_FIELDS.some((key) => key in rawAssignments);
}

/** `values` with Home's Active assignments section on and first, the rest in their order. */
export function withActiveAssignmentsSection(values: SettingsState): SettingsState {
  const rest = values.home.sections.filter((s) => s.key !== "activeAssignments");
  return { ...values, home: { ...values.home, sections: [{ key: "activeAssignments", enabled: true }, ...rest] } };
}
