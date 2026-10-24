import { describe, expect, it, vi } from "vitest";
import type { Interaction, InteractionId } from "../../domain";
import type { AssistCard, AssistEvents, AssistRequestId } from "../../providers";
import type { ScenarioStep } from "../../scenarios/scenario-script";
import { MAYA_CHEN_SCRIPT } from "../../scenarios/scripts/maya-chen";
import { createGuidance } from "./sim-guidance";

// P-CANVAS: the sim's guidance queues Next Best Actions and surfaces the
// queue's head only on the agent's request or a pause, one at a time, never
// while a bot holds the contact.

const ID = "i-1" as InteractionId;
const REQ = "req-1" as AssistRequestId;

function setUp(name = "Priya Shah") {
  const sent: AssistEvents["card"][] = [];
  const startBranch = vi.fn();
  const timers: { ms: number; run: () => void }[] = [];
  let current: Interaction | undefined;
  const guidance = createGuidance({
    now: () => 1_000,
    get: () => current,
    customerName: () => name,
    send: (payload) => sent.push(payload),
    startBranch,
    later: (ms, run) => timers.push({ ms, run }),
    releaseTurn: () => {},
  });
  const runTimers = () => timers.splice(0).forEach((t) => t.run());
  const nbaEvent = () => [...sent].reverse().find((p) => p.card.kind === "nba");
  const nba = () => nbaEvent()?.card as Extract<AssistCard, { kind: "nba" }> | undefined;
  const summary = () => [...sent].reverse().find((p) => p.card.kind === "text")?.card as Extract<AssistCard, { kind: "text" }> | undefined;
  /** An interaction snapshot, as the engine would emit it (also what `get` returns). */
  const contact = (state: Interaction["state"], patch: Partial<Interaction> = {}) => {
    current = { id: ID, channel: "chat", state, direction: "inbound", origin: "routed", startedAt: 0, ...patch } as Interaction;
    guidance.onInteraction(current);
  };
  const resolve = (outcome: "used" | "dismissed", alternative?: number) =>
    guidance.resolve(`nba:${ID}`, { outcome, ...(alternative !== undefined ? { alternative } : {}) });
  const request = () => guidance.surface(ID, "request", REQ);
  const pause = () => guidance.surface(ID, "pause", "pause-1" as AssistRequestId);
  return { guidance, sent, nba, nbaEvent, summary, contact, resolve, request, pause, startBranch, timers, runTimers };
}

describe("the rule set (a contact with no script)", () => {
  it("on connect the greeting is the agent's turn (surfaced by the turn trigger, no pause); then the reason; then nothing to suggest on request", () => {
    const { guidance, contact, nba, nbaEvent, pause, request, resolve } = setUp();
    contact("offered");
    expect(nba()).toBeUndefined();
    contact("active");
    // Waiting as the agent's turn: the agent UI surfaces it after the scripted beat.
    expect(nba()).toMatchObject({ frame: "listening", awaitingAgent: true });
    guidance.surface(ID, "turn", REQ);
    expect(nba()).toMatchObject({ frame: "suggestion", suggestion: { type: "say", title: "Greet Priya and say the chat is recorded" } });
    // Not a scripted turn: nothing waits on it once it shows.
    expect(nba()!.awaitingAgent).toBeUndefined();
    expect(nba()!.suggestion!.text).toContain("This chat is recorded");
    expect(nba()!.suggestion!.alt.map((a) => a.text)).toEqual(["Identify yourself", "Confirm the callback number"]);
    // One at a time: another pause while it shows changes nothing.
    const shown = nba()!.stepId;
    pause();
    expect(nba()!.stepId).toBe(shown);
    resolve("used");
    expect(nba()).toMatchObject({ frame: "listening" });
    // The reason is next, but only on the next pause or request.
    request();
    expect(nbaEvent()).toMatchObject({ requestId: "req-1", card: { frame: "suggestion", suggestion: { type: "ask" } } });
    resolve("dismissed");
    // Nothing left: a pause surfaces nothing; a request answers "nothing".
    const before = nba()!.stepId;
    pause();
    expect(nba()!.stepId).toBe(before);
    request();
    expect(nbaEvent()).toMatchObject({ requestId: "req-1", card: { frame: "nothing" } });
    expect(() => resolve("used")).toThrow(/nothing to answer/);
  });

  it("a call says the call is recorded; wrap-up leaves nothing", () => {
    const { contact, nba, request } = setUp();
    contact("active", { channel: "voice" });
    request();
    expect(nba()!.suggestion!.text).toContain("This call is recorded");
    contact("wrap-up", { channel: "voice" });
    expect(nba()).toMatchObject({ frame: "nothing" });
    expect(nba()!.suggestion).toBeUndefined();
  });

  it("an unnamed contact (a dialed number) is greeted without a name", () => {
    const { contact, nba, request } = setUp("(646) 555-0143");
    contact("active", { channel: "voice" });
    request();
    expect(nba()!.suggestion!.text).toMatch(/^Hi there,/);
  });

  it("a dialed outbound gets the greeting when the far end answers, not while it rings", () => {
    const { guidance, contact, nba } = setUp("(646) 555-0143");
    contact("connecting", { channel: "voice", direction: "outbound", origin: "agent-initiated" });
    expect(nba()).toBeUndefined();
    contact("active", { channel: "voice", direction: "outbound", origin: "agent-initiated" });
    expect(nba()).toMatchObject({ frame: "listening", awaitingAgent: true });
    guidance.surface(ID, "turn", REQ);
    expect(nba()).toMatchObject({ stepId: "rule-greeting", frame: "suggestion", suggestion: { type: "say" } });
  });

  it("while a bot holds the contact nothing surfaces, even on request; after takeover the queued greeting does", () => {
    const { guidance, contact, nba, request, pause } = setUp();
    contact("active", { review: { by: "Virtual agent", since: 0 } });
    request();
    pause();
    guidance.surface(ID, "turn", REQ);
    expect(nba()).toBeUndefined();
    contact("active");
    pause();
    expect(nba()).toMatchObject({ frame: "suggestion", suggestion: { type: "say" } });
  });

  it("a known customer's journey lookup brings the Journey Summary forward, as its own step", () => {
    const { contact, nba, timers, runTimers } = setUp();
    contact("active", { entityId: "customer-1" as Interaction["entityId"] });
    expect(timers.map((t) => t.ms)).toEqual([800]);
    runTimers();
    expect(nba()).toMatchObject({ stepId: "rule-journey", focus: "journey", frame: "listening" });
  });

  it("an unknown contact has no lookup to complete", () => {
    const { contact, timers } = setUp();
    contact("active");
    expect(timers).toEqual([]);
  });

  it("a routed call's pre-contact lines start the Real-Time Summary", () => {
    const { contact, summary } = setUp();
    contact("active", { channel: "voice", preContactSummary: ["Calling about a refund.", "Known caller."] });
    expect(summary()).toMatchObject({ purpose: "real-time-summary", status: "streaming", text: "Calling about a refund. Known caller." });
  });
});

describe("a scripted contact (Maya Chen)", () => {
  const step = (id: string) => [...MAYA_CHEN_SCRIPT.steps].find((s) => s.id === id)!;

  const turnSetUp = () => {
    const releaseTurn = vi.fn();
    const sent: AssistEvents["card"][] = [];
    const startBranch = vi.fn((..._: unknown[]) => order.push("branch"));
    const order: string[] = [];
    releaseTurn.mockImplementation(() => order.push("release"));
    let current: Interaction | undefined;
    const guidance = createGuidance({
      now: () => 1_000,
      get: () => current,
      customerName: () => "Maya Chen",
      send: (payload) => sent.push(payload),
      startBranch,
      later: () => {},
      releaseTurn,
    });
    const nba = () => [...sent].reverse().find((p) => p.card.kind === "nba")?.card as Extract<AssistCard, { kind: "nba" }> | undefined;
    const summary = () => [...sent].reverse().find((p) => p.card.kind === "text")?.card as Extract<AssistCard, { kind: "text" }> | undefined;
    guidance.startScript(ID, MAYA_CHEN_SCRIPT);
    current = { id: ID, channel: "voice", state: "active", direction: "inbound", origin: "routed", startedAt: 0 } as Interaction;
    guidance.onInteraction(current);
    return { guidance, nba, summary, releaseTurn, startBranch, order };
  };

  it("an agent line with a suggestion is the agent's turn: it waits (awaitingAgent), surfaces on the turn trigger, and answering it releases the line", () => {
    const { guidance, nba, summary, releaseTurn } = turnSetUp();
    guidance.onStep(ID, step("mcc-1"));
    expect(summary()!.text).toBe("Calling for a $412.00 refund on order NR-10871, an espresso machine that arrived with a cracked water tank.");
    expect(nba()).toBeUndefined();
    guidance.onStep(ID, step("mcc-2"));
    expect(nba()).toMatchObject({ frame: "listening", awaitingAgent: true });
    guidance.surface(ID, "turn", REQ);
    expect(nba()).toMatchObject({ stepId: "mcc-2", frame: "suggestion", awaitingAgent: true, suggestion: { type: "say" } });
    guidance.resolve(`nba:${ID}`, { outcome: "used" });
    expect(releaseTurn).toHaveBeenCalledWith(ID, false);
    expect(nba()).toMatchObject({ frame: "listening" });
    expect(nba()!.awaitingAgent).toBeUndefined();
  });

  it("Not now releases the line too; a typed turn releases it without the line", () => {
    const { guidance, releaseTurn } = turnSetUp();
    guidance.onStep(ID, step("mcc-2"));
    guidance.surface(ID, "turn", REQ);
    guidance.resolve(`nba:${ID}`, { outcome: "dismissed" });
    expect(releaseTurn).toHaveBeenLastCalledWith(ID, false);
    guidance.onStep(ID, step("mcc-ask"));
    guidance.surface(ID, "turn", REQ);
    guidance.resolve(`nba:${ID}`, { outcome: "used", agentTyped: true });
    expect(releaseTurn).toHaveBeenLastCalledWith(ID, true);
  });

  it("Run it on the Do runs its branch, then releases the line; the chip surfaces a waiting turn early", () => {
    const { guidance, nba, order } = turnSetUp();
    guidance.onStep(ID, step("mcc-do"));
    // The chip (a request) before the beat: the waiting turn surfaces.
    guidance.surface(ID, "request", REQ);
    expect(nba()).toMatchObject({ stepId: "mcc-do", suggestion: { type: "do", link: "maya-refund-steps", branch: "refund" } });
    guidance.resolve(`nba:${ID}`, { outcome: "used" });
    expect(order).toEqual(["branch", "release"]);
  });

  it("a turn trigger with no waiting turn surfaces nothing; wrap-up clears a waiting turn", () => {
    const { guidance, nba, summary } = turnSetUp();
    guidance.surface(ID, "turn", REQ);
    expect(nba()).toBeUndefined();
    guidance.onStep(ID, step("mcc-2"));
    guidance.onInteraction({ id: ID, channel: "voice", state: "wrap-up", direction: "inbound", origin: "routed", startedAt: 0 } as Interaction);
    expect(nba()).toMatchObject({ frame: "nothing" });
    expect(nba()!.awaitingAgent).toBeUndefined();
    expect(summary()?.status ?? "complete").toBe("complete");
  });

  it("her card fact brings Customer Info forward (nothing surfaced)", () => {
    const { guidance, nba } = turnSetUp();
    guidance.onStep(ID, step("mcc-3"));
    expect(nba()).toMatchObject({ stepId: "mcc-3", focus: "customer", frame: "listening" });
  });
});

describe("a guide step's suggestion (P-SHRINK)", () => {
  const nbaStep = {
    id: "g-1",
    kind: "guide",
    at: 0,
    nba: {
      type: "do",
      title: "Approve the refund",
      why: "Within policy.",
      action: "Authorizes the refund",
      branch: "approved",
      alt: [
        { type: "do", text: "Reject the refund", branch: "rejected", note: { label: "Reason", placeholder: "Why?", required: true } },
        { type: "do", text: "Send a 20% discount code", branch: "discount", vars: { discountPercent: "20" } },
        { type: "do", text: "Issue store credit", branch: "credit", note: { label: "Credit amount", placeholder: "200", input: "storeCreditAmount", kind: "amount" } },
      ],
    },
  } as const satisfies ScenarioStep;

  function guideSetUp(review: boolean) {
    const sent: AssistEvents["card"][] = [];
    const startBranch = vi.fn();
    const releaseTurn = vi.fn();
    let current = { id: ID, channel: "voice", state: "active", direction: "inbound", origin: "routed", startedAt: 0, ...(review ? { review: { by: "Cognigy AI Agent", since: 0 } } : {}) } as Interaction;
    const guidance = createGuidance({
      now: () => 1_000,
      get: () => current,
      customerName: () => "Marcus Webb",
      send: (payload) => sent.push(payload),
      startBranch,
      later: () => {},
      releaseTurn,
    });
    guidance.startScript(ID, MAYA_CHEN_SCRIPT);
    guidance.onInteraction(current);
    const nba = () => [...sent].reverse().find((p) => p.card.kind === "nba")?.card as Extract<AssistCard, { kind: "nba" }> | undefined;
    const takeOver = () => {
      current = { ...current, review: undefined };
      guidance.onInteraction(current);
    };
    return { guidance, nba, startBranch, releaseTurn, takeOver };
  }

  it("is the agent's turn and surfaces while a bot holds the contact; the note shows, its input name doesn't", () => {
    const { guidance, nba } = guideSetUp(true);
    guidance.onStep(ID, nbaStep);
    expect(nba()).toMatchObject({ frame: "listening", awaitingAgent: true });
    guidance.surface(ID, "turn", REQ);
    expect(nba()).toMatchObject({ frame: "suggestion", stepId: "g-1" });
    expect(nba()!.suggestion!.alt[0].note).toEqual({ label: "Reason", placeholder: "Why?", required: true });
    expect(nba()!.suggestion!.alt[2].note).toEqual({ label: "Credit amount", placeholder: "200", kind: "amount" });
    expect(nba()!.suggestion!.alt[1]).not.toHaveProperty("vars");
  });

  it("a request still surfaces nothing in review when the turn isn't the bot's (an agent line)", () => {
    const { guidance, nba } = guideSetUp(true);
    guidance.onStep(ID, { id: "a-1", kind: "say", speaker: "agent", at: 0, text: "Hi", nba: { type: "say", title: "Greet", why: "-", text: "Hi" } });
    guidance.surface(ID, "turn", REQ);
    expect(nba()!.frame).not.toBe("suggestion");
  });

  it("taking over withdraws it, surfaced or not, with no branch and no release", () => {
    const shown = guideSetUp(true);
    shown.guidance.onStep(ID, nbaStep);
    shown.guidance.surface(ID, "turn", REQ);
    shown.takeOver();
    expect(shown.nba()).toMatchObject({ frame: "listening" });
    expect(shown.nba()!.awaitingAgent).toBeUndefined();
    expect(shown.startBranch).not.toHaveBeenCalled();
    expect(shown.releaseTurn).not.toHaveBeenCalled();
    const waiting = guideSetUp(true);
    waiting.guidance.onStep(ID, nbaStep);
    waiting.takeOver();
    waiting.guidance.surface(ID, "turn", REQ);
    expect(waiting.nba()!.frame).not.toBe("suggestion");
  });

  it("outside review it isn't withdrawn by later snapshots", () => {
    const { guidance, nba, takeOver } = guideSetUp(false);
    guidance.onStep(ID, nbaStep);
    takeOver();
    guidance.surface(ID, "turn", REQ);
    expect(nba()).toMatchObject({ frame: "suggestion", stepId: "g-1" });
  });

  it("the used option's note and vars reach its branch: note, a named input, fixed vars", () => {
    const run = (resolution: Parameters<ReturnType<typeof createGuidance>["resolve"]>[1]) => {
      const { guidance, startBranch, releaseTurn } = guideSetUp(true);
      guidance.onStep(ID, nbaStep);
      guidance.surface(ID, "turn", REQ);
      guidance.resolve(`nba:${ID}`, resolution);
      expect(releaseTurn).toHaveBeenCalledWith(ID, false);
      return startBranch.mock.calls[0];
    };
    expect(run({ outcome: "used" })).toEqual([ID, "approved", {}]);
    expect(run({ outcome: "used", alternative: 0, note: "Needs photos" })).toEqual([ID, "rejected", { note: "Needs photos" }]);
    expect(run({ outcome: "used", alternative: 1 })).toEqual([ID, "discount", { vars: { discountPercent: "20" } }]);
    expect(run({ outcome: "used", alternative: 2, note: "150" })).toEqual([ID, "credit", { vars: { storeCreditAmount: "150" } }]);
  });
});
