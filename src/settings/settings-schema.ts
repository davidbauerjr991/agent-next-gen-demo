// Settings schema (P-SETTINGS). Each section is stored under its own key with
// its own version, so a later step adds a section (5d.2 flags, P4.4a card
// placement, P4.11 knowledge base) with one more `defineSection` and no
// migration of the others. Profile and database data never live here (P1.4).

/** Reads one stored value: returns it if it still has the expected type, or
 *  the fallback (a changed setting type falls back to its default). */
export type Field<T> = (raw: unknown, fallback: T) => T;

export const bool = (): Field<boolean> => (raw, fallback) => (typeof raw === "boolean" ? raw : fallback);

export const str = (): Field<string> => (raw, fallback) => (typeof raw === "string" ? raw : fallback);

export const oneOf =
  <const V extends string>(values: readonly V[]): Field<V> =>
  (raw, fallback) =>
    typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as V) : fallback;

export type Fields<T> = { [K in keyof T]: Field<T[K]> };

/** A nested object, read field by field; unknown stored fields are dropped. */
export const group =
  <T extends object>(fields: Fields<T>): Field<T> =>
  (raw, fallback) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fallback;
    const source = raw as Record<string, unknown>;
    const out = {} as T;
    for (const key of Object.keys(fields) as (keyof T)[]) {
      out[key] = fields[key](source[key as string], fallback[key]);
    }
    return out;
  };

export interface SectionDef<T extends object> {
  key: string;
  /** Bump when the section's shape changes incompatibly: stored values with
   *  another version are ignored and the section starts from its defaults. */
  version: number;
  defaults: T;
  read: Field<T>;
}

export function defineSection<T extends object>(def: { key: string; version: number; defaults: T; fields: Fields<T> }): SectionDef<T> {
  return { key: def.key, version: def.version, defaults: def.defaults, read: group(def.fields) };
}

// ── Sections ──

/** Header apps that aren't one of the named header flags; pinned from the
 *  apps menu or the Settings page's "Other apps" list. Not part of a preset. */
export const EXTRA_HEADER_APPS = ["customers", "accounts", "tickets", "wem", "screenpop"] as const;
export type ExtraHeaderApp = (typeof EXTRA_HEADER_APPS)[number];

export interface HeaderSettings {
  /** Master switch for the header's app icons, Search and View All Apps. */
  showAppIcons: boolean;
  search: boolean;
  /** Agent chat (messaging drawer, P0.9.3). */
  agentChat: boolean;
  calendar: boolean;
  notifications: boolean;
  /** The View All Apps picker (embedded apps, P7.7). */
  appsGrid: boolean;
  pins: Record<ExtraHeaderApp, boolean>;
}

const header = defineSection<HeaderSettings>({
  key: "header",
  version: 1,
  // Phase 1: the icons are hidden by the master switch; the sub-flags keep
  // the pins the page has always started with.
  defaults: {
    showAppIcons: false,
    search: true,
    agentChat: true,
    calendar: true,
    notifications: true,
    appsGrid: true,
    pins: { customers: false, accounts: false, tickets: false, wem: false, screenpop: false },
  },
  fields: {
    showAppIcons: bool(),
    search: bool(),
    agentChat: bool(),
    calendar: bool(),
    notifications: bool(),
    appsGrid: bool(),
    pins: group<Record<ExtraHeaderApp, boolean>>({
      customers: bool(),
      accounts: bool(),
      tickets: bool(),
      wem: bool(),
      screenpop: bool(),
    }),
  },
});

export interface HomeSettings {
  /** Dashboard / Customers / Accounts / Tickets tabs (P0.5d.2). */
  homeTabs: boolean;
  /** Calendar view on Home (P0.5d.2). */
  calendarView: boolean;
}

const home = defineSection<HomeSettings>({
  key: "home",
  version: 1,
  defaults: { homeTabs: false, calendarView: false },
  fields: { homeTabs: bool(), calendarView: bool() },
});

export interface AssignmentsSettings {
  /** Sync channels in the main column, async in the right slide-out (P2.2). */
  omnichannel: boolean;
  newOutboundAtBottom: boolean;
  navItemsAtTop: boolean;
  noInteractionCollapse: boolean;
}

const assignments = defineSection<AssignmentsSettings>({
  key: "assignments",
  version: 1,
  defaults: { omnichannel: false, newOutboundAtBottom: false, navItemsAtTop: false, noInteractionCollapse: false },
  fields: { omnichannel: bool(), newOutboundAtBottom: bool(), navItemsAtTop: bool(), noInteractionCollapse: bool() },
});

export const VOICE_CONTROLS_LOCATIONS = ["bottom", "top"] as const;
export interface VoiceSettings {
  controlsLocation: (typeof VOICE_CONTROLS_LOCATIONS)[number];
}

const voice = defineSection<VoiceSettings>({
  key: "voice",
  version: 1,
  defaults: { controlsLocation: "bottom" },
  fields: { controlsLocation: oneOf(VOICE_CONTROLS_LOCATIONS) },
});

export const AI_DISPLAY_LOCATIONS = ["inline", "panel"] as const;
export interface AiSettings {
  /** P4.4a's pinned-vs-auto card placement hangs off this section later. */
  displayLocation: (typeof AI_DISPLAY_LOCATIONS)[number];
}

const ai = defineSection<AiSettings>({
  key: "ai",
  version: 1,
  defaults: { displayLocation: "inline" },
  fields: { displayLocation: oneOf(AI_DISPLAY_LOCATIONS) },
});

export const PHONE_SETUPS = ["soft-phone", "phone-number", "work-station"] as const;
export type PhoneSetup = (typeof PHONE_SETUPS)[number];
export interface PhoneSettings {
  setup: PhoneSetup;
  phoneNumber: string;
  stationId: string;
}

const phone = defineSection<PhoneSettings>({
  key: "phone",
  version: 1,
  defaults: { setup: "soft-phone", phoneNumber: "", stationId: "" },
  fields: { setup: oneOf(PHONE_SETUPS), phoneNumber: str(), stationId: str() },
});

export const THEMES = ["light", "dark"] as const;
export interface AppearanceSettings {
  theme: (typeof THEMES)[number];
}

const appearance = defineSection<AppearanceSettings>({
  key: "appearance",
  version: 1,
  defaults: { theme: "light" },
  fields: { theme: oneOf(THEMES) },
});

/** One integration per seam (PLAN.md "Settings and configuration"). */
export const SEAMS = [
  "phone",
  "media",
  "crm",
  "tickets",
  "email",
  "wfm",
  "ai",
  "knowledge",
  "directory",
  "apps",
] as const;
export type SeamId = (typeof SEAMS)[number];
/** Only "simulated" until real adapters exist (P-ADAPTER). Non-secret
 *  settings only: secrets live in the proxy, never the browser. */
export const CONNECTION_MODES = ["simulated"] as const;
export interface ConnectionSettings {
  mode: (typeof CONNECTION_MODES)[number];
}
export interface ConnectionsSettings {
  seams: Record<SeamId, ConnectionSettings>;
}

const connection = group<ConnectionSettings>({ mode: oneOf(CONNECTION_MODES) });

const connections = defineSection<ConnectionsSettings>({
  key: "connections",
  version: 1,
  defaults: {
    seams: Object.fromEntries(SEAMS.map((seam) => [seam, { mode: "simulated" }])) as Record<SeamId, ConnectionSettings>,
  },
  fields: {
    seams: group<Record<SeamId, ConnectionSettings>>(
      Object.fromEntries(SEAMS.map((seam) => [seam, connection])) as Fields<Record<SeamId, ConnectionSettings>>,
    ),
  },
});

export const SECTIONS = { header, home, assignments, voice, ai, phone, appearance, connections };

export type SectionKey = keyof typeof SECTIONS;
export type SettingsState = { [K in SectionKey]: (typeof SECTIONS)[K]["defaults"] };
export type SectionSchemas = { [K in SectionKey]: SectionDef<SettingsState[K]> };

export function defaultSettings(sections: SectionSchemas = SECTIONS): SettingsState {
  return Object.fromEntries(Object.entries(sections).map(([key, def]) => [key, def.defaults])) as SettingsState;
}
