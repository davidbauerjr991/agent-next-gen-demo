// @vitest-environment jsdom
// The store over the org layers (P-CONFIG-LAYERS 2): the agent layer is what's stored, the org layers resolve above
// it, their locks refuse writes as the applied profile's do, and nothing is written for them.
import { afterEach, describe, expect, it } from "vitest";
import { applyProfile } from "./hooks";
import type { LayerProfile } from "./layers";
import { getProfileLibrary } from "./saved-profiles";
import { getOrgLayers } from "./org-layers";
import { PROFILES } from "./profiles";
import { agentSettings } from "./scope";
import { SECTIONS, defaultSettings, type SectionKey } from "./settings-schema";
import { sectionStorageKey, createSettingsStore, getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import type { SettingsStorage } from "./settings-storage";
import { withDerivedLayout } from "./settle";

function countingStorage(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([section, value]) => [sectionStorageKey(section), JSON.stringify({ v: SECTIONS[section as SectionKey].version, value })]));
  const writes: string[] = [];
  const storage: SettingsStorage = {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
    remove: (k) => void data.delete(k),
    keys: () => [...data.keys()],
  };
  return { storage, writes, read: (section: string) => JSON.parse(data.get(sectionStorageKey(section)) ?? "null")?.value };
}

const base = withDerivedLayout(defaultSettings());
const phase2 = agentSettings(PROFILES.phase2);
const team = (values: LayerProfile["values"], locks: SectionKey[] = []): LayerProfile => ({ level: "team", id: "birch", name: "Birch", primary: true, values, locks });

afterEach(() => resetSettingsStoreForTests());

describe("the settings store over the org layers", () => {
  it("pre-step storage reads as the agent layer: the same values, nothing written", () => {
    const { storage, writes } = countingStorage({ channels: PROFILES.phase2.channels, home: PROFILES.aifirst.home });
    const before = createSettingsStore(storage);
    const withNoLayers = createSettingsStore(storage, SECTIONS, { layers: () => [] });
    expect(writes).toEqual([]);
    expect(withNoLayers.getState().values).toEqual(before.getState().values);
    expect(withNoLayers.getState().values.channels).toEqual(PROFILES.phase2.channels);
    expect(withNoLayers.getState().sources.channels.from?.level).toBe("agent");
    expect(withNoLayers.getState().sources.voice).toEqual({ from: null, lockedBy: null });
  });

  it("an unstored section takes the org layer's value; reading writes nothing for it", () => {
    const { storage, writes } = countingStorage();
    const store = createSettingsStore(storage, SECTIONS, { layers: () => [team({ channels: phase2.channels })] });
    expect(store.getState().values.channels).toEqual(PROFILES.phase2.channels);
    expect(store.getState().sources.channels.from).toEqual({ level: "team", profileName: "Birch", primary: true });
    expect(writes).toEqual([]);
  });

  it("an org lock refuses a direct write and a write whose layout reconciliation reaches the locked section", () => {
    const { storage, writes } = countingStorage();
    const store = createSettingsStore(storage, SECTIONS, { layers: () => [team({ channels: phase2.channels }, ["channels", "layout"])] });
    store.update("channels", { sms: false });
    expect(store.getState().values.channels.sms).toBe(true);
    // A legacy placement write moves its part in the locked layout map: refused whole.
    store.update("assignments", { placement: "interiorPanel" });
    expect(store.getState().values.assignments.placement).toBe(base.assignments.placement);
    expect(writes).toEqual([]);
    expect(store.getState().sources.channels.lockedBy).toEqual({ level: "team", profileName: "Birch", primary: true });
  });

  it("a forced constraint value goes through an org lock", () => {
    const parts = { ...base.layout.parts, conversation: { ...base.layout.parts.conversation, slot: "docked-panel" }, aiFeed: { ...base.layout.parts.aiFeed, slot: "docked-panel" } };
    const { storage } = countingStorage();
    const store = createSettingsStore(storage, SECTIONS, { layers: () => [team({ layout: { ...base.layout, parts } as LayerProfile["values"]["layout"] }, ["layout"])] });
    expect(store.getState().values.layout.parts.conversation.slot).toBe("docked-panel");
    expect(store.getState().values.layout.parts.aiFeed.slot).toBe("main");
  });

  it("an agent write over a section an unlocked org layer sets copies the section into the agent layer", () => {
    const { storage, read } = countingStorage();
    const store = createSettingsStore(storage, SECTIONS, { layers: () => [team({ channels: phase2.channels })] });
    store.update("channels", { sms: false });
    expect(read("channels")).toEqual({ ...PROFILES.phase2.channels, sms: false });
    expect(store.getState().sources.channels.from?.level).toBe("agent");
  });

  it("an org lock wins over a section the agent has stored", () => {
    const { storage, writes } = countingStorage({ channels: { ...base.channels, sms: true } });
    const store = createSettingsStore(storage, SECTIONS, { layers: () => [team({ channels: phase2.channels }, ["channels"])] });
    expect(store.getState().values.channels).toEqual(PROFILES.phase2.channels);
    expect(writes).toEqual([]);
  });

  it("applying a profile under an org lock on the layout lands every section that doesn't reach it", () => {
    localStorage.clear();
    const store = getSettingsStore();
    getOrgLayers().setLayers([team({}, ["layout"])]);
    const layout = store.getState().values.layout;
    applyProfile("aifirst");
    expect(store.getState().values.channels).toEqual(PROFILES.aifirst.channels);
    expect(store.getState().values.outbound).toEqual(PROFILES.aifirst.outbound);
    // The AI display and the header apps move parts in the locked map: left as they were.
    expect(store.getState().values.layout).toBe(layout);
    expect(store.getState().values.ai.displayLocation).toBe(base.ai.displayLocation);
  });

  it("a saved profile's locks name it as the Agent-level lock holder", () => {
    localStorage.clear();
    const store = getSettingsStore();
    const saved = getProfileLibrary().saveAs("Mine", PROFILES.phase2, ["channels"])!;
    applyProfile(saved.id);
    expect(store.getState().sources.channels.lockedBy).toEqual({ level: "agent", profileName: "Mine", primary: undefined });
    applyProfile("phase1");
    expect(store.getState().sources.channels.lockedBy).toBeNull();
  });

  it("another tab's write under org layers re-renders only what changed", () => {
    localStorage.clear();
    const store = getSettingsStore();
    getOrgLayers().setLayers([team({ voice: { controlsLocation: "top" } })]);
    const before = store.getState().values;
    localStorage.setItem(sectionStorageKey("channels"), JSON.stringify({ v: SECTIONS.channels.version, value: PROFILES.phase2.channels }));
    store.syncFromStorage(sectionStorageKey("channels"));
    const after = store.getState().values;
    expect(after.channels).toEqual(PROFILES.phase2.channels);
    expect(after.voice).toBe(before.voice);
    expect(after.home).toBe(before.home);
  });

  it("the app's store re-resolves when the org layers change, and Reset keeps them", () => {
    localStorage.clear();
    const store = getSettingsStore();
    expect(store.getState().values.channels).toEqual(base.channels);
    getOrgLayers().setLayers([team({ channels: phase2.channels }, ["channels"])]);
    expect(store.getState().values.channels).toEqual(PROFILES.phase2.channels);
    store.resetAll();
    expect(store.getState().values.channels).toEqual(PROFILES.phase2.channels);
    getOrgLayers().setLayers([]);
    expect(store.getState().values.channels).toEqual(base.channels);
    expect(store.getState().sources.channels).toEqual({ from: null, lockedBy: null });
  });
});
