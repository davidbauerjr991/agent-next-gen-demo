// Settings schema (P-SETTINGS). Each section is stored under its own key with
// its own version, so a later step adds a section (5d.2 flags, P4.4a card
// placement, P4.11 knowledge base) with one more `defineSection` and no
// migration of the others. Profile and database data never live here (P1.4).

/** Reads one stored value: returns it if it still has the expected type, or
 *  the fallback (a changed setting type falls back to its default). */
export type Field<T> = (raw: unknown, fallback: T) => T;

export const bool = (): Field<boolean> => (raw, fallback) => (typeof raw === "boolean" ? raw : fallback);

export const str = (): Field<string> => (raw, fallback) => (typeof raw === "string" ? raw : fallback);

/** A setting's declaration for the forms that render it (CLAUDE.md: admin
 *  configuration is declared before designed). English source text; the
 *  form passes it through `t()`. P-ADMIN back-fills the other fields. */
export interface FieldMeta {
  label: string;
  description: string;
}

export const oneOf = <const V extends string>(
  values: readonly V[],
  meta?: FieldMeta
): Field<V> & { readonly values: readonly V[]; readonly meta?: FieldMeta } => {
  const read: Field<V> = (raw, fallback) =>
    typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as V) : fallback;
  return Object.assign(read, { values, meta });
};

/** A whole number within `[min, max]`; anything else reads as the default. */
export const int = (
  meta: FieldMeta & { min: number; max: number },
): Field<number> & { readonly meta: FieldMeta & { min: number; max: number } } => {
  const read: Field<number> = (raw, fallback) =>
    typeof raw === "number" && Number.isInteger(raw) && raw >= meta.min && raw <= meta.max ? raw : fallback;
  return Object.assign(read, { meta });
};

export type Fields<T> = { [K in keyof T]: Field<T[K]> };

/** An ordering of `values`: unknown and repeated keys are dropped, and
 *  missing keys are appended in `values` order. */
export const keyList =
  <K extends string>(values: readonly K[]): Field<K[]> =>
  (raw, fallback) => {
    if (!Array.isArray(raw)) return fallback;
    const out = [...new Set(raw.filter((k): k is K => typeof k === "string" && (values as readonly string[]).includes(k)))];
    return [...out, ...values.filter((k) => !out.includes(k))];
  };

/** Who a setting belongs to (P-AIFIRST). "agent" settings are part of
 *  workspace profiles; "admin" settings (the brand, the social placeholders)
 *  are tenant-wide: a profile never carries them and applying one never
 *  touches them. A group's scope is inherited by everything inside it. */
export type SettingScope = "agent" | "admin";

/** A `group` reader also carries its field readers and scope, so profile
 *  code can walk the schema (`./scope.ts`). */
export type GroupField<T> = Field<T> & { readonly fields: Fields<T>; readonly scope?: SettingScope };

/** A nested object, read field by field; unknown stored fields are dropped. */
export const group = <T extends object>(fields: Fields<T>, options?: { scope?: SettingScope }): GroupField<T> => {
  const read: Field<T> = (raw, fallback) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fallback;
    const source = raw as Record<string, unknown>;
    const out = {} as T;
    for (const key of Object.keys(fields) as (keyof T)[]) {
      out[key] = fields[key](source[key as string], fallback[key]);
    }
    return out;
  };
  return Object.assign(read, { fields, scope: options?.scope });
};

export interface SectionDef<T extends object> {
  key: string;
  /** Bump when the section's shape changes incompatibly: stored values with
   *  another version are ignored and the section starts from its defaults. */
  version: number;
  defaults: T;
  read: GroupField<T>;
}

export function defineSection<T extends object>(def: {
  key: string;
  version: number;
  defaults: T;
  fields: Fields<T>;
  scope?: SettingScope;
}): SectionDef<T> {
  return { key: def.key, version: def.version, defaults: def.defaults, read: group(def.fields, { scope: def.scope }) };
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
  /** "tab": a Home tab after Dashboard (the tab bar shows while any app is one). */
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
  /** The Home tabs' order after Dashboard (dragging a tab writes it). */
  tabOrder: ExtraHeaderApp[];
}

const appDisplay: Field<AppDisplay> = group<AppDisplay>({ enabled: bool(), placement: oneOf(APP_PLACEMENTS) });
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
    tabOrder: [...EXTRA_HEADER_APPS],
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
    tabOrder: keyList(EXTRA_HEADER_APPS),
  },
});

/** An ordered list of entries keyed by `values`: unknown and repeated keys
 *  are dropped, and missing keys are appended in `values` order with their
 *  default entry, so a stored order survives an added or removed key. */
export const keyedList =
  <K extends string, T extends { key: K }>(values: readonly K[], entry: Field<T>): Field<T[]> =>
  (raw, fallback) => {
    if (!Array.isArray(raw)) return fallback;
    const defaults = new Map(fallback.map((item) => [item.key, item]));
    const seen = new Set<K>();
    const out: T[] = [];
    for (const item of raw) {
      const key = (item as { key?: unknown } | null)?.key;
      if (typeof key !== "string" || !(values as readonly string[]).includes(key) || seen.has(key as K)) continue;
      const base = defaults.get(key as K);
      if (!base) continue;
      seen.add(key as K);
      out.push(entry(item, base));
    }
    for (const item of fallback) if (!seen.has(item.key)) out.push(item);
    return out;
  };

/** Dashboard sections, in v3's default order (Settings → Home). */
export const HOME_SECTIONS = ["queue", "contactHistory", "performance", "productivity"] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number];
export interface HomeSection {
  key: HomeSectionKey;
  enabled: boolean;
}

/** The Dashboard's queue tiles (`LATEST_CONTACTS_STATIC`). */
export const HOME_QUEUE_CHANNELS = ["digital", "inboundVoice", "voicemail", "workItem", "outboundVoice"] as const;
export type HomeQueueChannel = (typeof HOME_QUEUE_CHANNELS)[number];

export interface HomeSettings {
  /** The "Hello Jordan" header block. */
  showHeader: boolean;
  greeting: string;
  /** Appends the agent's first name to the greeting. */
  showFirstName: boolean;
  /** Which Dashboard sections render, in this order. */
  sections: HomeSection[];
  queue: { channels: Record<HomeQueueChannel, boolean> };
}

const home = defineSection<HomeSettings>({
  key: "home",
  // v2: v3's Dashboard settings. The v1 flags went away: Home tabs follow
  // the apps placed as "tab", and the calendar view was retired (P0.5d.2).
  version: 2,
  defaults: {
    showHeader: true,
    greeting: "Hello",
    showFirstName: true,
    sections: HOME_SECTIONS.map((key) => ({ key, enabled: true })),
    // v3's defaults: Digital and Work Item hidden.
    queue: { channels: { digital: false, inboundVoice: true, voicemail: true, workItem: false, outboundVoice: true } },
  },
  fields: {
    showHeader: bool(),
    greeting: str(),
    showFirstName: bool(),
    sections: keyedList(HOME_SECTIONS, group<HomeSection>({ key: oneOf(HOME_SECTIONS), enabled: bool() })),
    queue: group<HomeSettings["queue"]>({
      channels: group<Record<HomeQueueChannel, boolean>>(
        Object.fromEntries(HOME_QUEUE_CHANNELS.map((c) => [c, bool()])) as Fields<Record<HomeQueueChannel, boolean>>,
      ),
    }),
  },
});

/** Digital channels a contact can be auto-accepted on (calls always ring). */
export const AUTO_ACCEPT_CHANNELS = ["chat", "email", "sms", "whatsapp"] as const;
export type AutoAcceptChannel = (typeof AUTO_ACCEPT_CHANNELS)[number];

/** v2 (P-AIFIRST (k3)): `omnichannel` retired. Where threads open follows AI
 *  display alone: tabs for the main column (inline, panel), the docked panel
 *  under "main". */
export interface AssignmentsSettings {
  /** Per digital channel: on, an offer is accepted at once and loads as a
   *  card; off, it arrives as an offer card with Accept / Decline, like a
   *  call. (CXone's per-agent Auto Accept.) */
  autoAccept: Record<AutoAcceptChannel, boolean>;
  newOutboundAtBottom: boolean;
  navItemsAtTop: boolean;
  noInteractionCollapse: boolean;
  /** The Unassign & Dismiss icon shows at all (on top of the outcome-saved rule). */
  allowUnassignDismiss: boolean;
  /** Dismissing a contact asks for confirmation first. */
  confirmClose: boolean;
  /** The session row's status pill (every mode); Outcome keeps its own status control. */
  showStatusChip: boolean;
}

const assignments = defineSection<AssignmentsSettings>({
  key: "assignments",
  version: 2,
  defaults: {
    autoAccept: Object.fromEntries(AUTO_ACCEPT_CHANNELS.map((c) => [c, true])) as Record<AutoAcceptChannel, boolean>,
    newOutboundAtBottom: false,
    navItemsAtTop: false,
    noInteractionCollapse: false,
    allowUnassignDismiss: true,
    confirmClose: false,
    showStatusChip: true,
  },
  fields: {
    autoAccept: group<Record<AutoAcceptChannel, boolean>>(
      Object.fromEntries(AUTO_ACCEPT_CHANNELS.map((c) => [c, bool()])) as Fields<Record<AutoAcceptChannel, boolean>>,
    ),
    newOutboundAtBottom: bool(),
    navItemsAtTop: bool(),
    noInteractionCollapse: bool(),
    allowUnassignDismiss: bool(),
    confirmClose: bool(),
    showStatusChip: bool(),
  },
});

/** The channels agents contact customers on. Off hides every way to start
 *  or route a contact on that channel; contacts already open on it stay
 *  until they end. */
export const CONTACT_CHANNELS = ["voice", "chat", "email", "sms", "whatsapp"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

/** Private social messaging channels (P-AIFIRST placeholders): stored and
 *  shown in Settings, nothing routes or renders them until P2.7's channel
 *  registry. Admin-scope, so profiles never carry them. */
export const SOCIAL_CHANNELS = ["messenger", "instagram", "x", "tiktok", "telegram", "wechat", "appleMessages", "googleBusiness"] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

export type ChannelsSettings = Record<ContactChannel, boolean> & { social: Record<SocialChannel, boolean> };

const channels = defineSection<ChannelsSettings>({
  key: "channels",
  // Still v1: `social` is a nested group, so stored channel choices survive.
  version: 1,
  // Phase 1: voice only; every social placeholder off.
  defaults: {
    voice: true,
    chat: false,
    email: false,
    sms: false,
    whatsapp: false,
    social: Object.fromEntries(SOCIAL_CHANNELS.map((c) => [c, false])) as Record<SocialChannel, boolean>,
  },
  fields: {
    ...(Object.fromEntries(CONTACT_CHANNELS.map((c) => [c, bool()])) as Fields<Record<ContactChannel, boolean>>),
    social: group<Record<SocialChannel, boolean>>(
      Object.fromEntries(SOCIAL_CHANNELS.map((c) => [c, bool()])) as Fields<Record<SocialChannel, boolean>>,
      { scope: "admin" },
    ),
  },
});

/** The New Outbound launcher's tabs, named after CXone's Directory App so
 *  the CXone adapter maps them 1:1 (`dialpad` is ours). Agents, Skills and
 *  Teams need the DirectoryProvider (P0.9); Search is built into every tab. */
export const LAUNCHER_TABS = ["dialpad", "search", "all", "favorites", "agents", "skills", "teams", "addressBook"] as const;
export type LauncherTab = (typeof LAUNCHER_TABS)[number];

/** CXone's Outbound Calling permissions. They gate behaviors, not tabs; a
 *  behavior that's off hides its control. */
export const OUTBOUND_CALLING = ["adHoc", "redial", "agent", "addressBook", "skill", "elevation", "saveAndRedial", "transfer"] as const;
export type OutboundCalling = (typeof OUTBOUND_CALLING)[number];

export interface OutboundSettings {
  launcher: Record<LauncherTab, boolean>;
  calling: Record<OutboundCalling, boolean>;
}

const flags = <K extends string>(keys: readonly K[]) =>
  group<Record<K, boolean>>(Object.fromEntries(keys.map((k) => [k, bool()])) as Fields<Record<K, boolean>>);

const outbound = defineSection<OutboundSettings>({
  key: "outbound",
  version: 1,
  defaults: {
    // Phase 1: the Dial Pad only.
    launcher: Object.fromEntries(LAUNCHER_TABS.map((t) => [t, t === "dialpad"])) as Record<LauncherTab, boolean>,
    calling: Object.fromEntries(OUTBOUND_CALLING.map((c) => [c, true])) as Record<OutboundCalling, boolean>,
  },
  fields: { launcher: flags(LAUNCHER_TABS), calling: flags(OUTBOUND_CALLING) },
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

/** "inline": AI rows in the transcript. "panel": AI in the docked Contact
 *  Details panel. In both, a card's threads are tabs for the main column (a
 *  call's tab is its AI workspace). "main" (AI-first, P-AIFIRST): the AI
 *  workspace fills the main column and every conversation thread opens in
 *  the docked panel, one at a time. */
export const AI_DISPLAY_LOCATIONS = ["inline", "panel", "main"] as const;
export type AiDisplayLocation = (typeof AI_DISPLAY_LOCATIONS)[number];
/** P-CANVAS: under AI display "inline" and "main", whether the reference
 *  cards (Customer Info, Journey Summary, Artifacts) sit in a reference
 *  column on the main column's right edge ("twoColumn") or inline above the
 *  action area ("stacked", the single-column look). Unused under "panel". */
export const AI_CANVAS_LAYOUTS = ["stacked", "twoColumn"] as const;
export type AiCanvasLayout = (typeof AI_CANVAS_LAYOUTS)[number];
export const AI_CANVAS_LAYOUT_FIELD = oneOf(AI_CANVAS_LAYOUTS, {
  label: "Canvas layout",
  description:
    "Two columns puts the customer's reference cards in a column on the right of the main column; stacked shows them above the conversation or AI feed.",
});
/** P-CANVAS: how long a conversation pauses (no customer or agent turn)
 *  before the Next Best Action surfaces in it on its own. */
export const AI_NBA_PAUSE_CHAT_FIELD = int({
  label: "Suggest after a pause (chat and email)",
  description: "Milliseconds without a customer or agent turn before the Next Best Action appears in a chat or email conversation.",
  min: 1000,
  max: 120_000,
});
export const AI_NBA_PAUSE_VOICE_FIELD = int({
  label: "Suggest after a pause (voice)",
  description: "Milliseconds without a customer or agent turn before the Next Best Action appears in a call's transcript.",
  min: 1000,
  max: 120_000,
});
/** P-CANVAS: in a scripted conversation, the beat between reaching the agent's turn and its Next Best Action
 *  surfacing (and between "Not now" and the script's own line). */
export const AI_NBA_SCRIPTED_DELAY_FIELD = int({
  label: "Suggest the agent's turn after (scripted cases)",
  description: "Milliseconds between a scripted conversation reaching the agent's turn and its Next Best Action appearing; also the beat after Not now before the scripted line plays.",
  min: 0,
  max: 10_000,
});
/** P-CANVAS: what an Ask Copilot chip does on click — "run" posts its
 *  question at once (the "What should I do next?" chip surfaces the Next
 *  Best Action), "fill" puts it in the input for the agent to send. A chip
 *  that opens a panel opens it either way. */
export const AI_CHIP_BEHAVIORS = ["run", "fill"] as const;
export type AiChipBehavior = (typeof AI_CHIP_BEHAVIORS)[number];
export const AI_CHIP_BEHAVIOR_FIELD = oneOf(AI_CHIP_BEHAVIORS, {
  label: "Copilot chips",
  description: "Run asks the chip's question as soon as it's clicked; fill puts the question in the Ask Copilot input to send yourself.",
});
export interface AiSettings {
  /** P4.4a's pinned-vs-auto card placement hangs off this section later. */
  displayLocation: AiDisplayLocation;
  canvasLayout: AiCanvasLayout;
  nbaPauseChatMs: number;
  nbaPauseVoiceMs: number;
  nbaScriptedDelayMs: number;
  chipBehavior: AiChipBehavior;
}

// No version bump for canvasLayout, the pause fields or chipBehavior: a missing stored key reads as its default.
const ai = defineSection<AiSettings>({
  key: "ai",
  version: 1,
  defaults: {
    displayLocation: "inline",
    canvasLayout: "twoColumn",
    nbaPauseChatMs: 6000,
    nbaPauseVoiceMs: 8000,
    nbaScriptedDelayMs: 900,
    chipBehavior: "run",
  },
  fields: {
    displayLocation: oneOf(AI_DISPLAY_LOCATIONS),
    canvasLayout: AI_CANVAS_LAYOUT_FIELD,
    nbaPauseChatMs: AI_NBA_PAUSE_CHAT_FIELD,
    nbaPauseVoiceMs: AI_NBA_PAUSE_VOICE_FIELD,
    nbaScriptedDelayMs: AI_NBA_SCRIPTED_DELAY_FIELD,
    chipBehavior: AI_CHIP_BEHAVIOR_FIELD,
  },
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

/** The largest logo Settings accepts (P-AIFIRST). */
export const LOGO_MAX_BYTES = 256 * 1024;
/** "Workspace" arrives with P-ADMIN's area switcher (PLAN Administration). */
export const DEFAULT_APP_NAME = "Agent Workspace";

/** A logo stored as a data URL: PNG, JPEG or SVG, within the size limit
 *  (base64 is 4/3 of the bytes), else null (the default mark). */
export const dataUrlOrNull = (): Field<string | null> => (raw) =>
  typeof raw === "string" &&
  /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(raw) &&
  raw.length <= Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 64
    ? raw
    : null;

/** A `#rrggbb` color, else null. */
export const hexOrNull = (): Field<string | null> => (raw) =>
  typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : null;

/** White-labeling (P-AIFIRST; admin-scope, never in a profile). */
export interface BrandSettings {
  /** The header, launch screen and tab title. Empty reads as the default. */
  appName: string;
  /** The top-left mark; null is the default app icon. */
  logo: string | null;
  /** Overrides on lyra's primary and AI-accent tokens; null keeps lyra's. */
  colors: { primary: string | null; accent: string | null };
}

export interface AppearanceSettings {
  theme: (typeof THEMES)[number];
  brand: BrandSettings;
}

const appearance = defineSection<AppearanceSettings>({
  key: "appearance",
  // Still v1: `brand` is a nested group, so a stored v1 value reads with the
  // brand's defaults and keeps its theme.
  version: 1,
  defaults: { theme: "light", brand: { appName: DEFAULT_APP_NAME, logo: null, colors: { primary: null, accent: null } } },
  fields: {
    theme: oneOf(THEMES),
    brand: group<BrandSettings>(
      {
        appName: str(),
        logo: dataUrlOrNull(),
        colors: group<BrandSettings["colors"]>({ primary: hexOrNull(), accent: hexOrNull() }),
      },
      { scope: "admin" },
    ),
  },
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

const connection: Field<ConnectionSettings> = group<ConnectionSettings>({ mode: oneOf(CONNECTION_MODES) });

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

export const SECTIONS = { header, home, assignments, channels, outbound, voice, ai, phone, appearance, connections };

export type SectionKey = keyof typeof SECTIONS;
export type SettingsState = { [K in SectionKey]: (typeof SECTIONS)[K]["defaults"] };
export type SectionSchemas = { [K in SectionKey]: SectionDef<SettingsState[K]> };

export function defaultSettings(sections: SectionSchemas = SECTIONS): SettingsState {
  return Object.fromEntries(Object.entries(sections).map(([key, def]) => [key, def.defaults])) as SettingsState;
}
