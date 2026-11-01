// @vitest-environment jsdom
// Settings' "Set by" / "Locked by" markers over the sim's org tree (P-CONFIG-LAYERS 6): the agent persona's inert
// layers are named where they set a section; the supervisor's primary team locks Notifications read-only.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { SettingsView } from "@/components/settings/SettingsView";
import { lockedByLabel, sourceLabel } from "@/settings/source-labels";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const group = (id: string) => h.container.querySelector<HTMLFieldSetElement>(`[data-settings-group=${id}]`)!;
const marker = (el: Element) => el.querySelector(":scope > legend [data-section-source]")?.textContent ?? null;

async function persona(next: "agent" | "supervisor" | "sales") {
  await act(async () => {
    getSettingsStore().update("workspace", { persona: next });
    await vi.advanceTimersByTimeAsync(50);
  });
}

describe("source labels", () => {
  it("name the lock first, else an org layer that sets the section; the agent's own and the defaults say nothing", () => {
    const team = { level: "team" as const, profileName: "Atlas", primary: true };
    expect(sourceLabel({ from: team, lockedBy: null })).toBe("Set by: Atlas team profile (primary)");
    expect(sourceLabel({ from: { level: "contactCenter", profileName: "Care" }, lockedBy: null })).toBe("Set by: Care contact center profile");
    expect(sourceLabel({ from: team, lockedBy: { level: "enterprise", profileName: "Northwind" } })).toBe("Locked by: Northwind enterprise profile");
    expect(sourceLabel({ from: { level: "agent" }, lockedBy: null })).toBeNull();
    expect(sourceLabel({ from: null, lockedBy: null })).toBeNull();
    expect(lockedByLabel({ from: null, lockedBy: { level: "agent" } })).toBe("Locked by: your agent profile");
  });
});

describe("Settings over the org layers", () => {
  it("the agent persona: each org-set section names its layer, nothing is locked", async () => {
    await h.render(<SettingsView />);
    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(marker(group("notifications"))).toBe("Set by: Atlas team profile (primary)");
    expect(marker(group("voice"))).toBe("Set by: Northwind Care contact center profile");
    expect(group("notifications").disabled).toBe(false);
    expect(h.container.querySelectorAll("[data-section-locked]").length).toBe(0);
    // A section no layer sets (the agent's own, or the defaults) carries no marker.
    expect(marker(group("assignments"))).toBeNull();
  });

  it("the agent's own write over an org-set section makes it theirs: the marker goes", async () => {
    await h.render(<SettingsView />);
    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(marker(group("voice"))).toBe("Set by: Northwind Care contact center profile");
    await act(async () => {
      getSettingsStore().update("voice", { controlsLocation: "top" });
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(marker(group("voice"))).toBeNull();
  });

  it("the sales persona's team locks New Outbound, a sub-group: its own marker, its controls disabled", async () => {
    await h.render(<SettingsView />);
    await persona("sales");
    const outbound = [...h.container.querySelectorAll<HTMLFieldSetElement>("[data-settings-subgroup]")].find((f) => f.querySelector(":scope > legend")?.textContent?.startsWith("New Outbound"))!;
    expect(marker(outbound)).toBe("Locked by: Sales team profile");
    expect(outbound.disabled).toBe(true);
    expect(marker(group("notifications"))).toBeNull();
  });

  it("the Resolved settings view lists each value with its source, and follows a persona switch", async () => {
    await h.render(<SettingsView />);
    await act(async () => vi.advanceTimersByTimeAsync(50));
    const row = (key: string) => h.container.querySelector(`[data-resolved-settings] [data-resolved-row='${key}']`);
    expect(row("notifications.toasts")?.textContent).toContain("Set by: Atlas team profile (primary)");
    expect(row("assignments.placement")?.textContent).toContain("Default");
    await persona("supervisor");
    expect(row("notifications.toasts")?.textContent).toContain("Locked by: Supervisors team profile");
    expect(row("notifications.toasts")?.hasAttribute("data-resolved-locked")).toBe(true);
  });

  it("the supervisor's primary team locks Notifications read-only, and switching back unlocks it", async () => {
    await h.render(<SettingsView />);
    await persona("supervisor");
    expect(marker(group("notifications"))).toBe("Locked by: Supervisors team profile");
    expect(group("notifications").disabled).toBe(true);
    await persona("agent");
    expect(group("notifications").disabled).toBe(false);
    expect(marker(group("notifications"))).toBe("Set by: Atlas team profile (primary)");
  });
});
