// @vitest-environment jsdom
// P-HOME-1n: a reference card shows only when it has something (the registry's `hasContent`): the Real-Time Summary
// with a summary, the Journey Summary with at least one earlier interaction, Customer Info always ("Link to existing
// customer" is an action). A card that fills enters with the AI cards' enter, staggered by its place.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { MAYA_CHEN_SCRIPT } from "@/scenarios/scripts/maya-chen";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { canvasCellDefinition, resetCanvasRegistry } from "./canvas-registry";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetCanvasRegistry();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const referenceCells = () =>
  [...(h.container.querySelector("[data-canvas-region=reference]")?.querySelectorAll<HTMLElement>("[data-canvas-cell]") ?? [])].map((c) =>
    c.getAttribute("data-canvas-cell"),
  );

async function open() {
  await act(async () => {
    getSettingsStore().updateMany(profileValues("phase2"));
    getSettingsStore().update("ai", { displayLocation: "inline", canvasLayout: "twoColumn" });
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
}

describe("reference cards hide when empty (P-HOME-1n)", () => {
  it("the rule is data on the registry", () => {
    const content = (c: Partial<{ summary: boolean; asks: number; journeyRows: number }>) => ({ summary: false, asks: 0, journeyRows: 0, ...c });
    const has = (id: string, c: Parameters<typeof content>[0]) => canvasCellDefinition(id)!.hasContent?.({} as never, content(c)) ?? true;
    expect(has("real-time-summary", {})).toBe(false);
    expect(has("real-time-summary", { summary: true })).toBe(true);
    expect(has("real-time-summary", { asks: 1 })).toBe(true);
    expect(has("journey-summary", {})).toBe(false);
    expect(has("journey-summary", { journeyRows: 1 })).toBe(true);
    expect(has("customer-info", {})).toBe(true);
  });

  it("an unknown contact arriving, before anything is said: Customer Info alone (its Link to existing customer)", async () => {
    await open();
    const id = await h.startInbound("chat", "nobody@example.com", "nobody@example.com");
    await h.accept(id);
    await h.click(h.navCard("nobody@example.com"));
    await h.advance(50);
    expect(referenceCells()).toEqual(["customer-info"]);
  });

  it("Maya (a repeat customer): Journey Summary and Customer Info from the start; the Real-Time Summary enters after her first summary turn, staggered first", async () => {
    await open();
    await h.play(MAYA_CHEN_SCRIPT.id);
    await h.click(h.navCard("Maya Chen"));
    await h.advance(200);
    expect(referenceCells()).toEqual(["journey-summary", "customer-info"]);
    await h.advance(3_000);
    expect(referenceCells()).toEqual(["real-time-summary", "journey-summary", "customer-info"]);
    // The enter, at its place in the stagger (the first card: no delay; the next 60ms after).
    const cell = (id: string) => h.container.querySelector<HTMLElement>(`[data-canvas-region=reference] [data-canvas-cell=${id}]`)!;
    expect(cell("real-time-summary").style.getPropertyValue("--canvas-enter-delay")).toBe("0ms");
    expect(cell("journey-summary").style.getPropertyValue("--canvas-enter-delay")).toBe("60ms");
    expect(cell("real-time-summary").querySelector(".animate-in")).not.toBeNull();
  });
});
