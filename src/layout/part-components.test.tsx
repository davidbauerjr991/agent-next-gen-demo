// @vitest-environment jsdom
// P-LAYOUT: every part has a form — a component `<Slot>` renders, or the host that mounts it — in every slot it may
// take, and nowhere else.
import { describe, expect, it } from "vitest";
import { PART_FORMS, isHosted } from "./part-components";
import { PARTS, PART_IDS } from "./parts";
import { SLOT_IDS } from "./slots";

const slotOf = (key: string) => key.split(":")[0];

describe("part-components (P-LAYOUT)", () => {
  it("covers every PART_ID, and nothing else", () => {
    expect(Object.keys(PART_FORMS).sort()).toEqual([...PART_IDS].sort());
  });

  it("every part has a form in each slot it allows, and none in a slot it doesn't", () => {
    for (const id of PART_IDS) {
      const slots = new Set(Object.keys(PART_FORMS[id]).map(slotOf));
      expect([...slots].sort(), id).toEqual([...PARTS[id].allowedSlots].sort());
      for (const slot of slots) expect(SLOT_IDS, `${id}: ${slot}`).toContain(slot);
    }
  });

  it("each form is a component or names its host", () => {
    for (const id of PART_IDS) {
      for (const [key, form] of Object.entries(PART_FORMS[id])) {
        if (isHosted(form)) expect(form.host.length, `${id} @ ${key}`).toBeGreaterThan(0);
        else expect(typeof form, `${id} @ ${key}`).toBe("function");
      }
    }
  });
});
