// @vitest-environment jsdom
// The Activity Home (P-HOME-1, 1b): the feed as a Home section in both
// layouts, fed by the stub schedule source; the kind chips and the
// Assignments · History views (1e); History is Contact History's entries in
// its range plus completed items, and a History row opens Contact History's
// preview; an Assignments row opens its own preview, whose primary action
// opens it (1h); the Assignments range; Due soon opens its items.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import type { HomeSectionKey } from "@/settings/settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, TOM_LEWIS_SCRIPT } from "@/scenarios";
import { seedScheduleDay } from "@/adapters/sim/sim-schedule-seeds";

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
/** A kind chip by its label (its unread count, when it has one, follows the label). */
const chipLabel = (b: Element) => b.textContent?.trim().replace(/\d+$/, "");
const kindChip = (label: string) => [...feed().querySelectorAll<HTMLButtonElement>("[data-feed-kinds] button")].find((b) => chipLabel(b) === label);
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
    expect(rows("Today").length).toBe(5);
  });

  it("twoColumn: the welcome PageHeader with oneColumn's subtitle, the feed as the main column, the other sections stacked right in order — Due soon and Contact History only in one column", async () => {
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
    // The record header's form: lyra PageHeader, the greeting as its title, oneColumn's user-name line as its subtitle
    // (the counts are on the view buttons, P-HOME-1h), the actions beside.
    const header = home.querySelector("[data-home-header] [data-home-page-header]")!;
    expect(header.querySelector("h1")?.textContent).toBe("Hello John");
    expect(header.textContent).toContain("User Name:");
    expect(header.textContent).not.toContain("to decide");
    // Presence is the header's presence menu: no Go Available here. One line under the whole header, as the record header.
    expect(h.buttonByText("Go Available", header)).toBeUndefined();
    expect(header.className).toContain("border-b");
    expect(header.textContent).toContain("My Assignment Queue");
  });

  it("twoColumn: the welcome header outside the feed's scroll; no toggle while the right column fits; the queue's drill-down opens over the right column, in the feed's row", async () => {
    turnOn();
    await showHome();
    await setLayout("twoColumn");
    const home = h.container.querySelector("[data-home-layout=twoColumn]")!;
    const header = home.querySelector("[data-home-header]")!;
    expect(header.querySelector("[data-home-page-header]")).not.toBeNull();
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

  it("the view switcher is Assignments | Parked | History (one always selected, Assignments by default): a row previews; its Join opens it, and it stays in the feed marked open", async () => {
    turnOn();
    await showHome();
    expect([...feed().querySelectorAll("[data-feed-views] [role=radio]")].map((b) => b.textContent?.replace(/\d+( new)?$/, "").replace(/\d+$/, "").trim())).toEqual([
      "Assignments",
      "Parked",
      "History",
    ]);
    expect(view("Assignments")?.getAttribute("aria-checked")).toBe("true");
    expect(group("Today")).not.toBeNull();
    expect(group("History")).toBeNull();
    // A row's click previews it in Home's detail panel: title, kind, due, source, the agenda; Start, not yet opened.
    await h.click(rowNamed("Returns team stand-up")!);
    await h.advance(100);
    const preview = () => document.querySelector<HTMLElement>("[data-home-detail=item]");
    expect(preview()?.getAttribute("data-schedule-item")).toBe("agent-mt-standup");
    expect(rowNamed("Returns team stand-up")?.getAttribute("data-selected")).toBe("true");
    expect([...document.querySelectorAll("h2")].some((el) => el.textContent === "Returns team stand-up")).toBe(true);
    expect(preview()!.textContent).toContain("Meeting");
    expect(preview()!.textContent).toContain("Calendar");
    expect(preview()!.textContent).toContain("Refund policy RET-1.3 rollout");
    expect(h.container.querySelector("[data-kind-cell]")).toBeNull();
    // The second click closes it.
    await h.click(rowNamed("Returns team stand-up")!);
    await h.advance(400);
    expect(rowNamed("Returns team stand-up")?.getAttribute("data-selected")).toBeNull();
    await h.click(rowNamed("Returns team stand-up")!);
    // Open (secondary) beside the meeting's own Join (primary, P-HOME-1i); Join joins and opens it.
    expect(h.buttonByText("Open", preview()!)).toBeTruthy();
    await h.click(h.buttonByText("Join", preview()!)!);
    expect(h.container.querySelector("[data-kind-started]")?.textContent).toBe("Joined");
    // It opened as the active assignment; back on Home it stays in its time group, marked open (P-HOME-1m), not in
    // History; its row goes to its card.
    expect(h.container.querySelector("[data-kind-cell]")?.getAttribute("data-kind-cell")).toBe("meeting");
    await h.click(homeButton());
    const open = rows("Today").find((r) => r.textContent?.includes("Returns team stand-up"))!;
    expect(open.getAttribute("data-feed-status")).toBe("inRail");
    expect(open.textContent).toContain("Open");
    expect(open.querySelector("[data-feed-action]")).toBeNull();
    await h.click(open);
    expect(h.container.querySelector("[data-kind-cell]")?.getAttribute("data-kind-cell")).toBe("meeting");
    await h.click(homeButton());

    await h.click(view("History")!);
    expect(view("History")?.getAttribute("aria-checked")).toBe("true");
    expect(view("Assignments")?.getAttribute("aria-checked")).toBe("false");
    expect(group("Today")).toBeNull();
    expect(group("Needs a decision")).toBeNull();
    expect(group("History")?.textContent).not.toContain("Returns team stand-up");

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
    expect([...feed().querySelectorAll("[data-feed-kinds] button")].map(chipLabel)).toEqual([
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
    // Contact History's earlier contacts (Last 48 Hours) are conversations.
    await h.click([...group("History")!.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Today"))!);
    await h.click([...document.querySelectorAll<HTMLElement>("[role=radio]")].find((r) => r.parentElement?.textContent?.includes("Last 48"))!);
    expect(rows("History")).toHaveLength(0);
    await h.click(kindChip("Conversation")!);
    expect(rows("History").length).toBeGreaterThan(0);
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
    expect(rows("History").every((r) => r.getAttribute("data-feed-status") === "completed")).toBe(true);
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

  it("a ringing offer pins to Needs a decision; its row previews it with Accept and Decline; Accept accepts it", async () => {
    turnOn();
    await showHome();
    await h.goAvailable();
    await h.startInbound("voice", "+15555550123", "Tom Lewis");
    expect(group("Needs a decision")?.textContent).toContain("Tom Lewis");
    await h.click(group("Needs a decision")!.querySelector("[data-feed-row]")!);
    await h.advance(100);
    const preview = document.querySelector<HTMLElement>("[data-home-detail=offer]")!;
    expect(h.buttonByText("Decline", preview)).toBeTruthy();
    await h.click(h.buttonByText("Accept", preview)!);
    await h.advance(500);
    // Accepted: the call opens as the active assignment, in the rail.
    expect(h.container.querySelector("[data-activity-feed]")).toBeNull();
    await h.click(homeButton());
    expect(group("Needs a decision")).toBeNull();
  });

  it("an offered schedule item (the supervisor's escalation) previews with Accept and Decline; Decline takes it off the feed", async () => {
    turnOn();
    await act(async () => {
      getSettingsStore().update("workspace", { persona: "supervisor" });
      await vi.advanceTimersByTimeAsync(50);
    });
    await showHome();
    expect(group("Needs a decision")?.textContent).toContain("Lauren Briggs");
    await h.click(group("Needs a decision")!.querySelector("[data-feed-row]")!);
    await h.advance(100);
    const preview = document.querySelector<HTMLElement>("[data-home-detail=item]")!;
    expect(h.buttonByText("Accept", preview)).toBeTruthy();
    await h.click(h.buttonByText("Decline", preview)!);
    await h.advance(500);
    expect(group("Needs a decision")).toBeNull();
  });

  it("no date control on Assignments or Parked (P-HOME-1m): nearest first, Later (past the week) collapsed until opened; no kebab beside any filter", async () => {
    turnOn();
    await showHome();
    expect(feed().querySelector("[data-feed-range]")).toBeNull();
    const later = () => group("Later")!;
    expect(later().getAttribute("data-expanded")).toBe("false");
    expect(later().textContent).toContain("Later · 1");
    expect(later().querySelector("[data-feed-row]")).toBeNull();
    await h.click(later().querySelector<HTMLElement>("button[aria-expanded]")!);
    expect(later().querySelector("[data-feed-row]")?.textContent).toContain("Q4 compliance refresher");
    expect(view("Assignments")?.textContent).toMatch(/^Assignments9/);
    await h.click(view("Parked")!);
    expect(feed().querySelector("[data-feed-range]")).toBeNull();
    // History keeps its date control, with no kebab.
    await h.click(view("History")!);
    const controls = group("History")!.querySelector<HTMLElement>("[data-feed-history-controls]")!;
    expect(controls.textContent).toContain("Today");
    expect(feed().querySelector(".lyra-container-header-filter-compact")).toBeNull();
  });

  it("unread (P-HOME-1m): the seeded day loads read; an item that comes due afterwards is unread (tinted, with a dot, counted on Assignments and its chip); a preview reads it, across view switches", async () => {
    turnOn();
    await showHome();
    const unread = () => feed().querySelector("[data-feed-views] [data-feed-unread]")?.textContent;
    const row = () => rowNamed("Callback · Priya Shah")!;
    expect(feed().querySelectorAll("[data-unread]")).toHaveLength(0);
    expect(unread()).toBeUndefined();
    // Priya's callback comes due (30 minutes in): it arrived since the agent last looked.
    await h.advance(31 * 60_000);
    expect(row().getAttribute("data-unread")).toBe("true");
    expect(row().className).toContain("bg-lyra-state-hover");
    expect(unread()).toBe("1 new");
    expect(kindChip("Callback")?.textContent?.trim()).toBe("Callback1");
    await h.click(row());
    await h.advance(100);
    expect(row().getAttribute("data-unread")).toBeNull();
    expect(unread()).toBeUndefined();
    // Still read after a round trip through the other views.
    await h.click(view("Parked")!);
    await h.click(view("History")!);
    await h.click(view("Assignments")!);
    expect(row().getAttribute("data-unread")).toBeNull();
  });

  it("a new assignment arriving while the agent isn't on it raises Home's banner above Needs a decision; several stack as a count; View opens it; X dismisses", async () => {
    turnOn();
    await showHome();
    await h.goAvailable();
    const banner = () => feed().querySelector<HTMLElement>("[data-feed-arrivals]");
    expect(banner()).toBeNull();
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.advance(500);
    expect(banner()?.textContent).toContain("New assignment · Lucas Thomas · Chat");
    expect(feed().firstElementChild).toBe(banner());
    await h.play(MARCUS_WEBB_SCRIPT.id);
    await h.advance(500);
    expect(banner()?.getAttribute("data-feed-arrivals")).toBe("2");
    expect(banner()?.textContent).toContain("2 new assignments");
    // View opens the newest (Marcus); Lucas stays in the banner.
    await h.click([...banner()!.querySelectorAll<HTMLElement>("a, button")].find((b) => b.textContent?.trim() === "View")!);
    expect(h.container.querySelector("[data-activity-feed]")).toBeNull();
    await h.click(homeButton());
    expect(banner()?.textContent).toContain("New assignment · Lucas Thomas");
    await h.click(banner()!.querySelector<HTMLElement>('button[aria-label^="Dismiss"]')!);
    expect(banner()).toBeNull();
  });

  it("an offer that arrives after load is unread (tinted, with the dot) in Needs a decision", async () => {
    turnOn();
    await showHome();
    await h.goAvailable();
    await h.startInbound("voice", "+15555550123", "Tom Lewis");
    const offer = group("Needs a decision")!.querySelector<HTMLElement>("[data-feed-row]")!;
    expect(offer.getAttribute("data-unread")).toBe("true");
    expect(offer.className).toContain("bg-lyra-state-hover");
  });

  it("an item the schedule source adds after load is unread in its time group, counted (badge 1), and raises the arrival banner; View opens its row's preview", async () => {
    turnOn();
    await showHome();
    const [template] = seedScheduleDay("agent", Date.now());
    await act(async () => {
      const added = h.schedule!.add({ ...template!, id: "added-callback", title: "Callback · Ana Lopez", customer: { name: "Ana Lopez" }, dueAt: Date.now() + 45 * 60_000 });
      await vi.advanceTimersByTimeAsync(50);
      await added;
    });
    const row = rowNamed("Callback · Ana Lopez")!;
    expect(row.getAttribute("data-unread")).toBe("true");
    expect(feed().querySelector("[data-feed-views] [data-feed-unread]")?.textContent).toBe("1 new");
    const banner = feed().querySelector<HTMLElement>("[data-feed-arrivals]")!;
    expect(banner.textContent).toContain("New assignment · Ana Lopez · Callback");
    // Due in 45 minutes: Today's (there is no Now group).
    expect(row.closest("[data-feed-group]")?.getAttribute("data-feed-group")).toBe("Today");
    await h.click([...banner.querySelectorAll<HTMLElement>("a, button")].find((b) => b.textContent?.trim() === "View")!);
    await h.advance(100);
    // The feed row's preview, not the item opened: it stays on Home, read.
    expect(h.container.querySelector("[data-kind-cell]")).toBeNull();
    expect(document.querySelector("[data-home-detail=item]")?.getAttribute("data-schedule-item")).toBe("added-callback");
    expect(rowNamed("Callback · Ana Lopez")!.getAttribute("data-unread")).not.toBe("true");
    expect(feed().querySelector("[data-feed-arrivals]")).toBeNull();
  });

  it("conversations are the rail's (P-HOME-1m): a routed one is in the rail, not the feed; no Now group renders", async () => {
    turnOn();
    await showHome();
    await h.goAvailable();
    const id = await h.startInbound("voice", "+15555550177", "Rae Kim");
    await h.accept(id);
    await h.advance(300);
    expect(h.navCard("Rae Kim")).toBeTruthy();
    expect(rowNamed("Rae Kim")).toBeUndefined();
    expect([...feed().querySelectorAll("[data-feed-group]")].map((g) => g.getAttribute("data-feed-group"))).not.toContain("Now");
  });

  it("a persona switch re-seeds its day as read", async () => {
    turnOn();
    await act(async () => {
      getSettingsStore().update("workspace", { persona: "supervisor" });
      await vi.advanceTimersByTimeAsync(50);
    });
    await showHome();
    expect(feed().textContent).toContain("Coaching · John Smith");
    expect(feed().querySelectorAll("[data-unread]")).toHaveLength(0);
  });

  it("park (P-HOME-1k): from the row's hover cluster in the kind's words; out of the feed into Parked, its count; Unpark returns it", async () => {
    turnOn();
    await showHome();
    const priya = () => rowNamed("Callback · Priya Shah");
    const park = priya()!.querySelector<HTMLElement>('[data-feed-action="park"]')!;
    expect(park.getAttribute("aria-label") ?? park.getAttribute("title")).toBe("Park this callback");
    await h.click(park);
    await h.advance(200);
    expect(priya()).toBeUndefined();
    expect(view("Assignments")?.textContent).toMatch(/^Assignments8/);
    expect(view("Parked")?.textContent).toMatch(/^Parked1/);
    await h.click(view("Parked")!);
    expect(rows("Parked").map((r) => r.getAttribute("data-feed-status"))).toEqual(["parked"]);
    // Its read state as it was (the day loaded read), and Unpark.
    expect(priya()!.getAttribute("data-unread")).toBeNull();
    await h.click(priya()!.querySelector<HTMLElement>('[data-feed-action="unpark"]')!);
    await h.advance(200);
    expect(group("Parked")?.textContent).toContain("Nothing parked");
    await h.click(view("Assignments")!);
    expect(priya()?.getAttribute("data-feed-status")).toBe("scheduled");
  });

  it("delete (P-HOME-1k): only on an item the agent created, after a confirm; a WFM or calendar item has no Delete anywhere", async () => {
    turnOn();
    await showHome();
    // WFM training: Park, no Delete, on the row and in its preview.
    const training = rowNamed("RET-1.3 refund policy update")!;
    expect(training.querySelector('[data-feed-action="park"]')).not.toBeNull();
    expect(training.querySelector('[data-feed-action="delete"]')).toBeNull();
    await h.click(training);
    await h.advance(100);
    const preview = () => document.querySelector<HTMLElement>("[data-home-detail=item]")!;
    expect(preview().querySelector('[data-feed-action="park"]')).not.toBeNull();
    expect(preview().querySelector('[data-feed-action="delete"]')).toBeNull();
    // The agent's own callback: Delete, confirmed.
    const sofia = () => rowNamed("Callback · Sofia Ramirez");
    await h.click(sofia()!.querySelector<HTMLElement>('[data-feed-action="delete"]')!);
    expect(document.body.textContent).toContain("Delete this callback?");
    expect(document.body.textContent).toContain("It won't come back.");
    expect(sofia()).toBeDefined();
    // The confirm's own Delete (the only labeled one: the row's is an icon).
    await h.click([...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) => b.textContent?.trim() === "Delete").pop()!);
    await h.advance(200);
    expect(sofia()).toBeUndefined();
    await h.click(view("Parked")!);
    await h.click(view("History")!);
    expect(feed().textContent).not.toContain("Sofia Ramirez");
    // From the preview too, in the kind's words, after the same confirm.
    await h.click(view("Assignments")!);
    await h.click(rowNamed("Callback · Nathan Cole")!);
    await h.advance(100);
    const del = preview().querySelector<HTMLElement>('[data-feed-action="delete"]')!;
    // The row's icons, left of the chip (P-HOME-1m), named in the kind's words.
    const named = (el: Element | null) => el?.getAttribute("aria-label") ?? el?.getAttribute("title");
    expect(named(del)).toBe("Delete this callback");
    expect(named(preview().querySelector('[data-feed-action="park"]'))).toBe("Park this callback");
    const actions = del.closest<HTMLElement>("[data-feed-row-actions]")!;
    expect(actions.nextElementSibling?.textContent).toContain("Callback");
    await h.click(del);
    expect(document.body.textContent).toContain("Delete this callback?");
    await h.click([...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) => b.textContent?.trim() === "Delete").pop()!);
    await h.advance(200);
    expect(rowNamed("Callback · Nathan Cole")).toBeUndefined();
  });

  it("History is Contact History's list: the same entries, order and times as the card; the History count is that list", async () => {
    turnOn("contactHistory");
    await showHome();
    await h.click(view("History")!);
    await h.click([...group("History")!.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Today"))!);
    await h.click([...document.querySelectorAll<HTMLElement>("[role=radio]")].find((r) => r.parentElement?.textContent?.includes("Last 48"))!);
    const feedRows = rows("History").map((r) => r.textContent ?? "");
    const card = h.container.querySelector<HTMLElement>('[data-home-section="contactHistory"]')!;
    // The card's own range: Last 48 Hours too.
    await h.click([...card.querySelectorAll<HTMLElement>("button")].find((b) => /Date filter/.test(b.getAttribute("aria-label") ?? ""))!);
    await h.click([...document.querySelectorAll<HTMLElement>("[role=radio]")].find((r) => r.parentElement?.textContent?.includes("Last 48"))!);
    const cardTimes = [...card.querySelectorAll<HTMLElement>("span")].map((s) => s.textContent ?? "").filter((t) => /^(\d+[mhd] ago|Just now)$/.test(t));
    expect(feedRows.length).toBeGreaterThan(0);
    expect(feedRows.map((r) => /(\d+[mhd] ago|Just now)/.exec(r)?.[1])).toEqual(cardTimes.slice(0, feedRows.length));
    expect(view("History")?.textContent).toContain(String(feedRows.length));
  });
});
