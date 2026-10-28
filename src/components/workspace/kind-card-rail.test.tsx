// @vitest-environment jsdom
// Kind cards are rail cards like any other (P-HOME-1m): a schedule item opened
// from Activity sorts in Custom order and drags like a conversation card, and
// sits in the same Collapse all / accordion state (only the active card open
// when collapsed, whichever kind it is), kept across the nav collapse.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { withPersonaSections } from "@/settings/persona";
import { resetAssignmentsWorkingStateForTests } from "@/contact-handling/assignments-working-state";

const h = createWorkspaceHarness({ schedule: true });
const TRAINING = "schedule:agent-tr-ret13";

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetAssignmentsWorkingStateForTests();
  const store = getSettingsStore();
  store.update("home", { sections: withPersonaSections(store.getState().values.home.sections, "agent") });
  store.update("channels", { chat: true });
  h.setUp();
  vi.setSystemTime(new Date(2026, 9, 24, 10, 30));
});

afterEach(async () => {
  await h.tearDown();
});

const store = () => getSettingsStore();
const feed = () => h.container.querySelector<HTMLElement>("[data-activity-feed]");
const rowNamed = (text: string) => [...(feed()?.querySelectorAll<HTMLElement>("[data-feed-row]") ?? [])].find((r) => r.textContent?.includes(text));
const cardEls = () => [...h.container.querySelectorAll<HTMLElement>("aside [data-slot=assignment-card]")];
const cardKeys = () => cardEls().map((el) => el.getAttribute("data-reorder-key"));
const card = (key: string) => cardEls().find((el) => el.getAttribute("data-reorder-key") === key)!;
const homeButton = () => [...h.container.querySelectorAll("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!;
/** Whether a card's channel list is open: its chevron reads "Collapse channels" while open. */
const isOpen = (el: HTMLElement) => !!el.querySelector('[title="Collapse channels"], [aria-label="Collapse channels"]');
const isClosed = (el: HTMLElement) => !!el.querySelector('[title="Expand channels"], [aria-label="Expand channels"]');
const bulk = () => h.container.querySelector<HTMLElement>('aside [aria-label="Collapse all"], aside [aria-label="Expand all"]')!;

/** Two chats, then the RET-1.3 training opened from Activity (its preview's Open): three cards, the training active. */
async function chatsAndTraining() {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  for (const [address, name] of [
    ["ana@example.com", "Ana Ruiz"],
    ["ben@example.com", "Ben Ito"],
  ]) {
    await h.accept(await h.startInbound("chat", address, name));
    await h.advance(1000);
  }
  await h.click(homeButton());
  await h.advance(100);
  await h.click(rowNamed("RET-1.3 refund policy update")!);
  await h.click(document.querySelector<HTMLElement>("[data-home-detail=item] [data-preview-open]")!);
  await h.advance(100);
  expect(cardKeys()).toContain(TRAINING);
}

async function move(key: string, arrow: "ArrowUp" | "ArrowDown") {
  await act(async () => {
    card(key).dispatchEvent(new KeyboardEvent("keydown", { key: arrow, ctrlKey: true, shiftKey: true, bubbles: true }));
    await vi.advanceTimersByTimeAsync(50);
  });
}

describe("kind cards in the rail's Custom order", () => {
  it("a kind card is a drag target like a conversation card: moving it switches to Custom, and the order persists", async () => {
    await chatsAndTraining();
    // Not Custom yet: the conversations by their sort, then the kind card.
    const before = cardKeys();
    expect(before[before.length - 1]).toBe(TRAINING);
    await move(TRAINING, "ArrowUp");
    const moved = cardKeys();
    expect(moved.indexOf(TRAINING)).toBe(moved.length - 2);
    expect(store().getState().values.assignments.sort.mode).toBe("custom");
    // Kept per browser, with the kind card's key among the conversations'.
    expect(localStorage.getItem("agent-next-gen:working:assignments")).toContain(TRAINING);
    await move(TRAINING, "ArrowUp");
    expect(cardKeys()[0]).toBe(TRAINING);
    const order = cardKeys();
    // It persists: the nav collapsed to the rail and back keeps it.
    const toggleNav = () => h.container.querySelector<HTMLElement>('aside [aria-label="Collapse sidebar"], aside [aria-label="Expand sidebar"]')!;
    await h.click(toggleNav());
    await h.click(toggleNav());
    expect(cardKeys()).toEqual(order);
  });
});

describe("kind cards in Collapse all and the accordion rule", () => {
  it("Collapse all with a kind card and conversation cards open leaves only the active one open, whichever kind it is; it holds across the nav collapse", async () => {
    await chatsAndTraining();
    const named = (name: string) => cardEls().find((el) => el.textContent?.includes(name))!;
    // The training is active: Collapse all leaves it open and closes both conversations.
    await h.click(bulk());
    expect(isOpen(card(TRAINING))).toBe(true);
    expect(cardEls().filter((el) => el !== card(TRAINING)).every(isClosed)).toBe(true);
    expect(bulk().getAttribute("aria-label")).toBe("Expand all");

    // A conversation becomes active: it opens and the kind card closes.
    await h.click(h.navCard("Ana Ruiz"));
    expect(isOpen(named("Ana Ruiz"))).toBe(true);
    expect(isClosed(card(TRAINING))).toBe(true);
    expect(cardEls().filter(isOpen)).toHaveLength(1);

    // The nav collapsed to the rail and back keeps it.
    const toggleNav = () => h.container.querySelector<HTMLElement>('aside [aria-label="Collapse sidebar"], aside [aria-label="Expand sidebar"]')!;
    await h.click(toggleNav());
    await h.click(toggleNav());
    expect(cardEls().filter(isOpen)).toHaveLength(1);
    expect(isClosed(card(TRAINING))).toBe(true);
    // And the placement swap leftNav → interior panel → leftNav.
    const panelCards = () => [...h.container.querySelectorAll<HTMLElement>("[data-slot=assignments-panel] [data-slot=assignment-card]")];
    await act(async () => {
      store().update("assignments", { placement: "interiorPanel" });
    });
    expect(panelCards().filter(isOpen)).toHaveLength(1);
    expect(isClosed(panelCards().find((el) => el.getAttribute("data-reorder-key") === TRAINING)!)).toBe(true);
    await act(async () => {
      store().update("assignments", { placement: "leftNav" });
    });
    expect(cardEls().filter(isOpen)).toHaveLength(1);
    expect(isClosed(card(TRAINING))).toBe(true);

    // Expand all opens every card, the kind card too.
    await h.click(bulk());
    expect(cardEls().every(isOpen)).toBe(true);
  });
});
