import { afterEach, describe, expect, it, vi } from "vitest";
import { providerError } from "../adapters/provider-error";
import { createMemoryBus } from "../adapters/sim/memory-transport";
import { createSimCustomerClient, type SimCustomerClient } from "../adapters/sim/sim-customer-client";
import {
  createSimulatedInteractionProvider,
  type SimulatedInteractionProvider,
} from "../adapters/sim/simulated-interaction-provider";
import { recordEvents, settle, waitFor, type Recorder } from "../contract-tests/event-recorder";
import type { ChannelKind, InteractionId } from "../domain";
import type { InteractionEvents, InteractionProvider } from "../providers";
import { createInteractionStore, type InteractionStore } from "./interaction-store";
import {
  applyEnded,
  applyTyping,
  initialStoreState,
  upsertAgent,
  upsertInteraction,
  upsertMessage,
  upsertUtterance,
  type InteractionStoreState,
} from "./interaction-store-state";

// The interaction store (P0.5.0) against the sim over the in-memory bus at
// zero latency: hydrate, upsert-by-id (idempotent, replay-safe), ended, and
// unsubscribe.

const ZERO = { minMs: 0, maxMs: 0 };

interface Rig {
  provider: SimulatedInteractionProvider;
  customer: SimCustomerClient;
  dial(channel: ChannelKind, extra?: { journeyId?: string }): Promise<InteractionId>;
  dispose(): Promise<void>;
}

const rigs: Rig[] = [];

function createRig(): Rig {
  const bus = createMemoryBus();
  const provider = createSimulatedInteractionProvider({
    latency: ZERO,
    timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
    createTransport: bus.createTransport,
  });
  const customer = createSimCustomerClient(provider.sessionId, bus.createTransport());
  const rig: Rig = {
    provider,
    customer,
    async dial(channel, extra = {}) {
      const [skill] = await provider.listOutboundSkills(channel);
      return provider.dial({ channel, address: `${channel}-address`, skillId: skill.id, ...extra } as Parameters<
        InteractionProvider["dial"]
      >[0]);
    },
    async dispose() {
      customer.dispose();
      await provider.dispose();
    },
  };
  rigs.push(rig);
  return rig;
}

const stores: InteractionStore[] = [];
function startStore(provider: InteractionProvider): InteractionStore {
  const store = createInteractionStore(provider);
  stores.push(store);
  store.start();
  return store;
}

afterEach(async () => {
  for (const store of stores.splice(0)) store.stop();
  for (const rig of rigs.splice(0)) await rig.dispose();
});

/** Replays recorded provider events through the same reducers the store uses. */
function replay(state: InteractionStoreState, recorder: Recorder): InteractionStoreState {
  let next = state;
  for (const entry of recorder.timeline) {
    if (entry.kind !== "event") continue;
    const payload = entry.payload;
    switch (entry.name) {
      case "incoming":
        next = upsertInteraction(next, (payload as InteractionEvents["incoming"]).interaction);
        break;
      case "stateChanged": {
        const event = payload as InteractionEvents["stateChanged"];
        next = event.kind === "agent" ? upsertAgent(next, event.agent) : upsertInteraction(next, event.interaction);
        break;
      }
      case "message":
        next = upsertMessage(next, (payload as InteractionEvents["message"]).message);
        break;
      case "transcript":
        next = upsertUtterance(next, (payload as InteractionEvents["transcript"]).utterance);
        break;
      case "typing": {
        const event = payload as InteractionEvents["typing"];
        next = applyTyping(next, event.interactionId, event.role, event.isTyping);
        break;
      }
      case "ended": {
        const event = payload as InteractionEvents["ended"];
        next = applyEnded(next, event.interactionId, event.reason);
        break;
      }
    }
  }
  return next;
}

describe("interaction store — hydrate", () => {
  it("hydrates the agent, live interactions and an earlier transcript after a late mount", async () => {
    const { provider, customer, dial } = createRig();
    const chatId = await dial("chat");
    const voiceId = customer.startInbound({ channel: "voice", address: "+15550001111", displayName: "Inbound Caller" });
    await settle(provider);
    await provider.accept(voiceId);
    await provider.sendMessage(chatId, "Hello before mount");
    await settle(provider);

    const store = startStore(provider);
    expect(store.getState().status).toBe("hydrating");
    await waitFor(() => store.getState().status === "ready", "store ready");

    const state = store.getState();
    expect(state.agent?.leg).toBe("connected");
    expect(state.interactionList.map((i) => i.id)).toEqual([chatId, voiceId]);
    expect(state.interactions.get(voiceId)?.state).toBe("active");

    store.ensureTranscript(chatId);
    await waitFor(() => store.getState().transcripts.get(chatId)?.hydrated === true, "transcript hydrated");
    expect(store.getState().transcripts.get(chatId)?.messages.map((m) => m.text)).toEqual(["Hello before mount"]);
  });

  it("marks a transcript for an unknown id hydrated and empty", async () => {
    const { provider } = createRig();
    const store = startStore(provider);
    const missing = "int-missing" as InteractionId;
    store.ensureTranscript(missing);
    await waitFor(() => store.getState().transcripts.get(missing)?.hydrated === true, "not-found transcript hydrated");
    expect(store.getState().transcripts.get(missing)?.messages).toEqual([]);
  });

  it("reports a failed snapshot read as status error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = {
      on: () => () => {},
      getSnapshot: () => Promise.reject(providerError("not-supported", "placeholder")),
    } as unknown as InteractionProvider;
    const store = startStore(failing);
    await waitFor(() => store.getState().status === "error", "status error");
    expect(store.getState().error?.code).toBe("not-supported");
  });
});

describe("interaction store — upsert by id", () => {
  it("updates an interaction in place and leaves untouched ones referentially equal", async () => {
    const { provider, dial } = createRig();
    const store = startStore(provider);
    await waitFor(() => store.getState().status === "ready", "store ready");

    const a = await dial("chat");
    const b = await dial("chat");
    await settle(provider);
    const aBefore = store.getState().interactions.get(a);
    const listBefore = store.getState().interactionList;

    await provider.hold(b, true);
    await settle(provider);
    expect(store.getState().interactions.get(b)?.state).toBe("held");
    await provider.hold(b, false);
    await settle(provider);

    const state = store.getState();
    expect(state.interactions.size).toBe(2);
    expect(state.interactions.get(b)?.state).toBe("active");
    expect(state.interactions.get(b)?.heldSince).toBeUndefined();
    expect(state.interactions.get(a)).toBe(aBefore);
    expect(state.interactionList).not.toBe(listBefore);
  });

  it("replaces a message on a delivery update instead of appending", async () => {
    const { provider, dial } = createRig();
    const store = startStore(provider);
    const chatId = await dial("chat");
    const messageId = await provider.sendMessage(chatId, "Tracking number is on its way");
    await waitFor(
      () => store.getState().transcripts.get(chatId)?.messages[0]?.delivery === "delivered",
      "message delivered",
    );
    const messages = store.getState().transcripts.get(chatId)?.messages ?? [];
    expect(messages.map((m) => m.id)).toEqual([messageId]);
  });

  it("is replay-safe: re-applying every recorded event changes nothing", async () => {
    const { provider, customer, dial } = createRig();
    const recorder = recordEvents(provider);
    const store = startStore(provider);
    await waitFor(() => store.getState().status === "ready", "store ready");

    const chatId = await dial("chat");
    const inboundId = customer.startInbound({ channel: "chat", address: "web-visitor", displayName: "Visitor" });
    await settle(provider);
    await provider.accept(inboundId);
    customer.typing({ interactionId: inboundId, isTyping: true });
    customer.message({ interactionId: inboundId, text: "Where is my order?" });
    await provider.sendMessage(inboundId, "Let me check.");
    await provider.hold(chatId, true);
    await provider.end(chatId);
    await provider.completeWrapUp(chatId, { dispositionCode: "resolved" });
    await waitFor(() => store.getState().endReasons.has(chatId), "chat ended");
    await settle(provider);
    recorder.stop();

    const state = store.getState();
    // Replaying the whole history (older snapshots included) converges on the
    // same state, with no duplicates.
    expect(replay(state, recorder)).toStrictEqual(state);
    // From empty, events alone rebuild the same event-derived slices (the
    // agent came from the snapshot, not an event, so it isn't compared).
    const fromEvents = replay(initialStoreState(), recorder);
    expect(fromEvents.interactionList).toStrictEqual(state.interactionList);
    expect(fromEvents.endReasons).toStrictEqual(state.endReasons);
    expect(fromEvents.transcripts).toStrictEqual(state.transcripts);
    expect(fromEvents.typing).toStrictEqual(state.typing);

    // Re-applying the latest snapshots (as fresh clones, like a redelivered
    // event) is a no-op: the very same state object comes back.
    let again = state;
    for (const interaction of state.interactionList) again = upsertInteraction(again, structuredClone(interaction));
    for (const message of state.transcripts.get(inboundId)?.messages ?? []) again = upsertMessage(again, structuredClone(message));
    again = applyEnded(again, chatId, "agent");
    again = upsertAgent(again, structuredClone(state.agent!));
    expect(again).toBe(state);
  });
});

describe("interaction store — ended", () => {
  it("keeps an agent-ended contact with its reason after wrap-up", async () => {
    const { provider, dial } = createRig();
    const store = startStore(provider);
    const voiceId = await dial("voice");
    await waitFor(() => store.getState().interactions.get(voiceId)?.state === "active", "voice active");

    await provider.end(voiceId);
    await settle(provider);
    expect(store.getState().interactions.get(voiceId)?.state).toBe("wrap-up");
    expect(store.getState().endReasons.has(voiceId)).toBe(false);

    await provider.completeWrapUp(voiceId, { dispositionCode: "resolved" });
    await waitFor(() => store.getState().endReasons.get(voiceId) === "agent", "ended{agent}");
    expect(store.getState().interactions.get(voiceId)?.state).toBe("ended");
  });

  it("records a customer hang-up and survives a re-hydrate without resurrecting or duplicating", async () => {
    const { provider, customer, dial } = createRig();
    const store = startStore(provider);
    await waitFor(() => store.getState().status === "ready", "store ready");

    const liveId = await dial("chat");
    const inboundId = customer.startInbound({ channel: "chat", address: "web-visitor", displayName: "Visitor" });
    await settle(provider);
    await provider.accept(inboundId);
    customer.typing({ interactionId: inboundId, isTyping: true });
    await settle(provider);
    expect(store.getState().typing.get(inboundId)?.customer).toBe(true);

    customer.hangUp({ interactionId: inboundId });
    await waitFor(() => store.getState().interactions.get(inboundId)?.state === "wrap-up", "inbound in wrap-up");
    await provider.completeWrapUp(inboundId, {});
    await waitFor(() => store.getState().endReasons.get(inboundId) === "customer", "ended{customer}");
    expect(store.getState().typing.has(inboundId)).toBe(false);

    store.stop();
    store.start();
    await settle(provider);
    await waitFor(() => store.getState().status === "ready", "re-hydrated");

    const state = store.getState();
    expect(state.interactionList.map((i) => i.id)).toEqual([liveId, inboundId]);
    expect(state.interactions.get(inboundId)?.state).toBe("ended");
    expect(state.interactions.get(liveId)?.state).toBe("active");
  });
});

describe("interaction store — stop", () => {
  it("stops notifying after the last stop()", async () => {
    const { provider, dial } = createRig();
    const store = createInteractionStore(provider);
    store.start();
    store.start();
    await waitFor(() => store.getState().status === "ready", "store ready");
    const listener = vi.fn();
    store.subscribe(listener);

    store.stop();
    await dial("chat");
    await settle(provider);
    expect(listener).toHaveBeenCalled(); // still one ref left

    listener.mockClear();
    store.stop();
    const before = store.getState();
    await dial("chat");
    await settle(provider);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });
});
