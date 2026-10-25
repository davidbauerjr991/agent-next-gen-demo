// @vitest-environment jsdom
// The Activity Home (P-HOME-1): the feed as a Home section in both layouts,
// fed by the stub schedule source; opening a scheduled row moves it off the
// feed into History.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";

const h = createWorkspaceHarness({ schedule: true });

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
const rowTitles = (title: string) =>
  [...(group(title)?.querySelectorAll("[data-feed-row]") ?? [])].map((r) => r.querySelector("[class*=emphasis], strong, b")?.textContent ?? r.textContent ?? "");
const rowNamed = (text: string) => [...feed().querySelectorAll<HTMLElement>("[data-feed-row]")].find((r) => r.textContent?.includes(text));
const chip = (label: string) => [...feed().querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim().startsWith(label));
const homeButton = () => [...h.container.querySelectorAll("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!;
const sectionsIn =(scope: Element) => [...scope.querySelectorAll(":scope > [data-home-section], :scope > * > [data-home-section]")].map((el) => el.getAttribute("data-home-section"));

describe("Activity feed on Home", () => {
  it("oneColumn: the feed is a container row in its stored position, grouped Today / This week", async () => {
    await showHome();
    expect(h.container.querySelector("[data-home-layout]")?.getAttribute("data-home-layout")).toBe("oneColumn");
    const order = [...h.container.querySelectorAll("[data-home-section]")].map((el) => el.getAttribute("data-home-section"));
    expect(order).toEqual(["queue", "contactHistory", "performance productivity", "activity", "reminders"]);
    expect(group("Today")?.textContent).toContain("Callback · Priya Shah");
    expect(group("This week")?.textContent).toContain("1:1 with Dana (supervisor)");
    expect(group("Needs a decision")).toBeNull();
    expect(h.container.querySelector("[data-welcome-counts]")).toBeNull();
    expect(rowTitles("Today").length).toBe(5);
  });

  it("twoColumn: the welcome counts, the feed as the main column and the other sections stacked right in order", async () => {
    await showHome();
    await setLayout("twoColumn");
    const home = h.container.querySelector("[data-home-layout=twoColumn]")!;
    expect(home.querySelector("[data-home-section=activity] [data-activity-feed]")).not.toBeNull();
    const side = home.querySelector("[data-home-column=side]")!;
    expect(sectionsIn(side)).toEqual(["queue", "contactHistory", "performance", "productivity", "reminders"]);
    expect(h.container.querySelector("[data-welcome-counts]")?.textContent).toBe(
      "0 to decide · 0 now · 5 more today · 3 this week · 2 in history",
    );
  });

  it("opening a scheduled row moves it off the feed; the History chip lists it; chips stack", async () => {
    await showHome();
    await h.click(rowNamed("Returns team stand-up")!);
    // It opened as the active assignment; back on Home it has left the feed.
    await h.click(homeButton());
    expect(rowNamed("Returns team stand-up")).toBeUndefined();

    await h.click(chip("History")!);
    expect(group("Today")).toBeNull();
    expect(group("History · left the feed today")?.textContent).toContain("Returns team stand-up");
    expect(group("History · left the feed today")?.textContent).toContain("Omar Farooq · Email · Sales");

    await h.click(chip("Assignments")!);
    expect(group("Today")?.textContent).toContain("Callback · Priya Shah");
    expect(group("History · left the feed today")).not.toBeNull();

    await h.click(chip("All")!);
    expect(group("History · left the feed today")).toBeNull();
    expect(getSettingsStore().getState().values.home.layout).toBe("oneColumn");
  });

  it("a ringing offer pins to Needs a decision; its row accepts it", async () => {
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
