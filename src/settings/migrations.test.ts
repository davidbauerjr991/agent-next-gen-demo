// P-LAYOUT-F1 B: a stored placement "none" (or the map's assignments at the top of Home) reads as the left nav with
// Home's Active assignments section on and first — in the store (written at once) and in a saved profile.
import { describe, expect, it } from "vitest";
import { readProfileSections } from "./saved-profiles";
import { SECTIONS, defaultSettings } from "./settings-schema";
import { safeStorage } from "./settings-storage";
import { createSettingsStore, sectionStorageKey } from "./settings-store";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}
const stored = (value: unknown, v: number) => JSON.stringify({ v, value });
const section = (values: ReturnType<typeof defaultSettings>) => values.home.sections.find((s) => s.key === "activeAssignments");

describe("placement none's migration (P-LAYOUT-F1 B)", () => {
  it("a stored placement none reads as the left nav with Active assignments on and first, written at once", () => {
    const backing = memoryStorage({
      [sectionStorageKey("assignments")]: stored({ ...defaultSettings().assignments, placement: "none" }, SECTIONS.assignments.version),
    });
    const values = createSettingsStore(safeStorage(() => backing)).getState().values;
    expect(values.assignments.placement).toBe("leftNav");
    expect(values.layout.parts.assignments.slot).toBe("left-nav");
    expect(values.home.sections[0]).toEqual({ key: "activeAssignments", enabled: true });
    // Written: a new store over the same storage reads the same, and no longer sees "none".
    expect(JSON.parse(backing.getItem(sectionStorageKey("assignments"))!).value.placement).toBe("leftNav");
    const again = createSettingsStore(safeStorage(() => backing)).getState().values;
    expect(again.home.sections[0]).toEqual({ key: "activeAssignments", enabled: true });
  });

  it("a stored none beside a retired channelChips (every pre-F3 write had one) still migrates, and the key is dropped", () => {
    const backing = memoryStorage({
      [sectionStorageKey("assignments")]: stored({ ...defaultSettings().assignments, channelChips: "auto", placement: "none" }, SECTIONS.assignments.version),
    });
    const values = createSettingsStore(safeStorage(() => backing)).getState().values;
    expect(values.home.sections[0]).toEqual({ key: "activeAssignments", enabled: true });
    expect(JSON.parse(backing.getItem(sectionStorageKey("assignments"))!).value).not.toHaveProperty("channelChips");
  });

  it("a stored panelPinned (retired, P-LAYOUT-F3 10) is dropped from storage on load; the rest stays", () => {
    const backing = memoryStorage({
      [sectionStorageKey("assignments")]: stored({ ...defaultSettings().assignments, placement: "interiorPanel", panelPinned: "unpinned" }, SECTIONS.assignments.version),
    });
    const values = createSettingsStore(safeStorage(() => backing)).getState().values;
    expect(values.assignments.placement).toBe("interiorPanel");
    const raw = JSON.parse(backing.getItem(sectionStorageKey("assignments"))!).value;
    expect(raw).not.toHaveProperty("panelPinned");
    expect(raw.placement).toBe("interiorPanel");
  });

  it("a stored two-column Home from before contentWidth reads that layout's default, full, written once; an explicit value stays (P-LAYOUT-F3 3)", () => {
    const backing = memoryStorage({
      [sectionStorageKey("home")]: stored({ ...defaultSettings().home, layout: "twoColumn", contentWidth: undefined }, SECTIONS.home.version),
    });
    expect(createSettingsStore(safeStorage(() => backing)).getState().values.home.contentWidth).toBe("full");
    expect(JSON.parse(backing.getItem(sectionStorageKey("home"))!).value.contentWidth).toBe("full");
    const explicit = memoryStorage({
      [sectionStorageKey("home")]: stored({ ...defaultSettings().home, layout: "twoColumn", contentWidth: "max" }, SECTIONS.home.version),
    });
    // An explicit Max under two columns is forced to Full (P-LAYOUT-F4 6): two columns always use the full width.
    expect(createSettingsStore(safeStorage(() => explicit)).getState().values.home.contentWidth).toBe("full");
  });

  it("a stored map with the assignments at the top of Home migrates the same way", () => {
    const backing = memoryStorage({
      [sectionStorageKey("layout")]: stored({ parts: { assignments: { slot: "home-top" } } }, SECTIONS.layout.version),
    });
    const values = createSettingsStore(safeStorage(() => backing)).getState().values;
    expect(values.layout.parts.assignments.slot).toBe("left-nav");
    expect(section(values)?.enabled).toBe(true);
  });

  it("without none, nothing changes: the section stays off and nothing is written", () => {
    const backing = memoryStorage({
      [sectionStorageKey("assignments")]: stored({ ...defaultSettings().assignments, placement: "interiorPanel" }, SECTIONS.assignments.version),
    });
    const values = createSettingsStore(safeStorage(() => backing)).getState().values;
    expect(values.assignments.placement).toBe("interiorPanel");
    expect(section(values)?.enabled).toBe(false);
    expect(backing.getItem(sectionStorageKey("home"))).toBeNull();
  });

  it("a saved profile with placement none applies as the left nav with Active assignments on", () => {
    const { values } = readProfileSections({
      assignments: { v: SECTIONS.assignments.version, value: { ...defaultSettings().assignments, placement: "none" } },
    });
    expect(values.assignments?.placement).toBe("leftNav");
    expect(values.home?.sections?.[0]).toEqual({ key: "activeAssignments", enabled: true });
  });
});
