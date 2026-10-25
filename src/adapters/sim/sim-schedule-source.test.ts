// The stub schedule source (P-HOME-1): one seeded day per role, every kind
// through it, state changes only as events after the sim's latency.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentKind } from "../../domain";
import type { ScheduleEvents, ScheduleProvider } from "../../providers";
import { createSimScheduleProvider } from "./sim-schedule-source";

const NOW = new Date(2026, 9, 24, 10, 30).getTime();
const LATENCY = { minMs: 50, maxMs: 50 };

let source: ScheduleProvider;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  source = createSimScheduleProvider({ latency: LATENCY });
});

afterEach(async () => {
  await source.dispose();
  vi.useRealTimers();
});

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(LATENCY.maxMs);
  return promise;
}

const kindsOf = (items: readonly { kind: AssignmentKind }[]) => new Set(items.map((i) => i.kind));

describe("sim schedule source", () => {
  it("seeds each role's day with that role's kinds", async () => {
    const agent = await settle(source.listItems({ role: "agent" }));
    expect(kindsOf(agent.items)).toEqual(new Set(["callback", "meeting", "training", "task", "conversation"]));
    expect(agent.items.filter((i) => i.kind === "callback")).toHaveLength(3);
    expect(agent.items.filter((i) => i.kind === "training")).toHaveLength(2);
    expect(agent.items.filter((i) => i.state === "done").every((i) => i.kind === "conversation")).toBe(true);

    const supervisor = await settle(source.listItems({ role: "supervisor" }));
    expect(kindsOf(supervisor.items)).toEqual(new Set(["conversation", "evaluation", "coaching", "meeting"]));
    expect(supervisor.items.find((i) => i.kind === "conversation")?.state).toBe("offered");
    expect(Object.keys(supervisor.cards)).toEqual(["teamQueues", "teamToday", "needsYou"]);

    const sales = await settle(source.listItems({ role: "sales" }));
    expect(kindsOf(sales.items)).toEqual(new Set(["callback", "meeting", "campaign-block", "conversation"]));
    expect(Object.keys(sales.cards)).toEqual(["pipeline", "campaignToday", "followUps"]);
  });

  it("times the day from when it is listed", async () => {
    const { items } = await settle(source.listItems({ role: "agent" }));
    const priya = items.find((i) => i.id === "agent-cb-priya");
    // Seeded once the list's latency has passed.
    expect(priya?.dueAt).toBe(NOW + LATENCY.maxMs + 30 * 60_000);
  });

  it("emits reset when a different role is listed, and not when the same one is", async () => {
    const resets: ScheduleEvents["reset"][] = [];
    source.on("reset", (e) => resets.push(e));
    await settle(source.listItems({ role: "agent" }));
    await settle(source.listItems({ role: "agent" }));
    expect(resets).toHaveLength(1);
    await settle(source.listItems({ role: "sales" }));
    expect(resets.map((r) => r.snapshot.role)).toEqual(["agent", "sales"]);
  });

  it("reports open and complete only as events, after the latency", async () => {
    await settle(source.listItems({ role: "agent" }));
    const changes: ScheduleEvents["itemChanged"][] = [];
    source.on("itemChanged", (e) => changes.push(e));

    const opening = source.open("agent-mt-standup");
    expect(changes).toHaveLength(0);
    await settle(opening);
    expect(changes.map((c) => c.item.state)).toEqual(["active"]);

    await settle(source.complete("agent-mt-standup", { note: "Covered RET-1.3", actionItems: ["Share checklist"] }));
    const done = changes[1]?.item;
    expect(done?.state).toBe("done");
    // List, open, complete: three round trips.
    expect(done?.completedAt).toBe(NOW + 3 * LATENCY.maxMs);
    expect(done?.outcome).toEqual({ note: "Covered RET-1.3", actionItems: ["Share checklist"] });
  });

  it("rejects commands that don't fit the item's state, or a missing item", async () => {
    await settle(source.listItems({ role: "agent" }));
    const rejected = Promise.all([
      expect(source.complete("agent-tr-ret13", {})).rejects.toMatchObject({ code: "invalid-state" }),
      expect(source.open("agent-done-omar")).rejects.toMatchObject({ code: "invalid-state" }),
      expect(source.open("nope")).rejects.toMatchObject({ code: "not-found" }),
    ]);
    await vi.advanceTimersByTimeAsync(LATENCY.maxMs);
    await rejected;
  });

  it("emits itemDue when a scheduled item reaches its time, unless it was opened first", async () => {
    await settle(source.listItems({ role: "agent" }));
    const due: string[] = [];
    source.on("itemDue", (e) => due.push(e.item.id));
    await settle(source.open("agent-mt-standup"));
    await vi.advanceTimersByTimeAsync(90 * 60_000);
    expect(due).toEqual(["agent-cb-priya"]);
  });

  it("rejects every call once disposed", async () => {
    await source.dispose();
    await expect(source.listItems({ role: "agent" })).rejects.toMatchObject({ code: "invalid-state" });
  });
});
