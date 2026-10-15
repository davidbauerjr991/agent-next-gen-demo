// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import {
  createPlaceholderAssistProvider,
  createPlaceholderCustomerDataProvider,
  createPlaceholderMediaProvider,
} from "@/adapters/placeholder/placeholder-providers";
import { createMemoryBus } from "@/adapters/sim/memory-transport";
import { createSimCustomerClient, type SimCustomerClient } from "@/adapters/sim/sim-customer-client";
import type { SimTransport } from "@/adapters/sim/sim-transport";
import { createSimulatedInteractionProvider, type SimulatedInteractionProvider } from "@/adapters/sim/simulated-interaction-provider";
import { waitFor } from "@/contract-tests/event-recorder";
import type { EntityId } from "@/domain";
import type { InteractionCapabilities, ProviderSet } from "@/providers";
import { ProviderRoot } from "@/provider-context";
import { outcomeDraftKey, useChannelOutcomeDrafts } from "./useChannelOutcomeDrafts";
import { useContactActivation, type Activation } from "./useContactActivation";
import { useContactCommands } from "./useContactCommands";
import { useIncomingOffer } from "./useIncomingOffer";
import { useNavCards } from "./useNavCards";
import { useOutboundDial } from "./useOutboundDial";
import { useVoiceCallControls, type VoiceCallControlProps } from "./useVoiceCallControls";
import { voiceWrapUpThread } from "./wrap-up";

// P0.5d.1: the voice bar's controls, voice wrap-up (the inline wrap-up card
// and the "Needs outcome" chip), per-channel Outcome drafts and the incoming
// offer tile, against the sim on the in-memory bus under StrictMode. State
// must come from events: a command's ack alone never changes the UI.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZERO = { minMs: 0, maxMs: 0 };

interface Api {
  cards: NavCard[];
  dial: ReturnType<typeof useOutboundDial>;
  voice: VoiceCallControlProps;
  callThread: NavCard["threads"][number] | undefined;
  commands: ReturnType<typeof useContactCommands>;
  drafts: ReturnType<typeof useChannelOutcomeDrafts>;
  offer: ReturnType<typeof useIncomingOffer>;
}

describe("voice bar, wrap-up and incoming offers", () => {
  let container: HTMLElement;
  let root: Root;
  let provider: SimulatedInteractionProvider;
  let customer: SimCustomerClient;
  let api: Api;
  let activations: Activation[];
  let declined: number;
  let dbCounter = 0;
  /** While set, events to the provider queue here instead of arriving. */
  let heldEvents: (() => void)[] | null = null;
  // Page inputs, read by the harness on each render (change, then `render()`).
  let showHarness = true;
  let scenarioCall = false;
  let capabilities: Partial<InteractionCapabilities> = {};

  function Harness() {
    const nav = useNavCards({ anchorMs: 0 });
    const { activateWhenReady } = useContactActivation((a) => activations.push(a), nav.seedOverlay);
    const dial = useOutboundDial({
      findOpenCard: nav.findOpenCard,
      findCustomer: (id) => CREATE_NEW_CUSTOMERS.find((c) => c.id === id),
      activateWhenReady,
      onLegDisconnected: () => {},
      secondVoiceCall: "auto-hold",
      onVoiceCallRefused: () => {},
    });
    const liveCard = nav.cards.find((c) => !c.offered && c.threads.some((t) => t.type === "voice"));
    const callThread = scenarioCall
      ? ({ id: "voice", type: "voice", startTick: 0, contactId: "s", heldByAgent: true } as NavCard["threads"][number])
      : liveCard?.threads.find((t) => t.type === "voice");
    const voice = useVoiceCallControls(callThread);
    const commands = useContactCommands({ cards: nav.cards });
    const drafts = useChannelOutcomeDrafts();
    const offer = useIncomingOffer({
      findOpenCard: nav.findOpenCard,
      activateWhenReady,
      onDeclined: () => {
        declined += 1;
      },
    });
    api = { cards: nav.cards, dial, voice, callThread, commands, drafts, offer };
    return null;
  }

  function makeSet(): ProviderSet {
    const bus = createMemoryBus();
    let created = 0;
    const createTransport = (): SimTransport => {
      const transport = bus.createTransport();
      created += 1;
      if (created !== 2) return transport;
      return {
        ...transport,
        onMessage(handler) {
          return transport.onMessage((message) => {
            if (message.type === "event" && heldEvents) heldEvents.push(() => handler(message));
            else handler(message);
          });
        },
      };
    };
    provider = createSimulatedInteractionProvider({
      latency: ZERO,
      timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
      createTransport,
      capabilities,
    });
    customer = createSimCustomerClient(provider.sessionId, bus.createTransport());
    return {
      interaction: provider,
      media: createPlaceholderMediaProvider(),
      customerData: createPlaceholderCustomerDataProvider(),
      assist: createPlaceholderAssistProvider(),
    };
  }

  const until = (predicate: () => boolean, message: string) => act(() => waitFor(predicate, message));
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)));
  /** Delivers every held event and stops holding. */
  function release() {
    const held = heldEvents ?? [];
    heldEvents = null;
    act(() => held.forEach((deliver) => deliver()));
  }

  function render() {
    act(() => {
      root.render(
        <StrictMode>
          <ProviderRoot kind="sim" profile={{ id: "p", name: "P" }} database={{ id: `vw-${dbCounter}`, name: "vw", profileId: "p" }} factory={makeSet}>
            {showHarness && <Harness />}
          </ProviderRoot>
        </StrictMode>,
      );
    });
  }

  /** Remounts on a fresh provider (e.g. after changing `capabilities`). */
  async function remount() {
    dbCounter += 1;
    render();
    await settle();
  }

  async function placeCall() {
    act(() => api.dial.quickDial("5550001111", "general"));
    await until(() => !!api.callThread?.providerInteractionId, "call live");
    const card = api.cards.find((c) => c.threads.includes(api.callThread!))!;
    return { card, thread: api.callThread!, id: api.callThread!.providerInteractionId! };
  }

  beforeAll(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  beforeEach(async () => {
    heldEvents = null;
    activations = [];
    declined = 0;
    showHarness = true;
    scenarioCall = false;
    capabilities = {};
    dbCounter += 1;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    render();
    await settle();
  });

  afterEach(async () => {
    act(() => root.unmount());
    customer.dispose();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    container.remove();
  });

  describe("useVoiceCallControls", () => {
    it("mute, record, mask and hold change only when the provider's event arrives", async () => {
      await placeCall();
      expect(api.voice).toMatchObject({ onHold: false, muted: false, recording: false, masked: false });
      heldEvents = [];
      act(() => {
        api.voice.onMuteChange!(true);
        api.voice.onRecordingChange!(true);
        api.voice.onMaskedChange!(true);
        api.voice.onHoldChange(true);
      });
      await settle();
      // Acknowledged, but the events are held back: nothing on screen changed.
      expect(api.voice).toMatchObject({ onHold: false, muted: false, recording: false, masked: false });
      release();
      await until(() => api.voice.muted === true && api.voice.recording === true && api.voice.masked === true, "events");
      await until(() => api.voice.onHold === true, "held");
    });

    it("sends keypad digits as DTMF", async () => {
      const { id } = await placeCall();
      const sendDtmf = vi.spyOn(provider, "sendDtmf");
      act(() => {
        api.voice.onSendDtmf!("5");
        api.voice.onSendDtmf!("#");
      });
      expect(sendDtmf.mock.calls).toEqual([
        [id, "5"],
        [id, "#"],
      ]);
    });

    it("shows each control the provider supports and hides the rest", async () => {
      expect(api.voice).toMatchObject({ showHold: true, showMute: true, showRecord: true, showMask: true, showKeypad: true });
      capabilities = { hold: false, mute: false, record: false, mask: false, dtmf: false };
      await remount();
      expect(api.voice).toMatchObject({ showHold: false, showMute: false, showRecord: false, showMask: false, showKeypad: false });
    });

    it("leaves a thread with no provider contact uncontrolled, and its hold inert", async () => {
      scenarioCall = true;
      render();
      expect(api.voice.onMuteChange).toBeUndefined();
      expect(api.voice.muted).toBeUndefined();
      expect(api.voice.onHold).toBe(true);
      expect(() => act(() => api.voice.onHoldChange(false))).not.toThrow();
    });
  });

  describe("voice wrap-up (inline wrap-up card and Needs outcome chip)", () => {
    const wrapUpOf = (cardId: string) => voiceWrapUpThread(api.cards.find((c) => c.id === cardId));

    it("agent hang-up: the call shows as in wrap-up only once the provider's event arrives, and nothing is activated", async () => {
      const { card, thread } = await placeCall();
      expect(wrapUpOf(card.id)).toBeUndefined();
      heldEvents = [];
      act(() => {
        expect(api.commands.hangUp(thread)).toBe(true);
      });
      await settle();
      expect(wrapUpOf(card.id)).toBeUndefined();
      release();
      await until(() => wrapUpOf(card.id) !== undefined, "in wrap-up");
      expect(wrapUpOf(card.id)?.wrapUpSinceTick).toBeTypeOf("number");
      // No page switch: the only activation is the original dial.
      expect(activations).toHaveLength(1);
    });

    it("customer hang-up: the same wrap-up state, from the customer's side", async () => {
      const { card, id } = await placeCall();
      act(() => customer.hangUp({ interactionId: id }));
      await until(() => wrapUpOf(card.id) !== undefined, "in wrap-up");
      expect(activations).toHaveLength(1);
    });

    it("a call already in wrap-up when the page mounts (hydrate, tier switch) still shows it", async () => {
      const { card, id } = await placeCall();
      showHarness = false;
      render();
      await act(() => provider.end(id));
      await settle();
      showHarness = true;
      render();
      await until(() => wrapUpOf(card.id) !== undefined, "in wrap-up after remount");
    });

    it("leaves wrap-up once the call's outcome is saved (Save & Dismiss of just the call); the card stays for its other channel", async () => {
      const known = CREATE_NEW_CUSTOMERS[0];
      const contact = { id: known.id, name: known.name, subtitle: known.customerId, channels: ["voice", "sms"] } as never;
      act(() => api.dial.startCall({ contact, channel: "sms", phone: "+15550007777", skillId: "general" }));
      await until(() => activations.length === 1, "sms card");
      act(() => api.dial.startCall({ contact, channel: "voice", phone: "+15550008888", skillId: "general" }));
      await until(() => !!api.callThread?.providerInteractionId, "call on the same card");
      expect(api.cards).toHaveLength(1);
      const cardId = api.cards[0].id;
      act(() => {
        api.commands.hangUp(api.callThread!);
      });
      await until(() => wrapUpOf(cardId) !== undefined, "in wrap-up");
      const voiceKey = wrapUpOf(cardId)!.id;
      await act(() => api.commands.dismissThread(api.cards[0], voiceKey, { dispositionCode: "resolved" }));
      await until(() => wrapUpOf(cardId) === undefined, "wrap-up done");
      expect(api.cards).toHaveLength(1);
      expect(api.cards[0].threads.map((t) => t.type)).toEqual(["sms"]);
    });
  });

  describe("useChannelOutcomeDrafts", () => {
    it("keeps one draft per channel, starting empty, and turns it into the outcome", () => {
      const voice = outcomeDraftKey("card-1", "voice:+1555");
      const chat = outcomeDraftKey("card-1", "chat");
      expect(api.drafts.draftFor(voice)).toEqual({ tags: [], dispositionCode: "", summary: "" });
      act(() => api.drafts.update(voice, (d) => ({ ...d, tags: ["Billing"], dispositionCode: "resolved" })));
      act(() => api.drafts.update(voice, (d) => ({ ...d, summary: "Refund issued" })));
      expect(api.drafts.draftFor(voice)).toEqual({ tags: ["Billing"], dispositionCode: "resolved", summary: "Refund issued" });
      expect(api.drafts.draftFor(chat)).toEqual({ tags: [], dispositionCode: "", summary: "" });
      expect(api.drafts.outcomeOf(voice)).toEqual({ tags: ["Billing"], dispositionCode: "resolved", summary: "Refund issued" });
      expect(api.drafts.outcomeOf(chat)).toEqual({});
      act(() => api.drafts.clear(voice));
      expect(api.drafts.draftFor(voice)).toEqual({ tags: [], dispositionCode: "", summary: "" });
    });
  });

  describe("useIncomingOffer", () => {
    it("shows a voice offer as an offered card; Accept makes it a live call and activates it", async () => {
      act(() => {
        customer.startInbound({ channel: "voice", address: "+15559990000", displayName: "Jordan Reyes" });
      });
      await until(() => api.cards.some((c) => c.offered), "ringing card");
      const offerCard = api.cards.find((c) => c.offered)!;
      expect(offerCard.customerName).toBe("Jordan Reyes");
      expect(api.callThread).toBeUndefined();
      await act(() => api.offer.accept(offerCard));
      await until(() => activations.length === 1, "activated");
      expect(activations[0]).toMatchObject({ journeyId: offerCard.id, mode: "focus", isNewCard: true });
      expect(api.cards.find((c) => c.id === offerCard.id)?.offered).toBeUndefined();
      expect(api.callThread?.providerInteractionId).toBe(offerCard.threads[0].providerInteractionId);
    });

    it("Accept joins the customer's open card", async () => {
      const known = CREATE_NEW_CUSTOMERS[0];
      act(() =>
        api.dial.startCall({
          contact: { id: known.id, name: known.name, subtitle: known.customerId, channels: ["sms"] } as never,
          channel: "sms",
          phone: "+15550004444",
          skillId: "general",
        }),
      );
      await until(() => activations.length === 1, "open card");
      act(() => {
        customer.startInbound({ channel: "voice", address: "+15559990000", displayName: known.name, entityId: known.id as EntityId });
      });
      await until(() => api.cards.some((c) => c.offered), "ringing card");
      await act(() => api.offer.accept(api.cards.find((c) => c.offered)!));
      await until(() => activations.length === 2, "accepted");
      expect(activations[1]).toMatchObject({ journeyId: activations[0].journeyId, isNewCard: false });
      expect(api.cards).toHaveLength(1);
    });

    it("Decline confirms after the provider declines, and the tile leaves; so does a caller who hangs up", async () => {
      act(() => {
        customer.startInbound({ channel: "voice", address: "+15559990000", displayName: "Jordan Reyes" });
      });
      await until(() => api.cards.some((c) => c.offered), "ringing");
      await act(() => api.offer.decline(api.cards.find((c) => c.offered)!));
      expect(declined).toBe(1);
      await until(() => api.cards.length === 0, "declined tile gone");

      let id = "";
      act(() => {
        id = customer.startInbound({ channel: "voice", address: "+15559990001", displayName: "Sam Lee" });
      });
      await until(() => api.cards.some((c) => c.offered), "ringing again");
      act(() => customer.hangUp({ interactionId: id as never }));
      await until(() => api.cards.length === 0, "abandoned tile gone");
      expect(declined).toBe(1);
    });

    it("hides Decline when the provider can't decline", async () => {
      expect(api.offer.canDecline).toBe(true);
      capabilities = { decline: false };
      await remount();
      expect(api.offer.canDecline).toBe(false);
    });
  });
});
