import { describe, expect, it } from "vitest";
import { applyChangeSet, changeSetLog, resetChangeSets, revertChangeSet, type LayerChange } from "./change-set";
import type { LayerProfile } from "./layers";
import { createOrgLayers } from "./org-layers";
import { PROFILES } from "./profiles";

const atlas: LayerProfile = { level: "team", id: "atlas", name: "Atlas", primary: true, values: {}, locks: [] };
const birch: LayerProfile = { level: "team", id: "birch", name: "Birch", primary: false, values: {}, locks: [] };
const northwind: LayerProfile = { level: "enterprise", id: "northwind", name: "Northwind", values: {}, locks: [] };

const change = (c: Omit<LayerChange, "before">): LayerChange => ({ before: { locked: false }, ...c });

describe("change sets", () => {
  it("apply then revert restores the layers; reverting one set keeps every other applied set", () => {
    const holder = createOrgLayers();
    holder.setLayers([northwind, atlas, birch]);
    const original = structuredClone(holder.getState().layers);

    const first = applyChangeSet(
      {
        intent: "Lock Birch's channels",
        affected: ["team:birch"],
        changes: [
          // Birch is a membership, not the primary team: the change makes it the primary one.
          change({ level: "team", profileId: "birch", section: "channels", after: { value: PROFILES.phase2.channels, locked: true } }),
          change({ level: "enterprise", profileId: "northwind", section: "voice", after: { value: { controlsLocation: "top" }, locked: false } }),
        ],
      },
      holder,
    );
    const afterFirst = holder.getState().layers;
    expect(afterFirst.find((l) => l.id === "birch")).toMatchObject({ primary: true, values: { channels: PROFILES.phase2.channels }, locks: ["channels"] });
    expect(afterFirst.find((l) => l.id === "atlas")?.primary).toBe(false);
    expect(afterFirst.find((l) => l.id === "northwind")?.values.voice).toEqual({ controlsLocation: "top" });

    const second = applyChangeSet(
      { intent: "Northwind sets the outbound launcher", affected: ["enterprise:northwind"], changes: [change({ level: "enterprise", profileId: "northwind", section: "outbound", after: { value: PROFILES.phase2.outbound, locked: true } })] },
      holder,
    );
    expect(changeSetLog(holder).map((s) => [s.version, s.intent])).toEqual([
      [1, "Lock Birch's channels"],
      [2, "Northwind sets the outbound launcher"],
    ]);

    // Reverting the first leaves the second's change, and only it.
    expect(revertChangeSet(first.id, holder)).toBe(true);
    const afterRevert = holder.getState().layers;
    const enterprise = afterRevert.find((l) => l.id === "northwind")!;
    expect(enterprise.values).toEqual({ outbound: PROFILES.phase2.outbound });
    expect(enterprise.locks).toEqual(["outbound"]);
    expect(afterRevert.filter((l) => l.level === "team").map((l) => [l.id, l.primary, l.locks])).toEqual(
      expect.arrayContaining([["atlas", true, []], ["birch", false, []]]),
    );

    expect(revertChangeSet(second.id, holder)).toBe(true);
    expect(holder.getState().layers).toEqual(original);
    expect(revertChangeSet(second.id, holder)).toBe(false);

    // A new chain starts the log again; ids don't repeat.
    resetChangeSets(holder);
    expect(changeSetLog(holder)).toEqual([]);
    const third = applyChangeSet({ intent: "x", affected: [], changes: [] }, holder);
    expect([third.version, third.id === first.id || third.id === second.id]).toEqual([1, false]);
  });
});
