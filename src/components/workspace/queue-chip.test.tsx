// @vitest-environment jsdom
// "My Assignment Queue: n" (P-HOME-1n): a Tag pill whose variant is the queue's severity, on Home's page header. It
// shows or hides the assignments list where it is (the nav, or the interior panel). Its app-header switcher, for
// placement "none", went with that placement (P-LAYOUT-F1 B).
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

  it("in the interior panel placement: the chip on Home's header shows and hides the panel, not the nav", async () => {
    await act(async () => {
      getSettingsStore().update("assignments", { placement: "interiorPanel" });
    });
    await twoChats();
    const toggle = () => h.container.querySelector<HTMLElement>("[aria-controls=assignments-panel]")!;
    expect(chips()).toHaveLength(1);
    expect(inAppHeader(chips()[0])).toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    await h.click(chips()[0]);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(h.container.querySelector('aside button[aria-label="Collapse sidebar"]')).toBeNull();
    await h.click(chips()[0]);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });
});
