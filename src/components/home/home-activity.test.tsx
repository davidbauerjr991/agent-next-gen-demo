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
import { TOM_LEWIS_SCRIPT } from "@/scenarios";
import { seedScheduleDay } from "@/adapters/sim/sim-schedule-seeds";
import { getWorkspaceUiStore } from "@/contact-handling/workspace-ui-store";

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
/** The filter row every view shares (P-HOME-1m): the view's search, the kinds chip, History's date. */
const filters = () => feed().querySelector<HTMLElement>("[data-feed-filters]")!;
/** The kinds filter's trigger (lyra's FilterChip, "Filter"). */
const kindsChip = () => filters().querySelector<HTMLButtonElement>("[data-feed-kinds] button[aria-haspopup]")!;
/** The kinds dropdown's options (lyra's multi-select: search, Select All, a checkbox per kind). */
const kindOptions = () => [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
/** Ticks (or unticks) a kind in the kinds dropdown, opening and closing it around the click. */
async function pickKind(label: string) {
  await h.click(kindsChip());
  await h.click(kindOptions().find((o) => o.textContent?.trim() === label)!);
  await h.click(kindsChip());
}
/** Picks History's range in lyra's DateRangeFilterChip ("Date: …"), closing it again unless `keepOpen`. */
async function pickRange(label: string, options?: { keepOpen?: boolean }) {
  const trigger = () => [...filters().querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith("Date:"))!;
  await h.click(trigger());
  const radio = [...document.body.querySelectorAll<HTMLElement>('[role="radio"]')].find(
    (r) => (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) === label || r.parentElement?.textContent?.trim() === label,
  )!;
  await h.click(radio);
  if (!options?.keepOpen) await h.click(trigger());
}
/** The picked kinds as tokens below the filter row. */
const kindTokens = () => [...feed().querySelectorAll<HTMLElement>("[data-feed-tokens] [data-feed-token]")].map((t) => t.getAttribute("data-feed-token"));
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

  it("the view switcher is Activity | Parked | History (one always selected, Activity by default): a row previews; its Join opens it, and it stays in the feed marked open", async () => {
    turnOn();
    await showHome();
    expect([...feed().querySelectorAll("[data-feed-views] [role=radio]")].map((b) => b.textContent?.replace(/\d+( new)?$/, "").replace(/\d+$/, "").trim())).toEqual([
      "Activity",
      "Parked",
      "History",
    ]);
    expect(view("Activity")?.getAttribute("aria-checked")).toBe("true");
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
    expect(view("Activity")?.getAttribute("aria-checked")).toBe("false");
    expect(group("Today")).toBeNull();
    expect(group("Needs a decision")).toBeNull();
    expect(group("History")?.textContent).not.toContain("Returns team stand-up");

    await h.click(view("Activity")!);
    expect(group("Today")?.textContent).toContain("Callback · Priya Shah");
    expect(group("History")).toBeNull();
    // Clicking the selected view again keeps it selected.
    await h.click(view("Activity")!);
    expect(view("Activity")?.getAttribute("aria-checked")).toBe("true");
  });

  it("one filter row under the views (P-HOME-1m), no view heading: the search first, then lyra's FilterChip (\"Filter\"); picked kinds filter the current view and show as removable tokens below (+N past three, Clear); the selection holds across views", async () => {
    turnOn();
    await showHome();
    const order = [...feed().querySelectorAll("[data-feed-views], [data-feed-filters]")].map((el) => (el.hasAttribute("data-feed-views") ? "views" : "filters"));
    expect(order).toEqual(["views", "filters"]);
    // Search first, then the kinds filter.
    expect(filters().firstElementChild?.querySelector("input")?.placeholder).toBe("Search activity");
    expect(kindsChip().textContent?.trim()).toBe("Filter");
    // The dropdown lists the persona's kinds (with lyra's search and Select All).
    await h.click(kindsChip());
    expect(kindOptions().map((o) => o.textContent?.trim())).toEqual(["Conversation", "Callback", "Meeting", "Training", "Task"]);
    expect(document.body.textContent).toContain("Select All");
    await h.click(kindsChip());
    expect(feed().querySelector("[data-feed-tokens]")).toBeNull();
    await pickKind("Callback");
    expect(kindTokens()).toEqual(["callback"]);
    expect(rows("Today").map((r) => r.textContent?.includes("Callback")).every(Boolean)).toBe(true);
    // A token's × removes its kind.
    await h.click(feed().querySelector<HTMLElement>('[data-feed-token="callback"] button')!);
    expect(kindTokens()).toEqual([]);
    for (const kind of ["Callback", "Task", "Meeting", "Training"]) await pickKind(kind);
    // Three tokens, then +1 for the rest.
    expect(kindTokens()).toEqual(["callback", "meeting", "training"]);
    expect(feed().querySelector("[data-feed-tokens-more]")?.textContent?.trim()).toBe("+1");
    // The same selection in History (no view heading; its date chip after the kinds filter) and Parked.
    await h.click(view("History")!);
    expect(kindTokens()).toEqual(["callback", "meeting", "training"]);
    expect(group("History")?.querySelector("h3")).toBeNull();
    expect(filters().lastElementChild?.textContent).toContain("Date");
    await h.click(view("Parked")!);
    expect(group("Parked")?.querySelector("h3")).toBeNull();
    expect(feed().querySelector("[data-feed-tokens-more]")?.textContent?.trim()).toBe("+1");
    // Clear resets it: every kind again.
    await h.click(view("Activity")!);
    await h.click(feed().querySelector<HTMLElement>("[data-feed-tokens-clear]")!);
    expect(feed().querySelector("[data-feed-tokens]")).toBeNull();
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
    // The filter row carries Contact History's own date control in History.
    expect(filters().textContent).toContain("Today");
    await h.click(tom()!);
    expect(h.buttonByText("Redial")).toBeTruthy();
    await act(async () => {
      getSettingsStore().update("outbound", (prev) => ({ calling: { ...prev.calling, redial: false } }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(h.buttonByText("Redial")).toBeUndefined();
  });

  it("History behaves as Contact History: its search and date controls in the filter row, a row opens the preview (selected) and closes it again; the kinds still filter", async () => {
    turnOn();
    await showHome();
    await h.click(view("History")!);
    const controls = filters();
    expect(controls.querySelector("input")?.getAttribute("placeholder")).toBe("Search contact history");
    expect(controls.textContent).toContain("Date:Today");
    await pickRange("Last 7 days");
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
    expect(group("History")?.textContent).toContain("No results for “zzz-no-match”");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, name.slice(0, 4));
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(rows("History").length).toBeGreaterThan(0);
    // A kind with nothing in History empties it.
    await pickKind("Training");
    expect(rows("History")).toHaveLength(0);
  });

  it("History's range is lyra's DateRangeFilterChip (Today / Yesterday / Last 7 days / Custom), applied by when each contact happened", async () => {
    turnOn();
    await showHome();
    await h.click(view("History")!);
    const times = () => rows("History").map((r) => r.textContent ?? "");
    // Today: this morning's contacts (minutes and hours ago), none a day or more back.
    const today = times();
    expect(today.length).toBeGreaterThan(0);
    expect(today.some((r) => /\dd ago/.test(r))).toBe(false);
    // Yesterday: the day before only.
    await pickRange("Yesterday");
    expect(times().length).toBeGreaterThan(0);
    expect(times().every((r) => r.includes("1d ago"))).toBe(true);
    // Last 7 days: the whole week, today's and yesterday's included.
    await pickRange("Last 7 days");
    expect(times().length).toBeGreaterThan(today.length);
    expect(rows("History").every((r) => r.getAttribute("data-feed-status") === "completed")).toBe(true);
    // Custom: the picker appears in the chip's popover (lyra's DateRangePicker).
    await pickRange("Custom", { keepOpen: true });
    expect(document.body.querySelector('input[placeholder="Select date range"]')).not.toBeNull();
    // No 48h / 72h wording anywhere.
    expect(document.body.textContent).not.toMatch(/48 Hours|72 Hours/);
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
    expect(view("Activity")?.textContent).toMatch(/^Activity9/);
    await h.click(view("Parked")!);
    expect(feed().querySelector("[data-feed-range]")).toBeNull();
    // History keeps its date control, with no kebab.
    await h.click(view("History")!);
    expect(filters().textContent).toContain("Today");
    expect(feed().querySelector(".lyra-container-header-filter-compact")).toBeNull();
  });

  it("unread (P-HOME-1m): the seeded day loads read; an item that comes due afterwards is unread (tinted, with a dot, counted on Activity); a preview reads it, across view switches", async () => {
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
    await h.click(row());
    await h.advance(100);
    expect(row().getAttribute("data-unread")).toBeNull();
    expect(unread()).toBeUndefined();
    // Still read after a round trip through the other views.
    await h.click(view("Parked")!);
    await h.click(view("History")!);
    await h.click(view("Activity")!);
    expect(row().getAttribute("data-unread")).toBeNull();
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

  it("an item the schedule source adds after load is unread in its time group and counted (badge 1); its preview reads it", async () => {
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
    // Due in 45 minutes: Today's (there is no Now group).
    expect(row.closest("[data-feed-group]")?.getAttribute("data-feed-group")).toBe("Today");
    await h.click(row);
    await h.advance(100);
    expect(document.querySelector("[data-home-detail=item]")?.getAttribute("data-schedule-item")).toBe("added-callback");
    expect(rowNamed("Callback · Ana Lopez")!.getAttribute("data-unread")).not.toBe("true");
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
    expect(view("Activity")?.textContent).toMatch(/^Activity8/);
    expect(view("Parked")?.textContent).toMatch(/^Parked1/);
    await h.click(view("Parked")!);
    expect(rows("Parked").map((r) => r.getAttribute("data-feed-status"))).toEqual(["parked"]);
    // Its read state as it was (the day loaded read), and Unpark.
    expect(priya()!.getAttribute("data-unread")).toBeNull();
    await h.click(priya()!.querySelector<HTMLElement>('[data-feed-action="unpark"]')!);
    await h.advance(200);
    expect(group("Parked")?.textContent).toContain("Nothing parked");
    await h.click(view("Activity")!);
    expect(priya()?.getAttribute("data-feed-status")).toBe("scheduled");
  });

  /** Types into the current view's search (the filter row's input). */
  async function search(value: string) {
    const input = filters().querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
  }
  const titlesShown = () => [...feed().querySelectorAll<HTMLElement>("[data-feed-row]")].map((r) => r.textContent ?? "");

  it("search (P-HOME-1m): Activity's matches title, subtitle, customer and source, with the kinds; no hits says so, and Clear search clears it", async () => {
    turnOn();
    await showHome();
    const input = filters().querySelector<HTMLInputElement>("input")!;
    expect(input.placeholder).toBe("Search activity");
    // A source ("Ticket queue") finds the task.
    await search("ticket queue");
    expect(titlesShown()).toEqual([expect.stringContaining("Ticket #4821")]);
    // A customer finds her rows; the Callback kind keeps the callback alone.
    await search("priya");
    expect(titlesShown().length).toBeGreaterThan(1);
    await pickKind("Callback");
    expect(titlesShown()).toEqual([expect.stringContaining("Callback · Priya Shah")]);
    // No hits: lyra's EmptyState says so, with Clear search.
    await search("zzz-no-match");
    const empty = feed().querySelector<HTMLElement>('[data-feed-empty="assignments"]')!;
    expect(empty.textContent).toContain("No results for “zzz-no-match”");
    await h.click(empty.querySelector<HTMLElement>("[data-feed-clear-search]")!);
    expect(input.value).toBe("");
    // Cleared: every callback again (the chip still applies).
    expect(titlesShown().some((r) => r.includes("Callback · Sofia Ramirez"))).toBe(true);
    expect(titlesShown().every((r) => r.includes("Callback"))).toBe(true);
  });

  it("empty states (P-HOME-1m): Activity with filters, Parked's (with its line), History's; Parked has its own search", async () => {
    turnOn();
    await showHome();
    // Conversation alone: no offers, so nothing matches the filters.
    await pickKind("Conversation");
    expect(feed().querySelector('[data-feed-empty="assignments"]')?.textContent).toContain("No activity matches these filters");
    await pickKind("Conversation");
    await h.click(view("Parked")!);
    const parked = feed().querySelector<HTMLElement>('[data-feed-empty="parked"]')!;
    expect(parked.textContent).toContain("Nothing parked");
    expect(parked.textContent).toContain("Parked items wait here until you bring them back.");
    expect(parked.querySelector("svg")).not.toBeNull();
    expect(filters().querySelector("input")?.placeholder).toBe("Search parked");
    await search("zzz");
    expect(feed().querySelector('[data-feed-empty="parked"]')?.textContent).toContain("No results for “zzz”");
    await h.click(view("History")!);
    // A kind with nothing in History: the filtered line.
    await pickKind("Training");
    expect(feed().querySelector('[data-feed-empty="history"]')?.textContent).toContain("No history matches");
    await pickKind("Training");
    // A range with nothing in it (Custom, days in 2020; set in the store, lyra's calendar isn't driven here).
    await act(async () => {
      getWorkspaceUiStore(h.provider).update((s) => ({ ...s, activityHistoryRange: "custom", activityHistoryCustom: { from: new Date(2020, 0, 1), to: new Date(2020, 0, 2) } }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(feed().querySelector('[data-feed-empty="history"]')?.textContent).toContain("Nothing completed yet");
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
    await h.click(view("Activity")!);
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
    await pickRange("Yesterday");
    const feedRows = rows("History").map((r) => r.textContent ?? "");
    const card = h.container.querySelector<HTMLElement>('[data-home-section="contactHistory"]')!;
    // The card's own range (lyra's DateRangeFilterChip too, from Last 7 days): Yesterday as well.
    await h.click([...card.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith("Date:"))!);
    await h.click([...document.body.querySelectorAll<HTMLElement>('[role="radio"]')].find((r) => (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) === "Yesterday" || r.parentElement?.textContent?.trim() === "Yesterday")!);
    const cardTimes = [...card.querySelectorAll<HTMLElement>("span")].map((s) => s.textContent ?? "").filter((t) => /^(\d+[mhd] ago|Just now)$/.test(t));
    expect(feedRows.length).toBeGreaterThan(0);
    expect(feedRows.map((r) => /(\d+[mhd] ago|Just now)/.exec(r)?.[1])).toEqual(cardTimes.slice(0, feedRows.length));
    expect(view("History")?.textContent).toContain(String(feedRows.length));
  });
});
