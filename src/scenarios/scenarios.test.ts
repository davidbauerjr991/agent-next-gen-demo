import { describe, expect, it } from "vitest";
import { recordEvents, waitFor } from "../contract-tests/event-recorder";
import type { ChannelKind, InteractionId } from "../domain";
import { createMemoryBus } from "../adapters/sim/memory-transport";
import { createSimCustomerClient, type SimCustomerClient } from "../adapters/sim/sim-customer-client";
import { createSimulatedInteractionProvider } from "../adapters/sim/simulated-interaction-provider";
import {
  LUCAS_THOMAS_SCRIPT,
  SCENARIOS,
  TOM_LEWIS_SCRIPT,
  cannedLines,
  getScenario,
  parseScenarioJson,
  startRequest,
  stepsFor,
  toCustomerAction,
  validateScenario,
  type ScenarioCustomerAction,
  type ScenarioScript,
} from "./index";

// Scenario scripts (P0.7): every ported script validates, round-trips as
// JSON, loads into the sim as customer actions, and runs as another channel.

const ZERO = { minMs: 0, maxMs: 0 };
const clone = <T>(value: T): T => structuredClone(value);

/** Applies a customer action to the sim's customer client. */
function send(client: SimCustomerClient, action: ScenarioCustomerAction) {
  switch (action.kind) {
    case "message":
      return client.message({ interactionId: action.interactionId, text: action.text });
    case "typing":
      return client.typing({ interactionId: action.interactionId, isTyping: action.isTyping });
    case "hangUp":
      return client.hangUp({ interactionId: action.interactionId });
    default:
      throw new Error(`the sim can't send a "${action.kind}" action yet (P0.5c adds speak)`);
  }
}

async function withSim(run: (ctx: { client: SimCustomerClient; rec: ReturnType<typeof recordEvents> }) => Promise<void>) {
  const bus = createMemoryBus();
  const provider = createSimulatedInteractionProvider({
    latency: ZERO,
    timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
    createTransport: bus.createTransport,
  });
  const client = createSimCustomerClient(provider.sessionId, bus.createTransport());
  const rec = recordEvents(provider);
  try {
    await run({ client, rec });
  } finally {
    rec.stop();
    client.dispose();
    await provider.dispose();
  }
}

describe.each(SCENARIOS.map((script) => [script.id, script] as const))("scenario %s", (_id, script) => {
  it("validates", () => {
    expect(validateScenario(script)).toEqual([]);
  });

  it("is JSON: it survives a round trip unchanged and loads from text", () => {
    const parsed = parseScenarioJson(JSON.stringify(script));
    expect(parsed.errors).toEqual([]);
    expect(parsed.script).toEqual(script);
  });

  it("launches in the sim as its own channel and its customer lines arrive as messages", async () => {
    await withSim(async ({ client, rec }) => {
      const id = client.startInbound(startRequest(script));
      await waitFor(() => rec.events("incoming").some((e) => e.interaction.id === id), "offered");
      const offer = rec.events("incoming").find((e) => e.interaction.id === id)!.interaction;
      expect(offer).toMatchObject({ channel: script.channel, contactName: script.entity.name });
      expect(offer.address?.value).toBe(script.channel === "chat" ? script.entity.key : script.entity.phone);

      if (script.channel === "voice") {
        // A voice customer line is `speak`, which the sim can't take until P0.5c.
        const customerSteps = stepsFor(script).filter((s) => toCustomerAction(script, s, id));
        for (const step of customerSteps) expect(toCustomerAction(script, step, id)!.kind).toMatch(/^(speak|hangUp)$/);
        return;
      }
      const sent: string[] = [];
      for (const step of stepsFor(script).filter((s) => s.at >= 0)) {
        const action = toCustomerAction(script, step, id);
        if (!action) continue;
        send(client, action);
        if (action.kind === "message") sent.push(action.text);
      }
      await waitFor(() => rec.events("message").length >= sent.length, "messages");
      expect(rec.events("message").map((e) => e.message.text)).toEqual(sent);
    });
  });
});

describe("registry", () => {
  it("lists the four ported scenarios by unique id", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["marcus-webb-scenario", "lucas-thomas", "tom-lewis-void-call", "maya-chen-refund-call"]);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    expect(getScenario("lucas-thomas")).toBe(LUCAS_THOMAS_SCRIPT);
    expect(getScenario("nope")).toBeUndefined();
  });
});

describe("running a script as another channel", () => {
  it("validates Lucas as voice and Tom as chat; typing on voice is ignored, not an error", () => {
    expect(LUCAS_THOMAS_SCRIPT.steps.some((s) => s.kind === "typing")).toBe(true);
    expect(validateScenario(LUCAS_THOMAS_SCRIPT, { channel: "voice" })).toEqual([]);
    expect(validateScenario(TOM_LEWIS_SCRIPT, { channel: "chat" })).toEqual([]);
  });

  it("Lucas as voice: starts from his number, drops typing and chat-only lines, and speaks the customer's lines", async () => {
    expect(startRequest(LUCAS_THOMAS_SCRIPT, "voice")).toMatchObject({ channel: "voice", address: "(415) 555-0132", displayName: "Lucas Thomas" });
    const steps = stepsFor(LUCAS_THOMAS_SCRIPT, "voice");
    expect(steps.some((s) => s.kind === "typing")).toBe(false);
    expect(steps.some((s) => s.id === "lt-chat-started")).toBe(false);
    expect(stepsFor(LUCAS_THOMAS_SCRIPT, "chat").some((s) => s.id === "lt-chat-started")).toBe(true);
    const id = "i1" as InteractionId;
    const lt4 = steps.find((s) => s.id === "lt-4")!;
    expect(toCustomerAction(LUCAS_THOMAS_SCRIPT, lt4, id, "voice")).toEqual({
      kind: "speak",
      interactionId: id,
      text: "That failed too. Can someone just place it for me?",
    });
    expect(toCustomerAction(LUCAS_THOMAS_SCRIPT, lt4, id)).toMatchObject({ kind: "message" });
    const typing = LUCAS_THOMAS_SCRIPT.steps.find((s) => s.kind === "typing")!;
    expect(toCustomerAction(LUCAS_THOMAS_SCRIPT, typing, id, "voice")).toBeUndefined();
    await withSim(async ({ client, rec }) => {
      const started = client.startInbound(startRequest(LUCAS_THOMAS_SCRIPT, "voice"));
      await waitFor(() => rec.events("incoming").some((e) => e.interaction.id === started), "offered");
      const offer = rec.events("incoming").find((e) => e.interaction.id === started)!.interaction;
      expect(offer).toMatchObject({ channel: "voice", address: { value: "(415) 555-0132" } });
      expect(offer.preContactSummary).toBeDefined();
    });
  });

  it("Tom as chat: starts from a chat handle and his customer lines arrive as messages", async () => {
    await withSim(async ({ client, rec }) => {
      const request = startRequest(TOM_LEWIS_SCRIPT, "chat");
      expect(request).toMatchObject({ channel: "chat", address: "tom-lewis-void-call", skillId: "billing" });
      const id = client.startInbound(request);
      await waitFor(() => rec.events("incoming").some((e) => e.interaction.id === id), "offered");
      const lines: string[] = [];
      for (const step of stepsFor(TOM_LEWIS_SCRIPT, "chat")) {
        const action = toCustomerAction(TOM_LEWIS_SCRIPT, step, id, "chat");
        if (!action) continue;
        expect(action.kind).toBe("message");
        send(client, action);
        if (action.kind === "message") lines.push(action.text);
      }
      expect(lines).toHaveLength(2);
      await waitFor(() => rec.events("message").length === 2, "customer messages");
      expect(rec.events("message").map((e) => e.message.text)).toEqual(lines);
      // His agent line isn't a customer action: the player emits it.
      expect(stepsFor(TOM_LEWIS_SCRIPT, "chat").filter((s) => s.kind === "say" && s.speaker === "agent")).toHaveLength(1);
    });
  });

  it("can't launch as a channel the entity has no address for", () => {
    expect(validateScenario(TOM_LEWIS_SCRIPT, { channel: "email" })).toEqual([expect.stringContaining("can't launch as email")]);
    expect(() => startRequest(TOM_LEWIS_SCRIPT, "email")).toThrow(/no email address/);
  });
});

describe("canned lines", () => {
  it("lists an entity's customer lines (main steps and branches), without bot lines or templates", () => {
    const lines = cannedLines(SCENARIOS, { entityKey: "lucas-thomas" }).map((l) => l.text);
    expect(lines).toContain("That failed too. Can someone just place it for me?");
    expect(lines).toContain("Thank you so much — really appreciate the quick help!");
    expect(lines).not.toContain("Here's a secure link to pay another way.");
    expect(lines.some((text) => text.includes("{note}"))).toBe(false);
    expect(cannedLines(SCENARIOS, { entityKey: "tom-lewis-void-call" }).map((l) => l.text)).toEqual([
      expect.stringContaining("Hi, this is Tom Lewis"),
      expect.stringContaining("It's order NR-50877"),
    ]);
    expect(cannedLines(SCENARIOS, { entityKey: "nobody" })).toEqual([]);
  });

  it("adds a script's extra lines, skips canned: false and honors onlyOn", () => {
    const script = clone(TOM_LEWIS_SCRIPT) as ScenarioScript;
    script.canned = [{ label: "Hold", text: "Can you hold, please?" }];
    script.steps[0] = { ...script.steps[0], canned: false } as ScenarioScript["steps"][number];
    script.steps[2] = { ...script.steps[2], onlyOn: ["chat"] } as ScenarioScript["steps"][number];
    expect(cannedLines([script], { channel: "voice" })).toEqual([{ scenarioId: script.id, label: "Hold", text: "Can you hold, please?" }]);
    expect(cannedLines([script], { channel: "chat" }).map((l) => l.text)).toEqual([
      "It's order NR-50877, $86.40. I only placed it once, and I'd rather keep the Mastercard charge since that's my default card.",
      "Can you hold, please?",
    ]);
  });
});

describe("validateScenario catches", () => {
  const lucas = () => clone(LUCAS_THOMAS_SCRIPT) as ScenarioScript;
  const tom = () => clone(TOM_LEWIS_SCRIPT) as ScenarioScript;
  const problems = (script: unknown, options?: { channel?: ChannelKind }) => validateScenario(script, options).join("\n");

  it("input that isn't a script, or is malformed", () => {
    expect(validateScenario("nope")).toEqual(["script is not an object"]);
    expect(problems({ ...tom(), version: 2 })).toContain("version must be 1");
    expect(problems({ ...tom(), steps: [] })).toContain("steps must be a non-empty array");
    expect(problems({ ...tom(), start: { answer: "maybe" } })).toContain("start.answer");
    expect(problems({ ...tom(), channel: "fax" })).toContain("channel is not a channel");
    expect(parseScenarioJson("{").errors[0]).toContain("not valid JSON");
    expect(parseScenarioJson("{}").script).toBeUndefined();
  });

  it("duplicate step ids, across main steps and branches", () => {
    const script = lucas();
    script.branches!.other.steps[0] = { ...script.branches!.other.steps[0], id: "lt-1" };
    expect(problems(script)).toContain('duplicate step id');
  });

  it("timing that can't be: a past typing step, a past step on another anchor, a zero-length typing", () => {
    const past = lucas();
    past.steps[0] = { id: "p", kind: "typing", speaker: "bot", at: -5, durationMs: 100 };
    expect(problems(past)).toContain("only say and event steps can be in the past");
    const anchored = tom();
    anchored.steps[0] = { ...anchored.steps[0], at: -1 };
    expect(problems(anchored)).toContain("only the launch anchor can be in the past");
    const zero = lucas();
    zero.steps[6] = { id: "z", kind: "typing", speaker: "bot", at: 1, durationMs: 0 };
    expect(problems(zero)).toContain("typing needs a positive durationMs");
    const inBranch = lucas();
    inBranch.branches!.other.steps[1] = { ...inBranch.branches!.other.steps[1], at: -10 };
    expect(problems(inBranch)).toContain("a branch step can't be in the past");
    const anchoredBranch = lucas();
    anchoredBranch.branches!.other.steps[1] = { ...anchoredBranch.branches!.other.steps[1], anchor: "launch" };
    expect(problems(anchoredBranch)).toContain("a branch step takes no anchor");
  });

  it("{note} outside a branch that takes a note", () => {
    const script = lucas();
    script.branches!.other.inputs = undefined;
    expect(problems(script)).toContain("placeholder {note}");
    const main = lucas();
    main.steps[1] = { ...main.steps[1], text: "Hello {name}" } as ScenarioScript["steps"][number];
    expect(problems(main)).toContain("placeholder {name}");
  });

  it("beats and links that point at nothing", () => {
    const badRef = lucas();
    const summaryBeat = badRef.steps.find((s) => s.id === "lt-6-summary")!;
    expect(summaryBeat.kind).toBe("beat");
    Object.assign(summaryBeat, { ref: "missing" });
    expect(problems(badRef)).toContain("approval needs a ref to content.approvals");
    const badPanel = tom();
    badPanel.content.copilot!.links["Show the charges"] = "nowhere";
    expect(problems(badPanel)).toContain('unknown panel key "nowhere"');
    const badSnapshot = tom();
    badSnapshot.content.overview!.snapshot[0] = "See [this](ghost).";
    expect(problems(badSnapshot)).toContain('unknown panel key "ghost"');
    const noLink = tom();
    noLink.content.copilot!.suggestions.push("Another chip");
    expect(problems(noLink)).toContain('copilot chip "Another chip" has no link');
  });

  it("decisions without branches, branches nothing starts, and decision values used twice", () => {
    const noBranch = lucas();
    delete noBranch.branches!.accept;
    expect(problems(noBranch)).toContain('decision "accept" has no branch');
    const orphan = lucas();
    orphan.branches!.orphan = { label: "Orphan", steps: [{ id: "orphan-1", kind: "event", at: 0, text: "x" }] };
    expect(problems(orphan)).toContain('branch "orphan": nothing starts it');
    const twice = lucas();
    twice.content.approvals!.shipping.decisions![0] = { ...twice.content.approvals!.shipping.decisions![0], value: "accept" };
    expect(problems(twice)).toContain('decision value "accept" is used twice');
    const noComplete = lucas();
    noComplete.content.wrapUps!.main.completeBranch = "gone";
    expect(problems(noComplete)).toContain('completeBranch "gone" is not a branch');
  });
});
