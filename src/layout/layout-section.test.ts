// P-LAYOUT: the `layout` section — the map derived from the legacy placement fields (the migration), projected back
// onto them, validated from the registries, kept in step with them on every store write, and constrained.
import { describe, expect, it } from "vitest";
import {
  ASSIGNMENTS_PLACEMENTS,
  HOME_ACTIVITY_VIEWS,
  HOME_LAYOUTS,
  type SettingsState,
} from "@/settings";
import { createSettingsStore } from "@/settings/settings-store";
import { profileValues } from "@/settings/profiles";
import { disabledBy } from "@/settings/constraints";
import { SECTIONS, defaultSettings } from "@/settings/settings-schema";
import { settle, withDerivedLayout } from "@/settings/settle";
import type { SettingsStorage } from "@/settings/settings-storage";
import { layoutFromLegacy, legacyFromLayout, partsInSlot, readStoredParts, validateLayout, type LayoutParts } from "./layout-section";
import { LEGACY_FIELDS, PRESET_FIELDS } from "./presets";
import { HEADER_APP_PARTS, PARTS, PART_IDS } from "./parts";

function memoryStorage(): SettingsStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    keys: () => [...data.keys()],
  };
}

const DISPLAY = ["inline", "panel", "main"] as const;
const CANVAS = ["stacked", "twoColumn"] as const;
const VOICE = ["bottom", "top"] as const;

/** Every combination of the six enums (144). */
function* enumCombinations(): Generator<SettingsState> {
  const base = defaultSettings();
  for (const placement of ASSIGNMENTS_PLACEMENTS)
    for (const displayLocation of DISPLAY)
      for (const canvasLayout of CANVAS)
        for (const layout of HOME_LAYOUTS)
          for (const activityView of HOME_ACTIVITY_VIEWS)
            for (const controlsLocation of VOICE)
              yield {
                ...base,
                assignments: { ...base.assignments, placement },
                ai: { ...base.ai, displayLocation, canvasLayout },
                home: { ...base.home, layout, activityView },
                voice: { ...base.voice, controlsLocation },
              };
}

const legacy = (s: SettingsState) => Object.fromEntries(LEGACY_FIELDS.map((f) => [f.id, f.get(s)]));
const name = (s: SettingsState) =>
  `${s.assignments.placement}/${s.ai.displayLocation}/${s.ai.canvasLayout}/${s.home.layout}/${s.home.activityView}/${s.voice.controlsLocation}`;

describe("the migration: legacy placement fields → layout.parts (P-LAYOUT)", () => {
  it("the section's defaults are the map the defaults describe", () => {
    expect(SECTIONS.layout.defaults.parts).toEqual(layoutFromLegacy(defaultSettings()));
  });

  it("every combination of the six enums maps to a valid map that projects back to the same values", () => {
    let count = 0;
    for (const values of enumCombinations()) {
      count += 1;
      const settled = withDerivedLayout(values);
      const parts = settled.layout.parts;
      expect(validateLayout(parts), name(values)).toBe(parts);
      for (const id of PART_IDS) expect(PARTS[id].allowedSlots, `${name(values)}: ${id}`).toContain(parts[id].slot);
      // Round trip: the map, projected onto legacy fields reset to the defaults, gives the same values back.
      const reset = { ...settled, ...defaultSettings(), layout: settled.layout, notifications: settled.notifications };
      expect(legacy(legacyFromLayout(reset).values), name(values)).toEqual(legacy(settled));
    }
    expect(count).toBe(144);
  });

  it("each enum's values put its parts where the legacy layout did", () => {
    const parts = (patch: (s: SettingsState) => SettingsState) => withDerivedLayout(patch(defaultSettings())).layout.parts;
    expect(parts((s) => s).assignments.slot).toBe("left-nav");
    expect(parts((s) => ({ ...s, assignments: { ...s.assignments, placement: "interiorPanel" } })).assignments.slot).toBe("interior-panel");
    const none = parts((s) => ({ ...s, assignments: { ...s.assignments, placement: "none" } }));
    expect(none).toMatchObject({ assignments: { slot: "home-top" }, incomingTile: { slot: "home-top" }, queueChip: { slot: "header" } });
    expect(parts((s) => ({ ...s, ai: { ...s.ai, displayLocation: "panel" } }))).toMatchObject({
      conversation: { slot: "main" },
      aiFeed: { slot: "docked-panel" },
      copilotInput: { slot: "docked-panel" },
    });
    expect(parts((s) => ({ ...s, ai: { ...s.ai, displayLocation: "main" } }))).toMatchObject({ conversation: { slot: "docked-panel" }, aiFeed: { slot: "main" } });
    const stacked = parts((s) => ({ ...s, ai: { ...s.ai, canvasLayout: "stacked" } }));
    expect(stacked.customerInfo.slot).toBe("main");
    expect(stacked.customerInfo.order).toBeLessThan(stacked.conversation.order);
    const twoColumnHome = parts((s) => ({ ...s, home: { ...s.home, layout: "twoColumn" } }));
    expect(twoColumnHome).toMatchObject({ activityFeed: { slot: "main" }, performance: { slot: "main-trailing" }, dueSoon: { slot: "main" }, contactHistory: { slot: "main" } });
    expect(parts((s) => ({ ...s, home: { ...s.home, activityView: "table" } })).activityFeed.options.view).toBe("table");
    expect(parts((s) => ({ ...s, voice: { ...s.voice, controlsLocation: "top" } })).voiceBar.slot).toBe("left-nav");
  });

  it("each header app × each placement maps to its slot and back", () => {
    const SLOT = { header: "header", leftnav: "left-nav", tab: "home-top" } as const;
    for (const app of HEADER_APP_PARTS) {
      const placements = app === "agentChat" ? (["header", "leftnav"] as const) : (["header", "leftnav", "tab"] as const);
      for (const placement of placements) {
        const base = defaultSettings();
        const values: SettingsState =
          app === "agentChat"
            ? { ...base, header: { ...base.header, agentChat: { ...base.header.agentChat, placement: placement as "header" | "leftnav" } } }
            : { ...base, header: { ...base.header, apps: { ...base.header.apps, [app]: { ...base.header.apps[app], placement } } } };
        const settled = withDerivedLayout(values);
        expect(settled.layout.parts[app].slot, `${app} ${placement}`).toBe(SLOT[placement]);
        expect(legacy(legacyFromLayout({ ...settled, header: base.header }).values), `${app} ${placement}`).toEqual(legacy(settled));
      }
    }
  });

  it("a canvas cell in the action region goes after the conversation in the main column, and back", () => {
    const base = defaultSettings();
    const values: SettingsState = { ...base, canvas: { cells: { "customer-info": { region: "action" } } } };
    const parts = withDerivedLayout(values).layout.parts;
    expect(parts.customerInfo.slot).toBe("main");
    expect(parts.customerInfo.order).toBeGreaterThan(parts.conversation.order);
    expect(parts.realTimeSummary.slot).toBe("reference");
    const projected = legacyFromLayout({ ...withDerivedLayout(values), canvas: { cells: {} } }).values;
    expect(projected.canvas.cells).toEqual({ "customer-info": { region: "action" } });
  });

  it("Home's section order: the map's order within a slot, each section keeping its place among the other slot's", () => {
    const base = withDerivedLayout({ ...defaultSettings(), home: { ...defaultSettings().home, layout: "twoColumn" } });
    const keys = base.home.sections.map((s) => s.key);
    // Swap Performance and Productivity in the trailing column.
    const parts: LayoutParts = {
      ...base.layout.parts,
      performance: { ...base.layout.parts.performance, order: base.layout.parts.productivity.order },
      productivity: { ...base.layout.parts.productivity, order: base.layout.parts.performance.order },
    };
    const projected = legacyFromLayout({ ...base, layout: { parts } }).values.home.sections.map((s) => s.key);
    const swapped = [...keys];
    swapped[keys.indexOf("performance")] = "productivity";
    swapped[keys.indexOf("productivity")] = "performance";
    expect(projected).toEqual(swapped);
  });

  it("the preset rows are the fields with values; every field's id is unique", () => {
    expect(new Set(LEGACY_FIELDS.map((f) => f.id)).size).toBe(LEGACY_FIELDS.length);
    expect(PRESET_FIELDS.map((f) => f.id)).toEqual(expect.arrayContaining(["assignments.placement", "ai.displayLocation", "ai.canvasLayout", "home.layout", "home.activityView", "voice.controlsLocation"]));
  });
});

describe("validation from the registries (P-LAYOUT)", () => {
  it("a stored map keeps known parts and valid fields only", () => {
    expect(
      readStoredParts({
        assignments: { slot: "interior-panel", order: 3 },
        voiceBar: { slot: "header" }, // not allowed
        activityFeed: { options: { view: "grid" } }, // not a value
        bogus: { slot: "main" },
        aiFeed: "main",
      }),
    ).toEqual({ assignments: { slot: "interior-panel", order: 3 } });
    expect(readStoredParts(null)).toEqual({});
  });

  it("a part in a slot it doesn't allow goes to its default; options default; orders are kept as sort keys", () => {
    const parts = { ...layoutFromLegacy(defaultSettings()) };
    parts.voiceBar = { slot: "header", order: 99, options: {} };
    parts.activityFeed = { slot: "main", order: -5, options: { view: "grid" } };
    parts.queue = { slot: "main", order: Number.NaN, options: {} };
    const fixed = validateLayout(parts);
    expect(fixed.voiceBar).toEqual({ slot: "dock-bottom", order: 99, options: {} });
    expect(fixed.activityFeed).toEqual({ slot: "main", order: -5, options: { view: "list" } });
    expect(fixed.queue.order).toBe(PART_IDS.indexOf("queue"));
    expect(partsInSlot(fixed, "main")[0]).toBe("activityFeed");
    expect(validateLayout(fixed)).toBe(fixed);
  });

  it("the same layout reached two ways is the same map (orders are keys, not positions)", () => {
    const direct = withDerivedLayout({ ...defaultSettings(), ai: { ...defaultSettings().ai, displayLocation: "panel" } });
    const store = createSettingsStore(memoryStorage());
    store.update("ai", { displayLocation: "main" });
    store.update("home", { layout: "twoColumn" });
    store.update("home", { layout: "oneColumn" });
    store.update("ai", { displayLocation: "panel" });
    expect(store.getState().values.layout).toEqual(direct.layout);
  });
});

describe("the store keeps the map and the legacy fields in step (P-LAYOUT)", () => {
  it("nothing stored: the map reads through to the legacy fields, and nothing is written until a change", () => {
    const storage = memoryStorage();
    storage.set("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { ...SECTIONS.ai.defaults, displayLocation: "panel" } }));
    const store = createSettingsStore(storage);
    expect(store.getState().values.layout.parts.aiFeed.slot).toBe("docked-panel");
    expect(store.getState().stored.layout).toBe(false);
    expect(storage.data.has("agent-next-gen:settings:layout")).toBe(false);
  });

  it("a partial stored map reads through for the parts it doesn't name; the map wins for those it does", () => {
    const storage = memoryStorage();
    storage.set("agent-next-gen:settings:voice", JSON.stringify({ v: 1, value: { ...SECTIONS.voice.defaults, controlsLocation: "top" } }));
    storage.set("agent-next-gen:settings:layout", JSON.stringify({ v: 1, value: { parts: { assignments: { slot: "interior-panel" } } } }));
    const values = createSettingsStore(storage).getState().values;
    expect(values.layout.parts.voiceBar.slot).toBe("left-nav");
    expect(values.layout.parts.assignments.slot).toBe("interior-panel");
    expect(values.assignments.placement).toBe("interiorPanel");
  });

  it("a legacy field written the old way moves its parts, and both are stored", () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    store.update("ai", { displayLocation: "main" });
    expect(store.getState().values.layout.parts).toMatchObject({ conversation: { slot: "docked-panel" }, aiFeed: { slot: "main" } });
    expect(JSON.parse(storage.data.get("agent-next-gen:settings:layout")!).value.parts.conversation.slot).toBe("docked-panel");
  });

  it("a map write projects onto the legacy fields and writes them", () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    const parts = store.getState().values.layout.parts;
    store.update("layout", { parts: { ...parts, voiceBar: { ...parts.voiceBar, slot: "left-nav" } } });
    expect(store.getState().values.voice.controlsLocation).toBe("top");
    expect(JSON.parse(storage.data.get("agent-next-gen:settings:voice")!).value.controlsLocation).toBe("top");
  });

  it("a map that reproduces no value leaves the legacy field as it was", () => {
    const store = createSettingsStore(memoryStorage());
    const parts = store.getState().values.layout.parts;
    store.update("home", { layout: "twoColumn" });
    store.update("layout", { parts: { ...store.getState().values.layout.parts, performance: { ...parts.performance, slot: "main" } } });
    expect(store.getState().values.layout.parts.performance.slot).toBe("main");
    expect(store.getState().values.home.layout).toBe("twoColumn");
  });

  it("a profile applied with one field overridden: the override wins (its parts weren't moved by the profile's map)", () => {
    const store = createSettingsStore(memoryStorage());
    const phase2 = withDerivedLayout({ ...defaultSettings(), header: defaultSettings().header });
    store.updateMany({ ...phase2, ai: { ...phase2.ai, displayLocation: "panel" } });
    expect(store.getState().values.ai.displayLocation).toBe("panel");
    expect(store.getState().values.layout.parts.aiFeed.slot).toBe("docked-panel");
  });

  it("a profile applied with an override over a different map: the override still wins (AI-first → Phase 2 + panel)", () => {
    const store = createSettingsStore(memoryStorage());
    store.updateMany(profileValues("aifirst"));
    expect(store.getState().values.layout.parts.conversation.slot).toBe("docked-panel");
    store.updateMany({ ...profileValues("phase2"), ai: { ...profileValues("phase2").ai!, displayLocation: "panel" } });
    expect(store.getState().values.ai.displayLocation).toBe("panel");
    expect(store.getState().values.layout.parts).toMatchObject({ conversation: { slot: "main" }, aiFeed: { slot: "docked-panel" } });
  });

  it("a map write beside an unchanged legacy field projects onto it", () => {
    const store = createSettingsStore(memoryStorage());
    const base = store.getState().values;
    const parts = base.layout.parts;
    store.updateMany({ layout: { parts: { ...parts, voiceBar: { ...parts.voiceBar, slot: "left-nav" } } }, ai: { ...base.ai, displayLocation: "panel" } });
    expect(store.getState().values.voice.controlsLocation).toBe("top");
    expect(store.getState().values.ai.displayLocation).toBe("panel");
  });

  it("a profile carrying a custom arrangement: its map wins over the legacy field written with it", () => {
    const store = createSettingsStore(memoryStorage());
    const base = store.getState().values;
    const parts = base.layout.parts;
    // Only Performance beside the feed: no value of home.layout reproduces that.
    store.updateMany({
      layout: { parts: { ...parts, performance: { ...parts.performance, slot: "main-trailing" } } },
      home: { ...base.home, layout: "twoColumn" },
    });
    const after = store.getState().values.layout.parts;
    expect(after.performance.slot).toBe("main-trailing");
    expect(after.productivity.slot).toBe("main");
  });
});

describe("profile locks hold across the reconciliation (P-LAYOUT)", () => {
  const locked = (sections: readonly string[]) => createSettingsStore(memoryStorage(), SECTIONS, { lockedSections: () => sections as never });

  it("Layout locked: a placement field written the old way is dropped (it would move the locked map)", () => {
    const store = locked(["layout"]);
    store.update("ai", { displayLocation: "panel" });
    expect(store.getState().values.ai.displayLocation).toBe("inline");
    expect(store.getState().values.layout.parts.aiFeed.slot).toBe("main");
    // An AI setting that isn't a placement is written.
    store.update("ai", { chipBehavior: "fill" });
    expect(store.getState().values.ai.chipBehavior).toBe("fill");
  });

  it("a placement section locked: a map write that would project onto it is dropped", () => {
    const store = locked(["voice"]);
    const parts = store.getState().values.layout.parts;
    store.update("layout", { parts: { ...parts, voiceBar: { ...parts.voiceBar, slot: "left-nav" } } });
    expect(store.getState().values.layout.parts.voiceBar.slot).toBe("dock-bottom");
    expect(store.getState().values.voice.controlsLocation).toBe("bottom");
  });

  it("a forced value still goes through a lock", () => {
    const store = locked(["notifications"]);
    store.update("assignments", { placement: "none" });
    expect(store.getState().values.notifications.toasts.events.incoming).toBe(true);
  });
});

describe("constraints on the map (P-LAYOUT)", () => {
  const settled = (patch: (s: SettingsState) => SettingsState) => settle(null, patch(defaultSettings())).values;

  it("placement none forces the toasts on and moves the incoming tile and the queue chip", () => {
    const v = settled((s) => ({ ...s, assignments: { ...s.assignments, placement: "none" } }));
    expect(v.notifications.toasts.enabled).toBe(true);
    expect(v.notifications.toasts.events.incoming).toBe(true);
    expect(v.layout.parts.incomingTile.slot).toBe("home-top");
    expect(v.layout.parts.queueChip.slot).toBe("header");
  });

  it("the conversation and the AI feed are never both docked; the Copilot input follows the feed", () => {
    const store = createSettingsStore(memoryStorage());
    const parts = store.getState().values.layout.parts;
    store.update("layout", {
      parts: { ...parts, conversation: { ...parts.conversation, slot: "docked-panel" }, aiFeed: { ...parts.aiFeed, slot: "docked-panel" } },
    });
    const after = store.getState().values;
    expect(after.layout.parts.conversation.slot).toBe("docked-panel");
    expect(after.layout.parts.aiFeed.slot).toBe("main");
    expect(after.layout.parts.copilotInput.slot).toBe("main");
    expect(after.ai.displayLocation).toBe("main");
  });

  it("AI in the panel disables the canvas layout and the legs; Custom sort disables the direction", () => {
    const panel = settled((s) => ({ ...s, ai: { ...s.ai, displayLocation: "panel" } }));
    expect(disabledBy(panel, "ai.canvasLayout")?.reason).toBe("Not used when AI display is In the Contact Details panel");
    expect(disabledBy(panel, "assignments.legs")?.reason).toBe("Contact Details panel uses tabs");
    expect(disabledBy(settled((s) => s), "ai.canvasLayout")).toBeNull();
    const custom = settled((s) => ({ ...s, assignments: { ...s.assignments, sort: { ...s.assignments.sort, mode: "custom" } } }));
    expect(disabledBy(custom, "assignments.sort.direction")?.reason).toBe("Custom uses your dragged order");
  });
});
