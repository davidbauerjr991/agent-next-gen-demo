import { describe, expect, it } from "vitest";
import type { InteractionId } from "../../domain";
import type { InteractionCapabilities } from "../../providers";
import {
  describeInteractionProviderContract,
  type InteractionContractHarness,
} from "../../contract-tests/interaction-provider.contract";
import { expectProviderError, recordEvents, waitFor } from "../../contract-tests/event-recorder";
import { createMemoryBus } from "./memory-transport";
import { SIM_CAPABILITIES, SIM_DEMO_SEED } from "./sim-fixtures";
import { createSimCustomerClient } from "./sim-customer-client";
import { createSimulatedInteractionProvider, type SimOptions } from "./simulated-interaction-provider";
import type { SimTransport } from "./sim-transport";

const ZERO = { minMs: 0, maxMs: 0 };

/** Sim options with no injected latency and no scripted delays. */
function instant(createTransport: () => SimTransport, extra: SimOptions = {}): SimOptions {
  return { latency: ZERO, timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO }, createTransport, ...extra };
}

function simHarness(capabilities?: Partial<InteractionCapabilities>) {
  return (): InteractionContractHarness => {
    const bus = createMemoryBus();
    const provider = createSimulatedInteractionProvider(instant(bus.createTransport, { capabilities }));
    const client = createSimCustomerClient(provider.sessionId, bus.createTransport());
    return {
      provider,
      customer: {
        startInbound: async (request) => client.startInbound(request),
        message: async (id, text) => client.message({ interactionId: id, text }),
        hangUp: async (id) => client.hangUp({ interactionId: id }),
        typing: async (id, isTyping) => client.typing({ interactionId: id, isTyping }),
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
  }),
);

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
