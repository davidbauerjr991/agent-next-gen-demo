// The Activity feed's rules (P-HOME-1): offers pinned, feed or rail, History
// as a chip, the time groups, the chip semantics and the counts.
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

  it("keeps a row in the feed or the rail, never both: an opened item leaves the feed and is in History", () => {
    const items = seedScheduleDay("agent", NOW).map((i) => (i.id === "agent-cb-priya" ? { ...i, state: "active" as const } : i));
    const priya = assignmentIdFor(scheduleCardKey("agent-cb-priya"));
    expect(buildFeed(input({ scheduleItems: items })).today.some((r) => r.assignmentId === priya)).toBe(false);
    expect(buildFeed(input({ scheduleItems: items, view: "history" })).history.find((r) => r.assignmentId === priya)?.status).toBe("inRail");
    // A rail card with the same assignment hides a still-scheduled item too.
    const shadowed = buildFeed(input({ railCards: [{ ...railCard, assignmentId: priya }] }));
    expect(shadowed.today.some((r) => r.assignmentId === priya)).toBe(false);
  });

  it("History lists what left the feed in its range: Contact History's entries, completed items in time order, then what's in the rail", () => {
    const feed = buildFeed(input({ view: "history" }));
    expect(titles(feed.history)).toEqual([
      "Sarah Brown · Chat · Billing",
      "Omar Farooq · Email · Sales",
      "Nathan Cole · Voice · General Support",
      "Maya Chen · Voice",
    ]);
    // A range starting after both seeded completions leaves them out; Contact History's entries are the caller's range.
    const later = buildFeed(input({ view: "history", historySince: NOW }));
    expect(titles(later.history)).toEqual(["Sarah Brown · Chat · Billing", "Maya Chen · Voice"]);
  });

  it("the kind chips filter whichever view is selected, History included; none picked is every kind", () => {
    const callbacks = buildFeed(input({ kindFilter: new Set<AssignmentKind>(["callback"]) }));
    expect(callbacks.today.concat(callbacks.thisWeek).every((r) => r.kind === "callback")).toBe(true);
    expect(titles(callbacks.today)).toEqual(["Callback · Priya Shah", "Callback · Sofia Ramirez"]);
    expect(callbacks.needsDecision).toEqual([]);
    const meetingsAndConversations = buildFeed(input({ kindFilter: new Set<AssignmentKind>(["meeting", "conversation"]) }));
    expect(new Set(meetingsAndConversations.today.concat(meetingsAndConversations.thisWeek).map((r) => r.kind))).toEqual(new Set(["meeting"]));
    expect(buildFeed(input({ view: "history", kindFilter: new Set<AssignmentKind>(["meeting", "conversation"]) })).history.length).toBe(4);
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
    expect(counts).toEqual({ needsDecision: 1, now: 0, today: 5, thisWeek: 3, assignments: 8, history: 4 });
  });

  it("leaves out kinds the persona doesn't see", () => {
    const feed = buildFeed(input({ scheduleItems: seedScheduleDay("supervisor", NOW), kinds: PERSONA_KINDS.agent }));
    expect(feed.today.concat(feed.thisWeek).some((r) => r.kind === "coaching" || r.kind === "evaluation")).toBe(false);
  });
});
