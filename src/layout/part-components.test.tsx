// @vitest-environment jsdom
// P-LAYOUT: every part has a form — a component `<Slot>` renders, or the host that mounts it — in every slot it may
// take, and nowhere else.
import { describe, expect, it } from "vitest";
import { createSettingsStore } from "@/settings/settings-store";
import type { SettingsStorage } from "@/settings/settings-storage";
import { PART_FORMS, isHosted } from "./part-components";
import { PARTS, PART_IDS, slotFor, type PartId } from "./parts";
import { SLOT_IDS, type SlotId } from "./slots";

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

describe("the map moves every part, hosted ones included (P-LAYOUT)", () => {
  // A follower's slot is forced from its leader's (SETTING_CONSTRAINTS): its leader's slot moves it, not its own.
  const FOLLOWS: Partial<Record<PartId, { leader: PartId; leaderSlotFor: (slot: SlotId) => SlotId }>> = {
    incomingTile: { leader: "assignments", leaderSlotFor: (slot) => slot },
    queueChip: { leader: "assignments", leaderSlotFor: (slot) => (slot === "header" ? "home-top" : "left-nav") },
    copilotInput: { leader: "aiFeed", leaderSlotFor: (slot) => slot },
  };
  const memoryStorage = (): SettingsStorage => {
    const data = new Map<string, string>();
    return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k), keys: () => [...data.keys()] };
  };
  /** A fresh store with `moves` written into `layout.parts` through the store's own write path. */
  const written = (moves: Partial<Record<PartId, SlotId>>) => {
    const store = createSettingsStore(memoryStorage());
    const parts = store.getState().values.layout.parts;
    const next = { ...parts };
    for (const [part, slot] of Object.entries(moves) as [PartId, SlotId][]) next[part] = { ...parts[part], slot };
    store.update("layout", { parts: next });
    return { before: parts, after: store.getState().values };
  };
  /** A form (a component, or the container that hosts it) at `slot` or one of its regions. */
  const hasForm = (id: PartId, slot: SlotId) => Object.keys(PART_FORMS[id]).some((key) => key === slot || key.startsWith(`${slot}:`));

  it("for every PART_ID, writing another allowed slot into layout.parts changes where slotFor resolves it, and the part has a form there", () => {
    const single: PartId[] = [];
    for (const id of PART_IDS) {
      const { allowedSlots } = PARTS[id];
      if (allowedSlots.length === 1) {
        single.push(id);
        continue;
      }
      for (const slot of allowedSlots) {
        expect(hasForm(id, slot), `${id} has a form at ${slot}`).toBe(true);
        const follows = FOLLOWS[id];
        if (follows) {
          const alone = written({ [id]: slot });
          if (alone.before[id].slot === slot) continue;
          // Written alone, the constraint puts it back; its leader moved, it moves with it.
          expect(slotFor(id, alone.after), `${id} alone → ${slot}`).toBe(alone.before[id].slot);
          const led = written({ [follows.leader]: follows.leaderSlotFor(slot) });
          expect(slotFor(id, led.after), `${id} with ${follows.leader} → ${slot}`).toBe(slot);
          continue;
        }
        const { before, after } = written({ [id]: slot });
        if (before[id].slot === slot) continue;
        expect(slotFor(id, after), `${id} → ${slot}`).toBe(slot);
      }
    }
    // Only these have nowhere else to go.
    expect(single.sort()).toEqual(["contactHistory", "dueSoon", "notifications"]);
  });
});
