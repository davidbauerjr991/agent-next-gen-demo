// @vitest-environment jsdom
// "My Assignment Queue: n" (P-HOME-1n): a Tag pill whose variant is the queue's severity; on Home's page header in
// the left-nav and interior-panel slots; with the assignments at the top of Home, in the app header on every page,
// opening a menu of Home and every open assignment that switches between them.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withPersonaSections } from "@/settings/persona";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { resetAssignmentsWorkingStateForTests } from "@/contact-handling/assignments-working-state";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";

const h = createWorkspaceHarness({ schedule: true });

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

const chips = () => [...h.container.querySelectorAll<HTMLElement>("[data-slot=queue-chip]")];
const inAppHeader = (el: HTMLElement) => !!el.closest("header");
const homeButton = () => [...h.container.querySelectorAll<HTMLElement>("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!;
const menuRows = () => [...document.querySelectorAll<HTMLElement>("[role=menu] [role=menuitem], [role=menu] button")];
const pillTone = (chip: HTMLElement) => ["critical", "warning", "success"].find((v) => chip.querySelector(`.bg-lyra-status-${v}-subtle`));
const feedRow = (text: string) => [...h.container.querySelectorAll<HTMLElement>("[data-activity-feed] [data-feed-row]")].find((r) => r.textContent?.includes(text));

async function twoChats() {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  for (const [address, name] of [
    ["ana@example.com", "Ana Ruiz"],
    ["ben@example.com", "Ben Ito"],
  ]) {
    await h.accept(await h.startInbound("chat", address, name));
    await h.advance(1000);
  }
}

describe("My Assignment Queue chip (P-HOME-1n)", () => {
  it("in the left nav placement: one chip, on Home's header; a success pill when empty, a warning pill while assignments are open", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(chips()).toHaveLength(1);
    expect(chips()[0].textContent).toContain("My Assignment Queue: Empty");
    expect(pillTone(chips()[0])).toBe("success");
    await twoChats();
    await h.click(homeButton());
    expect(chips()).toHaveLength(1);
    expect(inAppHeader(chips()[0])).toBe(false);
    expect(chips()[0].textContent).toContain("My Assignment Queue: 2");
    expect(pillTone(chips()[0])).toBe("warning");
    expect(chips()[0].getAttribute("aria-haspopup")).toBeNull();
  });

  it("placement none: the chip is in the app header on Home and on an assignment; its menu lists Home and every card, a kind card too, and switches", async () => {
    await act(async () => {
      getSettingsStore().update("assignments", { placement: "none" });
    });
    await twoChats();
    // A training opened from Activity: a kind card in the one card list.
    await h.click(homeButton());
    await h.advance(100);
    await h.click(feedRow("RET-1.3 refund policy update")!);
    await h.click(document.querySelector<HTMLElement>("[data-home-detail=item] [data-preview-open]")!);
    await h.advance(100);
    // On an assignment (the training): the app header's chip, no other.
    expect(chips()).toHaveLength(1);
    expect(inAppHeader(chips()[0])).toBe(true);
    await h.click(chips()[0]);
    const labels = menuRows().map((r) => r.textContent ?? "");
    expect(labels[0]).toContain("Home");
    expect(labels.filter((l) => /Ana Ruiz|Ben Ito/.test(l))).toHaveLength(2);
    expect(labels.some((l) => l.includes("Training"))).toBe(true);

    await h.click(menuRows().find((r) => r.textContent?.includes("Ana Ruiz"))!);
    await h.advance(300);
    expect(h.container.querySelector("[data-slot=record-header]")?.textContent).toContain("Ana Ruiz");

    // Home goes back: the stack at the top of Home, the chip still in the app header.
    await h.click(chips()[0]);
    await h.click(menuRows().find((r) => r.textContent?.includes("Home"))!);
    await h.advance(300);
    expect(h.container.querySelector("[data-slot=record-header]")).toBeNull();
    expect(h.container.querySelector("[data-slot=assignments-stack][data-mount=homeTop]")).not.toBeNull();
    expect(chips()).toHaveLength(1);
    expect(inAppHeader(chips()[0])).toBe(true);
  });
});
