// The Activity feed's rules (P-HOME-1, -1h): offers pinned, feed or rail,
// History as Contact History plus completed items, the time groups and the
// Assignments range, the chip semantics and the counts.
import { describe, expect, it } from "vitest";
import { seedScheduleDay } from "@/adapters/sim/sim-schedule-seeds";
import { assignmentIdFor, scheduleCardKey, type AssignmentKind } from "@/domain";
import type { ScheduleItem } from "@/providers";
import { buildFeed, type FeedInput, type FeedRow } from "./activity-feed";
import { PERSONA_KINDS } from "./persona-kinds";

const NOW = new Date(2026, 9, 24, 10, 30).getTime();
const MIN = 60_000;

const offer: FeedRow = {
  assignmentId: assignmentIdFor("journey-tom"),
  kind: "conversation",
  title: "Tom Lewis · Voice",
  subtitle: "",
  status: "offered",
  target: { type: "card", cardId: "journey-tom" },
};
const railCard: FeedRow = { ...offer, assignmentId: assignmentIdFor("journey-maya"), title: "Maya Chen · Voice", status: "inRail", target: { type: "card", cardId: "journey-maya" } };
const completed: FeedRow = {
  assignmentId: assignmentIdFor("history:h1"),
  kind: "conversation",
  title: "Sarah Brown · Chat · Billing",
  subtitle: "Resolved",
  timeLabel: "12m ago",
  at: NOW - 12 * MIN,
  status: "completed",
  target: { type: "history", entryId: "h1" },
};

function input(overrides: Partial<FeedInput> = {}): FeedInput {
  return {
    offers: [offer],
    scheduleItems: seedScheduleDay("agent", NOW),
    railCards: [railCard],
    completedHistory: [completed],
    historyWindow: { from: new Date(2026, 9, 24).getTime(), to: Infinity },
    now: NOW,
    kinds: PERSONA_KINDS.agent,
    kindFilter: new Set<AssignmentKind>(),
    view: "assignments",
    ...overrides,
  };
}

const titles = (rows: readonly FeedRow[]) => rows.map((r) => r.title);

describe("buildFeed", () => {
  it("pins offers in Needs a decision whatever their time, offered schedule items included", () => {
    const items = seedScheduleDay("supervisor", NOW);
    const feed = buildFeed(input({ scheduleItems: items, kinds: PERSONA_KINDS.supervisor }));
    expect(titles(feed.needsDecision)).toEqual(["Tom Lewis · Voice", "Escalation · Lauren Briggs · Voice"]);
    expect(feed.today.concat(feed.thisWeek).some((r) => r.status === "offered")).toBe(false);
  });

  it("groups scheduled rows into Today / This week, with no Now or Completed-today group (P-HOME-1m)", () => {
    const feed = buildFeed(input());
    expect(Object.keys(feed)).not.toContain("now");
    expect(Object.keys(feed.counts)).not.toContain("now");
    expect(titles(feed.today)).toEqual([
      "Callback · Priya Shah",
      "Returns team stand-up",
      "RET-1.3 refund policy update",
      "Ticket #4821 · subscription renewal refund",
      "Callback · Sofia Ramirez",
    ]);
    expect(titles(feed.thisWeek)).toEqual(["Callback · Nathan Cole", "1:1 with Dana (supervisor)", "WhatsApp templates · intro"]);
    expect(Object.keys(feed)).not.toContain("completedToday");
    // Done items never appear in a time group.
    expect(feed.today.concat(feed.thisWeek).every((r) => r.status === "scheduled")).toBe(true);
  });

  it("puts an overdue scheduled row first in Today", () => {
    const late: ScheduleItem = { ...seedScheduleDay("agent", NOW)[0]!, id: "late", title: "Late callback", dueAt: NOW - 5 * MIN };
    expect(titles(buildFeed(input({ scheduleItems: [...seedScheduleDay("agent", NOW), late] })).today)[0]).toBe("Late callback");
  });

  it("an opened item isn't History (History keeps completed items only)", () => {
    const items = seedScheduleDay("agent", NOW).map((i) => (i.id === "agent-cb-priya" ? { ...i, state: "active" as const } : i));
    const priya = assignmentIdFor(scheduleCardKey("agent-cb-priya"));
    expect(buildFeed(input({ scheduleItems: items, view: "history" })).history.some((r) => r.assignmentId === priya)).toBe(false);
  });

  it("History is Contact History's entries in the card's order, with completed schedule items merged in by completion time", () => {
    const items = seedScheduleDay("agent", NOW).map((i) =>
      i.id === "agent-tr-ret13" ? { ...i, state: "done" as const, completedAt: NOW - 5 * MIN } : i.id === "agent-mt-standup" ? { ...i, state: "done" as const, completedAt: NOW - 30 * MIN } : i,
    );
    const older: FeedRow = { ...completed, assignmentId: assignmentIdFor("history:h2"), title: "Omar Farooq · Email · Sales", timeLabel: "2h ago", at: NOW - 120 * MIN, target: { type: "history", entryId: "h2" } };
    const feed = buildFeed(input({ view: "history", scheduleItems: items, completedHistory: [completed, older] }));
    expect(titles(feed.history)).toEqual(["RET-1.3 refund policy update", "Sarah Brown · Chat · Billing", "Returns team stand-up", "Omar Farooq · Email · Sales"]);
    // No rail rows: they're in the rail.
    expect(feed.history.some((r) => r.status === "inRail")).toBe(false);
    // A range starting after the completions leaves the items out; Contact History's entries are the caller's range.
    expect(titles(buildFeed(input({ view: "history", scheduleItems: items, historyWindow: { from: NOW, to: Infinity } })).history)).toEqual(["Sarah Brown · Chat · Billing"]);
    // …and one ending before them (Yesterday's) too.
    expect(titles(buildFeed(input({ view: "history", scheduleItems: items, historyWindow: { from: 0, to: NOW - 60 * MIN } })).history)).toEqual(["Sarah Brown · Chat · Billing"]);
    // A declined offer has left the feed: not in History either.
    const declined = seedScheduleDay("supervisor", NOW).map((i) => (i.state === "offered" ? { ...i, state: "declined" as const } : i));
    const supervisor = buildFeed(input({ scheduleItems: declined, kinds: PERSONA_KINDS.supervisor, offers: [] }));
    expect(supervisor.needsDecision).toEqual([]);
  });

  it("History's search keeps the rows it matches, and the History count is the listed rows", () => {
    const feed = buildFeed(input({ view: "history", historyMatches: (r) => r.title.includes("Sarah") }));
    expect(titles(feed.history)).toEqual(["Sarah Brown · Chat · Billing"]);
    expect(buildFeed(input({ view: "history", historyMatches: () => false })).counts.history).toBe(0);
  });

  it("Later is everything past the week, nearest first (P-HOME-1m: no range control)", () => {
    const far: ScheduleItem = { ...seedScheduleDay("agent", NOW)[0]!, id: "far", title: "Far callback", dueAt: NOW + 60 * 24 * 60 * MIN };
    const feed = buildFeed(input({ scheduleItems: [...seedScheduleDay("agent", NOW), far] }));
    expect(titles(feed.later)).toEqual(["Q4 compliance refresher", "Far callback"]);
    expect(feed.counts).toMatchObject({ today: 5, thisWeek: 3, later: 2, assignments: 10 });
  });

  it("an item open in the rail stays in its time group, marked open and read (P-HOME-1m: supersedes 1e's feed-or-rail)", () => {
    const items = seedScheduleDay("agent", NOW).map((i) => (i.id === "agent-mt-standup" ? { ...i, state: "active" as const } : i));
    const feed = buildFeed(input({ scheduleItems: items, isUnread: () => true }));
    const standup = feed.today.find((r) => r.title === "Returns team stand-up")!;
    expect(standup.status).toBe("inRail");
    expect(feed.counts.today).toBe(5);
    // Its unread doesn't count: it's been opened.
    expect(feed.counts.unread).toBe(8);
    // A rail card holding a still-scheduled item's assignment shows it open too.
    const priya = assignmentIdFor(scheduleCardKey("agent-cb-priya"));
    const held = buildFeed(input({ railCards: [{ ...railCard, assignmentId: priya }] }));
    expect(held.today.find((r) => r.assignmentId === priya)?.status).toBe("inRail");
  });

  it("the kind chips filter whichever view is selected, History included; none picked is every kind", () => {
    const callbacks = buildFeed(input({ kindFilter: new Set<AssignmentKind>(["callback"]) }));
    expect(callbacks.today.concat(callbacks.thisWeek).every((r) => r.kind === "callback")).toBe(true);
    expect(titles(callbacks.today)).toEqual(["Callback · Priya Shah", "Callback · Sofia Ramirez"]);
    expect(callbacks.needsDecision).toEqual([]);
    const meetingsAndConversations = buildFeed(input({ kindFilter: new Set<AssignmentKind>(["meeting", "conversation"]) }));
    expect(new Set(meetingsAndConversations.today.concat(meetingsAndConversations.thisWeek).map((r) => r.kind))).toEqual(new Set(["meeting"]));
    expect(titles(buildFeed(input({ view: "history", kindFilter: new Set<AssignmentKind>(["meeting", "conversation"]) })).history)).toEqual([
      "Sarah Brown · Chat · Billing",
    ]);
    const historyCallbacks = buildFeed(input({ view: "history", kindFilter: new Set<AssignmentKind>(["callback"]) }));
    expect(historyCallbacks.history).toEqual([]);
  });

  it("the view is one value: Assignments is Needs a decision and the time groups, History is History alone", () => {
    const assignments = buildFeed(input({ view: "assignments" }));
    expect([assignments.showAssignments, assignments.showHistory]).toEqual([true, false]);
    expect(assignments.needsDecision.length).toBe(1);
    expect(assignments.today.length).toBeGreaterThan(0);
    expect(assignments.history).toEqual([]);

    const history = buildFeed(input({ view: "history" }));
    expect([history.showAssignments, history.showHistory]).toEqual([false, true]);
    expect(history.needsDecision.concat(history.today, history.thisWeek)).toEqual([]);
  });

  it("counts the groups whatever the view shows", () => {
    const { counts } = buildFeed(input({ view: "history" }));
    expect(counts).toEqual({ needsDecision: 1, today: 5, thisWeek: 3, later: 1, assignments: 9, unread: 0, parked: 0, history: 1 });
  });

  it("unread (P-HOME-1k): the rows the predicate reads as new, and the Activity count's; the kinds narrow it", () => {
    const unreadIds = new Set(["agent-cb-priya", "agent-mt-standup", "agent-cb-sofia"]);
    const isUnread = (r: FeedRow) => r.target.type === "schedule" && unreadIds.has(r.target.itemId);
    const feed = buildFeed(input({ isUnread }));
    expect(feed.today.filter((r) => r.unread).map((r) => r.title)).toEqual(["Callback · Priya Shah", "Returns team stand-up", "Callback · Sofia Ramirez"]);
    expect(feed.counts.unread).toBe(3);
    const meetings = buildFeed(input({ isUnread, kindFilter: new Set<AssignmentKind>(["meeting"]) }));
    expect(meetings.counts.unread).toBe(1);
  });

  it("the views' searches (P-HOME-1m): title, subtitle, customer or source, with the kinds; Parked has its own", () => {
    const bySource = buildFeed(input({ query: "ticket queue" }));
    expect(titles(bySource.today.concat(bySource.thisWeek, bySource.later))).toEqual(["Ticket #4821 · subscription renewal refund"]);
    const priya = buildFeed(input({ query: "Priya", kindFilter: new Set<AssignmentKind>(["callback"]) }));
    expect(titles(priya.today)).toEqual(["Callback · Priya Shah"]);
    // The Activity search doesn't narrow Parked, and Parked's doesn't narrow Activity.
    const items = seedScheduleDay("agent", NOW).map((i) => (i.id === "agent-cb-priya" ? { ...i, state: "parked" as const, parkedAt: NOW } : i));
    expect(titles(buildFeed(input({ view: "parked", scheduleItems: items, query: "zzz" })).parked)).toEqual(["Callback · Priya Shah"]);
    expect(buildFeed(input({ view: "parked", scheduleItems: items, parkedQuery: "zzz" })).parked).toEqual([]);
    expect(buildFeed(input({ scheduleItems: items, parkedQuery: "zzz" })).counts.assignments).toBe(8);
  });

  it("parked (P-HOME-1k): out of the feed's groups, in the Parked view newest parked first, its own count; the chips filter it", () => {
    const items = seedScheduleDay("agent", NOW).map((i) =>
      i.id === "agent-cb-priya"
        ? { ...i, state: "parked" as const, parkedAt: NOW - 30 * MIN }
        : i.id === "agent-mt-standup"
          ? { ...i, state: "parked" as const, parkedAt: NOW - 5 * MIN }
          : i,
    );
    const assignments = buildFeed(input({ scheduleItems: items }));
    expect(assignments.today.map((r) => r.title)).not.toContain("Callback · Priya Shah");
    expect(assignments.counts).toMatchObject({ today: 3, parked: 2 });
    expect(assignments.parked).toEqual([]);
    const parked = buildFeed(input({ scheduleItems: items, view: "parked" }));
    expect([parked.showAssignments, parked.showParked, parked.showHistory]).toEqual([false, true, false]);
    expect(titles(parked.parked)).toEqual(["Returns team stand-up", "Callback · Priya Shah"]);
    expect(parked.today).toEqual([]);
    expect(titles(buildFeed(input({ scheduleItems: items, view: "parked", kindFilter: new Set<AssignmentKind>(["callback"]) })).parked)).toEqual([
      "Callback · Priya Shah",
    ]);
  });

  it("leaves out kinds the persona doesn't see", () => {
    const feed = buildFeed(input({ scheduleItems: seedScheduleDay("supervisor", NOW), kinds: PERSONA_KINDS.agent }));
    expect(feed.today.concat(feed.thisWeek).some((r) => r.kind === "coaching" || r.kind === "evaluation")).toBe(false);
  });
});
