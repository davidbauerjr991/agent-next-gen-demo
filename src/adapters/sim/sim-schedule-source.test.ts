// The stub schedule source (P-HOME-1): one seeded day per role, every kind
// through it, state changes only as events after the sim's latency.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentKind } from "../../domain";
import type { ScheduleEvents } from "../../providers";
import { createSimScheduleProvider, type SimScheduleProvider } from "./sim-schedule-source";

const NOW = new Date(2026, 9, 24, 10, 30).getTime();
const LATENCY = { minMs: 50, maxMs: 50 };

let source: SimScheduleProvider;

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
    // Completed conversations are Contact History's, not the schedule's (P-HOME-1h).
    expect(kindsOf(agent.items)).toEqual(new Set(["callback", "meeting", "training", "task"]));
    expect(agent.items.filter((i) => i.kind === "callback")).toHaveLength(3);
    expect(agent.items.filter((i) => i.kind === "training")).toHaveLength(3);
    expect(agent.items.some((i) => i.state === "done")).toBe(false);

    const supervisor = await settle(source.listItems({ role: "supervisor" }));
    expect(kindsOf(supervisor.items)).toEqual(new Set(["conversation", "evaluation", "coaching", "meeting"]));
    expect(supervisor.items.find((i) => i.kind === "conversation")?.state).toBe("offered");
    expect(Object.keys(supervisor.cards)).toEqual(["teamQueues", "teamToday", "needsYou"]);

    const sales = await settle(source.listItems({ role: "sales" }));
    expect(kindsOf(sales.items)).toEqual(new Set(["callback", "meeting", "campaign-block"]));
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
      expect(source.release("agent-tr-ret13")).rejects.toMatchObject({ code: "invalid-state" }),
      expect(source.decline("agent-tr-ret13")).rejects.toMatchObject({ code: "invalid-state" }),
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

  it("adds notes to an open item without completing it or cancelling its due time", async () => {
    await settle(source.listItems({ role: "agent" }));
    const due: string[] = [];
    source.on("itemDue", (e) => due.push(e.item.id));
    const changes: ScheduleEvents["itemChanged"][] = [];
    source.on("itemChanged", (e) => changes.push(e));
    await settle(source.addNote("agent-cb-priya", "Left a voicemail"));
    await settle(source.addNote("agent-cb-priya", "Customer called back"));
    expect(changes[changes.length - 1]?.item).toMatchObject({ state: "scheduled", notes: ["Left a voicemail", "Customer called back"] });
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    expect(due).toEqual(["agent-cb-priya"]);
    await settle(source.open("agent-mt-standup"));
    await settle(source.complete("agent-mt-standup", {}));
    const rejected = expect(source.addNote("agent-mt-standup", "late")).rejects.toMatchObject({ code: "invalid-state" });
    await vi.advanceTimersByTimeAsync(LATENCY.maxMs);
    await rejected;
  });

  it("release returns an open item to the feed, still due when it was; decline turns an offer down", async () => {
    await settle(source.listItems({ role: "agent" }));
    const due: string[] = [];
    source.on("itemDue", (e) => due.push(e.item.id));
    const changes: ScheduleEvents["itemChanged"][] = [];
    source.on("itemChanged", (e) => changes.push(e));
    await settle(source.open("agent-cb-priya"));
    await settle(source.release("agent-cb-priya"));
    expect(changes.map((c) => c.item.state)).toEqual(["active", "scheduled"]);
    expect(changes[1]?.item.outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    expect(due).toEqual(["agent-cb-priya"]);

    await settle(source.listItems({ role: "supervisor" }));
    await settle(source.decline("sup-esc-briggs"));
    expect(changes[changes.length - 1]?.item).toMatchObject({ id: "sup-esc-briggs", state: "declined" });
  });

  it("park keeps the item with no due (no due event while parked); unpark returns it at its due, or now once that's past", async () => {
    await settle(source.listItems({ role: "agent" }));
    const due: string[] = [];
    source.on("itemDue", (e) => due.push(e.item.id));
    const changes: ScheduleEvents["itemChanged"][] = [];
    source.on("itemChanged", (e) => changes.push(e));
    await settle(source.park("agent-cb-priya"));
    const parked = changes[changes.length - 1]!.item;
    expect(parked).toMatchObject({ state: "parked", parkedAt: NOW + 2 * LATENCY.maxMs });
    const originalDue = parked.dueAt;
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    expect(due).toEqual([]);
    // Past its due: back at now.
    await settle(source.unpark("agent-cb-priya"));
    const back = changes[changes.length - 1]!.item;
    expect(back.state).toBe("scheduled");
    expect(back.parkedAt).toBeUndefined();
    expect(back.dueAt).toBeGreaterThan(originalDue);
    // Still ahead: back at its original due, which then fires.
    await settle(source.park("agent-mt-standup"));
    const meetingDue = changes[changes.length - 1]!.item.dueAt;
    await settle(source.unpark("agent-mt-standup"));
    expect(changes[changes.length - 1]!.item.dueAt).toBe(meetingDue);
    await vi.advanceTimersByTimeAsync(90 * 60_000);
    expect(due).toContain("agent-mt-standup");
    const rejected = expect(source.unpark("agent-tr-ret13")).rejects.toMatchObject({ code: "invalid-state" });
    await vi.advanceTimersByTimeAsync(LATENCY.maxMs);
    await rejected;
  });

  it("open takes a parked item straight to active, unparked (P-HOME-1m)", async () => {
    await settle(source.listItems({ role: "agent" }));
    const changes: ScheduleEvents["itemChanged"][] = [];
    source.on("itemChanged", (e) => changes.push(e));
    await settle(source.park("agent-cb-priya"));
    await settle(source.open("agent-cb-priya"));
    const opened = changes[changes.length - 1]!.item;
    expect(opened.state).toBe("active");
    expect(opened.parkedAt).toBeUndefined();
  });

  it("remove deletes only what the agent created (itemRemoved); anything else is refused", async () => {
    const { items } = await settle(source.listItems({ role: "agent" }));
    expect(items.filter((i) => i.deletable).map((i) => i.id)).toEqual(["agent-cb-sofia", "agent-cb-nathan"]);
    const removed: string[] = [];
    source.on("itemRemoved", (e) => removed.push(e.id));
    await settle(source.remove("agent-cb-sofia"));
    expect(removed).toEqual(["agent-cb-sofia"]);
    const after = await settle(source.listItems({ role: "agent" }));
    expect(after.items.some((i) => i.id === "agent-cb-sofia")).toBe(false);
    const rejected = Promise.all([
      expect(source.remove("agent-tr-ret13")).rejects.toMatchObject({ code: "invalid-state" }),
      expect(source.remove("agent-cb-sofia")).rejects.toMatchObject({ code: "not-found" }),
    ]);
    await vi.advanceTimersByTimeAsync(LATENCY.maxMs);
    await rejected;
  });

  it("add (sim-only) puts an item in the day after it was listed, as an itemChanged, with its due armed; a duplicate is refused", async () => {
    const { items } = await settle(source.listItems({ role: "agent" }));
    const changes: ScheduleEvents["itemChanged"][] = [];
    source.on("itemChanged", (e) => changes.push(e));
    const due: string[] = [];
    source.on("itemDue", (e) => due.push(e.item.id));
    const added = { ...items[0]!, id: "added", dueAt: Date.now() + 10 * 60_000 };
    await settle(source.add(added));
    expect(changes.map((c) => c.item.id)).toEqual(["added"]);
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    expect(due).toContain("added");
    const rejected = expect(source.add(added)).rejects.toMatchObject({ code: "invalid-state" });
    await vi.advanceTimersByTimeAsync(LATENCY.maxMs);
    await rejected;
  });

  it("rejects every call once disposed", async () => {
    await source.dispose();
    await expect(source.listItems({ role: "agent" })).rejects.toMatchObject({ code: "invalid-state" });
  });
});
