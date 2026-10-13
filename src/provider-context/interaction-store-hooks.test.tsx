// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createPlaceholderAssistProvider,
  createPlaceholderCustomerDataProvider,
  createPlaceholderMediaProvider,
} from "../adapters/placeholder/placeholder-providers";
import { createMemoryBus } from "../adapters/sim/memory-transport";
import { createSimCustomerClient, type SimCustomerClient } from "../adapters/sim/sim-customer-client";
import {
  createSimulatedInteractionProvider,
  type SimulatedInteractionProvider,
} from "../adapters/sim/simulated-interaction-provider";
import { waitFor } from "../contract-tests/event-recorder";
import type { InteractionId } from "../domain";
import type { ProviderSet } from "../providers";
import { ProviderRoot } from "./ProviderRoot";
import {
  useAgentLegTransitions,
  useAgentState,
  useInteraction,
  useInteractions,
  useInteractionStoreStatus,
  useTranscript,
  useTyping,
} from "./interaction-store-hooks";

// The P0.5.0 hooks through ProviderRoot under StrictMode, against the sim on
// the in-memory bus: components see hydrated state and live events, and the
// StrictMode remount leaves exactly one subscription per event.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZERO = { minMs: 0, maxMs: 0 };
const profile = { id: "p", name: "P" };

interface Seen {
  status?: string;
  presence?: string;
  ids: InteractionId[];
  focusedState?: string;
  messages: string[];
  hydrated: boolean;
  customerTyping: boolean;
}

describe("interaction store hooks", () => {
  let container: HTMLElement;
  let root: Root;
  let provider: SimulatedInteractionProvider;
  let customer: SimCustomerClient;
  let liveListeners = 0;
  const seen: Seen = { ids: [], messages: [], hydrated: false, customerTyping: false };

  function Probe({ focus }: { focus?: InteractionId }) {
    const { status } = useInteractionStoreStatus();
    const agent = useAgentState();
    const interactions = useInteractions();
    const focused = useInteraction(focus);
    const transcript = useTranscript(focus);
    const typing = useTyping(focus);
    seen.status = status;
    seen.presence = agent?.presence.code;
    seen.ids = interactions.map((i) => i.id);
    seen.focusedState = focused?.state;
    seen.messages = transcript.messages.map((m) => m.text);
    seen.hydrated = transcript.hydrated;
    seen.customerTyping = typing.customer ?? false;
    return null;
  }

  function makeSet(): ProviderSet {
    const bus = createMemoryBus();
    provider = createSimulatedInteractionProvider({
      latency: ZERO,
      timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
      createTransport: bus.createTransport,
    });
    customer = createSimCustomerClient(provider.sessionId, bus.createTransport());
    // Count live registrations so a doubled subscription would show up.
    const on = provider.on.bind(provider);
    const interaction: SimulatedInteractionProvider = {
      ...provider,
      on(type, handler) {
        liveListeners += 1;
        const off = on(type, handler);
        let removed = false;
        return () => {
          if (!removed) liveListeners -= 1;
          removed = true;
          off();
        };
      },
      async dispose() {
        customer.dispose();
        await provider.dispose();
      },
    };
    return {
      interaction,
      media: createPlaceholderMediaProvider(),
      customerData: createPlaceholderCustomerDataProvider(),
      assist: createPlaceholderAssistProvider(),
    };
  }

  const legCalls: string[] = [];
  let leg: string | undefined;

  function LegProbe() {
    leg = useAgentState()?.leg;
    useAgentLegTransitions((settled) => legCalls.push(settled));
    return null;
  }

  function render(focus?: InteractionId, children = <Probe focus={focus} />) {
    act(() => {
      root.render(
        <StrictMode>
          <ProviderRoot kind="sim" profile={profile} database={{ id: "hooks-db", name: "hooks", profileId: "p" }} factory={makeSet}>
            {children}
          </ProviderRoot>
        </StrictMode>,
      );
    });
  }

  /** Waits inside act() so React flushes the store's updates. */
  const until = (predicate: () => boolean, message: string) => act(() => waitFor(predicate, message));

  beforeAll(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(async () => {
    act(() => root.unmount());
    // Let the cache's deferred dispose run.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    container.remove();
  });

  it("hydrates, follows live events, and loads a transcript, with one subscription per event", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    render();
    await until(() => seen.status === "ready", "ready");
    expect(seen.presence).toBe("available");
    expect(seen.ids).toEqual([]);
    // Six events, subscribed once despite StrictMode's effect remount.
    expect(liveListeners).toBe(6);

    const chatId = customer.startInbound({ channel: "chat", address: "web-visitor", displayName: "Visitor" });
    await until(() => seen.ids.includes(chatId), "incoming rendered");

    render(chatId);
    await until(() => seen.focusedState === "offered" && seen.hydrated, "focused + transcript hydrated");

    await act(() => provider.accept(chatId));
    await until(() => seen.focusedState === "active", "accepted");

    customer.typing({ interactionId: chatId, isTyping: true });
    await until(() => seen.customerTyping, "customer typing");

    customer.message({ interactionId: chatId, text: "Hi there" });
    await act(() => provider.sendMessage(chatId, "Hello! How can I help?"));
    await until(() => seen.messages.length === 2, "two messages");
    expect(seen.messages).toEqual(["Hi there", "Hello! How can I help?"]);
    expect(liveListeners).toBe(6);
  });

  it("useAgentLegTransitions fires on real leg changes only, never on hydrate or remount", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    render(undefined, <LegProbe key="first" />);
    await until(() => leg === "connected", "hydrated connected");
    expect(legCalls).toEqual([]);

    await act(() => provider.disconnectAgentLeg());
    await until(() => leg === "disconnected", "disconnected");
    expect(legCalls).toEqual(["disconnected"]);

    await act(() => provider.connectAgentLeg());
    await until(() => leg === "connected", "reconnected");
    expect(legCalls).toEqual(["disconnected", "connected"]);

    // A fresh mount on the same provider (a tier switch) starts silent.
    await act(() => provider.disconnectAgentLeg());
    await until(() => leg === "disconnected", "disconnected again");
    legCalls.length = 0;
    render(undefined, <LegProbe key="second" />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(leg).toBe("disconnected");
    expect(legCalls).toEqual([]);
  });
});
