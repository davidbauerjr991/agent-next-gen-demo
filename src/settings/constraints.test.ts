import { describe, expect, it } from "vitest";
import { activeConstraint, applyConstraints } from "./constraints";
import { SECTIONS, SETTING_CONSTRAINTS, defaultSettings, type SettingsState } from "./settings-schema";
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
const toasts = (values: SettingsState) => values.notifications.toasts;

describe("setting constraints (P-HOME-1n)", () => {
  it("incoming toasts are off by default, and no rule holds on the defaults", () => {
    const defaults = defaultSettings();
    expect(toasts(defaults).events.incoming).toBe(false);
    expect(applyConstraints(defaults).values).toBe(defaults);
  });

  // The engine's forces rules, through the voice bar's follow rule (P-LAYOUT-F1 A3): with the voice controls at the
  // top, the bar is at the top of the assignments list, wherever the list is. (These cases used placement none's
  // forced toasts until P-LAYOUT-F1 B retired that placement.)
  const voiceSlot = (values: SettingsState) => values.layout.parts.voiceBar.slot;
  const VOICE = "layout.parts.voiceBar.slot";

  it("a rule forces its target while it holds, with its reason; leaving the condition releases it", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()));
    store.update("voice", { controlsLocation: "top" });
    store.update("assignments", { placement: "interiorPanel" });
    expect(voiceSlot(store.getState().values)).toBe("interior-panel");
    expect(activeConstraint(store.getState().values, VOICE)?.reason).toBe("At the top of the assignments list");
    store.update("voice", { controlsLocation: "bottom" });
    expect(voiceSlot(store.getState().values)).toBe("dock-bottom");
    expect(activeConstraint(store.getState().values, VOICE)).toBeNull();
  });

  it("a write against the rule doesn't take, and the unforced value is never stored", () => {
    const backing = memoryStorage();
    const store = createSettingsStore(safeStorage(() => backing));
    store.update("voice", { controlsLocation: "top" });
    store.update("assignments", { placement: "interiorPanel" });
    store.update("layout", (l) => ({ parts: { ...l.parts, voiceBar: { ...l.parts.voiceBar, slot: "left-nav" as const } } }));
    expect(voiceSlot(store.getState().values)).toBe("interior-panel");
    expect(JSON.parse(backing.getItem(sectionStorageKey("layout"))!).value.parts.voiceBar.slot).toBe("interior-panel");
  });

  it("writes the forced section with the source, so a new store reads both", () => {
    const backing = memoryStorage();
    const first = createSettingsStore(safeStorage(() => backing));
    first.update("voice", { controlsLocation: "top" });
    first.update("assignments", { placement: "interiorPanel" });
    const again = createSettingsStore(safeStorage(() => backing));
    expect(again.getState().stored.layout).toBe(true);
    expect(voiceSlot(again.getState().values)).toBe("interior-panel");
  });

  it("a stored invalid combination heals on read", () => {
    const backing = memoryStorage({
      [sectionStorageKey("assignments")]: stored({ ...defaultSettings().assignments, placement: "interiorPanel" }, SECTIONS.assignments.version),
      [sectionStorageKey("voice")]: stored({ ...defaultSettings().voice, controlsLocation: "top" }, SECTIONS.voice.version),
      [sectionStorageKey("layout")]: stored({ parts: { voiceBar: { slot: "left-nav" } } }, SECTIONS.layout.version),
    });
    const store = createSettingsStore(safeStorage(() => backing));
    expect(voiceSlot(store.getState().values)).toBe("interior-panel");
  });

  // (A forced value written through a profile lock on its target had its case in placement none's toasts, a target in
  // another section than the rule's source. Every remaining forces rule targets the layout map its source writes, and
  // a write that would move a locked map is refused before any rule runs:)
  it("under a lock on the layout, the write that would move a part is refused whole", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()), SECTIONS, { lockedSections: () => ["layout"] });
    store.update("voice", { controlsLocation: "top" });
    expect(store.getState().values.voice.controlsLocation).toBe("bottom");
    expect(voiceSlot(store.getState().values)).toBe("dock-bottom");
  });

  it("applies to several sections written at once (applying a profile)", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()));
    store.updateMany({ assignments: { placement: "interiorPanel" }, voice: { controlsLocation: "top" } });
    expect(voiceSlot(store.getState().values)).toBe("interior-panel");
  });

  it("every rule's paths exist in the schema", () => {
    const defaults = defaultSettings() as unknown as Record<string, unknown>;
    const has = (path: string) => path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], defaults) !== undefined;
    for (const rule of SETTING_CONSTRAINTS) {
      expect(has(rule.when.path), rule.id).toBe(true);
      // A rule forces a value or disables a setting (P-LAYOUT); either target exists.
      expect(!!rule.forces !== !!rule.disables, `${rule.id}: forces xor disables`).toBe(true);
      if (rule.forces) expect(has(rule.forces.path), rule.id).toBe(true);
      if (rule.disables) expect(has(rule.disables.path), rule.id).toBe(true);
    }
  });
});
