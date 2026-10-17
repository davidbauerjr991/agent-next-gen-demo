// @vitest-environment jsdom
// P-EXTRACT, Bug 1: Log Outcome opened twice. The open flag was page state
// keyed by `${cardId}:${threadKey}` plus the kind of trigger, so two session
// rows of the same kind showing the same thread both opened: under AI display
// "main" the panel header's row and a second row kept mounted, hidden, in the
// main column. One popover opens per click, and under "main" the panel
// header's row is the only session row (k5 B). The popover's position is in
// e2e/outcome-popover-position.spec.ts.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import type { EntityId, Interaction, InteractionId, JourneyId } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiDisplayLocation } from "@/settings/settings-schema";

const h = createWorkspaceHarness();
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const panel = () => h.container.querySelector("[data-slot=right-panel]")!;
const panelShows = () => (panel()?.getAttribute("data-open") === "true" ? panel().getAttribute("data-thread") : null);
const mainColumn = () => h.container.querySelector("[data-main-thread]")!;
const headerIcon = (label: string) =>
  h.container.querySelector<HTMLElement>(`[aria-label="Open ${label} preview"], [aria-label="Close ${label} preview"]`);
const buttonText = (root: ParentNode, text: string | RegExp) =>
  [...root.querySelectorAll<HTMLElement>("button")].find((b) => (typeof text === "string" ? b.textContent?.trim() === text : text.test(b.textContent?.trim() ?? "")));
/** A session row's Outcome trigger: labelled "Outcome" (the nav row's is icon-only). */
const sessionRowOutcomes = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('button[aria-label="Outcome"]')].filter((b) => b.textContent?.trim() === "Outcome");
/** Open Outcome popovers: popper wrappers holding the "Log Outcome" form. */
const hover = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(400);
  });
const escape = () =>
  act(async () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
  });
const openOutcomePopovers = () =>
  [...document.body.querySelectorAll("[data-radix-popper-content-wrapper]")].filter((w) => w.textContent?.includes("Log Outcome"));

async function setUp(ai: AiDisplayLocation) {
  await act(async () => {
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
    getSettingsStore().update("ai", { displayLocation: ai });
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
}

async function snapshot() {
  let result: Interaction[] = [];
  await act(async () => {
    const s = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    result = (await s).interactions;
  });
  return result;
}

async function dial(channel: Interaction["channel"], address: string, journeyId?: string) {
  let id = "" as InteractionId;
  await act(async () => {
    const dialed = h.provider.dial({
      channel,
      address,
      skillId: "general",
      entityId: priya.id as EntityId,
      contactName: priya.name,
      ...(journeyId ? { journeyId: journeyId as JourneyId } : {}),
    });
    await vi.advanceTimersByTimeAsync(300);
    id = await dialed;
  });
  return (await snapshot()).find((i) => i.id === id)!.journeyId;
}

async function acceptCall(address: string, name: string) {
  await h.startInbound("voice", address, name);
  await h.advance(300);
  await h.click(buttonText(h.navCard(name).closest("aside")!, "Accept") ?? buttonText(h.container, "Accept")!);
  await h.advance(800);
}

// `it.fails`: fails on HEAD (the bug); P-EXTRACT C3 flips these to `it`.
describe("Bug 1: one Outcome popover per click", () => {
  it.fails("AI display main, a call: the panel row's Outcome opens one popover", async () => {
    await setUp("main");
    await acceptCall("(312) 555-0164", "Lauren Briggs");
    expect(panelShows()).toBe("voice");
    const [outcome] = sessionRowOutcomes(panel().querySelector("[data-slot=panel-session-row]")!);
    await h.click(outcome);
    expect(openOutcomePopovers()).toHaveLength(1);
  });

  it.fails("AI display main, two emails, the panel on each in turn: one popover each time", async () => {
    await setUp("main");
    const journey = await dial("email", priya.emailAddress!);
    await dial("email", "priya.second@example.com", journey);
    await h.click(h.navCard(priya.name));
    if (panelShows() !== "email") await h.click(headerIcon("Email")!);
    for (let pick = 0; pick < 2; pick += 1) {
      if (pick === 1) {
        // The email icon's thread menu lists both; the other one goes into the panel.
        await hover(h.container.querySelector("[data-channel-icon=email]")!);
        const rows = [...document.body.querySelectorAll<HTMLElement>("[data-slot=channel-thread-menu] [role=menuitem]")];
        expect(rows).toHaveLength(2);
        await h.click(rows.find((r) => !r.textContent?.includes("Current"))!);
      }
      expect(panelShows()).toBe("email");
      const [outcome] = sessionRowOutcomes(panel().querySelector("[data-slot=panel-session-row]")!);
      await h.click(outcome);
      expect(openOutcomePopovers(), `email ${pick + 1}`).toHaveLength(1);
      await escape();
    }
  });

  it("AI display inline, a call: the nav row's Outcome, with the session row showing, opens one popover", async () => {
    await setUp("inline");
    await acceptCall("(312) 555-0164", "Lauren Briggs");
    await h.click(h.navCard("Lauren Briggs"));
    expect(sessionRowOutcomes(mainColumn())).toHaveLength(1);
    const navOutcome = h.navCard("Lauren Briggs").closest("aside")!.querySelector<HTMLElement>('button[aria-label="Outcome"]')!;
    await h.click(navOutcome);
    expect(openOutcomePopovers()).toHaveLength(1);
  });
});

describe("Bug 1: which session rows exist", () => {
  it.fails("AI display main, a call: none in the main column (visible or hidden), one in the panel header", async () => {
    await setUp("main");
    await acceptCall("(312) 555-0164", "Lauren Briggs");
    expect(sessionRowOutcomes(mainColumn())).toHaveLength(0);
    expect(sessionRowOutcomes(panel().querySelector("[data-slot=panel-session-row]")!)).toHaveLength(1);
  });

  it("AI display inline, a call: one in the main column", async () => {
    await setUp("inline");
    await acceptCall("(312) 555-0164", "Lauren Briggs");
    await h.click(h.navCard("Lauren Briggs"));
    expect(sessionRowOutcomes(mainColumn())).toHaveLength(1);
  });
});
