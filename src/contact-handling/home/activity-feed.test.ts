// The Activity feed's rules (P-HOME-1): offers pinned, feed or rail, History
// as a chip, the time groups, the chip semantics and the counts.
import { describe, expect, it } from "vitest";
import { seedScheduleDay } from "@/adapters/sim/sim-schedule-seeds";
import { assignmentIdFor, scheduleCardKey } from "@/domain";
import type { ScheduleItem } from "@/providers";
import { buildFeed, type FeedFilter, type FeedInput, type FeedRow } from "./activity-feed";
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
    todayHistory: [completed],
    now: NOW,
    kinds: PERSONA_KINDS.agent,
    filters: new Set<FeedFilter>(),
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
    const feed = buildFeed(input({ scheduleItems: items, filters: new Set<FeedFilter>(["assignments", "history"]) }));
    const priya = assignmentIdFor(scheduleCardKey("agent-cb-priya"));
    expect(feed.today.some((r) => r.assignmentId === priya)).toBe(false);
    expect(feed.history.find((r) => r.assignmentId === priya)?.status).toBe("inRail");
    // A rail card with the same assignment hides a still-scheduled item too.
    const shadowed = buildFeed(input({ railCards: [{ ...railCard, assignmentId: priya }] }));
    expect(shadowed.today.some((r) => r.assignmentId === priya)).toBe(false);
  });

  it("History lists what left the feed today: completed first in time order, then what's in the rail", () => {
    const feed = buildFeed(input({ filters: new Set<FeedFilter>(["history"]) }));
    expect(titles(feed.history)).toEqual([
      "Sarah Brown · Chat · Billing",
      "Omar Farooq · Email · Sales",
      "Nathan Cole · Voice · General Support",
      "Maya Chen · Voice",
    ]);
  });

  it("chips: All shows the assignments, History alone hides them, Assignments + History stack", () => {
    const all = buildFeed(input());
    expect([all.showAssignments, all.showHistory]).toEqual([true, false]);
    expect(all.history).toEqual([]);

    const history = buildFeed(input({ filters: new Set<FeedFilter>(["history"]) }));
    expect([history.showAssignments, history.showHistory]).toEqual([false, true]);
    expect(history.needsDecision.concat(history.now, history.today, history.thisWeek)).toEqual([]);

    const both = buildFeed(input({ filters: new Set<FeedFilter>(["assignments", "history"]) }));
    expect([both.showAssignments, both.showHistory]).toEqual([true, true]);
    expect(both.today.length).toBeGreaterThan(0);
    expect(both.history.length).toBeGreaterThan(0);
  });

  it("counts the groups whatever the chips show", () => {
    const { counts } = buildFeed(input({ filters: new Set<FeedFilter>(["history"]) }));
    expect(counts).toEqual({ needsDecision: 1, now: 0, today: 5, thisWeek: 3, assignments: 8, history: 4 });
  });

  it("leaves out kinds the persona doesn't see", () => {
    const feed = buildFeed(input({ scheduleItems: seedScheduleDay("supervisor", NOW), kinds: PERSONA_KINDS.agent }));
    expect(feed.today.concat(feed.thisWeek).some((r) => r.kind === "coaching" || r.kind === "evaluation")).toBe(false);
  });
});
