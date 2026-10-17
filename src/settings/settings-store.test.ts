import { describe, expect, it, vi } from "vitest";
import { SECTIONS, defaultSettings, defineSection, oneOf, type SectionSchemas } from "./settings-schema";
import { SETTINGS_KEY_PREFIX, safeStorage } from "./settings-storage";
import { createSettingsStore, sectionStorageKey } from "./settings-store";

/** A minimal in-memory `Storage`. */
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

const stored = (value: unknown, v = 1) => JSON.stringify({ v, value });

describe("settings store", () => {
  it("starts from every section's defaults when nothing is stored", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()));
    expect(store.getState().values).toEqual(defaultSettings());
    expect(Object.values(store.getState().stored).every((s) => s === false)).toBe(true);
  });

  it("persists a change, and a new store instance reads it back", () => {
    const backing = memoryStorage();
    const first = createSettingsStore(safeStorage(() => backing));
    first.update("voice", { controlsLocation: "top" });
    first.update("header", { showAppIcons: true });

    const second = createSettingsStore(safeStorage(() => backing));
    expect(second.getState().values.voice.controlsLocation).toBe("top");
    expect(second.getState().values.header.showAppIcons).toBe(true);
    expect(second.getState().stored.voice).toBe(true);
    expect(backing.getItem(sectionStorageKey("voice"))).toBe(stored({ controlsLocation: "top" }));
  });

  it("notifies on a change, and not on a no-op", () => {
    const store = createSettingsStore(safeStorage(() => memoryStorage()));
    const listener = vi.fn();
    store.subscribe(listener);
    store.update("ai", { displayLocation: "panel" });
    expect(listener).toHaveBeenCalledTimes(1);
    store.update("ai", { displayLocation: "panel" });
    store.update("ai", (prev) => ({ displayLocation: prev.displayLocation }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reset removes every settings key (and only those) and restores defaults", () => {
    const backing = memoryStorage({
      [`${SETTINGS_KEY_PREFIX}retired-section`]: stored({ x: 1 }),
      "agent-next-gen:case-database:v2": "{}",
    });
    const store = createSettingsStore(safeStorage(() => backing));
    store.update("appearance", { theme: "dark" });
    store.update("assignments", { navItemsAtTop: true });
    const listener = vi.fn();
    store.subscribe(listener);

    store.resetAll();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().values).toEqual(defaultSettings());
    expect(store.getState().stored.appearance).toBe(false);
    const remaining = [...Array(backing.length).keys()].map((i) => backing.key(i));
    expect(remaining).toEqual(["agent-next-gen:case-database:v2"]);
  });

  it("a stored value with another version falls back to the section's defaults", () => {
    const backing = memoryStorage({ [sectionStorageKey("voice")]: stored({ controlsLocation: "top" }, 0) });
    const store = createSettingsStore(safeStorage(() => backing));
    expect(store.getState().values.voice).toEqual(SECTIONS.voice.defaults);
    expect(store.getState().stored.voice).toBe(false);
  });

  it("assignments v1 (with the retired omnichannel flag, (k3)) falls back to v2's defaults", () => {
    expect(SECTIONS.assignments.version).toBe(2);
    const backing = memoryStorage({ [sectionStorageKey("assignments")]: stored({ omnichannel: true, confirmClose: true }, 1) });
    const store = createSettingsStore(safeStorage(() => backing));
    expect(store.getState().values.assignments).toEqual(SECTIONS.assignments.defaults);
    expect("omnichannel" in store.getState().values.assignments).toBe(false);
  });

  it("a stored field whose type changed falls back for that field only", () => {
    const backing = memoryStorage({
      [sectionStorageKey("assignments")]: stored(
        {
          newOutboundAtBottom: true,
          navItemsAtTop: 1,
          noInteractionCollapse: true,
          retiredFlag: true,
        },
        SECTIONS.assignments.version,
      ),
      [sectionStorageKey("voice")]: stored({ controlsLocation: "sideways" }),
    });
    const store = createSettingsStore(safeStorage(() => backing));
    expect(store.getState().values.assignments).toEqual({
      newOutboundAtBottom: true,
      navItemsAtTop: false,
      noInteractionCollapse: true,
      // Fields added later read as their defaults.
      allowUnassignDismiss: true,
      confirmClose: false,
      autoAccept: { chat: true, email: true, sms: true, whatsapp: true },
      showStatusChip: true,
    });
    expect(store.getState().values.voice.controlsLocation).toBe("bottom");
  });

  it("nested groups fall back field by field too", () => {
    const backing = memoryStorage({
      [sectionStorageKey("header")]: stored(
        {
          ...SECTIONS.header.defaults,
          agentChat: { enabled: false, placement: "tab" },
          apps: { customers: { enabled: true, placement: "leftnav" }, tickets: { enabled: "on", placement: "sideways" } },
        },
        SECTIONS.header.version,
      ),
    });
    const store = createSettingsStore(safeStorage(() => backing));
    const { apps, agentChat } = store.getState().values.header;
    expect(apps).toEqual({ ...SECTIONS.header.defaults.apps, customers: { enabled: true, placement: "leftnav" } });
    // "tab" isn't an Agent chat placement: that field falls back, the other keeps its stored value.
    expect(agentChat).toEqual({ enabled: false, placement: "header" });
  });

  it("corrupt JSON reads as defaults", () => {
    const backing = memoryStorage({ [sectionStorageKey("appearance")]: "{not json" });
    const store = createSettingsStore(safeStorage(() => backing));
    expect(store.getState().values.appearance.theme).toBe("light");
  });

  describe("storage unavailable", () => {
    const cases: [string, () => Storage][] = [
      [
        "accessing localStorage throws",
        () => {
          throw new Error("SecurityError");
        },
      ],
      [
        "every call throws (quota, blocked)",
        () =>
          ({
            get length(): number {
              throw new Error("blocked");
            },
            key: () => {
              throw new Error("blocked");
            },
            getItem: () => {
              throw new Error("blocked");
            },
            setItem: () => {
              throw new Error("QuotaExceededError");
            },
            removeItem: () => {
              throw new Error("blocked");
            },
            clear: () => {
              throw new Error("blocked");
            },
          }) as Storage,
      ],
      ["localStorage is undefined", () => undefined as unknown as Storage],
    ];

    it.each(cases)("%s: defaults, no throw, changes still apply in memory", (_name, getStorage) => {
      const store = createSettingsStore(safeStorage(getStorage));
      expect(store.getState().values).toEqual(defaultSettings());
      expect(() => store.update("appearance", { theme: "dark" })).not.toThrow();
      expect(store.getState().values.appearance.theme).toBe("dark");
      expect(() => store.resetAll()).not.toThrow();
      expect(store.getState().values.appearance.theme).toBe("light");
    });
  });

  it("versions each section on its own: bumping one resets only that one", () => {
    const backing = memoryStorage();
    const before = createSettingsStore(safeStorage(() => backing));
    before.update("header", { showAppIcons: true });
    before.update("voice", { controlsLocation: "top" });

    const headerBumped = { ...SECTIONS.header, version: SECTIONS.header.version + 1 };
    const after = createSettingsStore(safeStorage(() => backing), { ...SECTIONS, header: headerBumped } as SectionSchemas);
    expect(after.getState().values.header.showAppIcons).toBe(false);
    expect(after.getState().values.voice.controlsLocation).toBe("top");
  });

  it("adds a new section without touching the stored ones", () => {
    const backing = memoryStorage();
    createSettingsStore(safeStorage(() => backing)).update("voice", { controlsLocation: "top" });
    const sla = defineSection({ key: "kb", version: 1, defaults: { mode: "link" as "link" | "quote" }, fields: { mode: oneOf(["link", "quote"] as const) } });
    const store = createSettingsStore(safeStorage(() => backing), { ...SECTIONS, kb: sla } as unknown as SectionSchemas);
    expect(store.getState().values.voice.controlsLocation).toBe("top");
    expect((store.getState().values as unknown as Record<string, unknown>).kb).toEqual({ mode: "link" });
  });

  it("persist: false applies in memory only", () => {
    const backing = memoryStorage();
    const store = createSettingsStore(safeStorage(() => backing));
    store.update("phone", { setup: "work-station", stationId: "12345" }, { persist: false });
    expect(store.getState().values.phone.stationId).toBe("12345");
    expect(store.getState().stored.phone).toBe(false);
    expect(backing.getItem(sectionStorageKey("phone"))).toBeNull();
  });

  it("persisting unchanged defaults still marks the section stored", () => {
    const backing = memoryStorage();
    const store = createSettingsStore(safeStorage(() => backing));
    store.update("phone", { setup: "soft-phone" });
    expect(store.getState().stored.phone).toBe(true);
    expect(backing.getItem(sectionStorageKey("phone"))).not.toBeNull();
  });

  it("picks up another tab's write through the storage event", () => {
    const backing = memoryStorage();
    const mine = createSettingsStore(safeStorage(() => backing));
    const theirs = createSettingsStore(safeStorage(() => backing));
    theirs.update("ai", { displayLocation: "panel" });
    const listener = vi.fn();
    mine.subscribe(listener);

    mine.syncFromStorage(sectionStorageKey("ai"));
    expect(mine.getState().values.ai.displayLocation).toBe("panel");
    expect(listener).toHaveBeenCalledTimes(1);

    mine.syncFromStorage("unrelated-key");
    expect(listener).toHaveBeenCalledTimes(1);

    backing.clear();
    mine.syncFromStorage(null);
    expect(mine.getState().values.ai.displayLocation).toBe("inline");
  });
});
