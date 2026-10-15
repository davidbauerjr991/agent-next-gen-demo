import { describe, expect, it } from "vitest";
import { derivePreset, presetPatches } from "./presets";
import { safeStorage } from "./settings-storage";
import { createSettingsStore } from "./settings-store";

function freshStore() {
  const data = new Map<string, string>();
  return createSettingsStore(
    safeStorage(
      () =>
        ({
          get length() {
            return data.size;
          },
          key: (i: number) => [...data.keys()][i] ?? null,
          getItem: (k: string) => data.get(k) ?? null,
          setItem: (k: string, v: string) => void data.set(k, v),
          removeItem: (k: string) => void data.delete(k),
          clear: () => data.clear(),
        }) as Storage,
    ),
  );
}

const preset = (store: ReturnType<typeof freshStore>) => derivePreset(store.getState().values);

describe("workspace presets", () => {
  it("defaults read Phase 1", () => {
    expect(preset(freshStore())).toBe("phase1");
  });

  it("Phase 2 turns on every Header flag, Desk's app placements, and the omnichannel layout", () => {
    const store = freshStore();
    store.updateMany(presetPatches("phase2"));
    const { header, assignments } = store.getState().values;
    expect([header.showAppIcons, header.search, header.notifications, header.appsGrid].every(Boolean)).toBe(true);
    expect(header.agentChat).toEqual({ enabled: true, placement: "header" });
    for (const app of ["customers", "accounts", "tickets"] as const) {
      expect(header.apps[app]).toEqual({ enabled: true, placement: "tab" });
    }
    for (const app of ["schedule", "wem"] as const) {
      expect(header.apps[app]).toEqual({ enabled: true, placement: "header" });
    }
    expect(assignments.omnichannel).toBe(true);
    expect(preset(store)).toBe("phase2");
  });

  it("leaves the left-nav toggles, Home, Voice and AI alone", () => {
    const store = freshStore();
    store.update("assignments", { navItemsAtTop: true });
    store.update("voice", { controlsLocation: "top" });
    store.update("home", { greeting: "Hi", showHeader: false });
    store.updateMany(presetPatches("phase2"));
    expect(store.getState().values.assignments.navItemsAtTop).toBe(true);
    expect(store.getState().values.voice.controlsLocation).toBe("top");
    expect(store.getState().values.home).toMatchObject({ greeting: "Hi", showHeader: false });
    expect(preset(store)).toBe("phase2");
    store.updateMany(presetPatches("phase1"));
    expect(store.getState().values.assignments.navItemsAtTop).toBe(true);
    expect(store.getState().values.home).toMatchObject({ greeting: "Hi", showHeader: false });
    expect(preset(store)).toBe("phase1");
  });

  it.each([
    ["header", { search: false }],
    ["assignments", { omnichannel: true }],
  ] as const)("changing one %s flag reads Custom", (section, patch) => {
    const store = freshStore();
    store.update(section, patch);
    expect(preset(store)).toBe("custom");
  });

  it("changing one app's display or Agent chat's placement reads Custom", () => {
    const store = freshStore();
    store.updateMany(presetPatches("phase2"));
    store.update("header", (h) => ({ apps: { ...h.apps, tickets: { enabled: true, placement: "leftnav" as const } } }));
    expect(preset(store)).toBe("custom");
    store.updateMany(presetPatches("phase2"));
    store.update("header", { agentChat: { enabled: true, placement: "leftnav" } });
    expect(preset(store)).toBe("custom");
  });

  it("re-picking a preset clears Custom", () => {
    const store = freshStore();
    store.updateMany(presetPatches("phase2"));
    store.update("header", { search: false });
    expect(preset(store)).toBe("custom");
    store.updateMany(presetPatches("phase2"));
    expect(preset(store)).toBe("phase2");
    store.update("assignments", { omnichannel: false });
    store.updateMany(presetPatches("phase1"));
    expect(preset(store)).toBe("phase1");
  });
});
