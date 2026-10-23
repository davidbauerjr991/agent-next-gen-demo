// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { applyCustomOrder, DEFAULT_SORT_DIRECTION, sortAssignmentCards } from "./assignment-sort";

/** A card with one thread per [type, startTick]. */
const card = (id: string, threads: [string, number][]): Interaction =>
  ({ id, customerName: id, threads: threads.map(([type, startTick], i) => ({ id: `${type}-${i}`, type, startTick })) }) as unknown as Interaction;

// a: chat at 10, then voice at 50 (last updated 50, created 10)
// b: email at 20 (both 20)
// c: voice at 30 (both 30)
// d: sms at 5, whatsapp at 40 (last updated 40, created 5)
const A = card("a", [["chat", 10], ["voice", 50]]);
const B = card("b", [["email", 20]]);
const C = card("c", [["voice", 30]]);
const D = card("d", [["sms", 5], ["whatsapp", 40]]);
const ALL = [A, B, C, D];
const ids = (list: Interaction[]) => list.map((i) => i.id);

describe("assignment sort modes (P-PROFILES 0b)", () => {
  it("Last updated: newest first by default, oldest first ascending", () => {
    expect(ids(sortAssignmentCards(ALL, { mode: "lastUpdated", direction: "desc" }))).toEqual(["a", "d", "c", "b"]);
    expect(ids(sortAssignmentCards(ALL, { mode: "lastUpdated", direction: "asc" }))).toEqual(["b", "c", "d", "a"]);
  });

  it("Create date: by the first thread", () => {
    expect(ids(sortAssignmentCards(ALL, { mode: "startDate", direction: "desc" }))).toEqual(["c", "b", "a", "d"]);
    expect(ids(sortAssignmentCards(ALL, { mode: "startDate", direction: "asc" }))).toEqual(["d", "a", "b", "c"]);
  });

  it("Channel A–Z: by the first thread's channel name, ties last updated first; Z–A reverses the names", () => {
    const E = card("e", [["chat", 60]]);
    // Chat (e at 60, a at 50), Email (b), SMS (d), Voice (c)
    expect(ids(sortAssignmentCards([...ALL, E], { mode: "channel", direction: "asc" }))).toEqual(["e", "a", "b", "d", "c"]);
    expect(ids(sortAssignmentCards([...ALL, E], { mode: "channel", direction: "desc" }))).toEqual(["c", "d", "b", "e", "a"]);
  });

  it("Custom: the dragged order; cards not in it land on top, newest first; direction is ignored", () => {
    const order = ["c", "a", "b"];
    expect(ids(sortAssignmentCards(ALL, { mode: "custom", direction: "asc" }, order))).toEqual(["d", "c", "a", "b"]);
    expect(ids(sortAssignmentCards(ALL, { mode: "custom", direction: "desc" }, order))).toEqual(["d", "c", "a", "b"]);
    const E = card("e", [["chat", 60]]);
    expect(ids(applyCustomOrder([...ALL, E], order))).toEqual(["e", "d", "c", "a", "b"]);
  });

  it("a dismissed card's id in the order is skipped", () => {
    expect(ids(applyCustomOrder([A, B], ["gone", "b", "a"]))).toEqual(["b", "a"]);
  });

  it("each mode has a natural direction: dates newest first, channels A–Z", () => {
    expect(DEFAULT_SORT_DIRECTION).toEqual({ lastUpdated: "desc", startDate: "desc", channel: "asc", custom: "desc" });
  });
});
