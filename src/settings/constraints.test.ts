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

  it("placement none forces toasts and incoming on; leaving it releases them", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()));
    store.update("notifications", (n) => ({ toasts: { ...n.toasts, enabled: false } }));
    store.update("assignments", { placement: "none" });
    expect(toasts(store.getState().values)).toMatchObject({ enabled: true, events: { incoming: true } });
    expect(activeConstraint(store.getState().values, "notifications.toasts.events.incoming")?.reason).toBe(
      "Required while assignments aren't in the left nav",
    );

    store.update("assignments", { placement: "leftNav" });
    expect(activeConstraint(store.getState().values, "notifications.toasts.events.incoming")).toBeNull();
    // Released, not reset: the agent turns it off themselves.
    expect(toasts(store.getState().values).events.incoming).toBe(true);
  });

  it("turning incoming off under none doesn't take, and the unforced value is never stored", () => {
    const backing = memoryStorage();
    const store = createSettingsStore(safeStorage(() => backing));
    store.update("assignments", { placement: "none" });
    store.update("notifications", (n) => ({ toasts: { ...n.toasts, events: { ...n.toasts.events, incoming: false } } }));
    expect(toasts(store.getState().values).events.incoming).toBe(true);
    expect(JSON.parse(backing.getItem(sectionStorageKey("notifications"))!).value.toasts.events.incoming).toBe(true);
  });

  it("writes the forced section with the source, so a new store reads both", () => {
    const backing = memoryStorage();
    createSettingsStore(safeStorage(() => backing)).update("assignments", { placement: "none" });
    const again = createSettingsStore(safeStorage(() => backing));
    expect(again.getState().stored.notifications).toBe(true);
    expect(toasts(again.getState().values).events.incoming).toBe(true);
  });

  it("a stored invalid combination heals on read", () => {
    const off = { ...defaultSettings().notifications, toasts: { ...defaultSettings().notifications.toasts, enabled: false } };
    const backing = memoryStorage({
      [sectionStorageKey("assignments")]: stored({ ...defaultSettings().assignments, placement: "none" }, SECTIONS.assignments.version),
      [sectionStorageKey("notifications")]: stored(off, SECTIONS.notifications.version),
    });
    const store = createSettingsStore(safeStorage(() => backing));
    expect(toasts(store.getState().values)).toMatchObject({ enabled: true, events: { incoming: true } });
  });

  it("a profile lock on the target doesn't block the forced value", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()), SECTIONS, { lockedSections: () => ["notifications"] });
    store.update("assignments", { placement: "none" });
    expect(toasts(store.getState().values).events.incoming).toBe(true);
  });

  it("applies to several sections written at once (applying a profile)", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()));
    store.updateMany({
      assignments: { placement: "none" },
      notifications: { toasts: { ...defaultSettings().notifications.toasts, enabled: false } },
    });
    expect(toasts(store.getState().values)).toMatchObject({ enabled: true, events: { incoming: true } });
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
