// @vitest-environment jsdom
// Settings → Workspace → Persona (P-HOME-1): switching persona turns that
// persona's Home cards on and the rest off, keeping the agent's stored order.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { PERSONA_HOME_SECTIONS, withPersonaSections } from "./persona";
import { SECTIONS, type HomeSection } from "./settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";

const enabledKeys = (sections: readonly HomeSection[]) => sections.filter((s) => s.enabled).map((s) => s.key);

describe("withPersonaSections", () => {
  it("turns on exactly the persona's set; Contact History is in none of them", () => {
    for (const persona of ["agent", "supervisor", "sales"] as const) {
      const next = withPersonaSections(SECTIONS.home.defaults.sections, persona);
      expect(new Set(enabledKeys(next))).toEqual(new Set(PERSONA_HOME_SECTIONS[persona]));
      expect(next.find((s) => s.key === "contactHistory")?.enabled).toBe(false);
    }
  });

  it("keeps a custom stored order", () => {
    const custom: HomeSection[] = [...SECTIONS.home.defaults.sections].reverse();
    const next = withPersonaSections(custom, "supervisor");
    expect(next.map((s) => s.key)).toEqual(custom.map((s) => s.key));
    expect(enabledKeys(next)).toEqual(["needsYou", "teamToday", "teamQueues", "activity"]);
  });
});

describe("Settings → Workspace → Persona", () => {
  const h = createWorkspaceHarness();

  beforeEach(() => {
    localStorage.clear();
    resetSettingsStoreForTests();
    h.setUp();
  });

  afterEach(async () => {
    await h.tearDown();
  });

  const radio = (label: string) =>
    [...h.container.querySelectorAll<HTMLElement>("[role=radio]")].find(
      (el) =>
        el.getAttribute("aria-label") === label ||
        el.closest("label")?.textContent?.trim() === label ||
        el.parentElement?.textContent?.trim() === label ||
        // A ToggleGroup item (Settings → Layout's presets, P-LAYOUT): the radio is the button holding its label.
        el.textContent?.trim() === label,
    );

  it("defaults to Agent; picking Sales stores it and applies the sales cards, keeping the order", async () => {
    const store = getSettingsStore();
    const moved = [...SECTIONS.home.defaults.sections];
    moved.unshift(moved.splice(moved.findIndex((s) => s.key === "followUps"), 1)[0]);
    await act(async () => {
      store.update("home", { sections: moved });
      await vi.advanceTimersByTimeAsync(50);
    });
    await h.show(AgentWorkspaceAdvancedPage);
    const settings = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
      (el) => el.textContent?.trim() === "Settings",
    )!;
    await h.click(settings);
    expect(store.getState().values.workspace.persona).toBe("agent");
    expect(radio("Agent")?.getAttribute("aria-checked")).toBe("true");

    await h.click(radio("Sales")!);
    const { workspace, home } = store.getState().values;
    expect(workspace.persona).toBe("sales");
    expect(home.sections.map((s) => s.key)).toEqual(moved.map((s) => s.key));
    expect(enabledKeys(home.sections)).toEqual(["followUps", "activity", "pipeline", "campaignToday"]);
  });

  it("offers the Home layout choice, defaulting to one column", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const settings = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
      (el) => el.textContent?.trim() === "Settings",
    )!;
    await h.click(settings);
    expect(radio("One column")?.getAttribute("aria-checked")).toBe("true");
    await h.click(radio("Two columns")!);
    expect(getSettingsStore().getState().values.home.layout).toBe("twoColumn");
  });
});
