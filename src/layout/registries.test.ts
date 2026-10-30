// P-LAYOUT: the parts and slots registries hold together — every part's slots exist, its default is one it allows,
// each part resolves to exactly one slot, and the registry's own lists match the settings lists they mirror.
import { describe, expect, it } from "vitest";
import { ASSIGNMENTS_PLACEMENTS, EXTRA_HEADER_APPS, HOME_ACTIVITY_VIEWS, HOME_SECTIONS, SETTING_CONSTRAINTS } from "@/settings";
import { defaultSettings } from "@/settings/settings-schema";
import { withDerivedLayout } from "@/settings/settle";
import { HEADER_APP_PARTS, HOME_SECTION_PARTS, PARTS, PART_IDS, partsIn, slotFor } from "./parts";
import { PAGES, SLOTS, SLOT_CONTAINERS, SLOT_IDS } from "./slots";

describe("slots registry (P-LAYOUT)", () => {
  it("every slot is registered under its own id, with a known container, a capacity and at least one page", () => {
    expect(Object.keys(SLOTS).sort()).toEqual([...SLOT_IDS].sort());
    for (const id of SLOT_IDS) {
      const slot = SLOTS[id];
      expect(slot.id).toBe(id);
      expect(SLOT_CONTAINERS, id).toContain(slot.container);
      expect(slot.capacity === "many" || slot.capacity >= 1, id).toBe(true);
      expect(slot.pages.length, id).toBeGreaterThan(0);
      for (const page of slot.pages) expect(PAGES, id).toContain(page);
    }
  });

  it("the interior panel is lyra SidePanel left, at least a card wide (Dave, 2026-10-30)", () => {
    expect(SLOTS["interior-panel"]).toMatchObject({ container: "SidePanel-left", minWidth: "card", capacity: 1 });
  });
});

describe("parts registry (P-LAYOUT)", () => {
  it("every part is registered under its own id, once", () => {
    expect(new Set(PART_IDS).size).toBe(PART_IDS.length);
    expect(Object.keys(PARTS).sort()).toEqual([...PART_IDS].sort());
    for (const id of PART_IDS) expect(PARTS[id].id).toBe(id);
  });

  it("every part allows only registered slots, without repeats, and its default is one of them", () => {
    for (const id of PART_IDS) {
      const { allowedSlots, defaultSlot } = PARTS[id];
      expect(allowedSlots.length, id).toBeGreaterThan(0);
      expect(new Set(allowedSlots).size, id).toBe(allowedSlots.length);
      for (const slot of allowedSlots) expect(SLOT_IDS, `${id} → ${slot}`).toContain(slot);
      expect(allowedSlots, id).toContain(defaultSlot);
    }
  });

  it("no part defaults to the overlay: it's where a slot goes when it doesn't fit", () => {
    for (const id of PART_IDS) expect(PARTS[id].allowedSlots, id).not.toContain("overlay");
  });

  it.each(ASSIGNMENTS_PLACEMENTS)("under placement %s, each part resolves to one allowed slot and the slots partition the parts", (placement) => {
    const base = defaultSettings();
    const settings = withDerivedLayout({ ...base, assignments: { ...base.assignments, placement } });
    const placed = SLOT_IDS.flatMap((slot) => partsIn(slot, settings));
    expect(placed.sort()).toEqual([...PART_IDS].sort());
    for (const id of PART_IDS) expect(PARTS[id].allowedSlots, id).toContain(slotFor(id, settings));
  });

  it("parts with equal order keys in a slot sort in registry order, whatever order the map lists them in (P-LAYOUT)", () => {
    const base = defaultSettings();
    const parts = { ...base.layout.parts };
    // Three header apps on one key; the map object lists them reversed.
    for (const app of ["schedule", "wem", "customers"] as const) parts[app] = { ...parts[app], slot: "header", order: 7 };
    const reversed = Object.fromEntries(Object.entries(parts).reverse()) as typeof parts;
    const ordered = partsIn("header", { ...base, layout: { parts: reversed } }).filter((p) => ["schedule", "wem", "customers"].includes(p));
    expect(ordered).toEqual(["customers", "wem", "schedule"]);
    expect(PART_IDS.indexOf("customers")).toBeLessThan(PART_IDS.indexOf("wem"));
  });

  it("every part has a label, a component and, for an option, a default among its values", () => {
    for (const id of PART_IDS) {
      const part = PARTS[id];
      expect(part.label, id).not.toBe("");
      expect(part.component, id).not.toBe("");
      for (const [name, option] of Object.entries(part.options ?? {})) expect(option.values, `${id}.${name}`).toContain(option.default);
    }
  });

  it("a part's constraints are declared in SETTING_CONSTRAINTS", () => {
    const ids = new Set(SETTING_CONSTRAINTS.map((c) => c.id));
    for (const id of PART_IDS) for (const rule of PARTS[id].constraints ?? []) expect(ids.has(rule), `${id}: ${rule}`).toBe(true);
  });

  it("every rule on the map is listed on its part: the part it moves, else the part its condition reads", () => {
    const partOf = (path?: string) => (path?.startsWith("layout.parts.") ? (path.split(".")[2] as (typeof PART_IDS)[number]) : undefined);
    for (const rule of SETTING_CONSTRAINTS) {
      const owner = partOf(rule.forces?.path ?? rule.disables?.path) ?? partOf(rule.when.path);
      if (!owner) continue;
      expect(PARTS[owner].constraints ?? [], `${rule.id} on ${owner}`).toContain(rule.id);
    }
  });

  it("the Home section parts are HOME_SECTIONS less the feed (activityFeed)", () => {
    expect([...HOME_SECTION_PARTS].sort()).toEqual(HOME_SECTIONS.filter((s) => s !== "activity").sort());
    expect(PART_IDS).toContain("activityFeed");
  });

  it("the Activity feed's view option is HOME_ACTIVITY_VIEWS, defaulting to the setting's default", () => {
    expect(PARTS.activityFeed.options!.view.values).toEqual([...HOME_ACTIVITY_VIEWS]);
    expect(PARTS.activityFeed.options!.view.default).toBe(defaultSettings().home.activityView);
  });

  it("the header app parts are EXTRA_HEADER_APPS plus Agent chat, which is never a Home tab", () => {
    expect([...HEADER_APP_PARTS].sort()).toEqual([...EXTRA_HEADER_APPS, "agentChat"].sort());
    expect(PARTS.agentChat.allowedSlots).not.toContain("home-top");
  });
});
