import { describe, expect, it } from "vitest";
import { deriveProfile, profileValues, PROFILES } from "./profiles";
import { agentSettings, withAgentSettings } from "./scope";
import { SECTIONS, defaultSettings, defineSection, group, str, type SectionSchemas, type SettingsState } from "./settings-schema";
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

const profile = (store: ReturnType<typeof freshStore>) => deriveProfile(store.getState().values);

describe("workspace profiles", () => {
  it("every built-in profile is a snapshot of every section", () => {
    for (const values of Object.values(PROFILES)) {
      expect(Object.keys(values).sort()).toEqual(Object.keys(SECTIONS).sort());
    }
  });

  it("defaults read Phase 1, and Phase 1 is the defaults", () => {
    expect(profile(freshStore())).toBe("phase1");
    expect(PROFILES.phase1).toEqual(defaultSettings());
    expect(profileValues("phase1")).toEqual(agentSettings(defaultSettings()));
  });

  it("Phase 2 turns on Desk's header apps and placements and the omnichannel layout", () => {
    const store = freshStore();
    store.updateMany(profileValues("phase2"));
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
    expect(profile(store)).toBe("phase2");
  });

  it("applying a profile writes every section, personal ones included", () => {
    const store = freshStore();
    store.update("assignments", { navItemsAtTop: true });
    store.update("voice", { controlsLocation: "top" });
    store.update("home", { greeting: "Hi" });
    store.update("appearance", { theme: "dark" });
    store.updateMany(profileValues("phase2"));
    const values = store.getState().values;
    expect(values.assignments.navItemsAtTop).toBe(false);
    expect(values.voice.controlsLocation).toBe("bottom");
    expect(values.home.greeting).toBe("Hello");
    expect(values.appearance.theme).toBe("light");
    expect(profile(store)).toBe("phase2");
  });

  it.each([
    ["header", { search: false }],
    ["home", { greeting: "Hi" }],
    ["assignments", { navItemsAtTop: true }],
    ["voice", { controlsLocation: "top" }],
    ["ai", { displayLocation: "panel" }],
    ["phone", { setup: "phone-number" }],
    ["appearance", { theme: "dark" }],
  ] as const)("changing one %s setting reads Custom", (section, patch) => {
    const store = freshStore();
    store.update(section, patch);
    expect(profile(store)).toBe("custom");
  });

  it("changing one app's display or Agent chat's placement reads Custom", () => {
    const store = freshStore();
    store.updateMany(profileValues("phase2"));
    store.update("header", (h) => ({ apps: { ...h.apps, tickets: { enabled: true, placement: "leftnav" as const } } }));
    expect(profile(store)).toBe("custom");
    store.updateMany(profileValues("phase2"));
    store.update("header", { agentChat: { enabled: true, placement: "leftnav" } });
    expect(profile(store)).toBe("custom");
  });

  it("re-applying a profile clears Custom", () => {
    const store = freshStore();
    store.updateMany(profileValues("phase2"));
    store.update("header", { search: false });
    expect(profile(store)).toBe("custom");
    store.updateMany(profileValues("phase2"));
    expect(profile(store)).toBe("phase2");
    store.update("assignments", { omnichannel: false });
    store.updateMany(profileValues("phase1"));
    expect(profile(store)).toBe("phase1");
  });

  it("AI-first is Phase 2 with AI display \"main\", and derives", () => {
    expect(PROFILES.aifirst).toEqual({ ...PROFILES.phase2, ai: { ...PROFILES.phase2.ai, displayLocation: "main" } });
    const store = freshStore();
    store.updateMany(profileValues("aifirst"));
    expect(store.getState().values.assignments.omnichannel).toBe(true);
    expect(store.getState().values.ai.displayLocation).toBe("main");
    expect(profile(store)).toBe("aifirst");
    store.update("ai", { displayLocation: "inline" });
    expect(profile(store)).toBe("phase2");
  });
});

describe("setting scope", () => {
  // A two-section schema: one agent section with an admin group inside, one
  // admin section.
  const look = defineSection({
    key: "look",
    version: 1,
    defaults: { theme: "light", brand: { name: "Workspace" } },
    fields: { theme: str(), brand: group({ name: str() }, { scope: "admin" }) },
  });
  const tenant = defineSection({ key: "tenant", version: 1, defaults: { id: "t1" }, fields: { id: str() }, scope: "admin" });
  const schema = { look, tenant } as unknown as SectionSchemas;
  const values = { look: { theme: "dark", brand: { name: "Acme" } }, tenant: { id: "t9" } } as unknown as SettingsState;

  it("a profile snapshot drops admin-scope nodes, inherited by children", () => {
    expect(agentSettings(values, schema)).toEqual({ look: { theme: "dark" }, tenant: {} });
  });

  it("applying keeps the current admin-scope values and takes the agent ones", () => {
    const incoming = { look: { theme: "light", brand: { name: "Other" } }, tenant: { id: "t2" } } as never;
    expect(withAgentSettings(values, incoming, schema)).toEqual({ look: { theme: "light", brand: { name: "Acme" } }, tenant: { id: "t9" } });
  });

  it("applying an identical profile returns the same references (nothing to write)", () => {
    const same = withAgentSettings(values, agentSettings(values, schema), schema) as unknown as Record<string, unknown>;
    expect(same.look).toBe((values as unknown as Record<string, unknown>).look);
  });
});
