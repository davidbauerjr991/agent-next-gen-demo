// @vitest-environment jsdom
// The Settings page's grouping (P-HOME-1n): top-level groups in order, each a larger lyra heading with a Separator
// between; the assignments placement as a three-option radio; the incoming toast forced on, disabled with its reason,
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
      "Assignments",
      "Home",
      "Notifications",
      "Appearance",
      "Channels",
      "Voice",
      "Phone",
      "Connections",
    ]);
    expect(groups().every((g) => g.querySelector("legend")!.classList.contains("lyra-heading-sm"))).toBe(true);
    expect(h.container.querySelectorAll("[data-testid=settings-view] [role=separator], [data-testid=settings-view] [data-orientation=horizontal]").length).toBeGreaterThanOrEqual(8);
  });

  it("Workspace → Layout holds Home layout, the placement radio (three options), AI display and the canvas layout", async () => {
    await h.render(<SettingsView />);
    const workspace = groups()[0];
    const layout = [...workspace.querySelectorAll("fieldset")].find((f) => f.querySelector("legend")?.textContent === "Layout")!;
    // Home layout (its declared label is "Layout": One column / Two columns), AI display, the canvas layout.
    expect(layout.textContent).toContain("One column");
    expect(layout.textContent).toContain("AI display");
    const placement = layout.querySelector("[data-setting='assignments.placement']")!;
    expect([...placement.querySelectorAll("[role=radio]")]).toHaveLength(3);
    expect(placement.textContent).toContain("Left nav");
    expect(placement.textContent).toContain("Interior panel");
    expect(placement.textContent).toContain("None");
  });

  it("placement none: the incoming toast is shown on, disabled, with the reason; another placement frees it", async () => {
    await h.render(<SettingsView />);
    await h.click(h.container.querySelectorAll<HTMLElement>("[data-setting='assignments.placement'] [role=radio]")[2]);
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
