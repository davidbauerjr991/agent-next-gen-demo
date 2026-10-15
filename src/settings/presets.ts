// Workspace presets (one-page decision, 2026-10-15). "Phase 1" and "Phase 2"
// are values for the Header section (including each app's display; apps
// placed as "tab" are the Home tabs) and the omnichannel layout. The preset
// isn't stored: it's whichever preset matches the current values, else
// "custom", so changing one setting reads Custom and re-picking a preset
// clears it. The left-nav toggles, Home (the Dashboard), Voice and AI aren't
// part of it.
import type { AppDisplay, AssignmentsSettings, ExtraHeaderApp, HeaderSettings, SettingsState } from "./settings-schema";

export type PresetId = "phase1" | "phase2";
export type WorkspacePreset = PresetId | "custom";

export interface PresetValues {
  header: HeaderSettings;
  assignments: Pick<AssignmentsSettings, "omnichannel">;
}

const app = (enabled: boolean, placement: AppDisplay["placement"] = "header"): AppDisplay => ({ enabled, placement });
const NO_APPS: Record<ExtraHeaderApp, AppDisplay> = {
  customers: app(false),
  accounts: app(false),
  tickets: app(false),
  wem: app(false),
  schedule: app(false),
  screenpop: app(false),
};

export const PRESETS: Record<PresetId, PresetValues> = {
  phase1: {
    header: {
      showAppIcons: false,
      search: true,
      agentChat: { enabled: true, placement: "header" },
      notifications: true,
      appsGrid: true,
      apps: NO_APPS,
    },
    assignments: { omnichannel: false },
  },
  // Desk's layout: Customers/Accounts/Tickets as Home tabs, Schedule and WEM
  // in the header.
  phase2: {
    header: {
      showAppIcons: true,
      search: true,
      agentChat: { enabled: true, placement: "header" },
      notifications: true,
      appsGrid: true,
      apps: {
        customers: app(true, "tab"),
        accounts: app(true, "tab"),
        tickets: app(true, "tab"),
        wem: app(true, "header"),
        schedule: app(true, "header"),
        screenpop: app(false),
      },
    },
    assignments: { omnichannel: true },
  },
};

export const PRESET_LABELS: Record<WorkspacePreset, string> = {
  phase1: "Phase 1",
  phase2: "Phase 2",
  custom: "Custom",
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** True when every field the preset sets has the preset's value. */
function matches<T extends object>(actual: T, expected: Partial<T>): boolean {
  return (Object.keys(expected) as (keyof T)[]).every((key) => deepEqual(actual[key], expected[key]));
}

/** The section patches that apply a preset. */
export function presetPatches(id: PresetId): PresetValues {
  return PRESETS[id];
}

export function derivePreset(values: SettingsState): WorkspacePreset {
  for (const id of Object.keys(PRESETS) as PresetId[]) {
    const preset = PRESETS[id];
    if (
      matches(values.header, preset.header) &&
      matches(values.assignments, preset.assignments)
    ) {
      return id;
    }
  }
  return "custom";
}
