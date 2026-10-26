// @vitest-environment jsdom
// The Activity Home (P-HOME-1, 1b): the feed as a Home section in both
// layouts, fed by the stub schedule source; the kind chips and the
// All · Assignments · History chips; History is Contact History's entries in
// its range plus what left the feed, and a History row opens Contact
// History's preview; Due soon opens its items like the feed does.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import type { HomeSectionKey } from "@/settings/settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { TOM_LEWIS_SCRIPT } from "@/scenarios";

const h = createWorkspaceHarness({ schedule: true });

/** The feed (and any other sections named) on: the default Home has neither. */
function turnOn(...keys: HomeSectionKey[]) {
  getSettingsStore().update("home", (prev) => ({
    sections: prev.sections.map((s) => (s.key === "activity" || keys.includes(s.key) ? { ...s, enabled: true } : s)),
  }));
}

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
  vi.setSystemTime(new Date(2026, 9, 24, 10, 30));
});

afterEach(async () => {
  await h.tearDown();
});

/** Shows the workspace and lets the persona's day arrive from the schedule source. */
async function showHome() {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.advance(100);
}

async function setLayout(layout: "oneColumn" | "twoColumn") {
  await act(async () => {
    getSettingsStore().update("home", { layout });
    await vi.advanceTimersByTimeAsync(50);
  });
}

const feed = () => h.container.querySelector<HTMLElement>("[data-activity-feed]")!;
const group = (title: string) => feed().querySelector<HTMLElement>(`[data-feed-group="${title}"]`);
const rows = (title: string) => [...(group(title)?.querySelectorAll<HTMLElement>("[data-feed-row]") ?? [])];
const rowNamed = (text: string) => [...feed().querySelectorAll<HTMLElement>("[data-feed-row]")].find((r) => r.textContent?.includes(text));
const chip = (label: string) => [...feed().querySelectorAll<HTMLButtonElement>("[data-feed-chips] button")].find((b) => b.textContent?.trim().startsWith(label));
const kindChip = (label: string) => [...feed().querySelectorAll<HTMLButtonElement>("[data-feed-kinds] button")].find((b) => b.textContent?.trim() === label);
const homeButton = () => [...h.container.querySelectorAll("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!;
const sectionsIn = (scope: Element) => [...scope.querySelectorAll(":scope > [data-home-section], :scope > * > [data-home-section]")].map((el) => el.getAttribute("data-home-section"));

describe("Activity feed on Home", () => {
  it("oneColumn: the feed is a container row in its stored position, grouped Today / This week", async () => {
    turnOn();
    await showHome();
    expect(h.container.querySelector("[data-home-layout]")?.getAttribute("data-home-layout")).toBe("oneColumn");
    const order = [...h.container.querySelectorAll("[data-home-section]")].map((el) => el.getAttribute("data-home-section"));
    expect(order).toEqual(["queue", "contactHistory", "performance", "activity"]);
    expect(group("Today")?.textContent).toContain("Callback · Priya Shah");
    expect(group("This week")?.textContent).toContain("1:1 with Dana (supervisor)");
    expect(group("Needs a decision")).toBeNull();
    expect(h.container.querySelector("[data-welcome-counts]")).toBeNull();
    expect(rows("Today").length).toBe(5);
  });

  it("twoColumn: the welcome counts, the feed as the main column, the other sections stacked right in order — Due soon only in one column", async () => {
    turnOn("dueSoon");
    await showHome();
    expect(h.container.querySelector('[data-home-section="dueSoon"]')).not.toBeNull();
    await setLayout("twoColumn");
    const home = h.container.querySelector("[data-home-layout=twoColumn]")!;
    expect(home.querySelector("[data-home-section=activity] [data-activity-feed]")).not.toBeNull();
    const side = home.querySelector("[data-home-column=side]")!;
    expect(sectionsIn(side)).toEqual(["queue", "contactHistory", "performance"]);
    expect(h.container.querySelector("[data-welcome-counts]")?.textContent).toBe(
      "0 to decide · 0 now · 5 more today · 3 this week · 2 in history",
    );
  });

  it("the chips are selectable Tags: opening a scheduled row moves it off the feed; History lists it; chips stack; All clears", async () => {
    turnOn();
    await showHome();
    expect(chip("All")?.getAttribute("aria-pressed")).toBe("true");
    await h.click(rowNamed("Returns team stand-up")!);
    // It opened as the active assignment; back on Home it has left the feed.
    await h.click(homeButton());
    expect(rowNamed("Returns team stand-up")).toBeUndefined();

    await h.click(chip("History")!);
    expect(chip("History")?.getAttribute("aria-pressed")).toBe("true");
    expect(chip("All")?.getAttribute("aria-pressed")).toBe("false");
    expect(group("Today")).toBeNull();
    expect(group("History")?.textContent).toContain("Returns team stand-up");
    expect(group("History")?.textContent).toContain("Omar Farooq · Email · Sales");

    await h.click(chip("Assignments")!);
    expect(group("Today")?.textContent).toContain("Callback · Priya Shah");
    expect(group("History")).not.toBeNull();

    await h.click(chip("All")!);
    expect(group("History")).toBeNull();
    expect(chip("Assignments")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("the kind chips filter every group, History included; none picked is every kind", async () => {
    turnOn();
    await showHome();
    expect([...feed().querySelectorAll("[data-feed-kinds] button")].map((b) => b.textContent?.trim())).toEqual([
      "Conversation",
      "Callback",
      "Meeting",
      "Training",
      "Task",
    ]);
    await h.click(kindChip("Callback")!);
    expect(kindChip("Callback")?.getAttribute("aria-pressed")).toBe("true");
    expect(rows("Today").map((r) => r.textContent?.includes("Callback")).every(Boolean)).toBe(true);
    await h.click(chip("History")!);
    expect(group("History")?.textContent).not.toContain("Omar Farooq");
    await h.click(kindChip("Conversation")!);
    expect(group("History")?.textContent).toContain("Omar Farooq");
    await h.click(kindChip("Callback")!);
    await h.click(kindChip("Conversation")!);
    expect(rows("Today").length).toBe(0);
    await h.click(chip("Assignments")!);
    expect(rows("Today").length).toBe(5);
  });

  it("History is Contact History's entries in its range: a declined call today; a History row opens Contact History's preview with Redial, hidden when Redial is off", async () => {
    turnOn();
    await showHome();
    await h.play(TOM_LEWIS_SCRIPT.id);
    const decline = [...h.container.querySelectorAll("aside button")].find((b) => b.textContent === "Decline") as HTMLElement;
    await h.click(decline);
    await h.advance(500);
    await h.click(chip("History")!);
    const tom = () => rowNamed("Tom Lewis");
    expect(tom()?.getAttribute("data-feed-status")).toBe("completed");
    // The History group's header carries Contact History's own date control.
    expect(group("History")?.textContent).toContain("Today");
    await h.click(tom()!);
    expect(h.buttonByText("Redial")).toBeTruthy();
    await act(async () => {
      getSettingsStore().update("outbound", (prev) => ({ calling: { ...prev.calling, redial: false } }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(h.buttonByText("Redial")).toBeUndefined();
  });

  it("History's range follows Contact History's date control: Last 48 Hours adds Contact History's earlier contacts", async () => {
    turnOn();
    await showHome();
    await h.click(chip("History")!);
    const before = rows("History").length;
    const trigger = [...group("History")!.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Today"))!;
    await h.click(trigger);
    const option = [...document.querySelectorAll<HTMLElement>("[role=radio]")].find((r) => r.closest("label")?.textContent?.includes("Last 48") || r.getAttribute("aria-label")?.includes("Last 48") || r.parentElement?.textContent?.includes("Last 48"));
    await h.click(option!);
    expect(rows("History").length).toBeGreaterThan(before);
    expect(rows("History").filter((r) => r.getAttribute("data-feed-status") === "completed").length).toBeGreaterThan(2);
  });

  it("Due soon lists the next three scheduled items; a row opens its item like the feed", async () => {
    turnOn("dueSoon");
    await showHome();
    const dueSoon = h.container.querySelector('[data-home-card="dueSoon"]')!;
    expect([...dueSoon.querySelectorAll("[data-due-soon-row]")].map((r) => r.getAttribute("data-due-soon-row"))).toEqual([
      "agent-cb-priya",
      "agent-mt-standup",
      "agent-tr-ret13",
    ]);
    await h.click(dueSoon.querySelector('[data-due-soon-row="agent-mt-standup"]')!);
    expect(h.container.querySelector("[data-kind-cell]")?.getAttribute("data-kind-cell")).toBe("meeting");
  });

  it("a ringing offer pins to Needs a decision; its row accepts it", async () => {
    turnOn();
    await showHome();
    await h.goAvailable();
    await h.startInbound("voice", "+15555550123", "Tom Lewis");
    expect(group("Needs a decision")?.textContent).toContain("Tom Lewis");
    await h.click(group("Needs a decision")!.querySelector("[data-feed-row]")!);
    await h.advance(500);
    // Accepted: the call opens as the active assignment, in the rail.
    expect(h.container.querySelector("[data-activity-feed]")).toBeNull();
    await h.click(homeButton());
    expect(group("Needs a decision")).toBeNull();
    await h.click(chip("History")!);
    const tom = rowNamed("Tom Lewis");
    expect(tom?.getAttribute("data-feed-status")).toBe("inRail");
  });
});
