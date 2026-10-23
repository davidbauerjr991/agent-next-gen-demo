import { describe, expect, it } from "vitest";
import { deriveProfile, profileValues, PROFILES } from "./profiles";
import { agentSettings, sectionInProfiles, withAgentSettings } from "./scope";
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

  it("Phase 2 turns on Desk's header apps and placements and every channel", () => {
    const store = freshStore();
    store.updateMany(profileValues("phase2"));
    const { header, channels } = store.getState().values;
    expect([header.showAppIcons, header.search, header.notifications, header.appsGrid].every(Boolean)).toBe(true);
    expect(header.agentChat).toEqual({ enabled: true, placement: "header" });
    for (const app of ["customers", "accounts", "tickets"] as const) {
      expect(header.apps[app]).toEqual({ enabled: true, placement: "tab" });
    }
    for (const app of ["schedule", "wem"] as const) {
      expect(header.apps[app]).toEqual({ enabled: true, placement: "header" });
    }
    expect([channels.voice, channels.chat, channels.email, channels.sms, channels.whatsapp].every(Boolean)).toBe(true);
    // (k3): no omnichannel setting; where threads open follows AI display.
    expect("omnichannel" in store.getState().values.assignments).toBe(false);
    expect(profile(store)).toBe("phase2");
  });

  it("applying a profile writes every agent-scope section and keeps personal settings (P-PROFILES)", () => {
    const store = freshStore();
    store.update("assignments", { navItemsAtTop: true });
    store.update("voice", { controlsLocation: "top" });
    store.update("home", { greeting: "Hi" });
    store.update("appearance", { theme: "dark" });
    store.update("phone", { setup: "phone-number", phoneNumber: "(555) 010-2000" });
    store.update("header", { tabOrder: ["tickets", "customers", "accounts", "wem", "schedule", "screenpop"] });
    store.updateMany(withAgentSettings(store.getState().values, profileValues("phase2")));
    const values = store.getState().values;
    expect(values.assignments.navItemsAtTop).toBe(false);
    expect(values.voice.controlsLocation).toBe("bottom");
    expect(values.home.greeting).toBe("Hello");
    // Personal: theme, phone and the Home tab order are the agent's own.
    expect(values.appearance.theme).toBe("dark");
    expect(values.phone).toEqual({ setup: "phone-number", phoneNumber: "(555) 010-2000", stationId: "" });
    expect(values.header.tabOrder[0]).toBe("tickets");
    expect(profile(store)).toBe("phase2");
  });

  it("personal settings never make a profile read Custom, and a snapshot carries none of them", () => {
    const store = freshStore();
    store.updateMany(profileValues("phase2"));
    store.update("phone", { setup: "work-station", stationId: "ST-14" });
    store.update("appearance", { theme: "dark" });
    store.update("header", { tabOrder: ["screenpop", "customers", "accounts", "tickets", "wem", "schedule"] });
    expect(profile(store)).toBe("phase2");
    const snapshot = agentSettings(store.getState().values);
    expect(snapshot.phone).toEqual({});
    expect("theme" in snapshot.appearance).toBe(false);
    expect("tabOrder" in snapshot.header).toBe(false);
    expect(sectionInProfiles("phone")).toBe(false);
    expect(sectionInProfiles("appearance")).toBe(false);
    expect(sectionInProfiles("header")).toBe(true);
  });

  it.each([
    ["header", { search: false }],
    ["home", { greeting: "Hi" }],
    ["assignments", { navItemsAtTop: true }],
    ["voice", { controlsLocation: "top" }],
    ["ai", { displayLocation: "panel" }],
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
    store.update("assignments", { confirmClose: true });
    store.updateMany(profileValues("phase1"));
    expect(profile(store)).toBe("phase1");
  });

  it("AI-first is Phase 2 with AI display \"main\" and the two-column canvas, and derives", () => {
    expect(PROFILES.aifirst).toEqual({
      ...PROFILES.phase2,
      ai: { ...PROFILES.phase2.ai, displayLocation: "main", canvasLayout: "twoColumn" },
    });
    const store = freshStore();
    store.updateMany(profileValues("aifirst"));
    expect(store.getState().values.ai.displayLocation).toBe("main");
    expect(store.getState().values.ai.canvasLayout).toBe("twoColumn");
    expect(profile(store)).toBe("aifirst");
    store.update("ai", { displayLocation: "inline" });
    expect(profile(store)).toBe("phase2");
  });

  it("canvasLayout defaults to twoColumn in every built-in; a stored ai section without it (or the pauses) reads the defaults", () => {
    for (const id of ["phase1", "phase2", "aifirst"] as const) expect(PROFILES[id].ai.canvasLayout).toBe("twoColumn");
    const read = SECTIONS.ai.read({ displayLocation: "main" }, SECTIONS.ai.defaults);
    expect(read).toEqual({ displayLocation: "main", canvasLayout: "twoColumn", nbaPauseChatMs: 6000, nbaPauseVoiceMs: 8000, nbaScriptedDelayMs: 900, chipBehavior: "run" });
    expect(SECTIONS.ai.read({ displayLocation: "main", canvasLayout: "grid" }, SECTIONS.ai.defaults).canvasLayout).toBe("twoColumn");
    // The pauses are whole numbers in range; anything else reads its default.
    expect(SECTIONS.ai.read({ nbaPauseChatMs: 3000, nbaPauseVoiceMs: 10 }, SECTIONS.ai.defaults)).toMatchObject({ nbaPauseChatMs: 3000, nbaPauseVoiceMs: 8000 });
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
