// @vitest-environment jsdom
// Saved workspace profiles and locks on the Settings page (P-PROFILES).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { SettingsView } from "@/components/settings/SettingsView";
import { applyProfile } from "./hooks";
import { PROFILES } from "./profiles";
import { exportProfile, getProfileLibrary } from "./saved-profiles";
import { agentSettings } from "./scope";
import { SECTIONS } from "./settings-schema";
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

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
  });
}

const dialog = () => document.body.querySelector<HTMLElement>("[role=dialog], [role=alertdialog]");
const profileCombobox = () =>
  [...h.container.querySelectorAll<HTMLElement>('[role="combobox"]')].find((el) => /Profile/.test(el.getAttribute("aria-labelledby") ? document.getElementById(el.getAttribute("aria-labelledby")!.split(" ")[0])?.textContent ?? "" : el.getAttribute("aria-label") ?? "")) ??
  h.container.querySelector<HTMLElement>('[role="combobox"]')!;
const optionLabels = () => [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => o.textContent?.trim());
const kebabButton = () => h.container.querySelector<HTMLElement>('[aria-label="Profile actions"]');
/** Radix opens its menu on pointer down or Enter, not on a synthetic click. */
async function openKebab() {
  await act(async () => {
    kebabButton()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.advanceTimersByTimeAsync(50);
  });
}
const menuItemLabels = () => [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((m) => m.textContent?.trim());
const menuItem = (label: string) => [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((m) => m.textContent?.trim() === label)!;

describe("the profile picker and its actions", () => {
  it("lists the built-in and saved profiles; Save as saves the current settings and the picker shows it", async () => {
    await act(async () => {
      store().update("assignments", { confirmClose: true });
    });
    await h.render(<SettingsView />);
    await h.click(h.buttonByText("Save as…", h.container)!);
    const input = dialog()!.querySelector<HTMLInputElement>("input")!;
    await type(input, "Billing team");
    await h.click(h.buttonByText("Save", dialog()!)!);
    const saved = getProfileLibrary().getState().saved;
    expect(saved.map((p) => p.name)).toEqual(["Billing team"]);
    expect(profileCombobox().textContent).toContain("Billing team");

    await h.click(profileCombobox());
    expect(optionLabels()).toEqual(["Phase 1", "Phase 2", "AI-first", "Billing team"]);
  });

  it("built-ins offer Duplicate and Export only; a saved profile adds Rename, Locks and Delete", async () => {
    await h.render(<SettingsView />);
    await openKebab();
    expect(menuItemLabels()).toEqual(["Duplicate", "Export"]);
    await h.click(menuItem("Duplicate"));
    expect(getProfileLibrary().getState().saved.map((p) => p.name)).toEqual(["Copy of Phase 1"]);

    const team = saveTeamProfile();
    await apply(team.id);
    await openKebab();
    expect(menuItemLabels()).toEqual(["Rename…", "Duplicate", "Locks…", "Export", "Delete…"]);
  });

  it("Delete asks first, then removes the saved profile; the settings stay and read Custom", async () => {
    const team = saveTeamProfile();
    await apply(team.id);
    await h.render(<SettingsView />);
    await openKebab();
    await h.click(menuItem("Delete…"));
    expect(dialog()!.textContent).toContain("Delete profile?");
    await h.click(h.buttonByText("Delete", dialog()!)!);
    expect(getProfileLibrary().getState().saved).toEqual([]);
    expect(store().getState().values.assignments.confirmClose).toBe(true);
    expect(profileCombobox().textContent).toContain("Custom");
  });

  it("Import saves the file as a new profile, reports defaults it fell back to, and Apply applies it", async () => {
    const values = { ...PROFILES.aifirst, assignments: { ...PROFILES.aifirst.assignments, confirmClose: true } };
    const file = JSON.parse(exportProfile({ name: "Shared", values: agentSettings(values), locks: ["ai"] }));
    file.sections.outbound.v = 0;
    await h.render(<SettingsView />);
    const input = h.container.querySelector<HTMLInputElement>("[data-slot=profile-import-input]")!;
    await act(async () => {
      const f = new File([JSON.stringify(file)], "shared.profile.json", { type: "application/json" });
      Object.defineProperty(input, "files", { value: [f], configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(dialog()!.textContent).toContain("Profile imported");
    expect(dialog()!.textContent).toContain("New Outbound (saved with another version)");
    await h.click(h.buttonByText("Apply", dialog()!)!);
    expect(store().getState().values.ai.displayLocation).toBe("main");
    expect(getProfileLibrary().getState().applied?.locks).toEqual(["ai"]);
    expect(section("AI").disabled).toBe(true);
  });

  it("a file that isn't a profile is refused with a message", async () => {
    await h.render(<SettingsView />);
    const input = h.container.querySelector<HTMLInputElement>("[data-slot=profile-import-input]")!;
    await act(async () => {
      const f = new File(["{ not json"], "x.json", { type: "application/json" });
      Object.defineProperty(input, "files", { value: [f], configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(dialog()!.textContent).toContain("Couldn't import the profile");
    expect(getProfileLibrary().getState().saved).toEqual([]);
  });
});

describe("assignments.legs (P-PROFILES schema; P-STREAM builds stream)", () => {
  it("defaults to tabs, is in every built-in, and the schema accepts stream so a profile file can carry it", () => {
    for (const id of ["phase1", "phase2", "aifirst"] as const) expect(PROFILES[id].assignments.legs).toBe("tabs");
    const read = (legs: unknown) => SECTIONS.assignments.read({ legs }, SECTIONS.assignments.defaults).legs;
    expect(read("stream")).toBe("stream");
    expect(read("columns")).toBe("tabs");
  });

  it("under AI display panel the Channels control is disabled with the reason; it offers only Separate tabs", async () => {
    await act(async () => {
      store().update("ai", { displayLocation: "panel" });
    });
    await h.render(<SettingsView />);
    const reason = [...h.container.querySelectorAll("[data-disabled-reason]")].find((el) => el.textContent?.includes("Channels"));
    expect(reason).toBeTruthy();
    const select = reason!.querySelector<HTMLElement>('[role="combobox"]')!;
    expect(select.matches(":disabled") || select.getAttribute("aria-disabled") === "true" || select.hasAttribute("data-disabled")).toBe(true);

    await act(async () => {
      store().update("ai", { displayLocation: "inline" });
    });
    // Without a reason the wrapper goes, so the select is a new node.
    const enabled = [...h.container.querySelectorAll<HTMLElement>('[role="combobox"]')].find(
      (el) => el.textContent?.includes("Separate tabs"),
    )!;
    await h.click(enabled);
    expect(optionLabels()).toEqual(["Separate tabs — one thread per channel"]);
  });
});

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
