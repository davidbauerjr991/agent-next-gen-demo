// @vitest-environment jsdom
// P-LAYOUT-F3 14 (Dave, 2026-11-01): the profile picker's match / modified state compares the agent's own layer (the
// stored agent-scope sections) with the profile, never the resolved values. A section an org layer sets doesn't make
// the picked profile read "modified" or match a built-in; an agent write does.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyProfile, useWorkspaceProfile } from "./hooks";
import type { LayerProfile } from "./layers";
import { getOrgLayers } from "./org-layers";
import { PROFILES } from "./profiles";
import { getProfileLibrary } from "./saved-profiles";
import type { SectionKey } from "./settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";

const team = (values: LayerProfile["values"], locks: SectionKey[] = []): LayerProfile => ({ level: "team", id: "birch", name: "Birch", primary: true, values, locks });

let seen: { profile: string; modified: boolean } = { profile: "", modified: false };
function Probe() {
  const { profile, modified } = useWorkspaceProfile();
  seen = { profile, modified };
  return null;
}

let root: ReturnType<typeof createRoot> | null = null;
beforeEach(async () => {
  localStorage.clear();
  getOrgLayers().setLayers([]);
  getProfileLibrary().setApplied(null);
  resetSettingsStoreForTests();
  root = createRoot(document.createElement("div"));
  await act(async () => root!.render(<Probe />));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  getOrgLayers().setLayers([]);
  getProfileLibrary().setApplied(null);
});

describe("the profile picker reads the agent's own layer", () => {
  it("an upper layer's value leaves the picked profile as it was; the agent's own write marks it modified", async () => {
    await act(async () => applyProfile("phase2"));
    expect(seen).toEqual({ profile: "phase2", modified: false });

    // A team layer sets and locks a section the profile also carries (a different value; locked, so it wins over the
    // agent's stored one): the resolved settings change, the picker doesn't.
    const chat = !PROFILES.phase2.channels.chat;
    await act(async () => getOrgLayers().setLayers([team({ channels: { ...PROFILES.phase2.channels, chat } }, ["channels"])]));
    expect(getSettingsStore().getState().values.channels.chat).toBe(chat);
    expect(seen).toEqual({ profile: "phase2", modified: false });

    // The agent's own write over a section: modified from Phase 2.
    await act(async () => getSettingsStore().update("assignments", { confirmClose: !PROFILES.phase2.assignments.confirmClose }));
    expect(seen).toEqual({ profile: "phase2", modified: true });
  });

  it("a profile saved under an org layer holds the agent's own settings and reads unmodified right after", async () => {
    await act(async () => applyProfile("phase2"));
    // An agent change of its own first, so the saved profile is distinct (a built-in wins a tie).
    await act(async () => getSettingsStore().update("assignments", { confirmClose: !PROFILES.phase2.assignments.confirmClose }));
    const chat = !PROFILES.phase2.channels.chat;
    await act(async () => getOrgLayers().setLayers([team({ channels: { ...PROFILES.phase2.channels, chat } }, ["channels"])]));
    let saved: { profile: string } | null = null;
    function SaveProbe() {
      const api = useWorkspaceProfile();
      saved = { profile: api.profile };
      return (
        <button type="button" onClick={() => api.saveAs("Mine")}>
          save
        </button>
      );
    }
    const el = document.createElement("div");
    const r = createRoot(el);
    await act(async () => r.render(<SaveProbe />));
    await act(async () => el.querySelector("button")!.click());
    const mine = getProfileLibrary().getState().saved.find((p) => p.name === "Mine")!;
    expect(mine.values.channels.chat).toBe(PROFILES.phase2.channels.chat);
    expect(seen).toEqual({ profile: mine.id, modified: false });
    expect(saved!.profile).toBe(mine.id);
    await act(async () => r.unmount());
  });

  it("an org layer whose values equal a built-in doesn't make the settings read as that built-in", async () => {
    // Nothing applied, defaults stored: Phase 1's values. A layer setting AI-first's AI section changes what resolves,
    // not what the picker matches.
    const before = seen.profile;
    await act(async () => getOrgLayers().setLayers([team({ ai: PROFILES.aifirst.ai })]));
    expect(getSettingsStore().getState().values.ai.displayLocation).toBe(PROFILES.aifirst.ai.displayLocation);
    expect(seen.profile).toBe(before);
  });
});
