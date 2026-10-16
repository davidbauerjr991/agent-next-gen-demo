import { describe, expect, it } from "vitest";
import type { EntityId, InteractionId } from "../../domain";
import type { InteractionCapabilities } from "../../providers";
import {
  describeInteractionProviderContract,
  type InteractionContractHarness,
} from "../../contract-tests/interaction-provider.contract";
import { expectProviderError, recordEvents, waitFor } from "../../contract-tests/event-recorder";
import { createMemoryBus } from "./memory-transport";
import { SIM_CAPABILITIES, SIM_DEMO_SEED, type SimDirectoryEntry } from "./sim-fixtures";
import { createSimCustomerClient } from "./sim-customer-client";
import { createSimulatedInteractionProvider, type SimOptions } from "./simulated-interaction-provider";
import type { SimTransport } from "./sim-transport";
import type { ScenarioScript } from "../../scenarios/scenario-script";

const ZERO = { minMs: 0, maxMs: 0 };

/** Sim options with no injected latency and no scripted delays. */
function instant(createTransport: () => SimTransport, extra: SimOptions = {}): SimOptions {
  return { latency: ZERO, timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO }, createTransport, ...extra };
}

/** One directory customer, stored formatted; the harness dials it as +1 digits. */
const KNOWN_CALLER: SimDirectoryEntry = {
  entityId: "known-caller" as EntityId,
  name: "Lauren Briggs",
  phones: ["(312) 555-0164"],
  emails: ["lauren.briggs@example.com"],
};

/** A minimal bot-handled script for the contract's review tests: delivered
 *  in review with one setup line and one action the agent can answer. */
const REVIEW_SCRIPT: ScenarioScript = {
  version: 1,
  id: "contract-review",
  title: "Contract review",
  summary: "A bot-handled contact in review.",
  entity: { key: "contract-review", name: "Riley Review", caseId: "CASE-REVIEW", phone: "(555) 010-0000" },
  channel: "chat",
  skill: { name: "AI Review", id: "ai-review" },
  participants: { bot: "Contract Bot" },
  start: { answer: "delivered", review: true },
  steps: [{ id: "cr-1", kind: "say", speaker: "customer", at: -1000, text: "Hello?" }],
  branches: { ack: { label: "Acknowledge", trigger: "action", steps: [{ id: "cr-ack", kind: "say", speaker: "bot", at: 0, text: "Noted." }] } },
  content: { panelKeys: [] },
};

function simHarness(capabilities?: Partial<InteractionCapabilities>) {
  return (): InteractionContractHarness => {
    const bus = createMemoryBus();
    const provider = createSimulatedInteractionProvider(
      instant(bus.createTransport, { capabilities, directory: [KNOWN_CALLER], scripts: [REVIEW_SCRIPT] }),
    );
    const client = createSimCustomerClient(provider.sessionId, bus.createTransport());
    return {
      provider,
      knownCaller: { address: "+1 312-555-0164", entityId: KNOWN_CALLER.entityId },
      customer: {
        startInbound: async (request) => client.startInbound(request),
        message: async (id, text) => client.message({ interactionId: id, text }),
        hangUp: async (id) => client.hangUp({ interactionId: id }),
        typing: async (id, isTyping) => client.typing({ interactionId: id, isTyping }),
        speak: async (id, text) => client.speak({ interactionId: id, text }),
        startInReview: async (channel) => ({ id: client.playScenario(REVIEW_SCRIPT.id, { channel }), actionValue: "ack" }),
      },
      async dispose() {
        client.dispose();
        await provider.dispose();
      },
    };
  };
}

// The sim as shipped: everything on except consult transfer.
describeInteractionProviderContract("sim — default capabilities", simHarness());

// Every optional capability off, so each gated command and the no-wrap-up,
// no-receipts paths are exercised. Inbound voice and chat stay on; outbound
// shrinks to chat.
describeInteractionProviderContract(
  "sim — optional capabilities off",
  simHarness({
    channels: { inbound: SIM_CAPABILITIES.channels.inbound, outbound: ["chat"] },
    decline: false,
    hold: false,
    mute: false,
    record: false,
    mask: false,
    dtmf: false,
    transfer: { blind: false, consult: false },
    typing: false,
    deliveryReceipts: false,
    agentLeg: false,
    wrapUp: false,
    caseStatus: false,
    reopen: false,
    review: false,
  }),
);

// A provider that routes no inbound channel, like the placeholders: per-agent
// channels have nothing to gate, so setAgentChannels rejects "not-supported".
describeInteractionProviderContract("sim — no inbound channels", simHarness({ channels: { inbound: [], outbound: ["chat"] } }));

describe("sim seed", () => {
  it("starts with the seed as offered, routed contacts in the snapshot, with no events", async () => {
    const bus = createMemoryBus();
    const provider = createSimulatedInteractionProvider(instant(bus.createTransport, { seed: SIM_DEMO_SEED }));
    const rec = recordEvents(provider);
    try {
      const before = Date.now();
      const { interactions } = await provider.getSnapshot();
      expect(interactions.map((i) => i.id)).toEqual(SIM_DEMO_SEED.map((s) => s.id));
      for (const seed of SIM_DEMO_SEED) {
        const i = interactions.find((x) => x.id === seed.id)!;
        expect(i).toMatchObject({ channel: seed.channel, contactName: seed.contactName, entityId: seed.entityId, state: "offered", origin: "routed", direction: "inbound" });
        expect(i.skill).toEqual({ id: "general", name: "General Support" });
        expect(i.caseId).toMatch(/^CS-\d{7}$/);
        expect(i.externalId?.id).toMatch(/^CTX-\d{8}-\d{5}$/);
        expect(i.journeyId).toMatch(/^\d{12}$/);
        expect(before - i.startedAt).toBeGreaterThanOrEqual(seed.ageMinutes * 60_000 - 1000);
      }
      expect(rec.events("incoming")).toEqual([]);

      // Opening a seed accepts it; its clock runs from acceptance.
      const [first] = SIM_DEMO_SEED;
      await provider.accept(first.id);
      await waitFor(
        () => rec.events("stateChanged").some((e) => e.kind === "interaction" && e.interaction.id === first.id && e.interaction.state === "active"),
        "seed accepted",
      );
      const accepted = (await provider.getSnapshot()).interactions.find((i) => i.id === first.id)!;
      expect(accepted.acceptedAt).toBeGreaterThanOrEqual(before);
    } finally {
      rec.stop();
      await provider.dispose();
    }
  });

  it("is loaded once per engine: the contract harness's default is no seed", async () => {
    const bus = createMemoryBus();
    const provider = createSimulatedInteractionProvider(instant(bus.createTransport));
    try {
      expect((await provider.getSnapshot()).interactions).toEqual([]);
    } finally {
      await provider.dispose();
    }
  });
});

describe("sim inbound routing and pre-contact summary (P0.5d.1)", () => {
  type Domain = import("../../domain").Interaction;
  async function withSim(
    run: (ctx: {
      provider: ReturnType<typeof createSimulatedInteractionProvider>;
      client: ReturnType<typeof createSimCustomerClient>;
      incoming: (id: InteractionId) => Promise<Domain>;
      latest: (id: InteractionId) => Domain | undefined;
    }) => Promise<void>,
  ) {
    const bus = createMemoryBus();
    const directory: SimDirectoryEntry[] = [
      {
        ...KNOWN_CALLER,
        lastContact: { channel: "voice", ageMinutes: 300, caseId: "CST-27760", caseStatus: "Escalated", topic: "Fraud investigation" },
      },
    ];
    const provider = createSimulatedInteractionProvider(instant(bus.createTransport, { directory }));
    const client = createSimCustomerClient(provider.sessionId, bus.createTransport());
    const rec = recordEvents(provider);
    const incoming = async (id: InteractionId) => {
      await waitFor(() => rec.events("incoming").some((e) => e.interaction.id === id), `incoming ${id}`);
      return rec.events("incoming").find((e) => e.interaction.id === id)!.interaction;
    };
    const latest = (id: InteractionId) => {
      const updates = rec.events("stateChanged").flatMap((e) => (e.kind === "interaction" && e.interaction.id === id ? [e.interaction] : []));
      return updates[updates.length - 1];
    };
    try {
      await run({ provider, client, incoming, latest });
    } finally {
      rec.stop();
      client.dispose();
      await provider.dispose();
    }
  }

  it("routes to General Support by default, or to the skill the customer side picks", () =>
    withSim(async ({ client, incoming }) => {
      const plain = await incoming(client.startInbound({ channel: "chat", address: "h", displayName: "A" }));
      expect(plain.skill).toEqual({ id: "general", name: "General Support" });
      const billing = await incoming(client.startInbound({ channel: "voice", address: "+1555", displayName: "B", skillId: "billing" }));
      expect(billing.skill).toEqual({ id: "billing", name: "Billing" });
    }));

  it("gives an unknown caller a generic summary, a known one reason / last contact / case status, and passes custom lines through", () =>
    withSim(async ({ provider, client, incoming, latest }) => {
      const unknown = await incoming(client.startInbound({ channel: "voice", address: "+15550001111", displayName: "+15550001111" }));
      expect(unknown.preContactSummary).toEqual(["Inbound call from +15550001111, no prior history."]);

      // A known number, however it's formatted: routing links the record and
      // the summary carries its last contact and open case.
      const lauren = await incoming(client.startInbound({ channel: "voice", address: "312.555.0164", displayName: "L BRIGGS" }));
      expect(lauren).toMatchObject({ entityId: KNOWN_CALLER.entityId, entityMatchedBy: "routing", contactName: "L BRIGGS" });
      expect(lauren.preContactSummary).toEqual([
        "Reason for contact: General question about the account (IVR, routed to General Support).",
        expect.stringMatching(/^Last contact: Voice, .+, case Escalated \(Fraud investigation\)\.$/),
        "Case status: CST-27760 is Escalated, still open.",
      ]);
      // Custom lines from the IVR go first; the record's facts still show.
      const ivr = await incoming(
        client.startInbound({ channel: "voice", address: "+13125550164", displayName: "Lauren", summary: ["Card reported stolen in IVR."] }),
      );
      expect(ivr.preContactSummary).toEqual([
        "Card reported stolen in IVR.",
        expect.stringMatching(/^Last contact: Voice, .+, case Escalated \(Fraud investigation\)\.$/),
        "Case status: CST-27760 is Escalated, still open.",
      ]);

      const entityId = "customer-3" as import("../../domain").EntityId;
      const first = await incoming(client.startInbound({ channel: "voice", address: "+15550002222", displayName: "David", entityId, skillId: "billing" }));
      expect(first.preContactSummary).toEqual([
        "Reason for contact: Question about a bill or payment (IVR, routed to Billing).",
        "No previous contact on record.",
        "Case status: New.",
      ]);
      // Once that call has been handled, the next one from the customer names it as the last contact.
      await provider.accept(first.id);
      await waitFor(() => latest(first.id)?.state === "active", "accepted");
      await provider.setCaseStatus(first.id, "Pending");
      await waitFor(() => latest(first.id)?.caseStatus === "Pending", "status");
      const second = await incoming(client.startInbound({ channel: "voice", address: "+15550002222", displayName: "David", entityId }));
      expect(second.preContactSummary?.[1]).toMatch(/^Last contact: Voice, .+, case Pending\.$/);

      const custom = await incoming(client.startInbound({ channel: "voice", address: "+1555", displayName: "C", summary: ["Line one", "Line two"] }));
      expect(custom.preContactSummary).toEqual(["Line one", "Line two"]);

      const chat = await incoming(client.startInbound({ channel: "chat", address: "h", displayName: "D" }));
      expect(chat.preContactSummary).toBeUndefined();
    }));
});

describe("sim-specific behavior", () => {
  it("isolates two sessions on one bus: no shared interactions, events or replies", async () => {
    const bus = createMemoryBus();
    const a = createSimulatedInteractionProvider(instant(bus.createTransport));
    const b = createSimulatedInteractionProvider(instant(bus.createTransport));
    const customerA = createSimCustomerClient(a.sessionId, bus.createTransport());
    const recA = recordEvents(a);
    const recB = recordEvents(b);
    try {
      expect(a.sessionId).not.toBe(b.sessionId);

      const idA = customerA.startInbound({ channel: "chat", address: "a-customer", displayName: "A Customer" });
      await waitFor(() => recA.events("incoming").some((e) => e.interaction.id === idA), "A sees its incoming");
      expect((await b.getSnapshot()).interactions).toEqual([]);
      expect(recB.events("incoming")).toEqual([]);

      // B can't touch A's interaction.
      await expectProviderError(b.accept(idA), "not-found");

      // Concurrent commands each get their own reply and their own events.
      const [skillA] = await a.listOutboundSkills("chat");
      const [dialA, dialB] = await Promise.all([
        a.dial({ channel: "chat", address: "a-out", skillId: skillA.id }),
        b.dial({ channel: "chat", address: "b-out", skillId: skillA.id }),
      ]);
      expect(dialA).not.toBe(dialB);
      await waitFor(
        () => recA.events("stateChanged").some((e) => e.kind === "interaction" && e.interaction.id === dialA) &&
          recB.events("stateChanged").some((e) => e.kind === "interaction" && e.interaction.id === dialB),
        "each session sees its own dialed interaction",
      );
      const idsIn = (rec: typeof recA) =>
        rec.events("stateChanged").flatMap((e) => (e.kind === "interaction" ? [e.interaction.id] : []));
      expect(idsIn(recA)).not.toContain(dialB);
      expect(idsIn(recB)).not.toContain(dialA);
      expect(idsIn(recB)).not.toContain(idA);
    } finally {
      recA.stop();
      recB.stop();
      customerA.dispose();
      await Promise.all([a.dispose(), b.dispose()]);
    }
  });

  it('rejects "network" (retryable) when the transport drops messages, after commandTimeoutMs', async () => {
    const bus = createMemoryBus();
    const dropping = (): SimTransport => ({ ...bus.createTransport(), send: () => {} });
    const provider = createSimulatedInteractionProvider(instant(dropping, { engine: false, commandTimeoutMs: 40 }));
    try {
      const started = Date.now();
      const read = provider.getSnapshot();
      const command = provider.accept("x" as InteractionId);
      for (const call of [read, command]) {
        await call.then(
          () => expect.unreachable("a dropped command must not resolve"),
          (err: unknown) => expect(err).toMatchObject({ code: "network", retryable: true }),
        );
      }
      expect(Date.now() - started).toBeGreaterThanOrEqual(30);
      // The timed-out entries are gone, so disposing doesn't reject them again.
      await expect(provider.dispose()).resolves.toBeUndefined();
    } finally {
      await provider.dispose();
    }
  });
});
