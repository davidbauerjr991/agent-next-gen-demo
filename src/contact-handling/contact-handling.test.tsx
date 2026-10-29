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
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import type { SimTransport } from "@/adapters/sim/sim-transport";
import { createSimulatedInteractionProvider, type SimulatedInteractionProvider } from "@/adapters/sim/simulated-interaction-provider";
import { buildDismissedContactHistoryEntry, type ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { INITIAL_NOTIFICATIONS } from "@/components/agent-next-gen-interaction-dashboard";
import { waitFor } from "@/contract-tests/event-recorder";
import type { ProviderSet } from "@/providers";
import { ProviderRoot, useInteractions } from "@/provider-context";
import { useContactActivation, type Activation } from "./useContactActivation";
import { useContactCommands } from "./useContactCommands";
import { useContactReopen } from "./useContactReopen";
import { useNavCards } from "./useNavCards";
import { useOutboundDial } from "./useOutboundDial";
import { alreadyOnCallMessage, onCallReasons } from "./already-open";
import { buildOpenChannelTagger } from "./open-channel-tagger";
import { callerOfInteraction, declinedCallMessage } from "./contact-identity";
import type { Interaction as DomainInteraction } from "@/domain";

// The shared contact-handling hooks (P0.5b.2) against the sim on the
// in-memory bus, under StrictMode, wired the way both pages wire them.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZERO = { minMs: 0, maxMs: 0 };

interface Api {
  cards: NavCard[];
  setCards: ReturnType<typeof useNavCards>["setCards"];
  dial: ReturnType<typeof useOutboundDial>;
  reopen: ReturnType<typeof useContactReopen>;
  commands: ReturnType<typeof useContactCommands>;
  contacts: ReturnType<typeof useInteractions>;
}

describe("contact handling", () => {
  let container: HTMLElement;
  let root: Root;
  let provider: SimulatedInteractionProvider;
  let api: Api;
  let activations: Activation[];
  let cardIdsAtActivation: string[][];
  let legDown: number;
  let refused: number;
  let alreadyOnCall: number;
  /** The call the last "already on a call" refusal named. */
  let alreadyOnCallWith: DomainInteraction | undefined;
  /** The page's second-voice-call rule; set before `mount()`. */
  let policy: "refuse" | "auto-hold" = "auto-hold";
  let dbCounter = 0;
  /** While set, events to the provider queue here instead of arriving. */
  let heldEvents: (() => void)[] | null = null;

  function Harness() {
    const nav = useNavCards({ anchorMs: 0 });
    const latestCards = nav.cards;
    const { activateWhenReady } = useContactActivation((a) => {
      activations.push(a);
      cardIdsAtActivation.push(latestCards.map((c) => c.id));
    }, nav.seedOverlay);
    const dial = useOutboundDial({
      findOpenCard: nav.findOpenCard,
      findCustomer: (id) => CREATE_NEW_CUSTOMERS.find((c) => c.id === id),
      activateWhenReady,
      onLegDisconnected: () => {
        legDown += 1;
      },
      secondVoiceCall: policy,
      onVoiceCallRefused: () => {
        refused += 1;
      },
      onAlreadyOnCall: (call) => {
        alreadyOnCall += 1;
        alreadyOnCallWith = call;
      },
    });
    const reopen = useContactReopen({ findOpenCard: nav.findOpenCard, activateWhenReady, skillIdForName: () => undefined });
    const commands = useContactCommands({ cards: nav.cards });
    const contacts = useInteractions();
    api = { cards: nav.cards, setCards: nav.setCards, dial, reopen, commands, contacts };
    return null;
  }

  function makeSet(): ProviderSet {
    const bus = createMemoryBus();
    // The provider's own endpoint (the second one created; the first is the
    // engine's) can hold its events back while replies still arrive — a
    // network where a command's ack lands before its resulting event — so
    // a launch that activated before the store had the contact would show.
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
      seed: SIM_DEMO_SEED,
    });
    return {
      interaction: provider,
      media: createPlaceholderMediaProvider(),
      customerData: createPlaceholderCustomerDataProvider(),
      assist: createPlaceholderAssistProvider(),
    };
  }

  const until = (predicate: () => boolean, message: string) => act(() => waitFor(predicate, message));
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)));

  beforeAll(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  beforeEach(async () => {
    heldEvents = null;
    activations = [];
    cardIdsAtActivation = [];
    legDown = 0;
    refused = 0;
    alreadyOnCall = 0;
    policy = "auto-hold";
    dbCounter += 1;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mount();
    await settle();
  });

  /** (Re-)renders the harness; same database, so the same provider. */
  function mount() {
    act(() => {
      root.render(
        <StrictMode>
          <ProviderRoot kind="sim" profile={{ id: "p", name: "P" }} database={{ id: `ch-${dbCounter}`, name: "ch", profileId: "p" }} factory={makeSet}>
            <Harness />
          </ProviderRoot>
        </StrictMode>,
      );
    });
  }

  afterEach(async () => {
    act(() => root.unmount());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    container.remove();
  });

  const customer = CREATE_NEW_CUSTOMERS.find((c) => c.phones.length > 1) ?? CREATE_NEW_CUSTOMERS[0];
  const contact = { id: customer.id, name: customer.name, subtitle: customer.customerId, channels: ["voice", "sms"] } as never;

  it("starts with no cards: the seeds are offers, not cards", () => {
    expect(api.cards).toEqual([]);
  });

  it("activates a dialed contact only once its card is on screen, keyed by journey, with the customer's record id", async () => {
    heldEvents = [];
    act(() => api.dial.startCall({ contact, channel: "sms", phone: "+15550001111", skillId: "general" }));
    await settle();
    // The dial was acknowledged, but its event hasn't arrived: nothing yet.
    expect(activations).toEqual([]);
    expect(api.cards).toEqual([]);
    const held = heldEvents;
    heldEvents = null;
    act(() => held.forEach((deliver) => deliver()));
    await until(() => activations.length === 1, "activated");
    const [activation] = activations;
    expect(activation).toMatchObject({ mode: "focus", isNewCard: true, threadKey: "sms:+15550001111" });
    expect(cardIdsAtActivation[0]).toContain(activation.journeyId);
    const card = api.cards.find((c) => c.id === activation.journeyId)!;
    expect(card.entityId).toBe(customer.id);
    expect(card.customerId).toBe(customer.customerId);
    expect(card.customerName).toBe(customer.name);
    expect(card.threads[0]).toMatchObject({ startedFresh: true, messageCount: 0 });
  });

  it("adds a second channel for the same contact to the open card", async () => {
    act(() => api.dial.startCall({ contact, channel: "sms", phone: "+15550001111", skillId: "general" }));
    await until(() => activations.length === 1, "first");
    act(() => api.dial.startCall({ contact, channel: "email", phone: "x@example.com", skillId: "general" }));
    await until(() => activations.length === 2, "second");
    expect(activations[1]).toMatchObject({ mode: "added", isNewCard: false, journeyId: activations[0].journeyId });
    expect(api.cards).toHaveLength(1);
    expect(api.cards[0].threads.map((t) => t.id)).toEqual(["sms:+15550001111", "email:x@example.com"]);
  });

  it("keeps overlay fields on a store card and drops provider-owned changes with a warning", async () => {
    act(() => api.dial.startCall({ contact, channel: "sms", phone: "+15550001111", skillId: "general" }));
    await until(() => activations.length === 1, "dialed");
    const id = activations[0].journeyId;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => api.setCards((prev) => prev.map((c) => (c.id === id ? { ...c, currentThreadId: "sms:+15550001111", customerName: "Nope" } : c))));
    const card = api.cards.find((c) => c.id === id)!;
    expect(card.currentThreadId).toBe("sms:+15550001111");
    expect(card.customerName).toBe(customer.name);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${id}.customerName`));
    warn.mockRestore();
  });

  it("refuses a voice dial with the leg down and opens no card", async () => {
    await act(() => provider.disconnectAgentLeg());
    await settle();
    act(() => api.dial.quickDial("5550002222", "general"));
    await until(() => legDown === 1, "leg toast");
    expect(api.cards).toEqual([]);
  });

  it("completes a Contact History redial on any of the customer's numbers (row 16)", async () => {
    const entry = { id: "h1", name: customer.name, caseId: "CASE-H1", customerId: customer.id, channelType: "voice", direction: "outbound", statusLabel: "Resolved" } as ContactHistoryEntry;
    act(() => api.dial.openRedialPad(entry, null));
    expect(api.dial.dialpadRequest?.phoneOptions?.length).toBe(customer.phones.length);
    const second = customer.phones[customer.phones.length - 1].value;
    act(() => api.dial.dialpadSubmit(second, "general", () => undefined));
    await until(() => activations.length === 1, "redialed");
    const card = api.cards[0];
    expect(card.entityId).toBe(customer.id);
    expect(card.customerId).toBe("CASE-H1");
  });

  it("accepts a seed from its notification, then switches to it when it's already live", async () => {
    const notification = INITIAL_NOTIFICATIONS.find((n) => n.id === "1")!;
    let isNew: boolean | undefined;
    await act(async () => {
      isNew = await api.reopen.openNotification(notification);
    });
    await until(() => activations.length === 1, "accepted");
    expect(isNew).toBe(true);
    expect(api.cards).toHaveLength(1);
    expect(api.cards[0].customerName).toBe("Noah Patel");
    await act(async () => {
      isNew = await api.reopen.openNotification(notification);
    });
    await until(() => activations.length === 2, "switched");
    expect(isNew).toBe(false);
    expect(activations[1].journeyId).toBe(activations[0].journeyId);
    expect(api.cards).toHaveLength(1);
  });

  it("accepts a notification into the customer's open card instead of a second card", async () => {
    const notification = INITIAL_NOTIFICATIONS.find((n) => n.id === "4")!;
    const ethan = SIM_DEMO_SEED.find((s) => s.id === "seed-notification-4")!;
    const ethanContact = { id: ethan.entityId, name: "Ethan Zhang", channels: ["voice", "email"] } as never;
    act(() => api.dial.startCall({ contact: ethanContact, channel: "email", phone: "ethan@example.com", skillId: "general" }));
    await until(() => activations.length === 1, "dialed");
    let isNew: boolean | undefined;
    await act(async () => {
      isNew = await api.reopen.openNotification(notification);
    });
    await until(() => activations.length === 2, "accepted into the card");
    expect(isNew).toBe(false);
    expect(activations[1]).toMatchObject({ journeyId: activations[0].journeyId, mode: "focus", isNewCard: false, threadKey: "sms" });
    expect(api.cards).toHaveLength(1);
    expect(api.cards[0].threads.map((t) => t.id).sort()).toEqual(["email:ethan@example.com", "sms"]);
  });

  it("refuses a second voice call on every path when the page says so; auto-hold allows it", async () => {
    policy = "refuse";
    mount();
    act(() => api.dial.quickDial("5550001111", "general"));
    await until(() => activations.length === 1, "first call");
    act(() => api.dial.quickDial("5550002222", "general"));
    const entry = { id: "h1", name: customer.name, caseId: "CASE-H1", customerId: customer.id, channelType: "voice", direction: "outbound", statusLabel: "Resolved" } as ContactHistoryEntry;
    act(() => api.dial.openRedialPad(entry, null));
    act(() => api.dial.openCardRedialPad(api.cards[0].id, "5550001111", null));
    await settle();
    expect(refused).toBe(3);
    expect(api.dial.dialpadRequest).toBeNull();
    expect(api.cards).toHaveLength(1);

    policy = "auto-hold";
    mount();
    act(() => api.dial.quickDial("5550002222", "general"));
    await until(() => activations.length === 2, "second call");
    await until(() => api.cards.some((c) => c.threads.some((t) => t.heldByAgent)), "first call held");
    expect(api.cards).toHaveLength(2);
    expect(refused).toBe(3);
  });

  it("one call per customer, one guard: Redial, Quick Dial, New Outbound and the '+' voice option are blocked only while that customer's call is ringing or live, never while it's held", async () => {
    const entry = { id: "h1", name: customer.name, caseId: "CASE-H1", customerId: customer.id, channelType: "voice", direction: "outbound", statusLabel: "Resolved" } as ContactHistoryEntry;
    const other = CREATE_NEW_CUSTOMERS.find((c) => c.id !== customer.id)!;
    const otherEntry = { ...entry, id: "h2", name: other.name, customerId: other.id };
    const plusVoiceBlocked = () =>
      !!buildOpenChannelTagger(api.cards, api.contacts)({ id: customer.id, name: customer.name, channels: ["voice", "sms"] } as never).openChannelTypes?.includes("voice");
    const plusVoiceReason = () => onCallReasons(api.contacts, { entityId: customer.id }).voice;

    // Digital only: nothing blocked.
    act(() => api.dial.startCall({ contact, channel: "sms", phone: "+15550001111", skillId: "general" }));
    await until(() => activations.length === 1, "sms");
    expect(api.dial.redialBlocked(entry)).toBe(false);
    expect(plusVoiceBlocked()).toBe(false);

    // Live call: blocked for this customer only.
    const number = customer.phones[0].value;
    act(() => api.dial.startCall({ contact, channel: "voice", phone: number, skillId: "general" }));
    await until(() => !!api.cards[0]?.threads.find((t) => t.type === "voice")?.onCall, "on call");
    expect(api.dial.redialBlocked(entry)).toBe(true);
    expect(api.dial.redialBlocked(otherEntry)).toBe(false);
    expect(plusVoiceBlocked()).toBe(true);
    // The "+" reason names the live call, in the dial's own words.
    expect(plusVoiceReason()).toBe(`Already on a call with ${customer.name}`);
    // A typed Quick Dial of the same number is refused, with no new call.
    const placed = activations.length;
    act(() => api.dial.quickDial(number, "general"));
    await until(() => alreadyOnCall === 1, "refused");
    await settle();
    expect(activations).toHaveLength(placed);
    // The refusal names the customer (the page shows it as a warning toast).
    expect(alreadyOnCallMessage(callerOfInteraction(alreadyOnCallWith!, api.cards).name)).toBe(`Already on a call with ${customer.name}`);
    // Redial doesn't open the pad, and says the same.
    alreadyOnCallWith = undefined;
    act(() => api.dial.openRedialPad(entry, null));
    expect(api.dial.dialpadRequest).toBeNull();
    expect(alreadyOnCall).toBe(2);
    expect(alreadyOnCallMessage(callerOfInteraction(alreadyOnCallWith!, api.cards).name)).toBe(`Already on a call with ${customer.name}`);

    // Held: nothing blocks — the dial, New Outbound and the "+" are one guard, and a held call isn't on it
    // (auto-hold, P-HOME-1m).
    const voice = () => api.cards[0].threads.find((t) => t.type === "voice")!;
    act(() => {
      api.commands.setHold(voice(), true);
    });
    await until(() => !!voice().heldByAgent, "held");
    expect(api.dial.redialBlocked(entry)).toBe(false);
    expect(plusVoiceBlocked()).toBe(false);
    expect(plusVoiceReason()).toBeUndefined();
    // Resumed: blocked again, everywhere.
    act(() => {
      api.commands.setHold(voice(), false);
    });
    await until(() => !voice().heldByAgent, "resumed");
    expect(api.dial.redialBlocked(entry)).toBe(true);
    expect(plusVoiceBlocked()).toBe(true);

    // Wrap-up: free again.
    act(() => {
      api.commands.hangUp(voice());
    });
    await until(() => !!api.cards[0]?.voiceCallEnded, "wrap-up");
    expect(api.dial.redialBlocked(entry)).toBe(false);
    expect(plusVoiceBlocked()).toBe(false);
  });

  it("a kind card's call checks only its own joined Voice row (P-HOME-1m): another call on the same number doesn't block it (auto-hold holds that one); its own live leg does, and the refusal names it", async () => {
    const number = customer.phones[0].value;
    const voiceOf = (journeyId: string) => api.cards.find((c) => c.id === journeyId)?.threads.find((t) => t.type === "voice");
    // A live call with the customer on a conversation card.
    act(() => api.dial.quickDial(number, "general"));
    await until(() => activations.length === 1, "first call");
    const first = activations[0].journeyId;
    await until(() => !!voiceOf(first)?.onCall, "first live");
    // A callback's dial to the same number joins its own card: not refused, and the first call is held.
    const dialCallback = () => {
      act(() => api.dial.openScheduleDialPad({ itemId: "cb-1", phoneNumber: number, contactName: "Callback Customer", summary: [] }, null));
      act(() => api.dial.dialpadSubmit(number, "general", () => undefined));
    };
    dialCallback();
    await until(() => activations.length === 2, "callback call");
    expect(alreadyOnCall).toBe(0);
    expect(activations[1].journeyId).toBe("schedule:cb-1");
    await until(() => !!voiceOf(first)?.heldByAgent, "first held");
    await until(() => !!voiceOf("schedule:cb-1")?.onCall, "callback live");
    // The callback's own leg is live: dialling it again is refused, naming that call's contact.
    dialCallback();
    await until(() => alreadyOnCall === 1, "refused");
    await settle();
    expect(activations).toHaveLength(2);
    expect(alreadyOnCallWith?.journeyId).toBe("schedule:cb-1");
    expect(alreadyOnCallMessage(callerOfInteraction(alreadyOnCallWith!, api.cards).name)).toBe("Already on a call with Callback Customer");
    // With that leg held too, nothing blocks: a held call never does.
    act(() => {
      api.commands.setHold(voiceOf("schedule:cb-1")!, true);
    });
    await until(() => !!voiceOf("schedule:cb-1")?.heldByAgent, "callback held");
    act(() => api.dial.quickDial(number, "general"));
    await settle();
    expect(alreadyOnCall).toBe(1);
  });

  it("holds and resumes a call, and hang-up takes it to wrap-up (shown as ended)", async () => {
    act(() => api.dial.quickDial("5550001111", "general"));
    await until(() => activations.length === 1, "dialed");
    await until(() => !!api.cards[0]?.threads[0], "card");
    act(() => {
      api.commands.setHold(api.cards[0].threads[0], true);
    });
    await until(() => !!api.cards[0].threads[0].heldByAgent, "held");
    expect(api.cards[0].threads[0].heldSinceTick).toBeTypeOf("number");
    act(() => {
      api.commands.setHold(api.cards[0].threads[0], false);
    });
    await until(() => !api.cards[0].threads[0].heldByAgent, "resumed");
    act(() => {
      api.commands.hangUp(api.cards[0].threads[0]);
    });
    await until(() => !!api.cards[0]?.voiceCallEnded, "ended (wrap-up)");
    expect(api.cards).toHaveLength(1);
  });

  it("Unassign & Dismiss: one thread leaves the card, then the whole card goes", async () => {
    act(() => api.dial.startCall({ contact, channel: "sms", phone: "+15550001111", skillId: "general" }));
    await until(() => activations.length === 1, "first");
    act(() => api.dial.startCall({ contact, channel: "email", phone: "x@example.com", skillId: "general" }));
    await until(() => activations.length === 2, "second");
    await until(() => api.cards[0]?.threads.length === 2, "two threads");
    let ok: boolean | undefined;
    await act(async () => {
      ok = await api.commands.dismissThread(api.cards[0], "email:x@example.com", { tags: ["Billing"] });
    });
    expect(ok).toBe(true);
    await until(() => api.cards[0]?.threads.length === 1, "email gone");
    expect(api.cards[0].threads[0].id).toBe("sms:+15550001111");
    await act(async () => {
      ok = await api.commands.dismissCard(api.cards[0], () => ({ dispositionCode: "resolved" }));
    });
    expect(ok).toBe(true);
    await until(() => api.cards.length === 0, "card gone");
  });

  it("Save & Redial completes the ended call only after the new one is placed, and the card stays", async () => {
    act(() => api.dial.quickDial("5550001111", "general"));
    await until(() => activations.length === 1, "dialed");
    await until(() => !!api.cards[0]?.threads[0], "card");
    act(() => {
      api.commands.hangUp(api.cards[0].threads[0]);
    });
    await until(() => !!api.cards[0]?.voiceCallEnded, "ended");
    const card = api.cards[0];
    act(() => api.dial.redialCard(card, "5550001111", "general"));
    await until(() => activations.length === 2, "redialed");
    await act(() => api.commands.completeEndedCalls(api.cards[0]));
    await settle();
    expect(api.cards).toHaveLength(1);
    expect(api.cards[0].id).toBe(card.id);
    expect(api.cards[0].voiceCallEnded).toBeUndefined();
  });

  it("hides a card once its contacts are wrapped up, and a reopened notification comes back as a new card", async () => {
    const notification = INITIAL_NOTIFICATIONS.find((n) => n.id === "4")!;
    await act(() => api.reopen.openNotification(notification));
    await until(() => api.cards.length === 1, "accepted");
    const seedId = api.cards[0].threads[0].providerInteractionId!;
    await act(async () => {
      await provider.end(seedId);
      await provider.completeWrapUp(seedId, {});
    });
    await until(() => api.cards.length === 0, "dismissed card hidden");
    await act(() => api.reopen.openNotification(notification));
    await until(() => api.cards.length === 1, "reopened");
    expect(api.cards[0].id).not.toBe(activations[0].journeyId);
  });

  it("a dismissed known customer's History row carries their record: reopened, it joins the customer's open card (not a new one); its Redial is refused while they have a live call, naming it", async () => {
    // A known customer's card, then the row its dismissal logs (the page's own builder).
    act(() => api.dial.startCall({ contact, channel: "sms", phone: "+15550001111", skillId: "general" }));
    await until(() => activations.length === 1, "first card");
    const first = api.cards.find((c) => c.id === activations[0].journeyId)!;
    const entry = buildDismissedContactHistoryEntry(first as Parameters<typeof buildDismissedContactHistoryEntry>[0], 0);
    expect(entry.entityId).toBe(customer.id);
    // Dismissed: its contact wraps up and the card goes.
    const smsId = first.threads[0].providerInteractionId!;
    await act(async () => {
      await provider.end(smsId);
      await provider.completeWrapUp(smsId, {});
    });
    await until(() => api.cards.length === 0, "dismissed");

    // Another card for the same customer.
    act(() => api.dial.startCall({ contact, channel: "email", phone: "x@example.com", skillId: "general" }));
    await until(() => activations.length === 2, "second card");
    const open = activations[1].journeyId;
    expect(api.cards.map((c) => c.id)).toEqual([open]);

    // Reopening the History row joins that card.
    await act(() => api.reopen.reopenHistoryEntry(entry));
    await until(() => activations.length === 3, "reopened");
    expect(activations[2].journeyId).toBe(open);
    expect(api.cards).toHaveLength(1);
    expect(api.cards[0].threads.map((t) => t.type).sort()).toEqual(["email", "sms"]);

    // A live call with the customer: the row's Redial is refused, naming that call.
    act(() => api.dial.startCall({ contact, channel: "voice", phone: customer.phones[0].value, skillId: "general" }));
    await until(() => !!api.cards[0]?.threads.find((t) => t.type === "voice")?.onCall, "on call");
    expect(api.dial.redialBlocked(entry)).toBe(true);
    expect(api.dial.redialBlockedReason(entry)).toBe(`Already on a call with ${customer.name}`);
    const refusedBefore = alreadyOnCall;
    act(() => api.dial.openRedialPad(entry, null));
    expect(api.dial.dialpadRequest).toBeNull();
    expect(alreadyOnCall).toBe(refusedBefore + 1);
    expect(alreadyOnCallWith?.entityId).toBe(customer.id);
    expect(alreadyOnCallMessage(callerOfInteraction(alreadyOnCallWith!, api.cards).name)).toBe(`Already on a call with ${customer.name}`);
  });

  it("folds a Contact History reopen into the open card's thread after it was closed", async () => {
    const notification = INITIAL_NOTIFICATIONS.find((n) => n.id === "4")!;
    await act(() => api.reopen.openNotification(notification));
    await until(() => api.cards.length === 1, "accepted");
    const seedId = api.cards[0].threads[0].providerInteractionId!;
    await act(() => provider.setCaseStatus(seedId, "Closed"));
    await settle();
    const entry = {
      id: "h4",
      name: "Ethan Zhang",
      caseId: api.cards[0].customerId,
      customerId: api.cards[0].entityId,
      channelType: "sms",
      direction: "inbound",
      statusLabel: "Open",
    } as ContactHistoryEntry;
    await act(() => api.reopen.reopenHistoryEntry(entry));
    await until(() => activations.length === 2, "reopened");
    expect(api.cards).toHaveLength(1);
    expect(api.cards[0].threads).toHaveLength(1);
    expect(api.cards[0].threads[0].reopenedContacts).toHaveLength(1);
  });
});

describe("toast wording (P0.5c browser-check fixes)", () => {
  it("names the customer on the already-on-a-call warning, with a fallback", () => {
    expect(alreadyOnCallMessage("Tom Lewis")).toBe("Already on a call with Tom Lewis");
    expect(alreadyOnCallMessage("(312) 555-0187")).toBe("Already on a call with (312) 555-0187");
    expect(alreadyOnCallMessage(undefined)).toBe("Already on a call with this customer");
  });

  it("names a declined caller, the number when the name is unknown", () => {
    expect(declinedCallMessage({ name: "Tom Lewis", number: "(312) 555-0187" })).toBe("Tom Lewis call declined");
    expect(declinedCallMessage({ number: "(312) 555-0187" })).toBe("(312) 555-0187 call declined");
    expect(declinedCallMessage({})).toBe("Unknown caller call declined");
  });
});
