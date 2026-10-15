import { afterEach, beforeEach, describe, expect, it, type TestContext } from "vitest";
import type { AgentState, ChannelKind, EntityId, Interaction, InteractionId, InteractionState, JourneyId } from "../domain";
import type { EndReason, InteractionProvider } from "../providers";
import { expectProviderError, recordEvents, settle, waitFor, type Recorder } from "./event-recorder";

// The InteractionProvider contract suite (P0.8). Every adapter — the sim,
// and later Twilio and CXone — must pass this before it counts as done.
// It talks to the provider only through the public interface plus a
// `customer` driver for the far side of the conversation, which a real
// adapter backs with a fake vendor backend. It branches on
// `provider.capabilities`: a step whose flag is false must reject
// "not-supported" instead of running.

export interface InteractionContractHarness {
  provider: InteractionProvider;
  /** The customer's side. Each call resolves once the action has been sent. */
  customer: {
    startInbound(request: { channel: ChannelKind; address: string; displayName: string }): Promise<InteractionId>;
    message(id: InteractionId, text: string): Promise<void>;
    hangUp(id: InteractionId): Promise<void>;
    typing(id: InteractionId, isTyping: boolean): Promise<void>;
  };
  /** Tears down the driver and anything else the factory made. Idempotent. */
  dispose(): Promise<void>;
  /** Extra quiet time for "nothing else happens" checks, for adapters with
   *  slower paths than a zero-latency in-memory bus. Default 0. */
  settleMs?: number;
  /** A customer the adapter's backend knows by phone number, with `address`
   *  formatted differently from how the record stores it, so the routing
   *  match has to normalize. Omitted: the known-caller test is skipped. */
  knownCaller?: { address: string; entityId: EntityId };
}

export type InteractionContractFactory = () => InteractionContractHarness | Promise<InteractionContractHarness>;

const GHOST = "ghost-interaction" as InteractionId;
const ALL_CHANNELS: ChannelKind[] = ["voice", "chat", "sms", "whatsapp", "email"];
const OUTCOME = { dispositionCode: "resolved", tags: ["contract"], summary: "Contract test" };

export function describeInteractionProviderContract(label: string, factory: InteractionContractFactory): void {
  describe(`InteractionProvider contract — ${label}`, () => {
    let h: InteractionContractHarness;
    let rec: Recorder;

    beforeEach(async () => {
      h = await factory();
      rec = recordEvents(h.provider);
    });

    afterEach(async () => {
      rec.stop();
      await h.dispose();
    });

    // ── Helpers ───────────────────────────────────────────────────────────

    const caps = () => h.provider.capabilities;
    const settleNow = () => settle(h.provider, h.settleMs ?? 0);

    /** The latest interaction snapshot the provider has emitted for `id`. */
    function latest(id: InteractionId): Interaction | undefined {
      let found: Interaction | undefined;
      for (const { interaction } of statesOf(id)) found = interaction;
      return found;
    }

    function statesOf(id: InteractionId) {
      return rec.events("stateChanged").flatMap((e) => (e.kind === "interaction" && e.interaction.id === id ? [e] : []));
    }

    function agentStates(): AgentState[] {
      return rec.events("stateChanged").flatMap((e) => (e.kind === "agent" ? [e.agent] : []));
    }

    /** The agent leg state from the latest agent snapshot. */
    function currentLeg(): AgentState["leg"] | undefined {
      const states = agentStates();
      return states[states.length - 1]?.leg;
    }

    const waitForState =(id: InteractionId, state: InteractionState) =>
      waitFor(() => latest(id)?.state === state, `interaction ${id} reaches "${state}"`);

    /** Skips the test unless the provider offers `channel` inbound. */
    function requireInbound(ctx: TestContext, channel: ChannelKind) {
      ctx.skip(!caps().channels.inbound.includes(channel), `provider does not offer inbound ${channel}`);
    }

    async function startInbound(channel: ChannelKind): Promise<InteractionId> {
      const id = await h.customer.startInbound({ channel, address: channel === "voice" ? "+15551230000" : "customer-handle", displayName: "Casey Customer" });
      await waitFor(() => rec.events("incoming").some((e) => e.interaction.id === id), `incoming for ${id}`);
      return id;
    }

    async function startAccepted(channel: ChannelKind): Promise<InteractionId> {
      const id = await startInbound(channel);
      await h.provider.accept(id);
      await waitForState(id, "active");
      return id;
    }

    /** Ends the contact and, with wrap-up, completes it. Resolves once `ended` fired. */
    async function closeFully(id: InteractionId): Promise<void> {
      await h.provider.end(id);
      if (caps().wrapUp) {
        await waitForState(id, "wrap-up");
        await h.provider.completeWrapUp(id, OUTCOME);
      }
      await waitForState(id, "ended");
      await waitFor(() => rec.events("ended").some((e) => e.interactionId === id), `ended for ${id}`);
    }

    /** `ended` fired exactly once, with `reason`, after the final stateChanged to "ended". */
    async function expectClosed(id: InteractionId, reason: EndReason) {
      await waitFor(() => rec.events("ended").some((e) => e.interactionId === id), `ended for ${id}`);
      await settleNow();
      const ended = rec.events("ended").filter((e) => e.interactionId === id);
      expect(ended).toEqual([{ interactionId: id, reason }]);
      const endedAt = rec.indexOf((e) => e.kind === "event" && e.name === "ended" && (e.payload as { interactionId: InteractionId }).interactionId === id);
      const lastState = rec.timeline.reduce(
        (last, e, i) =>
          e.kind === "event" && e.name === "stateChanged" && (e.payload as { kind: string; interaction?: Interaction }).interaction?.id === id ? i : last,
        -1,
      );
      expect(lastState, "no stateChanged for the interaction after `ended`").toBeLessThan(endedAt);
      expect(latest(id)?.state).toBe("ended");
    }

    /** Runs `action`, settles, and asserts it produced no events at all. */
    async function expectNoEvents(action: () => Promise<unknown>) {
      await settleNow();
      const mark = rec.mark();
      await action();
      await settleNow();
      expect(rec.since(mark).filter((e) => e.kind === "event")).toEqual([]);
    }

    // ── Lifecycles ────────────────────────────────────────────────────────

    describe("lifecycle", () => {
      it("an incoming offer always carries the skill it was routed to, on every inbound channel", async (ctx) => {
        ctx.skip(caps().channels.inbound.length === 0, "provider offers no inbound channels");
        for (const channel of caps().channels.inbound) {
          const id = await startInbound(channel);
          const incoming = rec.events("incoming").find((e) => e.interaction.id === id)!.interaction;
          expect(incoming.skill, `${channel} offer`).toEqual({ id: expect.any(String), name: expect.any(String) });
        }
      });

      it("an inbound call from a known number carries the customer's entityId; an unknown one none", async (ctx) => {
        requireInbound(ctx, "voice");
        ctx.skip(!h.knownCaller, "harness names no known caller");
        const { address, entityId } = h.knownCaller!;
        const known = await h.customer.startInbound({ channel: "voice", address, displayName: "Caller ID Name" });
        await waitFor(() => rec.events("incoming").some((e) => e.interaction.id === known), "known caller offered");
        const offer = rec.events("incoming").find((e) => e.interaction.id === known)!.interaction;
        expect(offer).toMatchObject({ entityId, entityMatchedBy: "routing" });

        const unknown = await startInbound("voice");
        const unknownOffer = rec.events("incoming").find((e) => e.interaction.id === unknown)!.interaction;
        expect(unknownOffer.entityId).toBeUndefined();
        expect(unknownOffer.entityMatchedBy).toBeUndefined();
      });

      it("chat: incoming → accept → message → hold → end → completeWrapUp", async (ctx) => {
        requireInbound(ctx, "chat");
        const { provider } = h;

        const id = await startInbound("chat");
        const incoming = rec.events("incoming").find((e) => e.interaction.id === id)!.interaction;
        expect(incoming).toMatchObject({ channel: "chat", direction: "inbound", state: "offered", origin: "routed" });
        expect((await provider.getSnapshot()).interactions.map((i) => i.id)).toContain(id);

        await provider.accept(id);
        await waitForState(id, "active");

        await h.customer.message(id, "Hello, I need help");
        await waitFor(() => rec.events("message").some((e) => e.message.author.role === "customer"), "customer message");
        await waitFor(() => latest(id)?.awaitingAgentSince !== undefined, "awaitingAgentSince set");

        const messageId = await provider.sendMessage(id, "Happy to help");
        await waitFor(
          () => rec.events("message").some((e) => e.message.id === messageId && e.message.author.role === "agent" && e.message.text === "Happy to help"),
          "agent message event",
        );
        if (caps().deliveryReceipts) {
          await waitFor(() => rec.events("message").some((e) => e.message.id === messageId && e.message.delivery === "delivered"), "delivered upsert");
        }
        await waitFor(() => latest(id)?.awaitingAgentSince === undefined, "awaitingAgentSince cleared by the reply");

        const transcript = await provider.getTranscript(id);
        expect(transcript.messages.map((m) => m.text)).toEqual(["Hello, I need help", "Happy to help"]);

        if (caps().hold) {
          await provider.hold(id, true);
          await waitForState(id, "held");
          expect(latest(id)?.heldSince).toBeTypeOf("number");
          await provider.hold(id, false);
          await waitForState(id, "active");
          expect(latest(id)?.heldSince).toBeUndefined();
        } else {
          await expectProviderError(provider.hold(id, true), "not-supported");
        }

        await provider.end(id);
        if (caps().wrapUp) {
          await waitForState(id, "wrap-up");
          await settleNow();
          expect(rec.events("ended"), "`ended` waits for completeWrapUp").toEqual([]);
          await provider.completeWrapUp(id, OUTCOME);
          await waitForState(id, "ended");
          expect(latest(id)?.outcome).toEqual(OUTCOME);
        } else {
          await waitForState(id, "ended");
        }
        await expectClosed(id, "agent");
        expect((await provider.getSnapshot()).interactions.map((i) => i.id)).not.toContain(id);

        if (!caps().wrapUp) {
          // Without wrap-up, the outcome is recorded on the ended contact — without a second `ended`.
          await provider.completeWrapUp(id, OUTCOME);
          await waitFor(() => latest(id)?.outcome !== undefined, "outcome recorded");
          expect(rec.events("ended").filter((e) => e.interactionId === id)).toHaveLength(1);
        }
      });

      it("voice: accept → in-call controls → end → completeWrapUp", async (ctx) => {
        requireInbound(ctx, "voice");
        const { provider } = h;
        const id = await startAccepted("voice");

        const controls = [
          ["muted", caps().mute, (on: boolean) => provider.mute(id, on)],
          ["recording", caps().record, (on: boolean) => provider.setRecording(id, on)],
          ["masked", caps().mask, (on: boolean) => provider.setMasked(id, on)],
        ] as const;
        for (const [field, supported, apply] of controls) {
          if (!supported) {
            await expectProviderError(apply(true), "not-supported");
            continue;
          }
          await apply(true);
          await waitFor(() => latest(id)?.[field] === true, `${field} on`);
          await apply(false);
          await waitFor(() => latest(id)?.[field] === false, `${field} off`);
        }

        if (caps().dtmf) await expectNoEvents(() => provider.sendDtmf(id, "12#"));
        else await expectProviderError(provider.sendDtmf(id, "12#"), "not-supported");

        if (caps().hold) {
          await provider.hold(id, true);
          await waitForState(id, "held");
          await provider.hold(id, false);
          await waitForState(id, "active");
        }

        await closeFully(id);
        await expectClosed(id, "agent");
      });

      it("outbound: dial resolves an id and the interaction appears via stateChanged, never incoming", async (ctx) => {
        const channel = caps().channels.outbound[0];
        ctx.skip(!channel, "provider offers no outbound channel");
        const { provider } = h;
        const skills = await provider.listOutboundSkills(channel);
        expect(skills.length).toBeGreaterThan(0);

        const id = await provider.dial({ channel, address: channel === "email" ? "casey@example.com" : "+15551230000", skillId: skills[0].id });
        await waitFor(() => latest(id) !== undefined, "first stateChanged for the dialed interaction");
        expect(statesOf(id)[0].interaction).toMatchObject({ id, channel, direction: "outbound", origin: "agent-initiated" });
        expect(rec.events("incoming")).toEqual([]);
      });

      it("outbound voice: connecting → active", async (ctx) => {
        ctx.skip(!caps().channels.outbound.includes("voice"), "provider offers no outbound voice");
        const { provider } = h;
        const [skill] = await provider.listOutboundSkills("voice");
        const id = await provider.dial({ channel: "voice", address: "+15551230000", skillId: skill.id });
        await waitForState(id, "active");
        const states = statesOf(id).map((e) => e.interaction.state);
        expect(states[0]).toBe("connecting");
        expect(states[states.length - 1]).toBe("active");
      });

      it("agent state: setAgentState emits an agent snapshot", async (ctx) => {
        const { provider } = h;
        const options = await provider.listPresenceOptions();
        const { agent } = await provider.getSnapshot();
        const next = options.find((o) => o.code !== agent.presence.code);
        ctx.skip(!next, "only one presence option");
        await provider.setAgentState(next!.code);
        await waitFor(() => agentStates().some((a) => a.presence.code === next!.code), "agent presence snapshot");
      });

      it("agent leg: disconnect, then connect passes through connecting", async (ctx) => {
        ctx.skip(!caps().agentLeg, "agent leg not supported");
        const { provider } = h;
        await provider.disconnectAgentLeg();
        await waitFor(() => currentLeg() === "disconnected", "leg disconnected");
        await provider.connectAgentLeg();
        await waitFor(() => currentLeg() === "connected", "leg connected");
        const legs = agentStates().map((a) => a.leg);
        expect(legs.indexOf("connecting")).toBeGreaterThan(legs.indexOf("disconnected"));
        expect(legs.lastIndexOf("connected")).toBeGreaterThan(legs.indexOf("connecting"));
      });

      it("typing: both directions, gated on capabilities.typing", async (ctx) => {
        requireInbound(ctx, "chat");
        const { provider } = h;
        const id = await startAccepted("chat");

        if (caps().typing) {
          await provider.setTyping(id, true);
          await waitFor(() => rec.events("typing").some((e) => e.interactionId === id && e.role === "agent" && e.isTyping), "agent typing on");
          await provider.setTyping(id, false);
          await waitFor(() => rec.events("typing").some((e) => e.role === "agent" && !e.isTyping), "agent typing off");

          await h.customer.typing(id, true);
          await waitFor(() => rec.events("typing").some((e) => e.interactionId === id && e.role === "customer" && e.isTyping), "customer typing on");
          await h.customer.typing(id, false);
          await waitFor(() => rec.events("typing").some((e) => e.role === "customer" && !e.isTyping), "customer typing off");
        } else {
          await expectProviderError(provider.setTyping(id, true), "not-supported");
          const mark = rec.mark();
          await h.customer.typing(id, true);
          await settle(provider, Math.max(5, h.settleMs ?? 0));
          expect(rec.since(mark).filter((e) => e.kind === "event" && e.name === "typing")).toEqual([]);
        }
      });
    });

    // ── Reopen, case ids, acceptance (P0.5b.1) ────────────────────────────

    describe("reopen, case ids and acceptedAt", () => {
      const requireReopen = (ctx: TestContext) => ctx.skip(!caps().reopen, "reopen not supported");

      it("accept with a journeyId joins that open journey and takes its case id", async (ctx) => {
        requireInbound(ctx, "chat");
        const first = await startAccepted("chat");
        const { journeyId, caseId } = latest(first)!;
        const second = await startInbound("chat");
        const offered = rec.events("incoming").find((e) => e.interaction.id === second)!.interaction;
        expect(offered.journeyId).not.toBe(journeyId);
        await h.provider.accept(second, { journeyId });
        await waitForState(second, "active");
        expect(latest(second)).toMatchObject({ journeyId, caseId });
      });

      it("accept into a journey with nothing open rejects not-found and leaves the offer", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startInbound("chat");
        await expect(h.provider.accept(id, { journeyId: "no-such-journey" as JourneyId })).rejects.toMatchObject({ code: "not-found" });
        const { interactions } = await h.provider.getSnapshot();
        expect(interactions.find((i) => i.id === id)?.state).toBe("offered");
      });

      it("accept stamps acceptedAt", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startAccepted("chat");
        const accepted = latest(id)!;
        expect(accepted.acceptedAt).toBeTypeOf("number");
        expect(accepted.acceptedAt!).toBeGreaterThanOrEqual(accepted.startedAt);
      });

      it("a dial that joins a journey shares its case id", async (ctx) => {
        const channel = caps().channels.outbound[0];
        ctx.skip(!channel, "provider offers no outbound channel");
        const { provider } = h;
        const [skill] = await provider.listOutboundSkills(channel);
        const first = await provider.dial({ channel, address: "one@example.com", skillId: skill.id });
        await waitFor(() => latest(first) !== undefined, "first dial appears");
        const journeyId = latest(first)!.journeyId;
        const second = await provider.dial({ channel, address: "two@example.com", skillId: skill.id, journeyId });
        await waitFor(() => latest(second) !== undefined, "second dial appears");
        expect(latest(second)!.journeyId).toBe(journeyId);
        expect(latest(second)!.caseId).toBe(latest(first)!.caseId);
      });

      it("a dial keeps a given case id on a new journey and ignores it when joining one", async (ctx) => {
        const channel = caps().channels.outbound[0];
        ctx.skip(!channel, "provider offers no outbound channel");
        const { provider } = h;
        const [skill] = await provider.listOutboundSkills(channel);
        const first = await provider.dial({ channel, address: "one@example.com", skillId: skill.id, caseId: "CASE-DIAL" });
        await waitFor(() => latest(first) !== undefined, "first dial appears");
        expect(latest(first)!.caseId).toBe("CASE-DIAL");
        const journeyId = latest(first)!.journeyId;
        const second = await provider.dial({ channel, address: "two@example.com", skillId: skill.id, journeyId, caseId: "CASE-OTHER" });
        await waitFor(() => latest(second) !== undefined, "second dial appears");
        expect(latest(second)!.caseId).toBe("CASE-DIAL");
      });

      it("reopen creates an active, reopened contact via stateChanged, never incoming", async (ctx) => {
        requireReopen(ctx);
        const id = await h.provider.reopen({ channel: "chat", direction: "inbound", address: "casey-handle", caseId: "CASE-A", caseStatus: "Pending", contactName: "Casey" });
        await waitFor(() => latest(id) !== undefined, "reopened contact appears");
        expect(latest(id)).toMatchObject({ id, channel: "chat", direction: "inbound", state: "active", origin: "reopened", caseId: "CASE-A", caseStatus: "Pending", contactName: "Casey" });
        expect(rec.events("incoming")).toEqual([]);
      });

      it("reopen joins the open journey with the same case id, or the given journeyId", async (ctx) => {
        requireReopen(ctx);
        const { provider } = h;
        const first = await provider.reopen({ channel: "chat", direction: "inbound", address: "a", caseId: "CASE-B" });
        const byCase = await provider.reopen({ channel: "email", direction: "inbound", address: "a@example.com", caseId: "CASE-B" });
        const other = await provider.reopen({ channel: "chat", direction: "inbound", address: "b", caseId: "CASE-C" });
        await waitFor(() => [first, byCase, other].every((id) => latest(id) !== undefined), "reopened contacts appear");
        const journeyId = latest(first)!.journeyId;
        expect(latest(byCase)!.journeyId).toBe(journeyId);
        expect(latest(other)!.journeyId).not.toBe(journeyId);

        const byJourney = await provider.reopen({ channel: "sms", direction: "outbound", address: "+15550001111", journeyId });
        await waitFor(() => latest(byJourney) !== undefined, "reopen by journey appears");
        expect(latest(byJourney)!.journeyId).toBe(journeyId);
        expect(latest(byJourney)!.caseId).toBe("CASE-B");
      });

      it("reopen supersedes a live contact on the same channel and address: it ends with reason agent, without wrap-up", async (ctx) => {
        requireReopen(ctx);
        const { provider } = h;
        const request = { channel: "chat" as const, direction: "inbound" as const, address: "same-handle", caseId: "CASE-D" };
        const old = await provider.reopen(request);
        await waitForState(old, "active");
        const replacement = await provider.reopen(request);
        await waitForState(replacement, "active");
        await expectClosed(old, "agent");
        expect(statesOf(old).map((e) => e.interaction.state)).not.toContain("wrap-up");
        expect(latest(replacement)!.journeyId).toBe(latest(old)!.journeyId);
      });
    });

    // ── One active call ───────────────────────────────────────────────────

    describe("one active voice contact", () => {
      it("with hold: accepting a second call holds the first, and resuming the first holds the second", async (ctx) => {
        requireInbound(ctx, "voice");
        ctx.skip(!caps().hold, "hold not supported");
        const { provider } = h;
        const first = await startAccepted("voice");
        const second = await startInbound("voice");
        await provider.accept(second);
        await waitForState(second, "active");
        await waitForState(first, "held");
        // The first was held before the second went active.
        const heldAt = rec.indexOf((e) => e.kind === "event" && e.name === "stateChanged" && (e.payload as { interaction?: Interaction }).interaction?.id === first && (e.payload as { interaction: Interaction }).interaction.state === "held");
        const activeAt = rec.indexOf((e) => e.kind === "event" && e.name === "stateChanged" && (e.payload as { interaction?: Interaction }).interaction?.id === second && (e.payload as { interaction: Interaction }).interaction.state === "active");
        expect(heldAt).toBeLessThan(activeAt);

        await provider.hold(first, false);
        await waitForState(first, "active");
        await waitForState(second, "held");
      });

      it("with hold: an outbound call holds the active call when it connects", async (ctx) => {
        requireInbound(ctx, "voice");
        ctx.skip(!caps().hold, "hold not supported");
        ctx.skip(!caps().channels.outbound.includes("voice"), "provider offers no outbound voice");
        const { provider } = h;
        const first = await startAccepted("voice");
        const [skill] = await provider.listOutboundSkills("voice");
        const dialed = await provider.dial({ channel: "voice", address: "+15559990000", skillId: skill.id });
        await waitForState(dialed, "active");
        await waitForState(first, "held");
      });

      it("with hold: a voice reopen holds the active call", async (ctx) => {
        requireInbound(ctx, "voice");
        ctx.skip(!caps().hold, "hold not supported");
        ctx.skip(!caps().reopen, "reopen not supported");
        const first = await startAccepted("voice");
        const reopened = await h.provider.reopen({ channel: "voice", direction: "outbound", address: "+15558880000" });
        await waitForState(reopened, "active");
        await waitForState(first, "held");
      });

      it("without hold: a second live voice contact rejects invalid-state", async (ctx) => {
        requireInbound(ctx, "voice");
        ctx.skip(caps().hold, "hold is supported");
        const { provider } = h;
        const first = await startAccepted("voice");
        const second = await startInbound("voice");
        await expectNoEvents(() => expectProviderError(provider.accept(second), "invalid-state"));
        if (caps().channels.outbound.includes("voice")) {
          const [skill] = await provider.listOutboundSkills("voice");
          await expectNoEvents(() => expectProviderError(provider.dial({ channel: "voice", address: "+15559990000", skillId: skill.id }), "invalid-state"));
        }
        if (caps().reopen) {
          await expectNoEvents(() => expectProviderError(provider.reopen({ channel: "voice", direction: "outbound", address: "+15558880000" }), "invalid-state"));
        }
        expect(latest(first)?.state).toBe("active");
      });
    });

    // ── Ack before event ──────────────────────────────────────────────────

    describe("ack-before-event ordering", () => {
      /** The command's ack lands in the timeline before the first event it caused. */
      async function expectAckFirst(label: string, mark: number, isCaused: (entry: Recorder["timeline"][number]) => boolean) {
        await waitFor(() => rec.since(mark).some(isCaused), `an event caused by ${label}`);
        const ack = rec.indexOf((e) => e.kind === "ack" && e.label === label, mark);
        const event = rec.indexOf(isCaused, mark);
        expect(ack, `ack:${label} recorded`).toBeGreaterThanOrEqual(0);
        expect(ack, `ack:${label} before its event`).toBeLessThan(event);
      }

      const stateOf = (id: InteractionId, state?: InteractionState) => (e: Recorder["timeline"][number]) =>
        e.kind === "event" &&
        e.name === "stateChanged" &&
        (e.payload as { kind: string; interaction?: Interaction }).interaction?.id === id &&
        (state === undefined || (e.payload as { interaction: Interaction }).interaction.state === state);

      it("accept, sendMessage, hold and end", async (ctx) => {
        requireInbound(ctx, "chat");
        const { provider } = h;
        const id = await startInbound("chat");

        let mark = rec.mark();
        await rec.track("accept", provider.accept(id));
        await expectAckFirst("accept", mark, stateOf(id, "active"));

        mark = rec.mark();
        await rec.track("sendMessage", provider.sendMessage(id, "hi"));
        await expectAckFirst("sendMessage", mark, (e) => e.kind === "event" && e.name === "message");

        if (caps().hold) {
          mark = rec.mark();
          await rec.track("hold", provider.hold(id, true));
          await expectAckFirst("hold", mark, stateOf(id, "held"));
          await provider.hold(id, false);
          await waitForState(id, "active");
        }

        mark = rec.mark();
        await rec.track("end", provider.end(id));
        await expectAckFirst("end", mark, stateOf(id, caps().wrapUp ? "wrap-up" : "ended"));
      });

      it("dial", async (ctx) => {
        const channel = caps().channels.outbound[0];
        ctx.skip(!channel, "provider offers no outbound channel");
        const [skill] = await h.provider.listOutboundSkills(channel);
        const mark = rec.mark();
        const id = await rec.track("dial", h.provider.dial({ channel, address: channel === "email" ? "casey@example.com" : "+15551230000", skillId: skill.id }));
        await expectAckFirst("dial", mark, stateOf(id));
      });

      it("reopen", async (ctx) => {
        ctx.skip(!caps().reopen, "reopen not supported");
        const mark = rec.mark();
        const id = await rec.track("reopen", h.provider.reopen({ channel: "chat", direction: "inbound", address: "casey-handle" }));
        await expectAckFirst("reopen", mark, stateOf(id));
      });
    });

    // ── Idempotent no-ops ─────────────────────────────────────────────────

    describe("idempotent commands resolve without an event", () => {
      it("hold(true) twice, hold(false) when not held", async (ctx) => {
        requireInbound(ctx, "chat");
        ctx.skip(!caps().hold, "hold not supported");
        const id = await startAccepted("chat");
        await expectNoEvents(() => h.provider.hold(id, false));
        await h.provider.hold(id, true);
        await waitForState(id, "held");
        await expectNoEvents(() => h.provider.hold(id, true));
      });

      it("mute / record / mask to the current value", async (ctx) => {
        requireInbound(ctx, "voice");
        const { provider } = h;
        const id = await startAccepted("voice");
        const controls = [
          [caps().mute, "muted", (on: boolean) => provider.mute(id, on)],
          [caps().record, "recording", (on: boolean) => provider.setRecording(id, on)],
          [caps().mask, "masked", (on: boolean) => provider.setMasked(id, on)],
        ] as const;
        let tested = 0;
        for (const [supported, field, apply] of controls) {
          if (!supported) continue;
          tested++;
          await expectNoEvents(() => apply(false)); // already off
          await apply(true);
          await waitFor(() => latest(id)?.[field] === true, `${field} on`);
          await expectNoEvents(() => apply(true)); // already on
        }
        ctx.skip(tested === 0, "no voice controls supported");
      });

      it("end while already in wrap-up", async (ctx) => {
        requireInbound(ctx, "chat");
        ctx.skip(!caps().wrapUp, "no wrap-up state");
        const id = await startAccepted("chat");
        await h.provider.end(id);
        await waitForState(id, "wrap-up");
        await expectNoEvents(() => h.provider.end(id));
      });

      it("setCaseStatus to the current status", async (ctx) => {
        requireInbound(ctx, "chat");
        ctx.skip(!caps().caseStatus, "case status not supported");
        const id = await startAccepted("chat");
        await h.provider.setCaseStatus(id, "Open");
        await waitFor(() => latest(id)?.caseStatus === "Open", "case status set");
        await expectNoEvents(() => h.provider.setCaseStatus(id, "Open"));
      });

      it("associateEntity with the linked entity", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startAccepted("chat");
        const entityId = "entity-1" as EntityId;
        await h.provider.associateEntity(id, entityId);
        await waitFor(() => latest(id)?.entityId === entityId, "entity linked");
        expect(latest(id)?.entityMatchedBy).toBe("agent");
        await expectNoEvents(() => h.provider.associateEntity(id, entityId));
      });

      it("setAgentState to the current presence", async (ctx) => {
        const [first] = await h.provider.listPresenceOptions();
        ctx.skip(!first, "no presence options");
        await h.provider.setAgentState(first.code);
        await expectNoEvents(() => h.provider.setAgentState(first.code));
      });

      it("connectAgentLeg when connected, disconnectAgentLeg when disconnected", async (ctx) => {
        ctx.skip(!caps().agentLeg, "agent leg not supported");
        const { provider } = h;
        if ((await provider.getSnapshot()).agent.leg !== "connected") {
          await provider.connectAgentLeg();
          await waitFor(() => currentLeg() === "connected", "leg connected");
        }
        await expectNoEvents(() => provider.connectAgentLeg());
        await provider.disconnectAgentLeg();
        await waitFor(() => currentLeg() === "disconnected", "leg disconnected");
        await expectNoEvents(() => provider.disconnectAgentLeg());
      });
    });

    // ── Errors ────────────────────────────────────────────────────────────

    describe('"not-supported"', () => {
      type Gated = { name: string; supported: (c: InteractionProvider["capabilities"]) => boolean; call: (p: InteractionProvider) => Promise<unknown> };
      const gated: Gated[] = [
        { name: "decline", supported: (c) => c.decline, call: (p) => p.decline(GHOST) },
        { name: "hold", supported: (c) => c.hold, call: (p) => p.hold(GHOST, true) },
        { name: "mute", supported: (c) => c.mute, call: (p) => p.mute(GHOST, true) },
        { name: "setRecording", supported: (c) => c.record, call: (p) => p.setRecording(GHOST, true) },
        { name: "setMasked", supported: (c) => c.mask, call: (p) => p.setMasked(GHOST, true) },
        { name: "sendDtmf", supported: (c) => c.dtmf, call: (p) => p.sendDtmf(GHOST, "1") },
        { name: "transfer (blind)", supported: (c) => c.transfer.blind, call: (p) => p.transfer(GHOST, { kind: "team", id: "t1", label: "Billing" }, "blind") },
        { name: "transfer (consult)", supported: (c) => c.transfer.consult, call: (p) => p.transfer(GHOST, { kind: "team", id: "t1", label: "Billing" }, "consult") },
        { name: "setTyping", supported: (c) => c.typing, call: (p) => p.setTyping(GHOST, true) },
        { name: "setCaseStatus", supported: (c) => c.caseStatus, call: (p) => p.setCaseStatus(GHOST, "Open") },
        { name: "connectAgentLeg", supported: (c) => c.agentLeg, call: (p) => p.connectAgentLeg() },
        { name: "disconnectAgentLeg", supported: (c) => c.agentLeg, call: (p) => p.disconnectAgentLeg() },
        { name: "reopen", supported: (c) => c.reopen, call: (p) => p.reopen({ channel: "chat", direction: "inbound", journeyId: "ghost-journey" as JourneyId }) },
        ...ALL_CHANNELS.map<Gated>((channel) => ({
          name: `dial (${channel})`,
          supported: (c) => c.channels.outbound.includes(channel),
          call: (p) => p.dial({ channel, address: "+15551230000", skillId: "any" }),
        })),
      ];

      for (const entry of gated) {
        it(`${entry.name} rejects when its capability is false — before looking anything up, with no event`, async (ctx) => {
          ctx.skip(entry.supported(caps()), `${entry.name} is supported by this provider`);
          const mark = rec.mark();
          await expectProviderError(entry.call(h.provider), "not-supported");
          await settleNow();
          expect(rec.since(mark).filter((e) => e.kind === "event")).toEqual([]);
        });
      }
    });

    describe('"invalid-state"', () => {
      it("accept on an active contact", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startAccepted("chat");
        await expectNoEvents(() => expectProviderError(h.provider.accept(id), "invalid-state"));
      });

      it("decline on an active contact", async (ctx) => {
        requireInbound(ctx, "chat");
        ctx.skip(!caps().decline, "decline not supported");
        const id = await startAccepted("chat");
        await expectNoEvents(() => expectProviderError(h.provider.decline(id), "invalid-state"));
      });

      it("commands on an ended contact", async (ctx) => {
        requireInbound(ctx, "chat");
        const { provider } = h;
        const id = await startAccepted("chat");
        await closeFully(id);
        await expectNoEvents(async () => {
          await expectProviderError(provider.sendMessage(id, "too late"), "invalid-state");
          await expectProviderError(provider.end(id), "invalid-state");
          await expectProviderError(provider.accept(id), "invalid-state");
          if (caps().hold) await expectProviderError(provider.hold(id, true), "invalid-state");
          if (caps().caseStatus) await expectProviderError(provider.setCaseStatus(id, "Open"), "invalid-state");
        });
      });

      it("voice-only commands on a chat", async (ctx) => {
        requireInbound(ctx, "chat");
        const { provider } = h;
        const id = await startAccepted("chat");
        await expectNoEvents(async () => {
          if (caps().mute) await expectProviderError(provider.mute(id, true), "invalid-state");
          if (caps().record) await expectProviderError(provider.setRecording(id, true), "invalid-state");
          if (caps().mask) await expectProviderError(provider.setMasked(id, true), "invalid-state");
          if (caps().dtmf) await expectProviderError(provider.sendDtmf(id, "1"), "invalid-state");
        });
      });

      it("digital-only commands on a call", async (ctx) => {
        requireInbound(ctx, "voice");
        const { provider } = h;
        const id = await startAccepted("voice");
        await expectNoEvents(async () => {
          await expectProviderError(provider.sendMessage(id, "hi"), "invalid-state");
          if (caps().typing) await expectProviderError(provider.setTyping(id, true), "invalid-state");
        });
      });

      it("completeWrapUp on a contact that is still active", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startAccepted("chat");
        await expectNoEvents(() => expectProviderError(h.provider.completeWrapUp(id, OUTCOME), "invalid-state"));
      });

      it("completeWrapUp a second time", async (ctx) => {
        requireInbound(ctx, "chat");
        ctx.skip(!caps().wrapUp, "no wrap-up state");
        const id = await startAccepted("chat");
        await closeFully(id);
        await expectNoEvents(() => expectProviderError(h.provider.completeWrapUp(id, OUTCOME), "invalid-state"));
      });

      it("dial with an empty address", async (ctx) => {
        const channel = caps().channels.outbound[0];
        ctx.skip(!channel, "provider offers no outbound channel");
        const [skill] = await h.provider.listOutboundSkills(channel);
        await expectNoEvents(() => expectProviderError(h.provider.dial({ channel, address: "  ", skillId: skill.id }), "invalid-state"));
      });

      it("voice dial while the agent leg isn't connected", async (ctx) => {
        ctx.skip(!caps().agentLeg, "agent leg not supported");
        ctx.skip(!caps().channels.outbound.includes("voice"), "provider offers no outbound voice");
        const { provider } = h;
        const [skill] = await provider.listOutboundSkills("voice");
        const request = { channel: "voice" as const, address: "+15551230000", skillId: skill.id };
        await provider.disconnectAgentLeg();
        await waitFor(() => currentLeg() === "disconnected", "leg disconnected");
        await expectNoEvents(() => expectProviderError(provider.dial(request), "invalid-state"));
        await provider.connectAgentLeg();
        await waitFor(() => currentLeg() === "connected", "leg connected");
        const id = await provider.dial(request);
        await waitFor(() => latest(id) !== undefined, "dialed after reconnecting");
      });
    });

    describe('"not-found"', () => {
      it("unknown interaction ids", async () => {
        const { provider } = h;
        await expectNoEvents(async () => {
          await expectProviderError(provider.accept(GHOST), "not-found");
          await expectProviderError(provider.end(GHOST), "not-found");
          await expectProviderError(provider.sendMessage(GHOST, "hi"), "not-found");
          await expectProviderError(provider.getTranscript(GHOST), "not-found");
          await expectProviderError(provider.completeWrapUp(GHOST, OUTCOME), "not-found");
          await expectProviderError(provider.associateEntity(GHOST, "e" as EntityId), "not-found");
          if (caps().hold) await expectProviderError(provider.hold(GHOST, true), "not-found");
        });
      });

      it("unknown presence code", async () => {
        await expectNoEvents(() => expectProviderError(h.provider.setAgentState("no-such-code"), "not-found"));
      });

      it("unknown outbound skill", async (ctx) => {
        const channel = caps().channels.outbound[0];
        ctx.skip(!channel, "provider offers no outbound channel");
        await expectNoEvents(() => expectProviderError(h.provider.dial({ channel, address: "+15551230000", skillId: "no-such-skill" }), "not-found"));
      });
    });

    // ── How contacts end ──────────────────────────────────────────────────

    describe("ended reasons", () => {
      it("customer hang-up on a handled contact goes through wrap-up", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startAccepted("chat");
        await h.customer.hangUp(id);
        if (caps().wrapUp) {
          await waitForState(id, "wrap-up");
          await settleNow();
          expect(rec.events("ended"), "`ended` waits for completeWrapUp").toEqual([]);
          await h.provider.completeWrapUp(id, OUTCOME);
        }
        await waitForState(id, "ended");
        await expectClosed(id, "customer");
        if (caps().wrapUp) expect(latest(id)?.outcome).toEqual(OUTCOME);
      });

      it("transfer goes through wrap-up and reports reason transfer", async (ctx) => {
        requireInbound(ctx, "chat");
        ctx.skip(!caps().transfer.blind, "blind transfer not supported");
        const id = await startAccepted("chat");
        await h.provider.transfer(id, { kind: "team", id: "team-billing", label: "Billing" }, "blind");
        if (caps().wrapUp) {
          await waitForState(id, "wrap-up");
          await settleNow();
          expect(rec.events("ended")).toEqual([]);
          await h.provider.completeWrapUp(id, OUTCOME);
        }
        await waitForState(id, "ended");
        await expectClosed(id, "transfer");
      });

      it("agent end reports reason agent", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startAccepted("chat");
        await closeFully(id);
        await expectClosed(id, "agent");
      });

      it("decline closes an offer directly with reason declined", async (ctx) => {
        requireInbound(ctx, "chat");
        ctx.skip(!caps().decline, "decline not supported");
        const id = await startInbound("chat");
        await h.provider.decline(id);
        await waitForState(id, "ended");
        await expectClosed(id, "declined");
        expect(statesOf(id).map((e) => e.interaction.state)).not.toContain("wrap-up");
      });

      it("customer hang-up on a still-offered contact abandons it without wrap-up", async (ctx) => {
        requireInbound(ctx, "chat");
        const id = await startInbound("chat");
        await h.customer.hangUp(id);
        await waitForState(id, "ended");
        await expectClosed(id, "customer");
        expect(statesOf(id).map((e) => e.interaction.state)).not.toContain("wrap-up");
      });
    });

    // ── dispose() ─────────────────────────────────────────────────────────

    describe("dispose()", () => {
      it("rejects a call that is still pending", async () => {
        const pending = h.provider.getSnapshot();
        const disposing = h.provider.dispose();
        await expectProviderError(pending, "invalid-state");
        await disposing;
      });

      it("rejects every later call with invalid-state", async () => {
        const { provider } = h;
        await provider.dispose();
        const id = GHOST;
        // Thunks, so each rejection is handled as soon as it is created.
        const calls: (() => Promise<unknown>)[] = [
          () => provider.getSnapshot(),
          () => provider.getTranscript(id),
          () => provider.listPresenceOptions(),
          () => provider.listOutboundSkills("chat"),
          () => provider.setAgentState("available"),
          () => provider.connectAgentLeg(),
          () => provider.disconnectAgentLeg(),
          () => provider.accept(id),
          () => provider.decline(id),
          () => provider.dial({ channel: "chat", address: "x", skillId: "x" }),
          () => provider.end(id),
          () => provider.completeWrapUp(id, OUTCOME),
          () => provider.hold(id, true),
          () => provider.mute(id, true),
          () => provider.setRecording(id, true),
          () => provider.setMasked(id, true),
          () => provider.sendDtmf(id, "1"),
          () => provider.transfer(id, { kind: "team", id: "t", label: "T" }, "blind"),
          () => provider.sendMessage(id, "x"),
          () => provider.setTyping(id, true),
          () => provider.setCaseStatus(id, "Open"),
          () => provider.associateEntity(id, "e" as EntityId),
        ];
        for (const call of calls) await expectProviderError(call(), "invalid-state");
      });

      it("is safe to call twice", async () => {
        await h.provider.dispose();
        await expect(h.provider.dispose()).resolves.toBeUndefined();
      });

      it("delivers nothing to listeners afterwards, and on() still returns a callable unsubscribe", async (ctx) => {
        requireInbound(ctx, "chat");
        await h.provider.dispose();
        const seen: unknown[] = [];
        const stop = h.provider.on("incoming", (e) => seen.push(e));
        expect(stop).toBeTypeOf("function");
        expect(() => stop()).not.toThrow();
        await h.customer.startInbound({ channel: "chat", address: "late", displayName: "Late Customer" });
        await new Promise((resolve) => setTimeout(resolve, 20 + (h.settleMs ?? 0)));
        expect(seen).toEqual([]);
        expect(rec.events("incoming")).toEqual([]);
      });
    });
  });
}
