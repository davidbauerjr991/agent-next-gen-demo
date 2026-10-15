// Workspace presets (one-page decision, 2026-10-15). "Phase 1" and "Phase 2"
// are values for the Header and Home flags plus the omnichannel layout. The
// preset isn't stored: it's whichever preset matches the current flags, else
// "custom", so changing one flag reads Custom and re-picking a preset clears
// it. Extra app pins, the left-nav toggles, Voice and AI aren't part of it.
import type { AssignmentsSettings, HeaderSettings, HomeSettings, SettingsState } from "./settings-schema";

export type PresetId = "phase1" | "phase2";
export type WorkspacePreset = PresetId | "custom";

type PresetHeader = Omit<HeaderSettings, "pins">;

export interface PresetValues {
  header: PresetHeader;
  home: HomeSettings;
  assignments: Pick<AssignmentsSettings, "omnichannel">;
}

export const PRESETS: Record<PresetId, PresetValues> = {
  phase1: {
    header: { showAppIcons: false, search: true, agentChat: true, calendar: true, notifications: true, appsGrid: true },
    home: { homeTabs: false, calendarView: false },
    assignments: { omnichannel: false },
  },
  phase2: {
    header: { showAppIcons: true, search: true, agentChat: true, calendar: true, notifications: true, appsGrid: true },
    home: { homeTabs: true, calendarView: true },
    assignments: { omnichannel: true },
  },
};

export const PRESET_LABELS: Record<WorkspacePreset, string> = {
  phase1: "Phase 1",
  phase2: "Phase 2",
  custom: "Custom",
};

function matches<T extends object>(actual: T, expected: Partial<T>): boolean {
  return (Object.keys(expected) as (keyof T)[]).every((key) => actual[key] === expected[key]);
}

/** The section patches that apply a preset (extra pins are left alone). */
export function presetPatches(id: PresetId): PresetValues {
  return PRESETS[id];
}

export function derivePreset(values: SettingsState): WorkspacePreset {
  for (const id of Object.keys(PRESETS) as PresetId[]) {
    const preset = PRESETS[id];
    if (
      matches(values.header, preset.header) &&
      matches(values.home, preset.home) &&
      matches(values.assignments, preset.assignments)
    ) {
      return id;
    }
  }
  return "custom";
}
