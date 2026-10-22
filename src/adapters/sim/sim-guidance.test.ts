import { describe, expect, it, vi } from "vitest";
import type { Interaction, InteractionId } from "../../domain";
import type { AssistCard, AssistEvents } from "../../providers";
import { MAYA_CHEN_SCRIPT } from "../../scenarios/scripts/maya-chen";
import { createGuidance } from "./sim-guidance";

const ID = "i-1" as InteractionId;

function setUp(name = "Priya Shah") {
  const sent: AssistEvents["card"][] = [];
  const startBranch = vi.fn();
  const guidance = createGuidance({
    now: () => 1_000,
    get: () => undefined,
    customerName: () => name,
    send: (payload) => sent.push(payload),
    startBranch,
  });
  const nba = () => [...sent].reverse().find((p) => p.card.kind === "nba")?.card as Extract<AssistCard, { kind: "nba" }> | undefined;
  const summary = () => [...sent].reverse().find((p) => p.card.kind === "text")?.card as Extract<AssistCard, { kind: "text" }> | undefined;
  const contact = (state: Interaction["state"], patch: Partial<Interaction> = {}) =>
    ({ id: ID, channel: "chat", state, direction: "inbound", origin: "routed", startedAt: 0, ...patch }) as Interaction;
  const resolve = (outcome: "used" | "dismissed", alternative?: number) =>
    guidance.resolve(nba()!.id, { outcome, ...(alternative !== undefined ? { alternative } : {}) });
  return { guidance, sent, nba, summary, contact, resolve, startBranch };
}

describe("the rule set (a contact with no script)", () => {
  it("greets on going live, asks the reason once that's answered, then has nothing to suggest", () => {
    const { guidance, nba, contact, resolve } = setUp();
    guidance.onInteraction(contact("offered"));
    expect(nba()).toBeUndefined();
    guidance.onInteraction(contact("active"));
    expect(nba()).toMatchObject({ frame: "suggestion", suggestion: { type: "say", title: "Greet Priya and say the chat is recorded" } });
    expect(nba()!.suggestion!.text).toContain("This chat is recorded");
    expect(nba()!.suggestion!.alt.map((a) => a.text)).toEqual(["Identify yourself", "Confirm the callback number"]);
    const greetingStep = nba()!.stepId;
    resolve("used");
    expect(nba()).toMatchObject({ frame: "suggestion", suggestion: { type: "ask" } });
    expect(nba()!.stepId).not.toBe(greetingStep);
    resolve("dismissed");
    expect(nba()).toMatchObject({ frame: "nothing" });
    expect(() => resolve("used")).toThrow(/nothing to answer/);
  });

  it("a call says the call is recorded; wrap-up leaves nothing to suggest", () => {
    const { guidance, nba, contact } = setUp();
    guidance.onInteraction(contact("active", { channel: "voice" }));
    expect(nba()!.suggestion!.text).toContain("This call is recorded");
    guidance.onInteraction(contact("wrap-up", { channel: "voice" }));
    expect(nba()).toMatchObject({ frame: "nothing" });
    expect(nba()!.suggestion).toBeUndefined();
  });

  it("an unnamed contact (a dialed number) is greeted without a name", () => {
    const { guidance, nba, contact } = setUp("(646) 555-0143");
    guidance.onInteraction(contact("active", { channel: "voice" }));
    expect(nba()!.suggestion!.text).toMatch(/^Hi there,/);
  });

  it("a routed call's pre-contact lines start the Real-Time Summary", () => {
    const { guidance, summary, contact } = setUp();
    guidance.onInteraction(contact("active", { channel: "voice", preContactSummary: ["Calling about a refund.", "Known caller."] }));
    expect(summary()).toMatchObject({ purpose: "real-time-summary", status: "streaming", text: "Calling about a refund. Known caller." });
  });
});

describe("a scripted contact (Maya Chen)", () => {
  const step = (id: string) => [...MAYA_CHEN_SCRIPT.steps].find((s) => s.id === id)!;

  it("greeting → Ask → Do (its branch starts) → nothing to suggest at wrap-up; the summary grows per customer turn", () => {
    const { guidance, nba, summary, contact, resolve, startBranch } = setUp("Maya Chen");
    guidance.startScript(ID, MAYA_CHEN_SCRIPT);
    guidance.onInteraction(contact("active", { channel: "voice" }));
    // Live, before the first step: listening, no summary yet.
    expect(nba()).toMatchObject({ frame: "listening" });
    expect(summary()).toBeUndefined();

    guidance.onStep(ID, step("mcc-greet"));
    expect(nba()).toMatchObject({ stepId: "mcc-greet", suggestion: { type: "say" } });
    guidance.onStep(ID, step("mcc-1"));
    expect(summary()!.text).toBe("Calling for a $412.00 refund on order NR-10871, an espresso machine that arrived with a cracked water tank.");
    // Queued behind the greeting: one at a time.
    guidance.onStep(ID, step("mcc-ask"));
    expect(nba()!.stepId).toBe("mcc-greet");
    resolve("used");
    expect(nba()).toMatchObject({ stepId: "mcc-ask", suggestion: { type: "ask" } });
    resolve("used");
    expect(nba()).toMatchObject({ frame: "listening" });

    guidance.onStep(ID, step("mcc-3"));
    expect(summary()!.text.split(". ").length).toBeGreaterThan(1);
    guidance.onStep(ID, step("mcc-do"));
    expect(nba()).toMatchObject({ stepId: "mcc-do", suggestion: { type: "do", link: "maya-refund-steps", branch: "refund" } });
    resolve("used");
    expect(startBranch).toHaveBeenCalledWith(ID, "refund");

    guidance.onInteraction(contact("wrap-up", { channel: "voice" }));
    expect(nba()).toMatchObject({ frame: "nothing" });
    expect(summary()!.status).toBe("complete");
  });

  it("Not now on a Do starts no branch", () => {
    const { guidance, contact, resolve, startBranch } = setUp("Maya Chen");
    guidance.startScript(ID, MAYA_CHEN_SCRIPT);
    guidance.onInteraction(contact("active", { channel: "voice" }));
    guidance.onStep(ID, step("mcc-do"));
    resolve("dismissed");
    expect(startBranch).not.toHaveBeenCalled();
  });
});
