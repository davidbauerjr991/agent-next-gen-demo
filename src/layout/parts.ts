// Workspace parts (P-LAYOUT; first slice in P-HOME-1n): each surface declares the slots it may mount in, where it
// goes by default, its options and constraints, and the legacy setting it reads through until that setting retires
// (PLAN Decisions 2026-10-30). Data only — the components are mapped in `part-components.tsx` — so the matrix script
// and node tests can read it. A part is a thin registration around an existing component; nothing here restructures
// one. A part's slot, order and options come from `layout.parts` (the `layout` section, `layout-section.ts`);
// components ask `slotFor` / `useSlotFor` / `useSlotParts`, never a legacy placement setting.
import type { SettingConstraint, SettingsState } from "@/settings";
import type { SlotId } from "./slots";

/** Home's sections as parts: `HOME_SECTIONS` less the feed, which is `activityFeed` (a test holds the two lists
 *  together; listed here so the registry imports no settings values). */
export const HOME_SECTION_PARTS = [
  "queue",
  "contactHistory",
  "performance",
  "productivity",
  "dueSoon",
  "teamQueues",
  "teamToday",
  "needsYou",
  "pipeline",
  "campaignToday",
  "followUps",
] as const;
export type HomeSectionPart = (typeof HOME_SECTION_PARTS)[number];

/** The header's apps as parts: `EXTRA_HEADER_APPS` plus Agent chat (a test holds them together). */
export const HEADER_APP_PARTS = ["customers", "accounts", "tickets", "wem", "schedule", "screenpop", "agentChat"] as const;
export type HeaderAppPart = (typeof HEADER_APP_PARTS)[number];

export const REFERENCE_CELL_PARTS = ["customerInfo", "realTimeSummary", "journeySummary"] as const;
export type ReferenceCellPart = (typeof REFERENCE_CELL_PARTS)[number];

export const PART_IDS = [
  "assignments",
  "incomingTile",
  "queueChip",
  "voiceBar",
  "conversation",
  "aiFeed",
  "copilotInput",
  ...REFERENCE_CELL_PARTS,
  "contactDetails",
  "experienceMemory",
  "sessionDetails",
  "activityFeed",
  ...HOME_SECTION_PARTS,
  "notifications",
  ...HEADER_APP_PARTS,
] as const;
export type PartId = (typeof PART_IDS)[number];

/** A part option: one of a fixed set of values (the only kind today). A plain descriptor rather than a settings
 *  field builder, so the registry stays data only (the `layout` section's reader builds the field from it). Labels
 *  match the strings Settings and the header show today. */
export interface PartOption {
  label: string;
  values: readonly string[];
  default: string;
}

export interface PartDef {
  id: PartId;
  /** The existing component(s) it registers, for the docs. */
  component: string;
  /** English source label (Settings → Layout wraps it in `t()`). */
  label: string;
  allowedSlots: readonly SlotId[];
  defaultSlot: SlotId;
  options?: Readonly<Record<string, PartOption>>;
  /** The `SETTING_CONSTRAINTS` ids that apply to it. */
  constraints?: readonly SettingConstraint["id"][];
  /** The legacy setting(s) its slot, order or options read through, for the docs and the retirement checklist. */
  source?: string;
}

type Def = Omit<PartDef, "id">;

const DETAIL: Def = {
  component: "contactDetailsFor bodies in the slide-over",
  label: "",
  allowedSlots: ["reference", "docked-panel"],
  defaultSlot: "reference",
};

const REFERENCE_CELL: Def = {
  component: "canvas-registry cell",
  label: "",
  allowedSlots: ["reference", "main"],
  defaultSlot: "reference",
  source: "ai.canvasLayout, canvas.cells region",
};

const HOME_SECTION: Def = {
  component: "home-dashboard nodeFor",
  label: "",
  allowedSlots: ["main", "main-trailing"],
  defaultSlot: "main",
  source: "home.layout (slot), home.sections (order)",
};

const HEADER_APP: Def = {
  component: "header icon / rail item / Home tab",
  label: "",
  allowedSlots: ["header", "left-nav", "home-top"],
  defaultSlot: "header",
  source: "header.apps.<app>.placement",
};

const DEFS: Record<PartId, Def> = {
  assignments: {
    component: "AssignmentEntryCard list (left nav), AssignmentsStack (interior panel), the inline rows (top of Home)",
    label: "Assignments",
    allowedSlots: ["left-nav", "interior-panel", "home-top"],
    defaultSlot: "left-nav",
    constraints: ["placement-none-toasts", "placement-none-incoming"],
    source: "assignments.placement",
  },
  incomingTile: {
    component: "IncomingOfferActions",
    label: "Incoming offer",
    allowedSlots: ["left-nav", "interior-panel", "home-top"],
    defaultSlot: "left-nav",
    constraints: ["incoming-follows-assignments-left-nav", "incoming-follows-assignments-interior-panel", "incoming-follows-assignments-home-top"],
    source: "follows assignments",
  },
  queueChip: {
    component: "QueueChip",
    label: "My Assignment Queue",
    allowedSlots: ["home-top", "header"],
    defaultSlot: "home-top",
    constraints: ["queue-chip-header", "queue-chip-home"],
    source: "follows assignments (header under none)",
  },
  voiceBar: {
    component: "VoiceBar (voiceBarHost)",
    label: "Voice controls",
    allowedSlots: ["dock-bottom", "left-nav"],
    defaultSlot: "dock-bottom",
    source: "voice.controlsLocation",
  },
  conversation: {
    component: "InteractionTranscript + InteractionComposer / ChannelThreadBody",
    label: "Conversation",
    allowedSlots: ["main", "docked-panel"],
    defaultSlot: "main",
    constraints: ["conversation-docked", "ai-feed-docked"],
    source: "ai.displayLocation",
  },
  aiFeed: {
    component: "inline AI rows / AiWorkspaceColumn / OverviewBody",
    label: "AI feed",
    allowedSlots: ["main", "docked-panel"],
    defaultSlot: "main",
    constraints: ["conversation-docked", "ai-feed-docked", "ai-panel-canvas", "ai-panel-legs"],
    source: "ai.displayLocation",
  },
  copilotInput: {
    component: "Copilot composer (copilotHost)",
    label: "Ask Copilot",
    allowedSlots: ["main", "docked-panel"],
    defaultSlot: "main",
    constraints: ["copilot-follows-ai-feed-main", "copilot-follows-ai-feed-docked-panel"],
    source: "follows aiFeed",
  },
  customerInfo: { ...REFERENCE_CELL, label: "Customer Info" },
  realTimeSummary: { ...REFERENCE_CELL, label: "Real-Time Summary" },
  journeySummary: { ...REFERENCE_CELL, label: "Journey Summary" },
  // Contact Details (with Artifacts), Experience Memory and Session Details: the reference slide-over; the docked
  // panel is declared so the Layout tab can offer it.
  contactDetails: { ...DETAIL, label: "Contact Details" },
  experienceMemory: { ...DETAIL, label: "Experience Memory" },
  sessionDetails: { ...DETAIL, label: "Session Details" },
  activityFeed: {
    component: "ActivityFeed",
    label: "Activity",
    allowedSlots: ["main", "main-trailing"],
    defaultSlot: "main",
    options: { view: { label: "View", values: ["list", "table"], default: "list" } },
    source: "home.layout, home.activityView",
  },
  queue: { ...HOME_SECTION, component: "DashboardQueue / QueueListCard", label: "Queue" },
  // Due soon and Contact History are one-column cards: beside the feed, the feed already lists what's next and its
  // History view is Contact History (P-HOME-1e).
  contactHistory: { ...HOME_SECTION, label: "Contact history", allowedSlots: ["main"] },
  performance: { ...HOME_SECTION, component: "PerformanceSummaryCard", label: "Performance" },
  productivity: { ...HOME_SECTION, component: "PerformanceBreakdownCard", label: "Productivity" },
  dueSoon: { ...HOME_SECTION, component: "DueSoonCard", label: "Due soon", allowedSlots: ["main"] },
  teamQueues: { ...HOME_SECTION, label: "Team queues" },
  teamToday: { ...HOME_SECTION, component: "persona-cards", label: "Team today" },
  needsYou: { ...HOME_SECTION, component: "persona-cards", label: "Needs you" },
  pipeline: { ...HOME_SECTION, component: "persona-cards", label: "Pipeline" },
  campaignToday: { ...HOME_SECTION, component: "persona-cards", label: "Campaign today" },
  followUps: { ...HOME_SECTION, component: "persona-cards", label: "Follow-ups" },
  notifications: {
    component: "NotificationsBell",
    label: "Notifications",
    allowedSlots: ["header"],
    defaultSlot: "header",
    source: "header.pins (unchanged)",
  },
  customers: { ...HEADER_APP, label: "Customers" },
  accounts: { ...HEADER_APP, label: "Accounts" },
  tickets: { ...HEADER_APP, label: "Tickets" },
  wem: { ...HEADER_APP, label: "WEM" },
  schedule: { ...HEADER_APP, label: "Schedule" },
  screenpop: { ...HEADER_APP, label: "Screen Pop" },
  // Agent chat is a drawer, never a Home tab.
  agentChat: { ...HEADER_APP, label: "Agent Chat", allowedSlots: ["header", "left-nav"], source: "header.agentChat.placement" },
};

export const PARTS = Object.fromEntries(PART_IDS.map((id) => [id, { id, ...DEFS[id] }])) as Record<PartId, PartDef>;

/** The slot `layout.parts` puts a part in. */
export function slotFor(part: PartId, settings: SettingsState): SlotId {
  return settings.layout.parts[part].slot;
}

/** The parts `layout.parts` puts in a slot, in order: by order key, ties in registry order (`PART_IDS`). */
export function partsIn(slot: SlotId, settings: SettingsState): PartId[] {
  const parts = settings.layout.parts;
  return PART_IDS.filter((part) => parts[part].slot === slot).sort((a, b) => parts[a].order - parts[b].order || PART_IDS.indexOf(a) - PART_IDS.indexOf(b));
}
