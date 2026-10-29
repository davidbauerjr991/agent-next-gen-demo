import { describe, expect, it } from "vitest";
import { ASSIGNMENTS_PLACEMENTS, SETTING_CONSTRAINTS, type SettingsState } from "@/settings";
import { defaultSettings } from "@/settings/settings-schema";
import { PARTS, PART_IDS, partsIn, slotFor } from "./parts";
import { SLOTS } from "./slots";

const withPlacement = (placement: (typeof ASSIGNMENTS_PLACEMENTS)[number]): SettingsState => {
  const s = defaultSettings();
  return { ...s, assignments: { ...s.assignments, placement } };
};

describe("layout parts (P-HOME-1n)", () => {
  it("assignments.placement resolves to a slot: left nav, interior panel, top of Home", () => {
    expect(slotFor("assignments", withPlacement("leftNav"))).toBe("left-nav");
    expect(slotFor("assignments", withPlacement("interiorPanel"))).toBe("interior-panel");
    expect(slotFor("assignments", withPlacement("none"))).toBe("home-top");
    expect(partsIn("home-top", withPlacement("none"))).toEqual(["assignments"]);
    expect(partsIn("home-top", withPlacement("leftNav"))).toEqual([]);
  });

  it("Contact Details, Experience Memory and Session Details mount in the reference slide-over", () => {
    expect(partsIn("reference", defaultSettings())).toEqual(["contactDetails", "experienceMemory", "sessionDetails"]);
  });

  it("every part resolves to a registered slot it allows, under every placement", () => {
    for (const placement of ASSIGNMENTS_PLACEMENTS) {
      for (const part of PART_IDS) {
        const slot = slotFor(part, withPlacement(placement));
        expect(SLOTS[slot], `${part} → ${slot}`).toBeDefined();
        expect(PARTS[part].allowedSlots, `${part} → ${slot}`).toContain(slot);
      }
    }
  });

  it("a part's constraints are declared in SETTING_CONSTRAINTS", () => {
    const ids = new Set(SETTING_CONSTRAINTS.map((c) => c.id));
    for (const part of PART_IDS) for (const id of PARTS[part].constraints ?? []) expect(ids.has(id), id).toBe(true);
  });
});
