// @vitest-environment jsdom
// Schedule items as assignments (P-HOME-1): a meeting, training or task row
// opens a minimal per-kind cell and a rail card; saving its placeholder
// outcome completes it into History. A persona switch re-seeds the feed and
// swaps the Home cards.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { withPersonaSections } from "@/settings/persona";

const h = createWorkspaceHarness({ schedule: true });

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  // The agent persona's Home: the Activity feed on (the default Home doesn't have it).
  const store = getSettingsStore();
  store.update("home", { sections: withPersonaSections(store.getState().values.home.sections, "agent") });
  h.setUp();
  vi.setSystemTime(new Date(2026, 9, 24, 10, 30));
});

afterEach(async () => {
  await h.tearDown();
});

async function showHome() {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.advance(100);
}

const feed = () => h.container.querySelector<HTMLElement>("[data-activity-feed]");
const rowNamed = (text: string) => [...(feed()?.querySelectorAll<HTMLElement>("[data-feed-row]") ?? [])].find((r) => r.textContent?.includes(text));
const cell = () => h.container.querySelector<HTMLElement>("[data-kind-cell]");
const button = (label: string) => [...h.container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === label);
const homeButton = () => [...h.container.querySelectorAll("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!;
const view = (label: string) => [...(feed()?.querySelectorAll<HTMLElement>("[data-feed-views] [role=radio]") ?? [])].find((b) => b.textContent?.trim().startsWith(label));

async function type(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
  });
}

describe("schedule items open as assignments", () => {
  it.each([
    ["Returns team stand-up", "meeting", "Agenda"],
    ["RET-1.3 refund policy update", "training", "Module"],
    ["Ticket #4821 · subscription renewal refund", "task", "Ticket #4821"],
  ] as const)("%s opens its %s cell and a rail card, and Save outcome completes it into History", async (title, kind, body) => {
    await showHome();
    await h.click(rowNamed(title)!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe(kind);
    expect(cell()?.textContent).toContain(body);
    expect(h.container.querySelector("[data-kind-outcome]")).not.toBeNull();
    const card = h.container.querySelector("aside [data-kind-nav-card]");
    expect(card).not.toBeNull();
    expect(feed()).toBeNull();

    const note = [...cell()!.querySelectorAll("textarea")][0]!;
    await type(note, "Done for today");
    await h.click(button("Save outcome")!);
    expect(cell()).toBeNull();
    expect(h.container.querySelector("aside [data-kind-nav-card]")).toBeNull();
    // Out of the time groups; in History (the All view shows it) as completed.
    expect(rowNamed(title)?.getAttribute("data-feed-status")).toBe("completed");
    await h.click(view("History")!);
    expect(rowNamed(title)?.getAttribute("data-feed-status")).toBe("completed");
  });

  it("the rail card reopens the cell after going Home", async () => {
    await showHome();
    await h.click(rowNamed("Returns team stand-up")!);
    await h.click(homeButton());
    expect(cell()).toBeNull();
    await h.click(h.container.querySelector("aside [data-kind-nav-card] [role=button], aside [data-kind-nav-card] button")!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("meeting");
  });
});

describe("persona", () => {
  it("switching to Supervisor re-seeds the feed and swaps the Home cards; back to Agent restores them", async () => {
    await showHome();
    expect(rowNamed("Callback · Priya Shah")).toBeDefined();
    expect(h.container.querySelector('[data-home-section="dueSoon"]')).not.toBeNull();

    const store = getSettingsStore();
    await act(async () => {
      store.updateMany({ workspace: { persona: "supervisor" }, home: { sections: withPersonaSections(store.getState().values.home.sections, "supervisor") } });
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(rowNamed("Callback · Priya Shah")).toBeUndefined();
    expect(rowNamed("Coaching · John Smith")).toBeDefined();
    expect(feed()?.textContent).toContain("Escalation · Lauren Briggs · Voice");
    const sections = [...h.container.querySelectorAll("[data-home-section]")].map((el) => el.getAttribute("data-home-section"));
    expect(sections).toEqual(["activity", "teamQueues", "teamToday", "needsYou"]);
    expect(h.container.querySelector('[data-home-card="teamToday"]')?.textContent).toContain("78%");

    await act(async () => {
      store.updateMany({ workspace: { persona: "agent" }, home: { sections: withPersonaSections(store.getState().values.home.sections, "agent") } });
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(rowNamed("Callback · Priya Shah")).toBeDefined();
    expect(h.container.querySelector('[data-home-section="dueSoon"]')).not.toBeNull();
  });
});
