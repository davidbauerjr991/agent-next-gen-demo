import { afterEach, describe, expect, it } from "vitest";
import { settle } from "../../contract-tests/event-recorder";
import type { EntityId, Interaction, InteractionId, JourneyId } from "../../domain";
import { createMemoryBus } from "../sim/memory-transport";
import { createSimCustomerClient } from "../sim/sim-customer-client";
import { createSimulatedInteractionProvider } from "../sim/simulated-interaction-provider";
import { buildNavCards, tickClock } from "./nav-card-view-model";

// Domain Interactions → left-nav card view model (P0.5.0).

const ANCHOR = 1_700_000_000_000;
const toTick = tickClock(ANCHOR);
const at = (seconds: number) => ANCHOR + seconds * 1000;

function contact(id: string, journey: string, patch: Partial<Interaction> = {}): Interaction {
  return {
    id: id as InteractionId,
    externalId: { system: "sim", id: `ext-${id}` },
    journeyId: journey as JourneyId,
    channel: "chat",
    direction: "outbound",
    state: "active",
    origin: "agent-initiated",
    startedAt: at(0),
    ...patch,
  };
}

describe("tickClock", () => {
  it("counts whole seconds from the anchor, negative before it", () => {
    expect(toTick(at(0))).toBe(0);
    expect(toTick(at(12) + 999)).toBe(12);
    expect(toTick(at(-30))).toBe(-30);
  });
});

describe("buildNavCards — grouping", () => {
  it("makes one card per journey, ordered by the journey's first contact, threads by startedAt", () => {
    const cards = buildNavCards(
      [
        contact("b2", "journey-b", { startedAt: at(40) }),
        contact("a1", "journey-a", { startedAt: at(10) }),
        contact("b1", "journey-b", { startedAt: at(5) }),
        contact("a2", "journey-a", { startedAt: at(20) }),
      ],
      { toTick },
    );
    expect(cards.map((c) => c.id)).toEqual(["journey-b", "journey-a"]);
    expect(cards.map((c) => c.interactionId)).toEqual(["journey-b", "journey-a"]);
    expect(cards[0].threads.map((t) => t.id)).toEqual(["b1", "b2"]);
    expect(cards[1].threads.map((t) => t.id)).toEqual(["a1", "a2"]);
  });

  it("keeps two concurrent journeys with the same entity as separate cards", () => {
    const entityId = "cust-1" as EntityId;
    const cards = buildNavCards(
      [contact("x", "journey-x", { entityId }), contact("y", "journey-y", { entityId, startedAt: at(1) })],
      { toTick },
    );
    expect(cards.map((c) => c.id)).toEqual(["journey-x", "journey-y"]);
    expect(cards.every((c) => c.customerId === "cust-1")).toBe(true);
  });
});

describe("buildNavCards — field mapping", () => {
  it("maps thread fields from the domain contact", () => {
    const [card] = buildNavCards(
      [
        contact("sms-1", "j", {
          channel: "sms",
          address: { value: "+14563833329", label: "(456) 383-3329" },
          skill: { id: "billing", name: "Billing" },
          startedAt: at(-30),
          awaitingAgentSince: at(15),
        }),
      ],
      { toTick, messageCounts: new Map([["sms-1" as InteractionId, 3]]) },
    );
    expect(card.threads[0]).toEqual({
      id: "sms-1",
      type: "sms",
      startTick: -30,
      contactId: "ext-sms-1",
      direction: "outbound",
      preview: "Billing",
      value: "+14563833329",
      addressLabel: "(456) 383-3329",
      awaitingResponse: true,
      lastCustomerMessageTick: 15,
      messageCount: 3,
      startedFresh: true,
    });
  });

  it("maps hold, routed origin and leaves voice message count undefined", () => {
    const [card] = buildNavCards(
      [contact("v", "j", { channel: "voice", direction: "inbound", origin: "routed", state: "held", heldSince: at(7) })],
      { toTick, messageCounts: new Map([["v" as InteractionId, 4]]) },
    );
    const [thread] = card.threads;
    expect(thread.heldByAgent).toBe(true);
    expect(thread.heldSinceTick).toBe(7);
    expect(thread.direction).toBe("inbound");
    expect(thread.startedFresh).toBeUndefined();
    expect(thread.messageCount).toBeUndefined();
    expect(thread.awaitingResponse).toBeUndefined();
  });

  it("maps case status per thread", () => {
    const [card] = buildNavCards(
      [contact("a", "j", { caseStatus: "Pending" }), contact("b", "j", { startedAt: at(1) })],
      { toTick },
    );
    expect(card.threadStatuses).toEqual({ a: "Pending" });
  });

  it("sets voiceCallEnded once a voice contact reaches wrap-up, and closed only when every contact ended", () => {
    const voice = contact("v", "j", { channel: "voice", state: "wrap-up" });
    const chat = contact("c", "j", { startedAt: at(1) });
    const [live] = buildNavCards([voice, chat], { toTick });
    expect(live.voiceCallEnded).toBe(true);
    expect(live.closed).toBeUndefined();

    const [done] = buildNavCards([{ ...voice, state: "ended" }, { ...chat, state: "ended" }], { toTick });
    expect(done.voiceCallEnded).toBe(true);
    expect(done.closed).toBe(true);

    const [chatOnly] = buildNavCards([chat], { toTick });
    expect(chatOnly.voiceCallEnded).toBeUndefined();
  });

  it("resolves the customer name from displayName, then address label, then address value", () => {
    const named = contact("a", "j1", { entityId: "e1" as EntityId, address: { value: "+1555", label: "Mobile" } });
    const labeled = contact("b", "j2", { address: { value: "+1666", label: "Home" }, startedAt: at(1) });
    const bare = contact("c", "j3", { address: { value: "visitor@example.com" }, startedAt: at(2) });
    const cards = buildNavCards([named, labeled, bare], {
      toTick,
      displayName: (i) => (i.entityId === "e1" ? "Marcus Webb" : undefined),
    });
    expect(cards.map((c) => c.customerName)).toEqual(["Marcus Webb", "Home", "visitor@example.com"]);
    expect(cards.map((c) => c.customerId)).toEqual(["e1", "+1666", "visitor@example.com"]);
    expect(cards.every((c) => c.currentThreadId === undefined && c.liveMessages === undefined)).toBe(true);
  });
});

describe("buildNavCards — against the sim", () => {
  const disposers: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const dispose of disposers.splice(0)) await dispose();
  });

  it("groups two dials on one journey into one card and an inbound contact into its own", async () => {
    const ZERO = { minMs: 0, maxMs: 0 };
    const bus = createMemoryBus();
    const provider = createSimulatedInteractionProvider({
      latency: ZERO,
      timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
      createTransport: bus.createTransport,
    });
    const customer = createSimCustomerClient(provider.sessionId, bus.createTransport());
    disposers.push(async () => {
      customer.dispose();
      await provider.dispose();
    });

    const [chatSkill] = await provider.listOutboundSkills("chat");
    const [voiceSkill] = await provider.listOutboundSkills("voice");
    const first = await provider.dial({ channel: "chat", address: "a@example.com", skillId: chatSkill.id });
    const { interactions: afterFirst } = await provider.getSnapshot();
    const journeyId = afterFirst.find((i) => i.id === first)!.journeyId;
    const second = await provider.dial({ channel: "voice", address: "+15550002222", skillId: voiceSkill.id, journeyId });
    const inbound = customer.startInbound({ channel: "chat", address: "web-visitor", displayName: "Visitor" });
    await settle(provider);

    const { interactions } = await provider.getSnapshot();
    const cards = buildNavCards(interactions, { toTick: tickClock(Date.now()) });
    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe(journeyId);
    expect(cards[0].threads.map((t) => [t.id, t.type])).toEqual([
      [first, "chat"],
      [second, "voice"],
    ]);
    expect(cards[1].threads.map((t) => t.id)).toEqual([inbound]);
    expect(cards[1].threads[0].direction).toBe("inbound");
  });
});
