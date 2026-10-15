import { afterEach, describe, expect, it } from "vitest";
import { settle } from "../../contract-tests/event-recorder";
import type { EntityId, Interaction, InteractionId, JourneyId } from "../../domain";
import { createMemoryBus } from "../sim/memory-transport";
import { createSimCustomerClient } from "../sim/sim-customer-client";
import { createSimulatedInteractionProvider } from "../sim/simulated-interaction-provider";
import { directoryDisplayName } from "@/contact-handling/contact-identity";
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
        contact("b2", "journey-b", { startedAt: at(40), channel: "email", address: { value: "b@example.com" } }),
        contact("a1", "journey-a", { startedAt: at(10) }),
        contact("b1", "journey-b", { startedAt: at(5) }),
        contact("a2", "journey-a", { startedAt: at(20), channel: "voice", address: { value: "+1555" } }),
      ],
      { toTick },
    );
    expect(cards.map((c) => c.id)).toEqual(["journey-b", "journey-a"]);
    expect(cards.map((c) => c.interactionId)).toEqual(["journey-b", "journey-a"]);
    expect(cards[0].threads.map((t) => [t.id, t.providerInteractionId])).toEqual([
      ["chat", "b1"],
      ["email:b@example.com", "b2"],
    ]);
    expect(cards[1].threads.map((t) => [t.id, t.providerInteractionId])).toEqual([
      ["chat", "a1"],
      ["voice:+1555", "a2"],
    ]);
  });

  it("leaves offered contacts out until they're accepted", () => {
    const offered = contact("o", "journey-o", { state: "offered", origin: "routed", direction: "inbound" });
    expect(buildNavCards([offered], { toTick })).toEqual([]);
    const cards = buildNavCards([offered, contact("a", "journey-o", { channel: "email", startedAt: at(1) })], { toTick });
    expect(cards).toHaveLength(1);
    expect(cards[0].threads.map((t) => t.id)).toEqual(["email"]);
  });

  it("with voiceOffers, makes a ringing voice offer its own offered card; digital offers stay out (P0.5d.1)", () => {
    const ringing = contact("v", "journey-v", { state: "offered", origin: "routed", direction: "inbound", channel: "voice", address: { value: "+1555" } });
    const chatOffer = contact("c", "journey-c", { state: "offered", origin: "routed", direction: "inbound" });
    const cards = buildNavCards([ringing, chatOffer], { toTick, voiceOffers: true });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "journey-v", offered: true });
    expect(cards[0].threads.map((t) => t.providerInteractionId)).toEqual(["v"]);
    expect(buildNavCards([{ ...ringing, state: "active" }], { toTick, voiceOffers: true })[0].offered).toBeUndefined();
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
      id: "sms:+14563833329",
      providerInteractionId: "sms-1",
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

  it("maps case status per thread key", () => {
    const [card] = buildNavCards(
      [contact("a", "j", { caseStatus: "Pending" }), contact("b", "j", { channel: "email", startedAt: at(1) })],
      { toTick },
    );
    expect(card.threadStatuses).toEqual({ chat: "Pending" });
  });

  it("runs the thread clock from acceptedAt when the contact was accepted", () => {
    const [card] = buildNavCards(
      [contact("a", "j", { origin: "routed", startedAt: at(-600), acceptedAt: at(-20) })],
      { toTick },
    );
    expect(card.threads[0].startTick).toBe(-20);
  });

  it("uses the case id as customerId, and links the entity", () => {
    const [card] = buildNavCards(
      [contact("a", "j", { caseId: "CS-1234567", entityId: "customer-2" as EntityId })],
      { toTick },
    );
    expect(card.customerId).toBe("CS-1234567");
    expect(card.entityId).toBe("customer-2");
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

  it("marks a live or held voice thread as recording from the provider, and nothing once it's in wrap-up (P0.5d.1)", () => {
    const voice = contact("v", "j", { channel: "voice", state: "active", recording: true });
    expect(buildNavCards([voice], { toTick })[0].threads[0].recording).toBe(true);
    expect(buildNavCards([{ ...voice, state: "held" }], { toTick })[0].threads[0].recording).toBe(true);
    expect(buildNavCards([{ ...voice, recording: false }], { toTick })[0].threads[0].recording).toBeUndefined();
    expect(buildNavCards([{ ...voice, state: "wrap-up" }], { toTick })[0].threads[0].recording).toBeUndefined();
  });

  it("gives a voice thread in wrap-up its wrapUpSinceTick from endedAt, and none once it's ended (P0.5d.1)", () => {
    const voice = contact("v", "j", { channel: "voice", state: "wrap-up", endedAt: at(42) });
    expect(buildNavCards([voice], { toTick })[0].threads[0].wrapUpSinceTick).toBe(42);
    expect(buildNavCards([{ ...voice, state: "ended" }], { toTick })[0].threads[0].wrapUpSinceTick).toBeUndefined();
    expect(buildNavCards([{ ...voice, state: "active", endedAt: undefined }], { toTick })[0].threads[0].wrapUpSinceTick).toBeUndefined();
  });

  it("resolves the customer name from displayName, then contactName, then address label, then address value", () => {
    const named = contact("a", "j1", { entityId: "e1" as EntityId, address: { value: "+1555", label: "Mobile" } });
    const presented = contact("d", "j4", { contactName: "Noah Patel", address: { value: "+1777", label: "Work" }, startedAt: at(3) });
    const labeled = contact("b", "j2", { address: { value: "+1666", label: "Home" }, startedAt: at(1) });
    const bare = contact("c", "j3", { address: { value: "visitor@example.com" }, startedAt: at(2) });
    const cards = buildNavCards([named, labeled, bare, presented], {
      toTick,
      displayName: (i) => (i.entityId === "e1" ? "Marcus Webb" : undefined),
    });
    expect(cards.map((c) => c.customerName)).toEqual(["Marcus Webb", "Home", "visitor@example.com", "Noah Patel"]);
    expect(cards.map((c) => c.customerId)).toEqual(["e1", "+1666", "visitor@example.com", "+1777"]);
    expect(cards.every((c) => c.currentThreadId === undefined && c.liveMessages === undefined)).toBe(true);
  });

  it("after a link, names the card from the record and keeps the presented name as presentedName", () => {
    const records: Record<string, { name: string }> = { lauren: { name: "Lauren Briggs" }, noah: { name: "Ava Thompson" } };
    const displayName = directoryDisplayName((id) => records[id]);
    const voice = { channel: "voice" as const, address: { value: "+13125550164" } };
    const linked = contact("a", "j1", { ...voice, contactName: "Jordan Reyes", entityId: "lauren" as EntityId, entityMatchedBy: "agent" });
    const routed = contact("b", "j2", { ...voice, contactName: "Lauren Briggs", entityId: "lauren" as EntityId, entityMatchedBy: "routing", startedAt: at(1) });
    const rawAddress = contact("c", "j3", { ...voice, contactName: "+13125550164", entityId: "lauren" as EntityId, entityMatchedBy: "agent", startedAt: at(2) });
    // Arrived already linked (a seed): its presented name stays the card name.
    const seeded = contact("d", "j4", { contactName: "Noah Patel", entityId: "noah" as EntityId, startedAt: at(3) });
    const cards = buildNavCards([linked, routed, rawAddress, seeded], { toTick, displayName });
    expect(cards.map((c) => [c.customerName, c.presentedName])).toEqual([
      ["Lauren Briggs", "Jordan Reyes"],
      ["Lauren Briggs", undefined],
      ["Lauren Briggs", undefined],
      ["Noah Patel", undefined],
    ]);
  });
});

describe("buildNavCards — reopen folding", () => {
  const sms = (id: string, patch: Partial<Interaction> = {}) =>
    contact(id, "j", { channel: "sms", address: { value: "+1555" }, ...patch });

  it("folds contacts on one thread: newest drives state, the first keeps contactId", () => {
    const [card] = buildNavCards(
      [
        sms("old", { state: "ended", caseStatus: "Pending", startedAt: at(0) }),
        sms("new", { origin: "reopened", caseStatus: "Open", startedAt: at(30) }),
      ],
      { toTick, messageCounts: new Map([["old" as InteractionId, 2], ["new" as InteractionId, 1]]) },
    );
    expect(card.threads).toHaveLength(1);
    const [thread] = card.threads;
    expect(thread.id).toBe("sms:+1555");
    expect(thread.providerInteractionId).toBe("new");
    expect(thread.contactId).toBe("ext-old");
    expect(thread.startTick).toBe(30);
    expect(thread.messageCount).toBe(3);
    expect(card.threadStatuses).toEqual({ "sms:+1555": "Open" });
    expect(card.closed).toBeUndefined();
    // The predecessor wasn't closed, so it's a refresh, not a reopen.
    expect(thread.reopenedContacts).toBeUndefined();
  });

  it("adds a reopenedContacts entry for each contact that follows a closed case", () => {
    const [card] = buildNavCards(
      [
        sms("first", { state: "ended", caseStatus: "Closed", startedAt: at(0) }),
        sms("second", { state: "ended", origin: "reopened", caseStatus: "Closed", startedAt: at(10) }),
        sms("third", { origin: "reopened", startedAt: at(20) }),
      ],
      { toTick, messagesBeforeReopen: (c) => (c.id === "second" ? 4 : 7) },
    );
    const entries = card.threads[0].reopenedContacts ?? [];
    expect(entries.map((e) => [e.id, e.contactId, e.messagesBeforeReopen])).toEqual([
      ["session-reopened-second", "ext-second", 4],
      ["session-reopened-third", "ext-third", 7],
    ]);
  });

  it("honours a custom closed-status rule", () => {
    const [card] = buildNavCards(
      [sms("a", { state: "ended", caseStatus: "Done" }), sms("b", { startedAt: at(5) })],
      { toTick, isClosedStatus: (s) => s === "Done" },
    );
    expect(card.threads[0].reopenedContacts).toHaveLength(1);
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
    // Still offered, so not a card yet.
    expect(buildNavCards((await provider.getSnapshot()).interactions, { toTick: tickClock(Date.now()) })).toHaveLength(1);
    await provider.accept(inbound);
    await settle(provider);

    const { interactions } = await provider.getSnapshot();
    const cards = buildNavCards(interactions, { toTick: tickClock(Date.now()) });
    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe(journeyId);
    expect(cards[0].threads.map((t) => [t.id, t.providerInteractionId, t.type])).toEqual([
      ["chat:a@example.com", first, "chat"],
      ["voice:+15550002222", second, "voice"],
    ]);
    // Both contacts on the journey share its case number.
    expect(cards[0].customerId).toMatch(/^CS-\d{7}$/);
    expect(cards[1].threads.map((t) => t.providerInteractionId)).toEqual([inbound]);
    expect(cards[1].threads[0].direction).toBe("inbound");
    expect(cards[1].customerName).toBe("Visitor");
  });
});
