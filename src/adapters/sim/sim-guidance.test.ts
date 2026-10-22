import { describe, expect, it, vi } from "vitest";
import type { Interaction, InteractionId } from "../../domain";
import type { AssistCard, AssistEvents, AssistRequestId } from "../../providers";
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
  it("queues the greeting on going live and shows nothing until a pause surfaces it; then the reason; then nothing to suggest on request", () => {
    const { contact, nba, nbaEvent, pause, request, resolve } = setUp();
    contact("offered");
    contact("active");
    // Queued, not surfaced.
    expect(nba()).toBeUndefined();
    pause();
    expect(nba()).toMatchObject({ frame: "suggestion", suggestion: { type: "say", title: "Greet Priya and say the chat is recorded" } });
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

  it("while a bot holds the contact nothing surfaces, even on request; after takeover the queued greeting does", () => {
    const { contact, nba, request, pause } = setUp();
    contact("active", { review: { by: "Virtual agent", since: 0 } });
    request();
    pause();
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

  it("its steps queue greeting → Ask → Do, each surfacing on request; a used Do starts its branch; the summary grows per customer turn", () => {
    const { guidance, contact, nba, summary, request, resolve, startBranch } = setUp("Maya Chen");
    guidance.startScript(ID, MAYA_CHEN_SCRIPT);
    contact("active", { channel: "voice" });
    expect(nba()).toBeUndefined();
    expect(summary()).toBeUndefined();

    guidance.onStep(ID, step("mcc-greet"));
    guidance.onStep(ID, step("mcc-1"));
    expect(summary()!.text).toBe("Calling for a $412.00 refund on order NR-10871, an espresso machine that arrived with a cracked water tank.");
    guidance.onStep(ID, step("mcc-ask"));
    // Nothing surfaced on its own.
    expect(nba()).toBeUndefined();
    request();
    expect(nba()).toMatchObject({ stepId: "mcc-greet", suggestion: { type: "say" } });
    resolve("used");
    request();
    expect(nba()).toMatchObject({ stepId: "mcc-ask", suggestion: { type: "ask" } });
    resolve("used");

    guidance.onStep(ID, step("mcc-3"));
    // Her card fact brings Customer Info forward (nothing surfaced).
    expect(nba()).toMatchObject({ stepId: "mcc-3", focus: "customer", frame: "listening" });
    guidance.onStep(ID, step("mcc-do"));
    request();
    expect(nba()).toMatchObject({ stepId: "mcc-do", suggestion: { type: "do", link: "maya-refund-steps", branch: "refund" } });
    resolve("used");
    expect(startBranch).toHaveBeenCalledWith(ID, "refund");

    contact("wrap-up", { channel: "voice" });
    expect(nba()).toMatchObject({ frame: "nothing" });
    expect(summary()!.status).toBe("complete");
  });

  it("Not now on a Do starts no branch", () => {
    const { guidance, contact, request, resolve, startBranch } = setUp("Maya Chen");
    guidance.startScript(ID, MAYA_CHEN_SCRIPT);
    contact("active", { channel: "voice" });
    guidance.onStep(ID, step("mcc-do"));
    request();
    resolve("dismissed");
    expect(startBranch).not.toHaveBeenCalled();
  });
});
