import { describe, expect, it } from "vitest";
import { lockedSections, resolveLayers, type AgentLayer, type LayerProfile } from "./layers";
import { PROFILE_IDS, PROFILES } from "./profiles";
import { agentSettings } from "./scope";
import { defaultSettings, type SectionKey, type SettingsState } from "./settings-schema";
import { settle, withDerivedLayout } from "./settle";

const base = withDerivedLayout(defaultSettings());
const phase2 = agentSettings(PROFILES.phase2);
const aifirst = agentSettings(PROFILES.aifirst);

const agent = (stored: SectionKey[] = [], locks: SectionKey[] = [], profileName?: string): AgentLayer => ({
  sets: (key) => stored.includes(key),
  locks,
  profileName,
});

const layer = (level: LayerProfile["level"], name: string, values: LayerProfile["values"], locks: SectionKey[] = [], primary?: boolean): LayerProfile => ({
  level,
  id: name.toLowerCase(),
  name,
  primary: level === "team" ? (primary ?? true) : primary,
  values,
  locks,
});

describe("resolveLayers", () => {
  it("takes each section from the lowest layer that sets it", () => {
    const layers = [
      layer("enterprise", "Northwind", { home: aifirst.home, channels: phase2.channels }),
      layer("team", "Atlas", { home: { ...aifirst.home, layout: "oneColumn" } }),
    ];
    const { values, sources, sets } = resolveLayers(base, layers, agent());
    expect(values.home.layout).toBe("oneColumn");
    expect(values.channels).toEqual(PROFILES.phase2.channels);
    expect(sources.home).toEqual({ from: { level: "team", profileName: "Atlas", primary: true }, lockedBy: null });
    expect(sources.channels.from?.level).toBe("enterprise");
    expect(sources.voice).toEqual({ from: null, lockedBy: null });
    expect([sets.home, sets.channels, sets.voice]).toEqual([true, true, false]);
  });

  it("a section no profile carries (the phone) is the agent's, set only when stored", () => {
    const layers = [layer("enterprise", "Northwind", {}, ["phone"])];
    const unstored = resolveLayers(base, layers, agent());
    expect([unstored.sets.phone, unstored.sources.phone]).toEqual([false, { from: null, lockedBy: null }]);
    const stored = resolveLayers(base, layers, agent(["phone"]));
    expect([stored.sets.phone, stored.sources.phone]).toEqual([true, { from: { level: "agent" }, lockedBy: null }]);
  });

  it("an unset agent layer falls through; a stored one wins below every unlocked layer", () => {
    const agentState: SettingsState = { ...base, channels: { ...base.channels, email: false, chat: false } };
    const layers = [layer("contactCenter", "Care", { channels: phase2.channels })];
    expect(resolveLayers(agentState, layers, agent()).values.channels).toEqual(PROFILES.phase2.channels);
    const stored = resolveLayers(agentState, layers, agent(["channels"]));
    expect(stored.values.channels).toBe(agentState.channels);
    expect(stored.sources.channels.from).toEqual({ level: "agent", profileName: undefined, primary: undefined });
  });

  it("a lock propagates down: the lowest setter at or above the topmost lock wins", () => {
    const layers = [
      layer("enterprise", "Northwind", { ai: aifirst.ai }),
      layer("contactCenter", "Care", { ai: phase2.ai }, ["ai"]),
      layer("team", "Atlas", { ai: { ...phase2.ai, displayLocation: "panel" } }),
    ];
    const agentState: SettingsState = { ...base, ai: { ...base.ai, displayLocation: "panel" } };
    const { values, sources } = resolveLayers(agentState, layers, agent(["ai"]));
    expect(values.ai).toEqual(PROFILES.phase2.ai);
    expect(sources.ai).toEqual({
      from: { level: "contactCenter", profileName: "Care", primary: undefined },
      lockedBy: { level: "contactCenter", profileName: "Care", primary: undefined },
    });
    // The topmost lock is the one that holds.
    const both = resolveLayers(agentState, [{ ...layers[0], locks: ["ai"] }, ...layers.slice(1)], agent(["ai"]));
    expect(both.values.ai.displayLocation).toBe(PROFILES.aifirst.ai.displayLocation);
    expect(both.sources.ai.lockedBy?.level).toBe("enterprise");
  });

  it("a lock on a layer that doesn't set the section takes the setter above it, else the defaults — never the agent's", () => {
    // The agent's stored channels differ from the defaults and from the setter above, so each outcome is distinct.
    const agentState: SettingsState = { ...base, channels: PROFILES.phase2.channels };
    const lockOnly = [layer("team", "Birch", {}, ["channels"])];
    const locked = resolveLayers(agentState, lockOnly, agent(["channels"]));
    expect(locked.values.channels).toEqual(base.channels);
    expect(locked.values.channels).not.toEqual(agentState.channels);
    expect(locked.sources.channels).toEqual({ from: null, lockedBy: { level: "team", profileName: "Birch", primary: true } });
    expect(locked.sets.channels).toBe(false);
    const fromAbove = { ...base.channels, sms: !base.channels.sms };
    const above = [layer("enterprise", "Northwind", { channels: fromAbove }), ...lockOnly];
    expect(resolveLayers(agentState, above, agent(["channels"])).values.channels).toEqual(fromAbove);
  });

  it("a partial section from a layer reads its other fields as the defaults, never the agent's", () => {
    const agentState: SettingsState = { ...base, channels: PROFILES.phase2.channels };
    const partial = { sms: !base.channels.sms } as LayerProfile["values"]["channels"];
    const { values } = resolveLayers(agentState, [layer("contactCenter", "Care", { channels: partial }, ["channels"])], agent(["channels"]));
    expect(values.channels).toEqual({ ...base.channels, sms: !base.channels.sms });
  });

  it("the applied profile's locks are Agent-level locks", () => {
    const { values, sources } = resolveLayers(base, [layer("team", "Atlas", { channels: phase2.channels })], agent(["channels"], ["channels"], "Mine"));
    expect(values.channels).toBe(base.channels);
    expect(sources.channels.lockedBy).toEqual({ level: "agent", profileName: "Mine", primary: undefined });
    expect(lockedSections([], ["channels"])).toEqual(["channels"]);
  });

  it("personal- and admin-scope fields stay the agent's", () => {
    const agentState: SettingsState = { ...base, header: { ...base.header, tabOrder: ["tickets", ...base.header.tabOrder.filter((a) => a !== "tickets")] } };
    // The layer's header carries a tab order of its own, which a profile never should: it's ignored.
    const header = { ...phase2.header, tabOrder: [...base.header.tabOrder].reverse() } as LayerProfile["values"]["header"];
    const { values } = resolveLayers(agentState, [layer("enterprise", "Northwind", { header }, ["header"])], agent());
    expect(values.header.showAppIcons).toBe(true);
    expect(values.header.tabOrder).toEqual(agentState.header.tabOrder);
    expect(values.appearance).toBe(agentState.appearance);
  });

  it("only the primary team enters the chain", () => {
    const layers = [
      layer("team", "Atlas", { channels: phase2.channels }, ["channels"], false),
      layer("team", "Sales", { home: aifirst.home }, [], true),
    ];
    const { values, sources } = resolveLayers(base, layers, agent());
    expect(values.channels).toBe(base.channels);
    expect(sources.channels).toEqual({ from: null, lockedBy: null });
    expect(sources.home.from?.profileName).toBe("Sales");
    expect(lockedSections(layers, [])).toEqual([]);
  });

  it("an inert tenant changes nothing", () => {
    const { values } = resolveLayers(base, [layer("tenant", "Northwind", {})], agent());
    expect(values).toBe(base);
  });

  it("the constraints run on the resolved value, so a forced value goes through a lock", () => {
    // The team locks an invalid combination (the conversation and the AI feed both docked): the resolved value is valid.
    const parts = { ...base.layout.parts, conversation: { ...base.layout.parts.conversation, slot: "docked-panel" }, aiFeed: { ...base.layout.parts.aiFeed, slot: "docked-panel" } };
    const { values } = resolveLayers(base, [layer("team", "Birch", { layout: { ...base.layout, parts } as LayerProfile["values"]["layout"] }, ["layout"])], agent());
    const settled = settle(null, values, values.layout.parts).values;
    expect(settled.layout.parts.conversation.slot).toBe("docked-panel");
    expect(settled.layout.parts.aiFeed.slot).toBe("main");
  });

  it("every built-in profile resolves as an Agent-layer snapshot to itself, under any unlocked org layers", () => {
    const org = [layer("enterprise", "Northwind", { home: aifirst.home, ai: aifirst.ai }), layer("team", "Atlas", { channels: phase2.channels })];
    const all = Object.keys(base) as SectionKey[];
    for (const id of PROFILE_IDS) {
      const { values } = resolveLayers(PROFILES[id], org, agent(all));
      expect(agentSettings(values)).toEqual(agentSettings(PROFILES[id]));
    }
  });
});
