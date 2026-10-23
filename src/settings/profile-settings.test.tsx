// @vitest-environment jsdom
// Saved workspace profiles and locks on the Settings page (P-PROFILES).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { SettingsView } from "@/components/settings/SettingsView";
import { applyProfile } from "./hooks";
import { PROFILES } from "./profiles";
import { getProfileLibrary } from "./saved-profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});

afterEach(async () => {
  await h.tearDown();
});

const store = () => getSettingsStore();
const section = (title: string) =>
  [...h.container.querySelectorAll<HTMLFieldSetElement>("[data-testid=settings-view] fieldset")].find((f) =>
    f.querySelector("legend")?.textContent?.startsWith(title),
  )!;

/** A saved team profile: Phase 2 with confirm-before-closing, Assignments and AI locked. */
function saveTeamProfile() {
  const values = { ...PROFILES.phase2, assignments: { ...PROFILES.phase2.assignments, confirmClose: true } };
  return getProfileLibrary().saveAs("Billing team", values, ["assignments", "ai"])!;
}

async function apply(id: Parameters<typeof applyProfile>[0]) {
  await act(async () => {
    applyProfile(id);
    await vi.advanceTimersByTimeAsync(50);
  });
}

describe("locks", () => {
  it("applying a profile with locked sections renders them read-only with \"Set by your team profile\"", async () => {
    const team = saveTeamProfile();
    await apply(team.id);
    expect(store().getState().values.assignments.confirmClose).toBe(true);
    await h.render(<SettingsView />);

    const assignments = section("Assignments");
    expect(assignments.disabled).toBe(true);
    expect(assignments.querySelector("legend")!.textContent).toContain("Set by your team profile");
    // Every lyra control in it is disabled (greyed, not hidden).
    const switches = [...assignments.querySelectorAll<HTMLButtonElement>('button[role="switch"]')];
    expect(switches.length).toBeGreaterThan(0);
    expect(switches.every((s) => s.matches(":disabled"))).toBe(true);
    expect(section("AI").disabled).toBe(true);
    // Unlocked sections stay editable.
    expect(section("Header").disabled).toBe(false);
    expect(section("Header").querySelector("legend")!.textContent).not.toContain("Set by your team profile");
  });

  it("the store refuses writes to a locked section; personal settings in the page stay editable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const team = saveTeamProfile();
    await apply(team.id);
    await act(async () => {
      store().update("assignments", { confirmClose: false });
      store().update("appearance", { theme: "dark" });
    });
    expect(store().getState().values.assignments.confirmClose).toBe(true);
    expect(store().getState().values.appearance.theme).toBe("dark");
    await h.render(<SettingsView />);
    expect(section("Appearance").disabled).toBe(false);
    vi.restoreAllMocks();
  });

  it("locks survive a reload, and applying a built-in profile or resetting lifts them", async () => {
    const team = saveTeamProfile();
    await apply(team.id);
    resetSettingsStoreForTests();
    expect(getProfileLibrary().getState().applied).toEqual({ id: team.id, locks: ["assignments", "ai"] });

    await apply("phase1");
    expect(getProfileLibrary().getState().applied).toBeNull();
    await h.render(<SettingsView />);
    expect(section("Assignments").disabled).toBe(false);
  });
});
