import { describe, expect, it } from "vitest";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { Interaction, InteractionId, JourneyId } from "@/domain";
import { diffCardOverlay, mergeCardOverlay } from "./nav-card-overlay";
import { visibleContacts } from "./useNavCards";

const card: NavCard = {
  id: "J1",
  interactionId: "J1",
  customerId: "CS-1",
  customerName: "Noah",
  threads: [
    { id: "chat:a", type: "chat", startTick: 5, providerInteractionId: "i1" as InteractionId },
    { id: "voice:1", type: "voice", startTick: 9, providerInteractionId: "i2" as InteractionId },
  ],
};

describe("mergeCardOverlay", () => {
  it("applies card and thread overlay fields, including an explicit undefined", () => {
    const merged = mergeCardOverlay(
      { ...card, threads: card.threads.map((t) => (t.id === "chat:a" ? { ...t, awaitingResponse: true } : t)) },
      { currentThreadId: "voice:1", threads: { "chat:a": { awaitingResponse: undefined, messageCount: 3 } } },
    );
    expect(merged.currentThreadId).toBe("voice:1");
    expect(merged.threads[0]).toMatchObject({ messageCount: 3 });
    expect(merged.threads[0].awaitingResponse).toBeUndefined();
    expect(merged.threads[1]).toBe(card.threads[1]);
  });

  it("returns the card untouched with no overlay", () => {
    expect(mergeCardOverlay(card, undefined)).toBe(card);
  });
});

describe("diffCardOverlay", () => {
  it("keeps overlay fields and reports provider-owned changes", () => {
    const after: NavCard = {
      ...card,
      currentThreadId: "chat:a",
      liveMessages: { "chat:a": [] },
      customerName: "Someone else",
      threads: card.threads.map((t) => (t.id === "chat:a" ? { ...t, awaitingResponse: true, startTick: 0 } : t)),
    };
    const { overlay, ignored } = diffCardOverlay(card, after, undefined);
    expect(overlay).toMatchObject({ currentThreadId: "chat:a", liveMessages: { "chat:a": [] }, threads: { "chat:a": { awaitingResponse: true } } });
    expect(overlay).not.toHaveProperty("customerName");
    expect(ignored).toEqual(expect.arrayContaining(["customerName", "threads[chat:a].startTick"]));
  });

  it("reports added or removed threads", () => {
    const { ignored } = diffCardOverlay(card, { ...card, threads: [card.threads[0]] }, undefined);
    expect(ignored).toContain("threads (added/removed)");
  });
});

describe("visibleContacts", () => {
  const base = { journeyId: "J1" as JourneyId, direction: "inbound", origin: "routed" } as const;
  const contact = (id: string, channel: Interaction["channel"], state: Interaction["state"], startedAt: number, address?: string): Interaction =>
    ({ ...base, id: id as InteractionId, channel, state, startedAt, ...(address ? { address: { value: address } } : {}) }) as Interaction;

  it("drops a thread whose newest contact ended, keeps earlier ended contacts of a live thread", () => {
    const visible = visibleContacts([
      contact("a1", "chat", "ended", 1, "a"),
      contact("a2", "chat", "active", 2, "a"),
      contact("b1", "email", "ended", 3, "b"),
      contact("o1", "sms", "offered", 4),
    ]);
    expect(visible.map((i) => i.id)).toEqual(["a1", "a2"]);
  });
});
