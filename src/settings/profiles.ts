// Workspace profiles (P0.5d.2; one-page decision, 2026-10-15). A profile is
// a snapshot of every agent-scope setting (admin-scope ones, such as the
// brand, are never in a profile; P-AIFIRST). "Phase 1", "Phase 2" and
// "AI-first" are the built-in profiles. The active profile isn't stored: it's
// whichever profile the current values equal, else the profile applied last
// (stored as the library's `applied` base) read as modified, else "custom".
// Saved profiles and per-section locks (P-PROFILES) are ./saved-profiles.ts.
import { agentSettings, deepEqual, type AgentSettings } from "./scope";
import {
  LAUNCHER_TABS,
  defaultSettings,
  type AppDisplay,
  type ExtraHeaderApp,
  type LauncherTab,
  type SettingsState,
} from "./settings-schema";

export type ProfileId = "phase1" | "phase2" | "aifirst";
/** A built-in profile, a saved one (`saved:…`, ./saved-profiles.ts), or
 *  "custom" (differs from every profile). */
export type WorkspaceProfile = ProfileId | `saved:${string}` | "custom";

const app = (enabled: boolean, placement: AppDisplay["placement"] = "header"): AppDisplay => ({ enabled, placement });

/** Phase 1: every section at its default. */
function phase1(): SettingsState {
  return defaultSettings();
}

/** Phase 2: Desk's layout. Customers, Accounts and Tickets as Home tabs,
 *  Schedule and WEM in the header, every channel. Every other section at its
 *  default. */
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
    channels: { ...base.channels, voice: true, chat: true, email: true, sms: true, whatsapp: true },
    // Every Directory App tab and every Outbound Calling behavior.
    outbound: {
      launcher: Object.fromEntries(LAUNCHER_TABS.map((t) => [t, true])) as Record<LauncherTab, boolean>,
      calling: { ...base.outbound.calling },
    },
  };
}

/** AI-first: Phase 2 with the AI workspace in the main column and every
 *  conversation thread in the docked panel (AI display "main"), with the
 *  reference cards in their own column (P-CANVAS), and the two-column
 *  Activity Home (P-HOME-1). */
function aiFirst(): SettingsState {
  const base = phase2();
  return {
    ...base,
    // The Activity feed, two columns; every other built-in keeps the original Home.
    home: {
      ...base.home,
      layout: "twoColumn",
      sections: base.home.sections.map((s) => (s.key === "activity" ? { ...s, enabled: true } : s)),
    },
    ai: { ...base.ai, displayLocation: "main", canvasLayout: "twoColumn" },
    // Legs as tabs until P-STREAM lands, then "stream" (PLAN Settings "Legs as one stream").
    assignments: { ...base.assignments, legs: "tabs" },
  };
}

export const PROFILES: Record<ProfileId, SettingsState> = { phase1: phase1(), phase2: phase2(), aifirst: aiFirst() };

export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];

export const PROFILE_LABELS: Record<ProfileId | "custom", string> = {
  phase1: "Phase 1",
  phase2: "Phase 2",
  aifirst: "AI-first",
  custom: "Custom",
};

/** A built-in profile's values: every agent-scope setting. */
export function profileValues(id: ProfileId): AgentSettings {
  return agentSettings(PROFILES[id]);
}

/** The profile the settings read as, and whether they've moved off it. */
export interface DerivedProfile {
  profile: WorkspaceProfile;
  /** The values differ from `profile`'s: it's the applied base they came from. */
  modified: boolean;
}

/** The profile the values equal exactly: a built-in first (they win a tie),
 *  then a saved one in list order. Else the applied base (the profile applied
 *  last, still present) with `modified`. Else "custom": values that match no
 *  profile and weren't derived from one. */
export function deriveProfileState(
  values: SettingsState,
  saved: readonly { id: `saved:${string}`; values: AgentSettings }[] = [],
  appliedBase: ProfileId | `saved:${string}` | null = null,
): DerivedProfile {
  const current = agentSettings(values);
  for (const id of PROFILE_IDS) {
    if (deepEqual(current, profileValues(id))) return { profile: id, modified: false };
  }
  for (const profile of saved) {
    if (deepEqual(current, profile.values)) return { profile: profile.id, modified: false };
  }
  const baseExists = appliedBase !== null && ((PROFILE_IDS as string[]).includes(appliedBase) || saved.some((p) => p.id === appliedBase));
  return baseExists ? { profile: appliedBase, modified: true } : { profile: "custom", modified: false };
}

/** `deriveProfileState`'s profile alone. */
export function deriveProfile(
  values: SettingsState,
  saved: readonly { id: `saved:${string}`; values: AgentSettings }[] = [],
  appliedBase: ProfileId | `saved:${string}` | null = null,
): WorkspaceProfile {
  return deriveProfileState(values, saved, appliedBase).profile;
}
