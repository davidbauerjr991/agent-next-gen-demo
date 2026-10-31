// @vitest-environment jsdom
// The Settings page's grouping (P-HOME-1n): top-level groups in order, each a larger lyra heading with a Separator
// between; the assignments placement as a three-option preset in Settings → Layout (P-LAYOUT); the incoming toast forced on, disabled with its reason,
// under placement "none"; admin-scope settings tagged.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { SettingsView } from "./SettingsView";

const h = createWorkspaceHarness();
beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const groups = () => [...h.container.querySelectorAll<HTMLFieldSetElement>("[data-settings-group]")];
const groupTitle = (g: HTMLElement) => g.querySelector("legend")!.firstChild!.textContent;

describe("Settings grouping (P-HOME-1n)", () => {
  it("top-level groups in order, a lyra heading each, a Separator between them", async () => {
    await h.render(<SettingsView />);
    expect(groups().map(groupTitle)).toEqual([
      "Workspace",
      "Layout",
      "Assignments",
      "Home",
      "Notifications",
      "Appearance",
      "Channels",
      "Voice",
      "Phone",
      "Connections",
    ]);
    // P-POLISH 6: group lyra-heading-md > sub-group lyra-heading-sm, each sub-group but the first with its own top margin.
    expect(groups().every((g) => g.querySelector("legend")!.classList.contains("lyra-heading-md"))).toBe(true);
    expect(groups().every((g) => [...g.querySelectorAll(":scope > fieldset > legend")].every((l) => l.classList.contains("lyra-heading-sm")))).toBe(true);
    // Every sub-group, wrapped ones too (Social), carries the margin; the group drops it only right under its heading.
    const subGroups = [...h.container.querySelectorAll<HTMLElement>("[data-settings-subgroup]")];
    expect(subGroups.find((f) => f.querySelector(":scope > legend")?.textContent?.startsWith("Social"))).toBeDefined();
    expect(subGroups.every((f) => f.classList.contains("mt-6"))).toBe(true);
    expect(groups().every((g) => g.classList.contains("[&>legend+fieldset]:mt-0"))).toBe(true);
    expect(h.container.querySelectorAll("[data-testid=settings-view] [role=separator], [data-testid=settings-view] [data-orientation=horizontal]").length).toBeGreaterThanOrEqual(9);
  });

  it("a sub-group of one control named as itself shows its title once and names the control (P-POLISH 6)", async () => {
    await h.render(<SettingsView />);
    const workspace = groups()[0];
    const text = workspace.textContent ?? "";
    expect(text.match(/Persona/g)).toHaveLength(1);
    // Named by the title alone (no tag text), described by the help text that moved to the legend's help icon.
    const persona = workspace.querySelector<HTMLElement>("[role=radiogroup]")!;
    const name = document.getElementById(persona.getAttribute("aria-labelledby")!)!;
    expect(name.closest("legend")).not.toBeNull();
    expect(name.querySelector("[data-variant], .lyra-tag")).toBeNull();
    expect(document.getElementById(persona.getAttribute("aria-describedby")!)?.textContent).toContain("The role the workspace is set up for");
    expect(workspace.querySelector('[aria-label="More info about Persona"]')).not.toBeNull();
    // The profile picker has no label of its own: it's named "Workspace profile", as its sub-group.
    const profile = workspace.querySelector<HTMLElement>('[role=combobox][aria-label="Workspace profile"]')!;
    expect(profile).not.toBeNull();
    expect(profile.getAttribute("aria-labelledby")).toBeNull();
  });

  it("Settings → Layout's presets hold Workspace's old Layout controls, labels unchanged, plus the voice controls and the Activity view (P-LAYOUT)", async () => {
    await h.render(<SettingsView />);
    expect(groups()[0].textContent).not.toContain("Home layout");
    const layout = groups()[1];
    const presets = [...layout.querySelectorAll<HTMLElement>("[data-layout-preset]")].map((el) => el.getAttribute("data-layout-preset"));
    expect(presets).toEqual(["home.layout", "assignments.placement", "ai.displayLocation", "ai.canvasLayout", "voice.controlsLocation", "home.activityView"]);
    expect(layout.textContent).toContain("Home layout");
    expect(layout.textContent).toContain("AI display");
    const placement = layout.querySelector("[data-layout-preset='assignments.placement']")!;
    expect([...placement.querySelectorAll("[role=radio]")].map((r) => r.textContent)).toEqual(["Left nav", "Interior panel", "None"]);
  });

  it("placement none: the incoming toast is shown on, disabled, with the reason; another placement frees it", async () => {
    await h.render(<SettingsView />);
    await h.click(h.container.querySelectorAll<HTMLElement>("[data-layout-preset='assignments.placement'] [role=radio]")[2]);
    expect(getSettingsStore().getState().values.assignments.placement).toBe("none");
    const forced = h.container.querySelector<HTMLElement>('[data-forced-setting="notifications.toasts.events.incoming"]')!;
    expect(forced.textContent).toContain("On — required while assignments aren't in the left nav");
    expect(forced.querySelector("[role=checkbox]")!.hasAttribute("disabled")).toBe(true);
    expect(forced.querySelector("[role=checkbox]")!.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      getSettingsStore().update("assignments", { placement: "leftNav" });
    });
    expect(h.container.querySelector('[data-forced-setting="notifications.toasts.events.incoming"]')).toBeNull();
  });

  it("admin-scope settings carry an Admin tag: Brand and Social", async () => {
    await h.render(<SettingsView />);
    const legends = [...h.container.querySelectorAll("legend")].map((l) => l.textContent ?? "");
    expect(legends.filter((l) => l.includes("Admin"))).toEqual(["BrandAdmin", "SocialAdmin"]);
  });
});
