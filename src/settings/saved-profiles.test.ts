import { describe, expect, it } from "vitest";
import { deriveProfile, profileValues, PROFILES } from "./profiles";
import { agentSettings } from "./scope";
import {
  PROFILES_STORAGE_KEY,
  createProfileLibrary,
  exportProfile,
  importProfile,
  profileSectionKeys,
  uniqueProfileName,
} from "./saved-profiles";
import { SECTIONS, defaultSettings, type SettingsState } from "./settings-schema";
import { safeStorage } from "./settings-storage";

function memoryStorage() {
  const data = new Map<string, string>();
  const storage = safeStorage(
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
  );
  return { storage, data };
}

/** Phase 2 with one agent-scope change, so it derives as neither built-in. */
function customValues(): SettingsState {
  const base = PROFILES.phase2;
  return { ...base, assignments: { ...base.assignments, confirmClose: true } };
}

describe("saved profiles: save as, rename, duplicate, delete", () => {
  it("save as stores the agent-scope values under the name, and they derive back to it", () => {
    const { storage } = memoryStorage();
    const library = createProfileLibrary(storage);
    const values = customValues();
    const saved = library.saveAs("  Billing team  ", values)!;
    expect(saved.name).toBe("Billing team");
    expect(saved.id.startsWith("saved:")).toBe(true);
    expect(saved.values).toEqual(agentSettings(values));
    expect(deriveProfile(values, library.getState().saved)).toBe(saved.id);
    // A built-in wins a tie.
    const asPhase2 = library.saveAs("Same as Phase 2", PROFILES.phase2)!;
    expect(deriveProfile(PROFILES.phase2, library.getState().saved)).toBe("phase2");
    expect(asPhase2).not.toBeNull();
  });

  it("names are trimmed, non-empty and unique (case-insensitive, built-ins included)", () => {
    const library = createProfileLibrary(memoryStorage().storage);
    expect(library.saveAs("   ", customValues())).toBeNull();
    expect(library.saveAs("phase 2", customValues())!.name).toBe("phase 2 (2)");
    expect(library.saveAs("Team", customValues())!.name).toBe("Team");
    expect(library.saveAs("team", customValues())!.name).toBe("team (2)");
    expect(uniqueProfileName("A", ["a", "A (2)"])).toBe("A (3)");
  });

  it("rename changes a saved profile's name; an empty or taken name doesn't go through as typed", () => {
    const library = createProfileLibrary(memoryStorage().storage);
    const a = library.saveAs("A", customValues())!;
    library.saveAs("B", customValues());
    expect(library.rename(a.id, "Renamed")).toBe(true);
    expect(library.getState().saved[0].name).toBe("Renamed");
    expect(library.rename(a.id, "")).toBe(false);
    expect(library.rename(a.id, "B")).toBe(true);
    expect(library.getState().saved[0].name).toBe("B (2)");
    // Renaming to its own name keeps it.
    expect(library.rename(a.id, "B (2)")).toBe(true);
    expect(library.getState().saved[0].name).toBe("B (2)");
  });

  it("built-ins can't be renamed or deleted; duplicating one makes a saved copy", () => {
    const library = createProfileLibrary(memoryStorage().storage);
    expect(library.rename("phase2" as never, "Mine")).toBe(false);
    library.remove("aifirst" as never);
    expect(library.getState().saved).toEqual([]);
    const copy = library.duplicate("aifirst")!;
    expect(copy.name).toBe("Copy of AI-first");
    expect(copy.values).toEqual(profileValues("aifirst"));
    expect(library.duplicate("aifirst")!.name).toBe("Copy of AI-first (2)");
  });

  it("duplicating a saved profile copies its values and locks; delete removes it and its applied locks", () => {
    const library = createProfileLibrary(memoryStorage().storage);
    const a = library.saveAs("Team", customValues(), ["assignments"])!;
    const copy = library.duplicate(a.id)!;
    expect(copy.values).toEqual(a.values);
    expect(copy.locks).toEqual(["assignments"]);
    library.setApplied({ id: a.id, locks: a.locks });
    library.remove(a.id);
    expect(library.getState().saved.map((p) => p.id)).toEqual([copy.id]);
    expect(library.getState().applied).toBeNull();
  });

  it("persists across a reload; a corrupt or other-version store reads empty", () => {
    const { storage, data } = memoryStorage();
    const first = createProfileLibrary(storage);
    const a = first.saveAs("Team", customValues(), ["ai", "bogus" as never])!;
    first.setApplied({ id: a.id, locks: a.locks });
    const reread = createProfileLibrary(storage).getState();
    expect(reread.saved).toEqual([{ ...a, locks: ["ai"] }]);
    expect(reread.applied).toEqual({ id: a.id, locks: ["ai"] });

    data.set(PROFILES_STORAGE_KEY, "{not json");
    expect(createProfileLibrary(storage).getState()).toEqual({ saved: [], applied: null });
    data.set(PROFILES_STORAGE_KEY, JSON.stringify({ v: 99, value: {} }));
    expect(createProfileLibrary(storage).getState()).toEqual({ saved: [], applied: null });
  });

  it("editing the applied profile's locks applies them at once", () => {
    const library = createProfileLibrary(memoryStorage().storage);
    const a = library.saveAs("Team", customValues())!;
    library.setApplied({ id: a.id, locks: [] });
    library.setLocks(a.id, ["header", "ai"]);
    expect(library.getState().applied).toEqual({ id: a.id, locks: ["header", "ai"] });
  });
});

describe("saved profiles: share as JSON", () => {
  it("export → import round-trips the values and locks", () => {
    const values = agentSettings(customValues());
    const json = exportProfile({ name: "Billing", values, locks: ["assignments", "ai"] });
    const result = importProfile(json);
    expect(result).toEqual({ ok: true, profile: { name: "Billing", values, locks: ["assignments", "ai"] }, warnings: [] });
  });

  it("an exported file carries no admin- or personal-scope settings", () => {
    const state: SettingsState = {
      ...customValues(),
      appearance: { theme: "dark", brand: { appName: "Acme", logo: null, colors: { primary: "#112233", accent: null } } },
      channels: { ...customValues().channels, social: { ...customValues().channels.social, telegram: true } },
      phone: { setup: "work-station", phoneNumber: "", stationId: "ST-9" },
    };
    const file = JSON.parse(exportProfile({ name: "X", values: agentSettings(state), locks: [] }));
    expect(Object.keys(file.sections).sort()).toEqual(profileSectionKeys().sort());
    expect(file.sections.phone).toBeUndefined();
    expect(file.sections.appearance).toBeUndefined();
    expect(file.sections.channels.value.social).toBeUndefined();
    expect(file.sections.header.value.tabOrder).toBeUndefined();
    expect(JSON.stringify(file)).not.toContain("Acme");
    expect(JSON.stringify(file)).not.toContain("ST-9");
  });

  it("a malformed file, a non-profile file and a newer format are errors", () => {
    expect(importProfile("{nope")).toEqual({ ok: false, error: "malformed" });
    expect(importProfile(JSON.stringify({ kind: "something-else" }))).toEqual({ ok: false, error: "notAProfile" });
    expect(importProfile("[]")).toEqual({ ok: false, error: "notAProfile" });
    expect(importProfile(JSON.stringify({ kind: "agent-workspace-profile", format: 2, sections: {} }))).toEqual({
      ok: false,
      error: "newerFormat",
    });
  });

  it("an old or hand-edited file falls back field by field and section by section", () => {
    const values = agentSettings(customValues());
    const file = JSON.parse(exportProfile({ name: "Edited", values, locks: ["ai", "nope"] as never }));
    file.sections.assignments.value.confirmClose = "yes"; // a bad field: its default
    file.sections.ai.value.displayLocation = "main"; // a good change: kept
    file.sections.outbound.v = 0; // an older section: its defaults
    delete file.sections.home; // a missing section: its defaults
    file.sections.bogus = { v: 1, value: {} }; // unknown: dropped
    const result = importProfile(JSON.stringify(file));
    if (!result.ok) throw new Error("expected ok");
    const defaults = agentSettings(defaultSettings());
    expect(result.profile.values.assignments.confirmClose).toBe(SECTIONS.assignments.defaults.confirmClose);
    expect(result.profile.values.ai.displayLocation).toBe("main");
    expect(result.profile.values.outbound).toEqual(defaults.outbound);
    expect(result.profile.values.home).toEqual(defaults.home);
    expect("bogus" in result.profile.values).toBe(false);
    expect(result.profile.locks).toEqual(["ai"]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        { section: "outbound", reason: "version" },
        { section: "home", reason: "missing" },
      ]),
    );
  });

  it("a file with no name imports as \"Imported profile\"", () => {
    const json = JSON.parse(exportProfile({ name: "", values: profileValues("phase1"), locks: [] }));
    const result = importProfile(JSON.stringify(json));
    expect(result.ok && result.profile.name).toBe("Imported profile");
  });
});
