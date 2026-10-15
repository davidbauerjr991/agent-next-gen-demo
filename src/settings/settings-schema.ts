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

/** Header apps with a display placement (ported from v3's per-app "{App}
 *  display" selects): a header icon, a left-nav rail item, or a Home tab. */
export const EXTRA_HEADER_APPS = ["customers", "accounts", "tickets", "wem", "schedule", "screenpop"] as const;
export type ExtraHeaderApp = (typeof EXTRA_HEADER_APPS)[number];

export const APP_PLACEMENTS = ["tab", "leftnav", "header"] as const;
export type AppPlacement = (typeof APP_PLACEMENTS)[number];
export interface AppDisplay {
  enabled: boolean;
  /** "tab" is stored but inert until P0.5d.2's Home tabs. */
  placement: AppPlacement;
}

/** Agent chat is a drawer, not a page, so it has no tab placement. */
export const AGENT_CHAT_PLACEMENTS = ["leftnav", "header"] as const;
export interface AgentChatDisplay {
  enabled: boolean;
  placement: (typeof AGENT_CHAT_PLACEMENTS)[number];
}

export interface HeaderSettings {
  /** Master switch for the header's app icons, Search and View All Apps. */
  showAppIcons: boolean;
  search: boolean;
  /** Agent chat (messaging drawer, P0.9.3; a placeholder panel until then). */
  agentChat: AgentChatDisplay;
  notifications: boolean;
  /** The View All Apps picker (embedded apps, P7.6). */
  appsGrid: boolean;
  apps: Record<ExtraHeaderApp, AppDisplay>;
}

const appDisplay = group<AppDisplay>({ enabled: bool(), placement: oneOf(APP_PLACEMENTS) });
const HIDDEN_APP: AppDisplay = { enabled: false, placement: "header" };

const header = defineSection<HeaderSettings>({
  key: "header",
  // v2: Agent chat gained a placement; per-app pins became per-app display
  // (Schedule moved in from the old `calendar` flag).
  version: 2,
  // Phase 1: the icons are hidden by the master switch.
  defaults: {
    showAppIcons: false,
    search: true,
    agentChat: { enabled: true, placement: "header" },
    notifications: true,
    appsGrid: true,
    apps: Object.fromEntries(EXTRA_HEADER_APPS.map((app) => [app, HIDDEN_APP])) as Record<ExtraHeaderApp, AppDisplay>,
  },
  fields: {
    showAppIcons: bool(),
    search: bool(),
    agentChat: group<AgentChatDisplay>({ enabled: bool(), placement: oneOf(AGENT_CHAT_PLACEMENTS) }),
    notifications: bool(),
    appsGrid: bool(),
    apps: group<Record<ExtraHeaderApp, AppDisplay>>(
      Object.fromEntries(EXTRA_HEADER_APPS.map((app) => [app, appDisplay])) as Fields<Record<ExtraHeaderApp, AppDisplay>>,
    ),
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
