// @vitest-environment jsdom
// P-AIFIRST (k5) F: the demo seed's waiting assignments used to be linked to
// another customer's directory record (`CREATE_NEW_CUSTOMERS[id % length]`),
// so an outbound to that customer (Sarah Brown, `customer-2`) joined Noah
// Patel's card. Each seed is its own pseudo-entity now: a customer with no
// open card always gets a new one.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { profileValues } from "@/settings/profiles";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

/** A card's channel rows, by their labels' first word ("Email", "SMS", …). */
const rowsOf = (name: string) =>
  [...h.navCard(name).closest("li, [data-slot=nav-card], div")!.parentElement!.querySelectorAll("[aria-label$=' channel'], [aria-label*=' channel,']")].map(
    (row) => row.getAttribute("aria-label")!.split(" ")[0],
  );

describe("a new customer always gets a new card", () => {
  it("Customers table → Sarah Brown (customer-2): a new card; Noah Patel's seeded card unchanged", async () => {
    await act(async () => {
      getSettingsStore().updateMany(profileValues("phase2"));
      await vi.advanceTimersByTimeAsync(50);
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.advance(500);
    expect(h.navCard("Noah Patel")).toBeTruthy();
    const noahRows = rowsOf("Noah Patel");

    const tab = [...h.container.querySelectorAll<HTMLElement>('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!;
    await h.click(tab);
    const sarah = [...h.container.querySelectorAll<HTMLElement>("table tr")].find(
      (tr) => tr.textContent?.includes("Sarah") && tr.textContent?.includes("Brown"),
    )!;
    expect(sarah).toBeTruthy();
    // A channel she has other than email (the bug was channel-independent).
    const icon = ["SMS", "WhatsApp", "Voice", "Email"]
      .map((label) => sarah.querySelector<HTMLElement>(`[title="${label}"], [aria-label="${label}"]`))
      .find(Boolean)!;
    await h.click(icon);
    const start = [...document.body.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === "Start Interaction")!;
    await h.click(start);
    await h.advance(1_000);

    expect(h.navCard("Sarah Brown")).toBeTruthy();
    expect(rowsOf("Noah Patel")).toEqual(noahRows);
  });
});
