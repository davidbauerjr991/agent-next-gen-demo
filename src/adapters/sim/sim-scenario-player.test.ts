import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Interaction, InteractionId, Message } from "../../domain";
import { expectProviderError, recordEvents, type Recorder } from "../../contract-tests/event-recorder";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, MAYA_CHEN_SCRIPT, SCENARIOS, TOM_LEWIS_SCRIPT, validateScenario, type ScenarioScript } from "../../scenarios";
import type { AssistCardResolution, AssistProvider } from "../../providers";
import { createMemoryBus } from "./memory-transport";
import { createSimAssistProvider } from "./sim-assist-provider";
import { createSimCustomerClient, type SimCustomerClient } from "./sim-customer-client";
import { createSimulatedInteractionProvider, type SimulatedInteractionProvider } from "./simulated-interaction-provider";

// The scenario player inside the sim engine (P0.5c): backfill, live timing,
// hold pausing, stopping on wrap-up, the three answer modes, review and
// takeover, and the agent's decisions starting branches. Fake timers, so a
// script's real delays run in no time.

const ZERO = { minMs: 0, maxMs: 0 };

/** A small chat script for the wrap-up / close / dismiss beats. */
const BEATS_SCRIPT: ScenarioScript = {
  version: 1,
  id: "beats",
  title: "Beats",
  summary: "Approval, wrap-up, close and dismiss.",
  entity: { key: "beats", name: "Bea Beats", caseId: "CASE-BEATS" },
  channel: "chat",
  skill: { name: "AI Review", id: "ai-review" },
  participants: { bot: "Beat Bot" },
  start: { answer: "delivered", review: true },
  steps: [{ id: "b-approval", kind: "beat", beat: "approval", ref: "ask", at: 0 }],
  branches: {
    go: { label: "Go", steps: [{ id: "b-wrap", kind: "beat", beat: "wrap-up", ref: "main", at: 100, unlessTakenOver: true }] },
    done: {
      label: "Done",
      steps: [
        { id: "b-close", kind: "beat", beat: "close", at: 0 },
        { id: "b-dismiss", kind: "beat", beat: "dismiss", at: 100, unlessTakenOver: true },
      ],
    },
  },
  content: {
    panelKeys: [],
    approvals: {
      ask: {
        title: "Approve?",
        headline: "h",
        description: "d",
        checklist: [],
        memoryTitle: "m",
        memory: [],
        sentimentLabel: "s",
        sentimentValue: "v",
        sentimentLevel: 1,
        decisions: [{ value: "go", title: "Go", result: "Gone" }],
      },
    },
    wrapUps: { main: { title: "Wrap up", summary: "s", disposition: "d", buttonLabel: "Complete", completeBranch: "done" } },
  },
};

/** A bot-held call whose decision is a guide step's Do NBA (P-SHRINK): a note on an alternative, fixed vars on
 *  another, an event that sets the case status and suggests the disposition, and a takeover. */
const GUIDE_SCRIPT: ScenarioScript = {
  version: 1,
  id: "guide",
  title: "Guide",
  summary: "A bot asks the agent to decide.",
  entity: { key: "guide", name: "Gus Guide", caseId: "CASE-GUIDE", phone: "(415) 555-0199" },
  channel: "voice",
  skill: { name: "AI Review", id: "ai-review" },
  participants: { bot: "Guide Bot" },
  start: { answer: "delivered", review: true, caseStatus: "Open" },
  steps: [
    {
      id: "g-decide",
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
        ],
      },
    },
    { id: "g-taken", kind: "event", anchor: "takeover", at: 0, text: "Taken over" },
  ],
  branches: {
    approved: {
      label: "Approved",
      trigger: "action",
      steps: [
        { id: "g-a1", kind: "event", at: 0, text: "Disposition updated", by: "Guide Bot", sets: { caseStatus: "Resolved", disposition: "Exception Approved" } },
        { id: "g-a2", kind: "say", speaker: "bot", at: 100, text: "Approved." },
      ],
    },
    rejected: { label: "Rejected", trigger: "action", inputs: ["note"], steps: [{ id: "g-r1", kind: "say", speaker: "bot", at: 0, text: "Rejected: {note}" }] },
    discount: {
      label: "Discount",
      trigger: "action",
      inputs: ["discountPercent"],
      steps: [{ id: "g-d1", kind: "say", speaker: "bot", at: 0, text: "{discountPercent}% off" }],
    },
  },
  content: { panelKeys: [] },
};

/** The provider with every command settled under fake timers: the memory
 *  bus delivers on `setTimeout(0)`, so a reply only lands once those run. */
let provider: SimulatedInteractionProvider;
let client: SimCustomerClient;
let rec: Recorder;
let assist: AssistProvider;

async function settled<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  promise.then(
    () => (done = true),
    () => (done = true),
  );
  // Fake timers clamp setTimeout(0) to 1ms, so each round advances 1ms.
  for (let i = 0; i < 20 && !done; i++) await vi.advanceTimersByTimeAsync(1);
  return promise;
}

function setup() {
  const bus = createMemoryBus();
  const raw = createSimulatedInteractionProvider({
    latency: ZERO,
    timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
    createTransport: bus.createTransport,
    scripts: [...SCENARIOS, BEATS_SCRIPT, GUIDE_SCRIPT],
  });
  provider = new Proxy(raw, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function" || key === "on") return value;
      return (...args: unknown[]) => settled((value as (...a: unknown[]) => Promise<unknown>).apply(target, args));
    },
  });
  client = createSimCustomerClient(raw.sessionId, bus.createTransport());
  assist = createSimAssistProvider({ sessionId: raw.sessionId, transport: bus.createTransport() });
  rec = recordEvents(raw);
}

async function teardown() {
  rec.stop();
  client.dispose();
  await assist.dispose();
  await provider.dispose();
}

/** The agent answers the turn a scripted run waits on (P-CANVAS): its suggestion surfaces ("turn"), then is resolved. */
async function answerTurn(id: InteractionId, resolution: AssistCardResolution = { outcome: "used" }) {
  const surfaced = assist.suggest({ interactionId: id, trigger: { kind: "turn" } });
  await flush();
  await surfaced;
  const resolved = assist.resolveCard(`nba:${id}`, resolution);
  await flush();
  await resolved;
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  setup();
});

afterEach(async () => {
  await teardown();
  vi.useRealTimers();
});

/** Lets one bus hop land (fake timers clamp setTimeout(0) to 1ms). */
const flush = () => vi.advanceTimersByTimeAsync(1);
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

function latest(id: InteractionId): Interaction | undefined {
  let found: Interaction | undefined;
  for (const e of rec.events("stateChanged")) if (e.kind === "interaction" && e.interaction.id === id) found = e.interaction;
  return found;
}
const utterances = (id: InteractionId) => rec.events("transcript").filter((e) => e.utterance.interactionId === id).map((e) => e.utterance);
const messages = (id: InteractionId) => rec.events("message").filter((e) => e.message.interactionId === id).map((e) => e.message);
/** The latest version of each message, by id. */
function currentMessages(id: InteractionId): Message[] {
  const byId = new Map<string, Message>();
  for (const m of messages(id)) byId.set(m.id, m);
  return [...byId.values()];
}

async function play(script: ScenarioScript, channel?: ScenarioScript["channel"]): Promise<InteractionId> {
  const id = client.playScenario(script.id, channel ? { channel } : undefined);
  await flush();
  await flush();
  return id;
}

async function accept(id: InteractionId) {
  await provider.accept(id);
  await flush();
}

describe("backfill", () => {
  it("writes the setup lines into the transcript before the contact appears, at their past times, with no events", async () => {
    const id = await play(LUCAS_THOMAS_SCRIPT);
    expect(messages(id)).toEqual([]);
    // The contact started 251s before the engine launched it.
    const before = latest(id)!.startedAt + 251_000;
    expect(Date.now() - before).toBeLessThan(10);
    const { messages: setup } = await provider.getTranscript(id);
    expect(setup.map((m) => m.text)).toEqual([
      "Chat started",
      "My card got declined on the Aurora X2 launch order. Is the price gone?",
      "I found order NR-11056. Your card was declined, so it wasn't placed. I've held the launch price of $189.00 and your unit for 24 hours.",
      "Launch price held for 24 h",
      "Here's a secure link to pay another way.",
      "Payment link sent",
    ]);
    expect(setup[0]).toMatchObject({ kind: "event", sentAt: before - 251_000 });
    expect(setup[1]).toMatchObject({ kind: "text", author: { role: "customer", displayName: "Lucas Thomas" }, sentAt: before - 250_000 });
    expect(setup[2].author).toMatchObject({ role: "bot", displayName: "AI agent · Checkout" });
    expect(latest(id)).toMatchObject({ state: "active", caseId: "CASE-30418", review: { by: "AI agent · Checkout" } });
    expect(rec.events("incoming")).toEqual([]);
  });

  it("voice: Marcus's call so far is backfilled as utterances; nothing more is said live until the agent decides", async () => {
    const id = await play(MARCUS_WEBB_SCRIPT);
    const { utterances: lines } = await provider.getTranscript(id);
    expect(lines.map((u) => [u.speaker.role, u.text])).toEqual(
      MARCUS_WEBB_SCRIPT.steps.filter((s) => s.at < 0 && s.kind === "say").map((s) => (s.kind === "say" ? [s.speaker, s.text] : [])),
    );
    expect(lines[0].speaker.displayName).toBe("Cognigy AI Agent");
    await advance(60_000);
    expect(utterances(id)).toEqual([]);
    expect(latest(id)).toMatchObject({ channel: "voice", state: "active", review: { by: "Cognigy AI Agent" }, entityId: "marcus-webb-scenario" });
  });
});

describe("answer modes and live timing", () => {
  it("agent answer: Tom rings; his lines wait for accept, then play on their delays", async () => {
    const id = await play(TOM_LEWIS_SCRIPT);
    expect(rec.events("incoming").map((e) => e.interaction)).toEqual([expect.objectContaining({ id, state: "offered", caseId: "CASE-30409", skill: { id: "billing", name: "Billing" } })]);
    await advance(20_000);
    expect(utterances(id)).toEqual([]);
    await accept(id);
    await advance(1200);
    expect(utterances(id).map((u) => u.speaker.role)).toEqual(["customer"]);
    // John's line is the agent's turn: it waits until the agent answers its suggestion (P-CANVAS).
    await advance(1000);
    expect(utterances(id)).toHaveLength(1);
    await answerTurn(id);
    expect(utterances(id).map((u) => [u.speaker.role, u.speaker.displayName])).toEqual([
      ["customer", "Tom Lewis"],
      ["agent", "John Smith"],
    ]);
    // His next line at its own timing after John's (3.6s).
    await advance(3500);
    expect(utterances(id)).toHaveLength(2);
    await advance(200);
    expect(utterances(id)).toHaveLength(3);
  });

  it("auto answer: Maya is offered and answered at once, with acceptedAt and autoAnswered", async () => {
    const id = await play(MAYA_CHEN_SCRIPT);
    expect(rec.events("incoming").map((e) => e.interaction.id)).toEqual([id]);
    expect(latest(id)).toMatchObject({ state: "active", autoAnswered: true, skill: { name: "Returns" } });
    expect(Date.now() - latest(id)!.acceptedAt!).toBeLessThan(10);
    // Her lines play on their delays; each of John's waits for the agent's turn (four of them).
    await advance(2000);
    for (let turn = 0; turn < 4; turn += 1) {
      await answerTurn(id);
      await advance(4000);
    }
    expect(utterances(id).map((u) => u.text)).toEqual(MAYA_CHEN_SCRIPT.steps.flatMap((s) => (s.kind === "say" ? [s.text] : [])));
  });

  describe("the agent's turn (P-CANVAS): an agent line with a Next Best Action waits on it", () => {
    const line = (id: string) => (MAYA_CHEN_SCRIPT.steps.find((s) => s.id === id) as { text: string }).text;
    const agentLines = (id: InteractionId) => utterances(id).filter((u) => u.speaker.role === "agent").map((u) => u.text);
    const lastText = (id: InteractionId) => {
      const all = utterances(id);
      return all[all.length - 1]?.text;
    };

    it("no agent line until it's answered; then the script's own line (not the suggestion); her next line follows at its own timing", async () => {
      const id = await play(MAYA_CHEN_SCRIPT);
      await advance(10_000);
      expect(utterances(id).map((u) => u.speaker.role)).toEqual(["customer"]);
      await answerTurn(id);
      expect(agentLines(id)).toEqual([line("mcc-2")]);
      expect(agentLines(id)[0]).not.toBe(MAYA_CHEN_SCRIPT.steps.find((s) => s.id === "mcc-2")!.nba!.text);
      await advance(3700);
      expect(lastText(id)).toBe(line("mcc-3"));
    });

    it("Not now plays the scripted line too", async () => {
      const id = await play(MAYA_CHEN_SCRIPT);
      await advance(2000);
      await answerTurn(id, { outcome: "dismissed" });
      expect(agentLines(id)).toEqual([line("mcc-2")]);
    });

    it("a turn the agent typed goes on without the scripted line; her next line still follows", async () => {
      const id = await play(MAYA_CHEN_SCRIPT);
      await advance(2000);
      await answerTurn(id, { outcome: "used", agentTyped: true });
      expect(agentLines(id)).toEqual([]);
      await advance(3700);
      expect(lastText(id)).toBe(line("mcc-3"));
    });

    it("a hold and resume while it waits doesn't release it", async () => {
      const id = await play(MAYA_CHEN_SCRIPT);
      await advance(2000);
      await provider.hold(id, true);
      await flush();
      await provider.hold(id, false);
      await flush();
      await advance(10_000);
      expect(utterances(id)).toHaveLength(1);
      await answerTurn(id);
      expect(utterances(id)).toHaveLength(2);
    });
  });

  it("hold pauses the run and resume plays the rest with the remaining delays", async () => {
    const id = await play(TOM_LEWIS_SCRIPT);
    await accept(id);
    await advance(2000);
    await answerTurn(id);
    expect(utterances(id)).toHaveLength(2);
    await advance(1000);
    await provider.hold(id, true);
    await flush();
    await advance(30_000);
    expect(utterances(id)).toHaveLength(2);
    await provider.hold(id, false);
    await flush();
    // About 2.6s of his next line's 3.6s were left when the call was held.
    await advance(2500);
    expect(utterances(id)).toHaveLength(2);
    await advance(200);
    expect(utterances(id)).toHaveLength(3);
  });

  it("wrap-up stops the run for good", async () => {
    const id = await play(MAYA_CHEN_SCRIPT);
    await advance(2000);
    await provider.end(id);
    await flush();
    expect(latest(id)?.state).toBe("wrap-up");
    await advance(30_000);
    expect(utterances(id)).toHaveLength(1);
  });

  it("chat: typing on and off around each line, the bot's as role bot", async () => {
    const id = await play(LUCAS_THOMAS_SCRIPT);
    await advance(1500);
    expect(rec.events("typing")).toEqual([{ interactionId: id, role: "customer", isTyping: true }]);
    await advance(3000);
    const lastTyping = () => rec.events("typing")[rec.events("typing").length - 1];
    expect(lastTyping()).toEqual({ interactionId: id, role: "customer", isTyping: false });
    expect(messages(id).map((m) => m.text)).toEqual(["That failed too. Can someone just place it for me?"]);
    await advance(700);
    expect(lastTyping()).toEqual({ interactionId: id, role: "bot", isTyping: true });
  });
});

describe("review and takeover", () => {
  it("customer lines in review don't start the awaiting clock; takeover starts it and the handle clock", async () => {
    const id = await play(LUCAS_THOMAS_SCRIPT);
    const launchedAt = latest(id)!.startedAt + 251_000;
    await advance(5000);
    expect(messages(id).some((m) => m.author.role === "customer")).toBe(true);
    expect(latest(id)?.awaitingAgentSince).toBeUndefined();
    await provider.takeOver(id);
    await flush();
    expect(latest(id)).toMatchObject({ state: "active", awaitingAgentSince: launchedAt - 250_000 });
    expect(Date.now() - latest(id)!.acceptedAt!).toBeLessThan(10);
    expect(latest(id)?.review).toBeUndefined();
  });

  it("takeover plays the handoff steps; handoff: false skips them", async () => {
    const id = await play(LUCAS_THOMAS_SCRIPT);
    await provider.takeOver(id);
    await flush();
    // The bot's handoff, then John's greeting waits on the agent's turn (P-CANVAS).
    await advance(1500);
    expect(messages(id).map((m) => m.text)).not.toContain("Ok, sounds good");
    await answerTurn(id);
    await advance(4000);
    const texts = messages(id).map((m) => m.text);
    expect(texts).toContain("Ok, sounds good");

    await teardown();
    setup();
    const quiet = await play(LUCAS_THOMAS_SCRIPT);
    await provider.takeOver(quiet, { handoff: false });
    await flush();
    const mark = messages(quiet).length;
    await advance(6000);
    expect(messages(quiet).slice(mark).map((m) => m.text)).not.toContain("Ok, sounds good");
  });

  it("a voice call in review isn't the agent's: it's never auto-held and doesn't block a dial; takeover holds the other call", async () => {
    const marcus = await play(MARCUS_WEBB_SCRIPT);
    const [skill] = await provider.listOutboundSkills("voice");
    const dialed = await provider.dial({ channel: "voice", address: "+15551230000", skillId: skill.id });
    await flush();
    await flush();
    expect(latest(dialed)?.state).toBe("active");
    expect(latest(marcus)?.state).toBe("active");
    await provider.takeOver(marcus, { handoff: false });
    await flush();
    expect(latest(dialed)?.state).toBe("held");
    expect(latest(marcus)).toMatchObject({ state: "active" });
  });
});

describe("respondToRequest", () => {
  async function approvalCard(id: InteractionId): Promise<Message> {
    await advance(14_000);
    const card = currentMessages(id).find((m) => m.annotation?.kind === "approval");
    expect(card).toBeDefined();
    return card!;
  }

  it("a decision on an approval card stamps the card and plays its branch", async () => {
    const id = await play(LUCAS_THOMAS_SCRIPT);
    const card = await approvalCard(id);
    expect(card).toMatchObject({ kind: "event", text: LUCAS_THOMAS_SCRIPT.content.approvals!.initial.title, annotation: { kind: "approval", ref: "initial" } });
    await provider.respondToRequest(id, { value: "accept", requestId: card.id });
    await flush();
    expect(currentMessages(id).find((m) => m.id === card.id)?.annotation?.response).toMatchObject({ value: "accept" });
    await advance(1000);
    expect(currentMessages(id).map((m) => m.text)).toEqual(expect.arrayContaining(["Authorize and place order NR-11056", "Exception approved by John Smith"]));
    const instruction = currentMessages(id).find((m) => m.annotation?.kind === "instruction")!;
    expect(instruction.annotation).toMatchObject({ kind: "instruction", ref: "accept" });

    // Answering the same card again is a no-op.
    await provider.respondToRequest(id, { value: "decline", requestId: card.id, note: "no" });
    await advance(5000);
    expect(currentMessages(id).some((m) => m.text.startsWith("Declined"))).toBe(false);
    expect(currentMessages(id).find((m) => m.id === card.id)?.annotation?.response).toMatchObject({ value: "accept" });
  });

  it("{note} is filled in, and an internal 'something else' note gets no customer-facing bot line", async () => {
    const id = await play(LUCAS_THOMAS_SCRIPT);
    const card = await approvalCard(id);
    await provider.respondToRequest(id, { value: "other", requestId: card.id, note: "show me his orders" });
    await advance(6000);
    const texts = currentMessages(id).map((m) => m.text);
    expect(texts).toContain("Instruction sent to the AI agent: show me his orders");
    expect(texts.some((t) => t.startsWith("Thanks for your patience"))).toBe(false);
    expect(rec.events("typing").filter((e) => e.role === "bot").length).toBe(4); // the two live bot lines' on/off only
  });

  it("a note that addresses the customer gets the bot's reply", async () => {
    const id = await play(LUCAS_THOMAS_SCRIPT);
    const card = await approvalCard(id);
    await provider.respondToRequest(id, { value: "other", requestId: card.id, note: "tell Lucas we're checking" });
    await advance(6000);
    expect(currentMessages(id).some((m) => m.text.startsWith("Thanks for your patience, Lucas"))).toBe(true);
  });

  it("an action branch with vars (Marcus's store credit), and not-found for anything else", async () => {
    const id = await play(MARCUS_WEBB_SCRIPT);
    await provider.respondToRequest(id, { value: "remedy-store-credit", vars: { storeCreditAmount: "150" } });
    await advance(5);
    expect(utterances(id).map((u) => [u.speaker.role, u.text])).toEqual([
      ["agent", "Perfect — I've issued $150 as store credit to your account; you'll see it available for your next purchase."],
    ]);
    await expectProviderError(provider.respondToRequest(id, { value: "nope" }), "not-found");
    await expectProviderError(provider.respondToRequest(id, { value: "accept", requestId: "missing" as Message["id"] }), "not-found");
  });

  it("wrap-up: completing the card closes the case, then dismisses the contact into wrap-up", async () => {
    const id = await play(BEATS_SCRIPT);
    await advance(5);
    const approval = currentMessages(id).find((m) => m.annotation?.kind === "approval")!;
    await provider.respondToRequest(id, { value: "go", requestId: approval.id });
    await advance(100);
    const wrap = currentMessages(id).find((m) => m.annotation?.kind === "wrap-up")!;
    expect(wrap).toMatchObject({ text: "Wrap up", annotation: { ref: "main" } });
    await provider.respondToRequest(id, { value: "complete", requestId: wrap.id });
    await flush();
    expect(latest(id)?.caseStatus).toBe("Closed");
    expect(latest(id)?.state).toBe("active");
    await advance(100);
    // The bot ended it for the agent; their outcome closes it.
    expect(latest(id)?.state).toBe("wrap-up");
    await provider.completeWrapUp(id, {});
    expect(rec.events("ended")).toEqual([{ interactionId: id, reason: "agent" }]);
  });

  it("taking over first skips a wrap-up card marked unlessTakenOver", async () => {
    const id = await play(BEATS_SCRIPT);
    await advance(5);
    const approval = currentMessages(id).find((m) => m.annotation?.kind === "approval")!;
    await provider.takeOver(id);
    await provider.respondToRequest(id, { value: "go", requestId: approval.id });
    await advance(500);
    expect(currentMessages(id).some((m) => m.annotation?.kind === "wrap-up")).toBe(false);
  });

  it("taking over withdraws an open wrap-up card, which can no longer be completed", async () => {
    const id = await play(BEATS_SCRIPT);
    await advance(5);
    const approval = currentMessages(id).find((m) => m.annotation?.kind === "approval")!;
    await provider.respondToRequest(id, { value: "go", requestId: approval.id });
    await advance(100);
    await provider.takeOver(id);
    await flush();
    const wrap = currentMessages(id).find((m) => m.annotation?.kind === "wrap-up")!;
    expect(wrap.annotation?.withdrawn).toBe(true);
    await provider.respondToRequest(id, { value: "complete", requestId: wrap.id });
    await advance(500);
    expect(latest(id)?.caseStatus).toBeUndefined();
    expect(latest(id)?.state).toBe("active");
  });
});

describe("launch rules", () => {
  it("routes only to an available or working agent", async () => {
    await provider.setAgentState("lunch");
    await flush();
    const id = await play(TOM_LEWIS_SCRIPT);
    expect(latest(id)).toBeUndefined();
    expect(rec.events("incoming")).toEqual([]);
    await provider.setAgentState("working");
    await flush();
    const later = await play(TOM_LEWIS_SCRIPT);
    expect(rec.events("incoming").map((e) => e.interaction.id)).toEqual([later]);
  });

  it("plays one run per script at a time; it can play again once the contact has ended", async () => {
    const first = await play(TOM_LEWIS_SCRIPT);
    const second = await play(TOM_LEWIS_SCRIPT);
    expect(rec.events("incoming").map((e) => e.interaction.id)).toEqual([first]);
    expect(latest(second)).toBeUndefined();
    await provider.decline(first);
    await flush();
    const third = await play(TOM_LEWIS_SCRIPT);
    expect(rec.events("incoming").map((e) => e.interaction.id)).toEqual([first, third]);
  });

  it("disposing the engine stops every run", async () => {
    const id = await play(MAYA_CHEN_SCRIPT);
    await provider.dispose();
    await advance(20_000);
    expect(utterances(id)).toHaveLength(0);
  });
});

describe("a guide step's Next Best Action (P-SHRINK)", () => {
  const botLines = (id: InteractionId) => utterances(id).filter((u) => u.speaker.role === "bot").map((u) => u.text);

  it("the script is valid", () => {
    expect(validateScenario(GUIDE_SCRIPT)).toEqual([]);
  });

  it("surfaces while the bot holds the call; Run it plays its branch: the event names who did it, sets the status and suggests the disposition", async () => {
    const id = await play(GUIDE_SCRIPT);
    await advance(5);
    expect(latest(id)?.review).toBeTruthy();
    await answerTurn(id);
    await advance(150);
    const event = currentMessages(id).find((m) => m.text === "Disposition updated")!;
    expect(event).toMatchObject({ kind: "event", author: { role: "system", displayName: "Guide Bot" }, suggestedDisposition: "Exception Approved" });
    expect(latest(id)?.caseStatus).toBe("Resolved");
    expect(botLines(id)).toEqual(["Approved."]);
  });

  it("an alternative's note fills {note}; another's fixed vars fill its inputs", async () => {
    const id = await play(GUIDE_SCRIPT);
    await advance(5);
    await answerTurn(id, { outcome: "used", alternative: 0, note: "Needs photos" });
    await advance(5);
    expect(botLines(id)).toEqual(["Rejected: Needs photos"]);

    await teardown();
    setup();
    const other = await play(GUIDE_SCRIPT);
    await advance(5);
    await answerTurn(other, { outcome: "used", alternative: 1 });
    await advance(5);
    expect(botLines(other)).toEqual(["20% off"]);
  });

  it("Marcus's photo follow-up (nothing starts it in the UI): flagging the account escalates the case", async () => {
    const id = await play(MARCUS_WEBB_SCRIPT);
    await advance(1500);
    await answerTurn(id, { outcome: "dismissed" });
    await provider.respondToRequest(id, { value: "photo-follow-up" });
    await advance(5);
    expect(currentMessages(id).map((m) => m.text)).toContain("The customer provided the attached photo.");
    await answerTurn(id, { outcome: "used", alternative: 1, note: "Too many claims" });
    await advance(3100);
    expect(currentMessages(id).map((m) => m.text)).toContain('Status updated to "Escalated"');
    expect(latest(id)?.caseStatus).toBe("Escalated");
  });

  it("taking over withdraws it: the takeover steps play, and there's nothing left to answer", async () => {
    const id = await play(GUIDE_SCRIPT);
    await advance(5);
    await provider.takeOver(id);
    await flush();
    await advance(5);
    expect(currentMessages(id).map((m) => m.text)).toContain("Taken over");
    const refused = expectProviderError(assist.resolveCard(`nba:${id}`, { outcome: "used" }), "not-found");
    await flush();
    await flush();
    await refused;
    expect(botLines(id)).toEqual([]);
  });
});
