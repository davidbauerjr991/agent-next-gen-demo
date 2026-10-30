// The legacy placement fields as presets over `layout.parts` (P-LAYOUT). Each field declares its values, the parts
// a value moves (its preset), which value the map reproduces (its projection), and the section it lives in, so one
// declaration drives the migration (`layoutFromLegacy`), the reconciliation on every write (`settleLayout`), the
// presets in Settings → Layout and the retirement checklist in the generated layout matrix. A field retires (PLAN
// Decisions 2026-10-30) by bumping its section's version and deleting its entry here. Types only from the settings
// schema, so the schema can import the layout section.
import type { HomeSectionKey, SectionKey, SettingsState } from "@/settings/settings-schema";
import type { LayoutPartEntry, LayoutParts } from "./layout-section";
import { HEADER_APP_PARTS, HOME_SECTION_PARTS, REFERENCE_CELL_PARTS, type HeaderAppPart, type PartId, type ReferenceCellPart } from "./parts";
import type { SlotId } from "./slots";

export type PartPatch = Partial<Record<PartId, Partial<LayoutPartEntry>>>;

/** Where the main column's interaction parts sort: stacked reference cells, the conversation, the AI feed, then
 *  action-region cells. Home's parts in `main` sort by their `home.sections` index, below these. */
export const MAIN_ORDER = { cellsBefore: 100, conversation: 200, aiFeed: 201, cellsAfter: 300 } as const;

export interface LegacyField<V = unknown> {
  /** The setting's path, as Settings and the docs name it. */
  id: string;
  section: SectionKey;
  /** The values offered as presets (empty: not a preset row — an order, read through only). */
  values: readonly V[];
  get(values: SettingsState): V;
  /** `values` with this field set to `value`. */
  set(values: SettingsState, value: V): SettingsState;
  /** The parts `value` moves. */
  preset(value: V, values: SettingsState): PartPatch;
  /** The value the map reproduces, or undefined (a custom map: the field is left as it is). */
  reproduced(parts: LayoutParts, values: SettingsState): V | undefined;
  /** `values` with this field projected from `parts`; `values` itself when there's nothing to change. */
  project(parts: LayoutParts, values: SettingsState): SettingsState;
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function field<V>(def: Omit<LegacyField<V>, "project">): LegacyField<V> {
  return {
    ...def,
    project(parts, values) {
      const value = def.reproduced(parts, values);
      return value === undefined || same(value, def.get(values)) ? values : def.set(values, value);
    },
  };
}

/** A field whose value maps to one part's slot. */
function slotField<V extends string>(def: {
  id: string;
  section: SectionKey;
  part: PartId;
  slots: Record<V, SlotId>;
  get: (values: SettingsState) => V;
  set: (values: SettingsState, value: V) => SettingsState;
}): LegacyField<V> {
  const values = Object.keys(def.slots) as V[];
  return field<V>({
    id: def.id,
    section: def.section,
    values,
    get: def.get,
    set: def.set,
    preset: (value) => ({ [def.part]: { slot: def.slots[value] } }),
    reproduced: (parts) => values.find((v) => def.slots[v] === parts[def.part].slot),
  });
}

// ── Assignments, voice ──────────────────────────────────────────────────────────────────────────────────────

const placement = slotField({
  id: "assignments.placement",
  section: "assignments",
  part: "assignments",
  slots: { leftNav: "left-nav", interiorPanel: "interior-panel", none: "home-top" },
  get: (s) => s.assignments.placement,
  set: (s, placement) => ({ ...s, assignments: { ...s.assignments, placement } }),
});

const voiceControls = slotField({
  id: "voice.controlsLocation",
  section: "voice",
  part: "voiceBar",
  slots: { bottom: "dock-bottom", top: "left-nav" },
  get: (s) => s.voice.controlsLocation,
  set: (s, controlsLocation) => ({ ...s, voice: { ...s.voice, controlsLocation } }),
});

// ── AI display ──────────────────────────────────────────────────────────────────────────────────────────────

type DisplayLocation = SettingsState["ai"]["displayLocation"];
const DISPLAY: Record<DisplayLocation, { conversation: SlotId; aiFeed: SlotId; copilotInput: SlotId }> = {
  inline: { conversation: "main", aiFeed: "main", copilotInput: "main" },
  panel: { conversation: "main", aiFeed: "docked-panel", copilotInput: "docked-panel" },
  main: { conversation: "docked-panel", aiFeed: "main", copilotInput: "main" },
};

const displayLocation = field<DisplayLocation>({
  id: "ai.displayLocation",
  section: "ai",
  values: Object.keys(DISPLAY) as DisplayLocation[],
  get: (s) => s.ai.displayLocation,
  set: (s, displayLocation) => ({ ...s, ai: { ...s.ai, displayLocation } }),
  preset: (value) => {
    const d = DISPLAY[value];
    return {
      conversation: { slot: d.conversation, order: MAIN_ORDER.conversation },
      aiFeed: { slot: d.aiFeed, order: MAIN_ORDER.aiFeed },
      copilotInput: { slot: d.copilotInput },
    };
  },
  // The Copilot input follows the AI feed (a constraint), so the two that decide are the conversation and the feed.
  reproduced: (parts) =>
    (Object.keys(DISPLAY) as DisplayLocation[]).find(
      (v) => DISPLAY[v].conversation === parts.conversation.slot && DISPLAY[v].aiFeed === parts.aiFeed.slot,
    ),
});

// ── Reference cells: canvas layout and each cell's region ─────────────────────────────────────────────────────

/** The canvas registry's cell id and default order for each reference-cell part (canvas-cells.tsx). */
export const REFERENCE_CELL_IDS: Record<ReferenceCellPart, { cell: string; order: number }> = {
  realTimeSummary: { cell: "real-time-summary", order: 10 },
  journeySummary: { cell: "journey-summary", order: 20 },
  customerInfo: { cell: "customer-info", order: 30 },
};

type CanvasLayout = SettingsState["ai"]["canvasLayout"];
type CellRegion = "reference" | "action";

const cellRegion = (s: SettingsState, part: ReferenceCellPart): CellRegion => s.canvas.cells[REFERENCE_CELL_IDS[part].cell]?.region ?? "reference";
const cellOrder = (s: SettingsState, part: ReferenceCellPart) => s.canvas.cells[REFERENCE_CELL_IDS[part].cell]?.order ?? REFERENCE_CELL_IDS[part].order;

/** A reference cell's place: in the reference column, in the main column before the conversation (stacked), or
 *  after it (the action region). */
export function cellPlace(parts: LayoutParts, part: ReferenceCellPart): "reference" | "before" | "after" {
  const entry = parts[part];
  if (entry.slot === "reference") return "reference";
  // The action area's anchor: the conversation, or the AI feed where the conversation is docked (AI display main).
  const anchor = parts.conversation.slot === "main" ? parts.conversation : parts.aiFeed;
  return entry.order < anchor.order ? "before" : "after";
}

function cellPatch(part: ReferenceCellPart, region: CellRegion, layout: CanvasLayout, s: SettingsState): Partial<LayoutPartEntry> {
  const order = cellOrder(s, part);
  if (region === "action") return { slot: "main", order: MAIN_ORDER.cellsAfter + order };
  return layout === "twoColumn" ? { slot: "reference", order } : { slot: "main", order: MAIN_ORDER.cellsBefore + order };
}

const canvasLayout = field<CanvasLayout>({
  id: "ai.canvasLayout",
  section: "ai",
  values: ["stacked", "twoColumn"],
  get: (s) => s.ai.canvasLayout,
  set: (s, canvasLayout) => ({ ...s, ai: { ...s.ai, canvasLayout } }),
  preset: (value, s) =>
    Object.fromEntries(
      REFERENCE_CELL_PARTS.filter((p) => cellRegion(s, p) === "reference").map((p) => [p, cellPatch(p, "reference", value, s)]),
    ),
  reproduced: (parts) => {
    const places = REFERENCE_CELL_PARTS.map((p) => cellPlace(parts, p));
    if (places.includes("reference") && !places.includes("before")) return "twoColumn";
    if (places.includes("before") && !places.includes("reference")) return "stacked";
    return undefined;
  },
});

const cellRegionFields = REFERENCE_CELL_PARTS.map((part) =>
  field<CellRegion>({
    id: `canvas.cells.${REFERENCE_CELL_IDS[part].cell}.region`,
    section: "canvas",
    values: [],
    get: (s) => cellRegion(s, part),
    set: (s, region) => {
      const id = REFERENCE_CELL_IDS[part].cell;
      const { region: _drop, ...rest } = s.canvas.cells[id] ?? {};
      const entry = region === "action" ? { ...rest, region } : rest;
      const cells = { ...s.canvas.cells };
      if (Object.keys(entry).length > 0) cells[id] = entry;
      else delete cells[id];
      return { ...s, canvas: { ...s.canvas, cells } };
    },
    preset: (region, s) => ({ [part]: cellPatch(part, region, s.ai.canvasLayout, s) }),
    reproduced: (parts) => (cellPlace(parts, part) === "after" ? "action" : "reference"),
  }),
);

// ── Home ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A Home section's part (the feed is `activityFeed`). */
const homePart = (key: HomeSectionKey): PartId => (key === "activity" ? "activityFeed" : key);
/** The sections that move beside the feed in two columns (`homeSideSections`); Due soon and Contact History stay. */
const SIDE_SECTIONS: readonly PartId[] = HOME_SECTION_PARTS.filter((p) => p !== "dueSoon" && p !== "contactHistory");

type HomeLayout = SettingsState["home"]["layout"];

const homeLayout = field<HomeLayout>({
  id: "home.layout",
  section: "home",
  values: ["oneColumn", "twoColumn"],
  get: (s) => s.home.layout,
  set: (s, layout) => ({ ...s, home: { ...s.home, layout } }),
  // Slots, and each section's order key from its place in `home.sections`, so a section that changes column sorts by
  // the same key wherever it lands.
  preset: (value, s) => {
    const order = (key: HomeSectionKey) => s.home.sections.findIndex((x) => x.key === key);
    return {
      activityFeed: { slot: "main", order: order("activity") },
      ...Object.fromEntries(
        HOME_SECTION_PARTS.map((p) => [p, { slot: value === "twoColumn" && SIDE_SECTIONS.includes(p) ? "main-trailing" : "main", order: order(p) }]),
      ),
    };
  },
  reproduced: (parts) => {
    if (parts.activityFeed.slot !== "main") return undefined;
    const trailing = SIDE_SECTIONS.filter((p) => parts[p].slot === "main-trailing").length;
    if (trailing === 0) return "oneColumn";
    if (trailing === SIDE_SECTIONS.length) return "twoColumn";
    return undefined;
  },
});

/** Home's section order: read through, not a preset row. Within each slot the map's order wins; a section keeps its
 *  position among the sections of other slots. */
const homeOrder = field<HomeSectionKey[]>({
  id: "home.sections (order)",
  section: "home",
  values: [],
  get: (s) => s.home.sections.map((x) => x.key),
  set: (s, keys) => ({ ...s, home: { ...s.home, sections: keys.map((key) => s.home.sections.find((x) => x.key === key)!) } }),
  preset: (keys) => Object.fromEntries(keys.map((key, index) => [homePart(key), { order: index }])),
  reproduced: (parts, s) => {
    const keys = s.home.sections.map((x) => x.key);
    const out = [...keys];
    const slots = new Set(keys.map((k) => parts[homePart(k)].slot));
    for (const slot of slots) {
      const positions = keys.flatMap((k, i) => (parts[homePart(k)].slot === slot ? [i] : []));
      const ordered = positions.map((i) => keys[i]).sort((a, b) => parts[homePart(a)].order - parts[homePart(b)].order);
      positions.forEach((pos, i) => (out[pos] = ordered[i]));
    }
    return out;
  },
});

type ActivityView = SettingsState["home"]["activityView"];

const activityView = field<ActivityView>({
  id: "home.activityView",
  section: "home",
  values: ["list", "table"],
  get: (s) => s.home.activityView,
  set: (s, activityView) => ({ ...s, home: { ...s.home, activityView } }),
  preset: (value) => ({ activityFeed: { options: { view: value } } }),
  reproduced: (parts) => parts.activityFeed.options.view as ActivityView,
});

// ── Header apps ─────────────────────────────────────────────────────────────────────────────────────────────

type AppPlacement = SettingsState["header"]["apps"]["customers"]["placement"];
const APP_SLOTS: Record<AppPlacement, SlotId> = { header: "header", leftnav: "left-nav", tab: "home-top" };

const headerAppFields = HEADER_APP_PARTS.filter((p): p is Exclude<HeaderAppPart, "agentChat"> => p !== "agentChat").map((app) =>
  slotField<AppPlacement>({
    id: `header.apps.${app}.placement`,
    section: "header",
    part: app,
    slots: APP_SLOTS,
    get: (s) => s.header.apps[app].placement,
    set: (s, placement) => ({ ...s, header: { ...s.header, apps: { ...s.header.apps, [app]: { ...s.header.apps[app], placement } } } }),
  }),
);

type AgentChatPlacement = SettingsState["header"]["agentChat"]["placement"];

const agentChat = slotField<AgentChatPlacement>({
  id: "header.agentChat.placement",
  section: "header",
  part: "agentChat",
  slots: { header: "header", leftnav: "left-nav" },
  get: (s) => s.header.agentChat.placement,
  set: (s, placement) => ({ ...s, header: { ...s.header, agentChat: { ...s.header.agentChat, placement } } }),
});

/** Every read-through legacy placement field, in the order their presets apply (the canvas layout after the AI
 *  display it orders against; the cell regions after the canvas layout; Home's order after its layout). */
export const LEGACY_FIELDS: readonly LegacyField[] = [
  placement,
  voiceControls,
  displayLocation,
  canvasLayout,
  ...cellRegionFields,
  homeLayout,
  homeOrder,
  activityView,
  ...headerAppFields,
  agentChat,
] as unknown as readonly LegacyField[];

/** The preset rows Settings → Layout offers: the legacy fields with values. */
export const PRESET_FIELDS = LEGACY_FIELDS.filter((f) => f.values.length > 0);
