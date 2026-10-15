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

  it("Phase 2 turns on every Header and Home flag, and the omnichannel layout", () => {
    const store = freshStore();
    store.updateMany(presetPatches("phase2"));
    const { header, home, assignments } = store.getState().values;
    const headerFlags = Object.entries(header).filter(([key]) => key !== "pins");
    expect(headerFlags.every(([, on]) => on === true)).toBe(true);
    expect(Object.values(home).every(Boolean)).toBe(true);
    expect(assignments.omnichannel).toBe(true);
    expect(preset(store)).toBe("phase2");
  });

  it("leaves the left-nav toggles, Voice and AI alone", () => {
    const store = freshStore();
    store.update("assignments", { navItemsAtTop: true });
    store.update("voice", { controlsLocation: "top" });
    store.updateMany(presetPatches("phase2"));
    expect(store.getState().values.assignments.navItemsAtTop).toBe(true);
    expect(store.getState().values.voice.controlsLocation).toBe("top");
    store.updateMany(presetPatches("phase1"));
    expect(store.getState().values.assignments.navItemsAtTop).toBe(true);
    expect(preset(store)).toBe("phase1");
  });

  it.each([
    ["header", { calendar: false }],
    ["home", { homeTabs: true }],
    ["assignments", { omnichannel: true }],
  ] as const)("changing one %s flag reads Custom", (section, patch) => {
    const store = freshStore();
    store.update(section, patch);
    expect(preset(store)).toBe("custom");
  });

  it("re-picking a preset clears Custom", () => {
    const store = freshStore();
    store.updateMany(presetPatches("phase2"));
    store.update("header", { search: false });
    expect(preset(store)).toBe("custom");
    store.updateMany(presetPatches("phase2"));
    expect(preset(store)).toBe("phase2");
    store.update("home", { calendarView: false });
    store.updateMany(presetPatches("phase1"));
    expect(preset(store)).toBe("phase1");
  });

  it("extra app pins don't affect the preset, and a preset pick keeps them", () => {
    const store = freshStore();
    store.update("header", (h) => ({ pins: { ...h.pins, tickets: true } }));
    expect(preset(store)).toBe("phase1");
    store.updateMany(presetPatches("phase2"));
    expect(store.getState().values.header.pins.tickets).toBe(true);
  });
});
