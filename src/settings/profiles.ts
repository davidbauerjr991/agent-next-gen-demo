// Workspace profiles (P0.5d.2; one-page decision, 2026-10-15). A profile is
// a snapshot of every settings section. "Phase 1" and "Phase 2" are the
// built-in profiles. The active profile isn't stored: it's whichever built-in
// profile the current values equal, else "custom", so changing any setting
// reads Custom and applying a profile clears it. P-PROFILES adds saved
// profiles and per-section locks on top of this.
import {
  LAUNCHER_TABS,
  defaultSettings,
  type AppDisplay,
  type ExtraHeaderApp,
  type LauncherTab,
  type SettingsState,
} from "./settings-schema";

export type ProfileId = "phase1" | "phase2";
export type WorkspaceProfile = ProfileId | "custom";

const app = (enabled: boolean, placement: AppDisplay["placement"] = "header"): AppDisplay => ({ enabled, placement });

/** Phase 1: every section at its default. */
function phase1(): SettingsState {
  return defaultSettings();
}

/** Phase 2: Desk's layout. Customers, Accounts and Tickets as Home tabs,
 *  Schedule and WEM in the header, the omnichannel layout. Every other
 *  section at its default. */
function phase2(): SettingsState {
  const base = defaultSettings();
  const apps: Record<ExtraHeaderApp, AppDisplay> = {
    customers: app(true, "tab"),
    accounts: app(true, "tab"),
    tickets: app(true, "tab"),
    wem: app(true, "header"),
    schedule: app(true, "header"),
    screenpop: app(false),
  };
  return {
    ...base,
    header: { ...base.header, showAppIcons: true, apps },
    assignments: { ...base.assignments, omnichannel: true },
    // Every Directory App tab and every Outbound Calling behavior.
    outbound: {
      launcher: Object.fromEntries(LAUNCHER_TABS.map((t) => [t, true])) as Record<LauncherTab, boolean>,
      calling: { ...base.outbound.calling },
    },
  };
}

export const PROFILES: Record<ProfileId, SettingsState> = { phase1: phase1(), phase2: phase2() };

export const PROFILE_LABELS: Record<WorkspaceProfile, string> = {
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

/** Every section's values for a built-in profile. */
export function profileValues(id: ProfileId): SettingsState {
  return PROFILES[id];
}

export function deriveProfile(values: SettingsState): WorkspaceProfile {
  for (const id of Object.keys(PROFILES) as ProfileId[]) {
    if (deepEqual(values, PROFILES[id])) return id;
  }
  return "custom";
}
