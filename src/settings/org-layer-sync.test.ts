// @vitest-environment jsdom
// The sim's org tree through the sync (P-CONFIG-LAYERS 4): the persona picks the chain, the agent persona is inert,
// only the primary team enters resolution, and the seeds are valid profile files that never touch workspace or home.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIM_EMPLOYEES, SIM_TEAMS, createSimOrgLayerProvider, simOrgChain } from "@/adapters/sim/sim-org-tree";
import type { ScheduleRole } from "@/providers";
import { readLayerFile, startOrgLayerSync } from "./org-layer-sync";
import { getOrgLayers } from "./org-layers";
import { readLayerSections } from "./saved-profiles";
import { defaultSettings, type SectionKey } from "./settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { withDerivedLayout } from "./settle";

const ROLES: ScheduleRole[] = ["agent", "supervisor", "sales"];
const instant = { latency: { minMs: 0, maxMs: 0 } };

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  resetSettingsStoreForTests();
});

async function started(role: ScheduleRole = "agent") {
  const store = getSettingsStore();
  if (role !== "agent") store.update("workspace", { persona: role });
  const stop = startOrgLayerSync(createSimOrgLayerProvider(instant));
  await vi.advanceTimersByTimeAsync(10);
  return { store, stop };
}

describe("the sim org tree", () => {
  it("every seed reads as a valid layer, with no warnings, and none sets or locks workspace or home", () => {
    for (const role of ROLES) {
      for (const file of simOrgChain(role).layers) {
        expect(readLayerSections(file.sections).warnings).toEqual([]);
        const layer = readLayerFile(file);
        expect(Object.keys(layer.values).length).toBe(Object.keys(file.sections).length);
        for (const key of ["workspace", "home"] as SectionKey[]) {
          expect(layer.values[key]).toBeUndefined();
          expect(layer.locks).not.toContain(key);
        }
      }
    }
  });

  it("each team carries its supervisors; the supervisor persona supervises Atlas and Birch from their own primary team", () => {
    expect(SIM_TEAMS.every((t) => t.supervisors.length > 0)).toBe(true);
    expect(SIM_EMPLOYEES.supervisor).toMatchObject({ primaryTeam: "supervisors", supervises: ["atlas", "birch"] });
    expect(simOrgChain("supervisor").teams.map((t) => t.id).sort()).toEqual(["atlas", "birch", "supervisors"]);
  });

  it("the agent persona is inert: it resolves to the defaults, nothing locked, with the layers named as sources", async () => {
    const { store, stop } = await started();
    expect(getOrgLayers().getState().layers.map((l) => l.level)).toEqual(["tenant", "enterprise", "contactCenter", "team"]);
    expect(store.getState().values).toEqual(withDerivedLayout(defaultSettings()));
    expect(Object.values(store.getState().sources).some((s) => s.lockedBy)).toBe(false);
    expect(store.getState().sources.notifications.from).toEqual({ level: "team", profileName: "Atlas", primary: true });
    expect(store.getState().sources.channels.from?.level).toBe("enterprise");
    stop();
    expect(getOrgLayers().getState().layers).toEqual([]);
  });

  it("only the primary team enters resolution: Sales' Atlas membership doesn't", async () => {
    const { store, stop } = await started("sales");
    const teams = getOrgLayers().getState().layers.filter((l) => l.level === "team");
    expect(teams.map((t) => [t.name, t.primary])).toEqual([["Sales", true], ["Atlas", false]]);
    expect(store.getState().sources.notifications.from).toBeNull();
    expect(store.getState().sources.outbound.lockedBy).toEqual({ level: "team", profileName: "Sales", primary: true });
    stop();
  });

  it("supervisor and sales each lock their section; an agent write to it is refused", async () => {
    const { store, stop } = await started("supervisor");
    expect(store.getState().values.notifications.toasts.duration).toBe(12);
    store.update("notifications", (prev) => ({ toasts: { ...prev.toasts, duration: 5 } }));
    expect(store.getState().values.notifications.toasts.duration).toBe(12);
    expect(store.getState().sources.notifications.lockedBy?.profileName).toBe("Supervisors");
    stop();
  });

  it("only the last persona's answer applies; an answer after stop doesn't", async () => {
    const store = getSettingsStore();
    const stop = startOrgLayerSync(createSimOrgLayerProvider({ latency: { minMs: 100, maxMs: 100 } }));
    store.update("workspace", { persona: "sales" });
    store.update("workspace", { persona: "supervisor" });
    await vi.advanceTimersByTimeAsync(150);
    expect(getOrgLayers().getState().layers.find((l) => l.primary)?.name).toBe("Supervisors");
    store.update("workspace", { persona: "agent" });
    stop();
    await vi.advanceTimersByTimeAsync(150);
    expect(getOrgLayers().getState().layers).toEqual([]);
  });

  it("a failed request leaves no previous persona's locks behind", async () => {
    const store = getSettingsStore();
    store.update("workspace", { persona: "sales" });
    let fail = false;
    const sim = createSimOrgLayerProvider(instant);
    const stop = startOrgLayerSync({ chainFor: (role) => (fail ? Promise.reject(new Error("down")) : sim.chainFor(role)) });
    await vi.advanceTimersByTimeAsync(10);
    expect(store.getState().sources.outbound.lockedBy?.profileName).toBe("Sales");
    fail = true;
    store.update("workspace", { persona: "agent" });
    await vi.advanceTimersByTimeAsync(10);
    expect(getOrgLayers().getState().layers).toEqual([]);
    expect(store.getState().sources.outbound.lockedBy).toBeNull();
    stop();
  });

  it("a persona switch swaps the chain, and switching back unlocks", async () => {
    const { store, stop } = await started();
    store.update("workspace", { persona: "sales" });
    await vi.advanceTimersByTimeAsync(10);
    expect(store.getState().values.outbound.launcher.search).toBe(true);
    expect(store.getState().sources.outbound.lockedBy?.profileName).toBe("Sales");
    store.update("workspace", { persona: "agent" });
    await vi.advanceTimersByTimeAsync(10);
    expect(store.getState().values.outbound).toEqual(defaultSettings().outbound);
    expect(store.getState().sources.outbound.lockedBy).toBeNull();
    stop();
  });
});
