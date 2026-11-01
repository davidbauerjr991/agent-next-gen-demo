// @vitest-environment jsdom
// P-LAYOUT-F2 8: a nav card isn't in a ClockTick any more. Its timer text ticks on its own (`ElapsedSince`) and the
// card re-renders when a colour tier changes (`cardTimeTiers`): the timer keeps counting, and the row's colour still
// escalates as the page clock runs.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { resetAssignmentsWorkingStateForTests } from "@/contact-handling/assignments-working-state";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetAssignmentsWorkingStateForTests();
  getSettingsStore().update("channels", { chat: true });
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

/** The tone of the card's row timer (lyra ChannelRow's severity class), or null with none. */
const rowTone = (card: HTMLElement) =>
  ["critical", "warning", "success"].find((tone) => card.querySelector(`.text-lyra-status-${tone}-strong`)) ?? null;
const cardOf = (name: string) => h.navCard(name).closest<HTMLElement>("[data-slot=assignment-card]") ?? h.navCard(name);

describe("nav card timers on the page clock, with no ClockTick around the card", () => {
  it("an awaiting chat's timer counts each second, and its row turns warning at 5 minutes and critical at 10", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    const id = await h.startInbound("chat", "tia@example.com", "Tia Moss");
    await h.accept(id);
    await h.advance(1000);
    // The customer writes: the row's timer starts (it counts from the customer's last message while awaiting).
    await act(async () => {
      h.customer.message({ interactionId: id, text: "Hi, is anyone there?" });
      await vi.advanceTimersByTimeAsync(1000);
    });
    const card = () => cardOf("Tia Moss");
    // The row's text runs into the timer ("General Support00:01"): match the time alone.
    const time = () => card().textContent?.match(/\d{2}:\d{2}/)?.[0];
    const first = time();
    expect(first).toBeDefined();
    await h.advance(3000);
    expect(time()).not.toBe(first);
    expect(rowTone(card())).toBe("success");
    await h.advance(300_000);
    expect(rowTone(card())).toBe("warning");
    await h.advance(300_000);
    expect(rowTone(card())).toBe("critical");
  });
});
