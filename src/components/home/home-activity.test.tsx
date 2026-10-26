// @vitest-environment jsdom
// The Activity Home (P-HOME-1, 1b): the feed as a Home section in both
// layouts, fed by the stub schedule source; the kind chips and the
// Assignments · History views (1e); History is Contact History's entries in
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
/** A view in the Assignments · History switcher (a radio). */
const view = (label: string) => [...feed().querySelectorAll<HTMLElement>("[data-feed-views] [role=radio]")].find((b) => b.textContent?.trim().startsWith(label));
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

  it("twoColumn: the welcome PageHeader with the counts, the feed as the main column, the other sections stacked right in order — Due soon and Contact History only in one column", async () => {
    turnOn("dueSoon");
    await showHome();
    expect(h.container.querySelector('[data-home-section="dueSoon"]')).not.toBeNull();
    expect(h.container.querySelector('[data-home-section="contactHistory"]')).not.toBeNull();
    await setLayout("twoColumn");
    const home = h.container.querySelector("[data-home-layout=twoColumn]")!;
    expect(home.querySelector("[data-home-section=activity] [data-activity-feed]")).not.toBeNull();
    const side = home.querySelector("[data-home-column=side]")!;
    // Contact History is the feed's History view here, so its card stays out of the right column.
    expect(sectionsIn(side)).toEqual(["queue", "performance"]);
    expect(h.container.querySelector('[data-home-section="contactHistory"]')).toBeNull();
    // The record header's form: lyra PageHeader, the greeting as its title, the counts as its subtitle, the actions beside.
    const header = home.querySelector("[data-home-header] [data-home-page-header]")!;
    expect(header.querySelector("h1")?.textContent).toBe("Hello John");
    expect(header.querySelector("[data-welcome-counts]")?.textContent).toBe("0 to decide · 0 now · 5 more today · 3 this week · 2 in history");
    // Presence is the header's presence menu: no Go Available here. One line under the whole header, as the record header.
    expect(h.buttonByText("Go Available", header)).toBeUndefined();
    expect(header.className).toContain("border-b");
    expect(header.textContent).toContain("My Assignment Queue");
    // The counts don't follow the view.
    await h.click(view("History")!);
    expect(header.querySelector("[data-welcome-counts]")?.textContent).toBe("0 to decide · 0 now · 5 more today · 3 this week · 2 in history");
  });

  it("twoColumn: the welcome header outside the feed's scroll; no toggle while the right column fits; the queue's drill-down opens over the right column, in the feed's row", async () => {
    turnOn();
    await showHome();
    await setLayout("twoColumn");
    const home = h.container.querySelector("[data-home-layout=twoColumn]")!;
    const header = home.querySelector("[data-home-header]")!;
    expect(header.querySelector("[data-welcome-counts]")).not.toBeNull();
    expect(header.closest("[data-home-scroll]")).toBeNull();
    expect(home.querySelector("[data-home-scroll=feed] [data-activity-feed]")).not.toBeNull();
    // Docked (it fits), with nothing to toggle.
    expect(home.querySelector('[data-canvas-region="reference"][data-docked="true"]')).not.toBeNull();
    expect(h.container.querySelector("[data-summaries-toggle]")).toBeNull();

    // The queue: rows, not the stacked tiles.
    const queueCard = home.querySelector('[data-home-card="queueList"]')!;
    expect([...queueCard.querySelectorAll("[data-queue-row]")].map((r) => r.textContent)).toEqual([
      expect.stringContaining("Inbound Voice"),
      expect.stringContaining("Voicemail"),
      expect.stringContaining("Outbound Voice"),
    ]);
    await h.click(queueCard.querySelector('[data-queue-row="2"]')!);
    await h.advance(100);
    // The interaction's slide-over layout: the panel is the feed's row's, over the right column (it widens the
    // column's slot, which pushes the feed) — never Home's docked panel beside the whole dashboard.
    const panel = home.querySelector<HTMLElement>('[data-slot="home-detail-panel"]')!;
    expect(panel).not.toBeNull();
    expect(panel.parentElement).toBe(home.querySelector("[data-home-scroll=feed]")!.parentElement);
    expect(panel.querySelector('[data-home-detail="queue"]')).not.toBeNull();
    expect(h.container.textContent).toContain("Skills");
  });

  it("twoColumn: the right column is the overlay only when it doesn't fit, opened by the header's toggle", async () => {
    turnOn();
    await showHome();
    const rect = Element.prototype.getBoundingClientRect;
    // A narrow row: the feed's minimum plus the card column doesn't fit.
    Element.prototype.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, right: 700, bottom: 1000, width: 700, height: 1000, toJSON: () => ({}) }) as DOMRect;
    try {
      await setLayout("twoColumn");
      const home = h.container.querySelector("[data-home-layout=twoColumn]")!;
      expect(home.querySelector('[data-canvas-region="reference"][data-docked="true"]')).toBeNull();
      const toggle = home.querySelector<HTMLElement>("[data-home-header] [data-summaries-toggle]")!;
      expect(toggle.getAttribute("aria-label")).toBe("Cards");
      await h.click(toggle);
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
      expect(document.querySelector('[data-canvas-region="reference"]')?.textContent).toContain("Cards");
    } finally {
      Element.prototype.getBoundingClientRect = rect;
    }
  });

  it("the view switcher is Assignments | History (one always selected, Assignments by default): opening a scheduled row moves it off the feed into History", async () => {
    turnOn();
    await showHome();
    expect([...feed().querySelectorAll("[data-feed-views] [role=radio]")].map((b) => b.textContent?.replace(/\d+$/, "").trim())).toEqual([
      "Assignments",
      "History",
    ]);
    expect(view("Assignments")?.getAttribute("aria-checked")).toBe("true");
    expect(group("Today")).not.toBeNull();
    expect(group("History")).toBeNull();
    await h.click(rowNamed("Returns team stand-up")!);
    // It opened as the active assignment; back on Home it has left the time groups for History.
    await h.click(homeButton());
    expect(rows("Today").some((r) => r.textContent?.includes("Returns team stand-up"))).toBe(false);

    await h.click(view("History")!);
    expect(view("History")?.getAttribute("aria-checked")).toBe("true");
    expect(view("Assignments")?.getAttribute("aria-checked")).toBe("false");
    expect(group("Today")).toBeNull();
    expect(group("Needs a decision")).toBeNull();
    expect(group("History")?.textContent).toContain("Returns team stand-up");
    expect(group("History")?.textContent).toContain("Omar Farooq · Email · Sales");

    await h.click(view("Assignments")!);
    expect(group("Today")?.textContent).toContain("Callback · Priya Shah");
    expect(group("History")).toBeNull();
    // Clicking the selected view again keeps it selected.
    await h.click(view("Assignments")!);
    expect(view("Assignments")?.getAttribute("aria-checked")).toBe("true");
  });

  it("the kind chips, below the views, filter whichever view is selected, History included; none picked is every kind", async () => {
    turnOn();
    await showHome();
    const order = [...feed().querySelectorAll("[data-feed-views], [data-feed-kinds]")].map((el) => (el.hasAttribute("data-feed-views") ? "views" : "kinds"));
    expect(order).toEqual(["views", "kinds"]);
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
    await h.click(view("History")!);
    expect(group("History")?.textContent).not.toContain("Omar Farooq");
    await h.click(kindChip("Conversation")!);
    expect(group("History")?.textContent).toContain("Omar Farooq");
    await h.click(kindChip("Callback")!);
    await h.click(kindChip("Conversation")!);
    await h.click(view("Assignments")!);
    expect(rows("Today").length).toBe(5);
  });

  it("History is Contact History's entries in its range: a declined call today; a History row opens Contact History's preview with Redial, hidden when Redial is off", async () => {
    turnOn();
    await showHome();
    await h.play(TOM_LEWIS_SCRIPT.id);
    const decline = [...h.container.querySelectorAll("aside button")].find((b) => b.textContent === "Decline") as HTMLElement;
    await h.click(decline);
    await h.advance(500);
    await h.click(view("History")!);
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

  it("History behaves as Contact History: its search and date controls in the header, a row opens the preview (selected) and closes it again; the kind chips still filter", async () => {
    turnOn();
    await showHome();
    await h.click(view("History")!);
    const controls = group("History")!.querySelector<HTMLElement>("[data-feed-history-controls]")!;
    expect(controls.querySelector("input")?.getAttribute("placeholder")).toBe("Search contact history");
    expect(controls.textContent).toContain("Today");
    await h.click([...controls.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Today"))!);
    await h.click([...document.querySelectorAll<HTMLElement>("[role=radio]")].find((r) => r.parentElement?.textContent?.includes("Last 48"))!);
    const entry = () => rows("History").find((r) => r.getAttribute("data-feed-row")?.startsWith("history:"))!;
    const name = entry().textContent!.split(" · ")[0]!;
    await h.click(entry());
    await h.advance(100);
    expect(entry().getAttribute("data-selected")).toBe("true");
    expect(document.querySelector("[data-home-detail=history]")).not.toBeNull();
    await h.click(entry());
    await h.advance(400);
    expect(entry().getAttribute("data-selected")).toBeNull();

    // The search narrows History (the counts stay the day's).
    const search = controls.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "zzz-no-match");
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(rows("History")).toHaveLength(0);
    expect(group("History")?.textContent).toContain("No matching contacts");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, name.slice(0, 4));
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(rows("History").length).toBeGreaterThan(0);
    // A kind chip with nothing in History empties it.
    await h.click(kindChip("Training")!);
    expect(rows("History")).toHaveLength(0);
  });

  it("History's range follows Contact History's date control: Last 48 Hours adds Contact History's earlier contacts", async () => {
    turnOn();
    await showHome();
    await h.click(view("History")!);
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
    await h.click(view("History")!);
    const tom = rowNamed("Tom Lewis");
    expect(tom?.getAttribute("data-feed-status")).toBe("inRail");
  });
});
