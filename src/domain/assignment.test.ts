// The one assignmentId derivation (P-HOME-1; P0.9's re-key replaces it).
import { describe, expect, it } from "vitest";
import { assignmentIdFor, scheduleCardKey, scheduleItemIdOf } from "./assignment";

describe("assignmentIdFor", () => {
  it("derives a stable id from a conversation card's journey key", () => {
    expect(assignmentIdFor("483920174625")).toBe(assignmentIdFor("483920174625"));
    expect(assignmentIdFor("483920174625")).not.toBe(assignmentIdFor("483920174626"));
  });

  it("derives a stable id from a schedule card's key, distinct from any journey", () => {
    const key = scheduleCardKey("agent-cb-priya");
    expect(key).toBe("schedule:agent-cb-priya");
    expect(assignmentIdFor(key)).toBe(assignmentIdFor(scheduleCardKey("agent-cb-priya")));
    expect(assignmentIdFor(key)).not.toBe(assignmentIdFor("agent-cb-priya"));
  });

  it("reads the schedule item back out of a card key", () => {
    expect(scheduleItemIdOf(scheduleCardKey("agent-mt-standup"))).toBe("agent-mt-standup");
    expect(scheduleItemIdOf("483920174625")).toBeNull();
  });
});
