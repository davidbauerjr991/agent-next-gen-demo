import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Interaction, InteractionId, Message } from "../../domain";
import { expectProviderError, recordEvents, type Recorder } from "../../contract-tests/event-recorder";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, MAYA_CHEN_SCRIPT, SCENARIOS, TOM_LEWIS_SCRIPT, type ScenarioScript } from "../../scenarios";
import { createMemoryBus } from "./memory-transport";
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

/** The provider with every command settled under fake timers: the memory
 *  bus delivers on `setTimeout(0)`, so a reply only lands once those run. */
let provider: SimulatedInteractionProvider;
let client: SimCustomerClient;
let rec: Recorder;

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
    scripts: [...SCENARIOS, BEATS_SCRIPT],
  });
  provider = new Proxy(raw, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function" || key === "on") return value;
      return (...args: unknown[]) => settled((value as (...a: unknown[]) => Promise<unknown>).apply(target, args));
    },
  });
  client = createSimCustomerClient(raw.sessionId, bus.createTransport());
  rec = recordEvents(raw);
}

async function teardown() {
  rec.stop();
  client.dispose();
  await provider.dispose();
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

  it("voice: Marcus's whole call is backfilled as utterances; nothing plays live", async () => {
    const id = await play(MARCUS_WEBB_SCRIPT);
    const { utterances: lines } = await provider.getTranscript(id);
    expect(lines.map((u) => [u.speaker.role, u.text])).toEqual(
      MARCUS_WEBB_SCRIPT.steps.map((s) => (s.kind === "say" ? [s.speaker, s.text] : [])),
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
    await advance(5800);
    expect(utterances(id).map((u) => [u.speaker.role, u.speaker.displayName])).toEqual([
      ["customer", "Tom Lewis"],
      ["agent", "John Smith"],
    ]);
    await advance(5000);
    expect(utterances(id)).toHaveLength(3);
  });

  it("auto answer: Maya is offered and answered at once, with acceptedAt and autoAnswered", async () => {
    const id = await play(MAYA_CHEN_SCRIPT);
    expect(rec.events("incoming").map((e) => e.interaction.id)).toEqual([id]);
    expect(latest(id)).toMatchObject({ state: "active", autoAnswered: true, skill: { name: "Returns" } });
    expect(Date.now() - latest(id)!.acceptedAt!).toBeLessThan(10);
    await advance(12_000);
    expect(utterances(id).map((u) => u.text)).toEqual(MAYA_CHEN_SCRIPT.steps.flatMap((s) => (s.kind === "say" ? [s.text] : [])));
  });

  it("hold pauses the run and resume plays the rest with the remaining delays", async () => {
    const id = await play(TOM_LEWIS_SCRIPT);
    await accept(id);
    await advance(3000);
    expect(utterances(id)).toHaveLength(1);
    await provider.hold(id, true);
    await flush();
    await advance(30_000);
    expect(utterances(id)).toHaveLength(1);
    await provider.hold(id, false);
    await flush();
    // About 4s of the agent line's 7s were left when the call was held.
    await advance(3900);
    expect(utterances(id)).toHaveLength(1);
    await advance(200);
    expect(utterances(id)).toHaveLength(2);
    await advance(5000);
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
    await advance(6000);
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
