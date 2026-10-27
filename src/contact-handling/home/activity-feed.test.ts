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
    historySince: new Date(2026, 9, 24).getTime(),
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
    expect(feed.now.concat(feed.today, feed.thisWeek).some((r) => r.status === "offered")).toBe(false);
  });

  it("groups scheduled rows into Now / Today / This week, with no Completed-today group", () => {
    const feed = buildFeed(input());
    expect(titles(feed.now)).toEqual([]);
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

  it("puts an overdue scheduled row in Now", () => {
    const late: ScheduleItem = { ...seedScheduleDay("agent", NOW)[0]!, id: "late", title: "Late callback", dueAt: NOW - 5 * MIN };
    expect(titles(buildFeed(input({ scheduleItems: [late] })).now)).toEqual(["Late callback"]);
  });

  it("keeps a row in the feed or the rail, never both: an opened item leaves the feed (the rail isn't History)", () => {
    const items = seedScheduleDay("agent", NOW).map((i) => (i.id === "agent-cb-priya" ? { ...i, state: "active" as const } : i));
    const priya = assignmentIdFor(scheduleCardKey("agent-cb-priya"));
    expect(buildFeed(input({ scheduleItems: items })).today.some((r) => r.assignmentId === priya)).toBe(false);
    expect(buildFeed(input({ scheduleItems: items, view: "history" })).history.some((r) => r.assignmentId === priya)).toBe(false);
    // A rail card with the same assignment hides a still-scheduled item too.
    const shadowed = buildFeed(input({ railCards: [{ ...railCard, assignmentId: priya }] }));
    expect(shadowed.today.some((r) => r.assignmentId === priya)).toBe(false);
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
    expect(titles(buildFeed(input({ view: "history", scheduleItems: items, historySince: NOW })).history)).toEqual(["Sarah Brown · Chat · Billing"]);
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

  it("the Assignments range bounds the groups: Today drops This week; Next 30 days and All add Later", () => {
    const today = buildFeed(input({ range: "today" }));
    expect(today.thisWeek).toEqual([]);
    expect(today.later).toEqual([]);
    expect(today.counts.assignments).toBe(5);
    expect(buildFeed(input()).later).toEqual([]);
    expect(titles(buildFeed(input({ range: "next30" })).later)).toEqual(["Q4 compliance refresher"]);
    const far: ScheduleItem = { ...seedScheduleDay("agent", NOW)[0]!, id: "far", title: "Far callback", dueAt: NOW + 60 * 24 * 60 * MIN };
    const items = [...seedScheduleDay("agent", NOW), far];
    expect(titles(buildFeed(input({ range: "next30", scheduleItems: items })).later)).toEqual(["Q4 compliance refresher"]);
    const all = buildFeed(input({ range: "all", scheduleItems: items }));
    expect(titles(all.later)).toEqual(["Q4 compliance refresher", "Far callback"]);
    expect(all.counts.assignments).toBe(10);
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
    expect(history.needsDecision.concat(history.now, history.today, history.thisWeek)).toEqual([]);
  });

  it("counts the groups whatever the view shows", () => {
    const { counts } = buildFeed(input({ view: "history" }));
    expect(counts).toEqual({ needsDecision: 1, now: 0, today: 5, thisWeek: 3, later: 0, assignments: 8, history: 1 });
  });

  it("leaves out kinds the persona doesn't see", () => {
    const feed = buildFeed(input({ scheduleItems: seedScheduleDay("supervisor", NOW), kinds: PERSONA_KINDS.agent }));
    expect(feed.today.concat(feed.thisWeek).some((r) => r.kind === "coaching" || r.kind === "evaluation")).toBe(false);
  });
});
