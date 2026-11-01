// @vitest-environment jsdom
// A profile's level (P-CONFIG-LAYERS 8): carried by the export file and the library, missing reads as the agent's own,
// and applying an org-level profile puts it in that layer through a change set, never in the agent's settings.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { changeSetLog, revertChangeSet } from "./change-set";
import { applyProfile, useWorkspaceProfile } from "./hooks";
import { savedProfilesByLevel } from "./source-labels";
import type { LayerProfile } from "./layers";
import { getOrgLayers } from "./org-layers";
import { PROFILES } from "./profiles";
import { PROFILES_STORAGE_KEY, createProfileLibrary, exportProfile, getProfileLibrary, importProfile } from "./saved-profiles";
import { agentSettings } from "./scope";
import { defaultSettings } from "./settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { safeStorage } from "./settings-storage";

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
});
afterEach(() => resetSettingsStoreForTests());

/** `useWorkspaceProfile`'s profile and modified flag, read once through a mounted probe. */
function derivedProfile() {
  let read: { profile: string; modified: boolean } | undefined;
  function Probe() {
    const { profile, modified } = useWorkspaceProfile();
    read = { profile, modified };
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() => root.render(createElement(Probe)));
  act(() => root.unmount());
  return read;
}

const atlas: LayerProfile ={ level: "team", id: "atlas", name: "Atlas", primary: true, values: {}, locks: [] };

describe("a profile's level", () => {
  it("round-trips through the export file; a file without one reads as the agent's own", () => {
    const file = exportProfile({ name: "Billing team", values: agentSettings(PROFILES.phase2), locks: ["channels"], level: "team" });
    expect(JSON.parse(file).level).toBe("team");
    const back = importProfile(file);
    expect(back.ok && back.profile.level).toBe("team");
    const old = JSON.parse(file);
    delete old.level;
    const oldBack = importProfile(JSON.stringify(old));
    expect(oldBack.ok && oldBack.profile.level).toBe("agent");
    const unknown = importProfile(JSON.stringify({ ...old, level: "skill" }));
    expect(unknown.ok && unknown.profile.level).toBe("agent");
  });

  it("is stored with a saved profile; a stored one from before the step reads as the agent's own", () => {
    const library = getProfileLibrary();
    const team = library.saveAs("Billing team", PROFILES.phase2, [], "team")!;
    const mine = library.saveAs("Mine", PROFILES.phase2)!;
    const raw = JSON.parse(localStorage.getItem(PROFILES_STORAGE_KEY)!);
    delete raw.value.saved.find((p: { id: string }) => p.id === mine.id).level;
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(raw));
    const reread = createProfileLibrary(safeStorage()).getState().saved;
    expect(reread.find((p) => p.id === team.id)?.level).toBe("team");
    expect(reread.find((p) => p.id === mine.id)?.level).toBe("agent");
    expect(library.duplicate(team.id)?.level).toBe("team");
  });

  it("groups the picker's saved profiles by level, the agent's own first", () => {
    const p = (name: string, level: "agent" | "team" | "enterprise") => ({ name, level });
    const grouped = savedProfilesByLevel([p("Ent", "enterprise"), p("Mine", "agent"), p("Billing", "team"), p("Mine 2", "agent")]);
    expect(grouped.map(({ profile, group }) => [profile.name, group])).toEqual([
      ["Mine", "Saved"],
      ["Mine 2", "Saved"],
      ["Billing", "Team profiles"],
      ["Ent", "Enterprise profiles"],
    ]);
  });

  it("applying a team-level profile makes it the primary team layer through a change set; the agent's settings stay; revert restores", () => {
    const store = getSettingsStore();
    getOrgLayers().setLayers([atlas]);
    const values = { ...PROFILES.phase2, channels: { ...PROFILES.phase2.channels, sms: false } };
    const team = getProfileLibrary().saveAs("Billing team", values, ["channels"], "team")!;
    const appliedBefore = getProfileLibrary().getState().applied;

    applyProfile(team.id);
    expect(store.getState().values.channels).toEqual(values.channels);
    expect(store.getState().sources.channels.lockedBy).toEqual({ level: "team", profileName: "Billing team", primary: true });
    expect(getOrgLayers().getState().layers.find((l) => l.id === "atlas")?.primary).toBe(false);
    // Nothing written for the agent, and the applied base unchanged.
    expect(store.getState().stored.channels).toBe(false);
    expect(getProfileLibrary().getState().applied).toBe(appliedBefore);

    // The picker never reads as the org-level profile, though the values now equal it (they match no built-in).
    expect(derivedProfile()).toEqual({ profile: "custom", modified: false });

    const [set] = changeSetLog();
    expect(set.intent).toContain("Billing team");
    revertChangeSet(set.id);
    expect(getOrgLayers().getState().layers).toEqual([atlas]);
    expect(store.getState().values.channels).toEqual(defaultSettings().channels);
  });
});
