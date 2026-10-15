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
import { SIM_DEMO_DIRECTORY } from "@/adapters/sim/sim-demo-directory";
import { createSimulatedInteractionProvider, type SimulatedInteractionProvider } from "@/adapters/sim/simulated-interaction-provider";
import { recordEvents, waitFor, type Recorder } from "@/contract-tests/event-recorder";
import type { Interaction, InteractionId } from "@/domain";
import type { ProviderSet } from "@/providers";
import { ProviderRoot } from "@/provider-context";
import { MARCUS_WEBB_SCRIPT, MAYA_CHEN_SCRIPT, SCENARIOS, startRequest, TOM_LEWIS_SCRIPT, type ScenarioScript } from "@/scenarios";
import { useContactActivation } from "./useContactActivation";
import { useContactCommands } from "./useContactCommands";
import { useNavCards } from "./useNavCards";
import { useOutboundDial } from "./useOutboundDial";

// P0.5c's done criterion: a scenario launched by the player is an ordinary
// engine contact. Each case is started once by `playScenario` and once by
// `__simCustomer.startInbound` with the same request, brought to the same
// point (answered, or taken over from review), and then put through the same
// follow-ups: a second call auto-holds it, the held row has its hold clock
// (the chip's timer and SLA), a dial to the same customer is refused (one
// call per customer), resume, hang-up → wrap-up → completeWrapUp. The
// contact's normalized snapshots and nav card must match at every step. Only
// the player's transcript, typing and review events differ, by design.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZERO = { minMs: 0, maxMs: 0 };

interface Api {
  cards: NavCard[];
  dial: ReturnType<typeof useOutboundDial>;
  commands: ReturnType<typeof useContactCommands>;
}

/** What a snapshot says about the contact, minus ids and clock values. */
function normalize(i: Interaction) {
  return {
    channel: i.channel,
    direction: i.direction,
    state: i.state,
    origin: i.origin,
    address: i.address,
    skill: i.skill,
    caseId: i.caseId,
    contactName: i.contactName,
    entityId: i.entityId,
    entityMatchedBy: i.entityMatchedBy,
    caseStatus: i.caseStatus,
    preContactSummary: i.preContactSummary,
    outcome: i.outcome,
    accepted: i.acceptedAt !== undefined,
    held: i.heldSince !== undefined,
    ended: i.endedAt !== undefined,
  };
}

/** A nav card minus ids and tick values (kept as "set or not"). */
function normalizeCard(card: NavCard | undefined) {
  if (!card) return undefined;
  return {
    customerName: card.customerName,
    customerId: card.customerId,
    entityId: card.entityId,
    offered: card.offered,
    closed: card.closed,
    voiceCallEnded: card.voiceCallEnded,
    threadStatuses: card.threadStatuses,
    threads: card.threads.map((t) => ({
      type: t.type,
      direction: t.direction,
      value: t.value,
      preview: t.preview,
      onCall: t.onCall,
      heldByAgent: t.heldByAgent,
      heldSinceTick: t.heldSinceTick !== undefined,
      wrapUpSinceTick: t.wrapUpSinceTick !== undefined,
      awaitingResponse: t.awaitingResponse,
      preContactSummary: t.preContactSummary,
    })),
  };
}

describe("scenario player ≡ startInbound", () => {
  let container: HTMLElement;
  let root: Root | undefined;
  let provider: SimulatedInteractionProvider;
  let customer: SimCustomerClient;
  let rec: Recorder;
  let api: Api;
  let alreadyOnCall: number;
  let dbCounter = 0;

  function Harness() {
    const nav = useNavCards({ anchorMs: 0, isScenarioCardId: () => false });
    const { activateWhenReady } = useContactActivation(() => {}, nav.seedOverlay);
    const dial = useOutboundDial({
      findOpenCard: nav.findOpenCard,
      findCustomer: (id) => CREATE_NEW_CUSTOMERS.find((c) => c.id === id),
      activateWhenReady,
      onLegDisconnected: () => {},
      secondVoiceCall: "auto-hold",
      onVoiceCallRefused: () => {},
      onAlreadyOnCall: () => {
        alreadyOnCall += 1;
      },
    });
    const commands = useContactCommands({ cards: nav.cards, setLocalStatus: () => {} });
    api = { cards: nav.cards, dial, commands };
    return null;
  }

  function makeSet(): ProviderSet {
    const bus = createMemoryBus();
    provider = createSimulatedInteractionProvider({
      latency: ZERO,
      timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
      createTransport: bus.createTransport,
      directory: SIM_DEMO_DIRECTORY,
      scripts: SCENARIOS,
    });
    customer = createSimCustomerClient(provider.sessionId, bus.createTransport());
    rec = recordEvents(provider);
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

  /** A fresh engine (new database id → new provider set), so each run starts
   *  with no contact history. */
  async function mount() {
    dbCounter += 1;
    container = document.createElement("div");
    document.body.appendChild(container);
    const created = createRoot(container);
    root = created;
    act(() => {
      created.render(
        <StrictMode>
          <ProviderRoot kind="sim" profile={{ id: "p", name: "P" }} database={{ id: `eq-${dbCounter}`, name: "eq", profileId: "p" }} factory={makeSet}>
            <Harness />
          </ProviderRoot>
        </StrictMode>,
      );
    });
    await settle();
  }

  async function unmount() {
    const mounted = root;
    if (!mounted) return;
    root = undefined;
    rec.stop();
    customer.dispose();
    act(() => mounted.unmount());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    container.remove();
  }

  beforeEach(() => {
    alreadyOnCall = 0;
  });

  afterEach(unmount);

  /** The latest snapshot of `id`, from `incoming` (an offer) or `stateChanged`. */
  function latest(id: InteractionId): Interaction | undefined {
    let found: Interaction | undefined;
    for (const e of rec.timeline) {
      if (e.kind !== "event" || (e.name !== "incoming" && e.name !== "stateChanged")) continue;
      const interaction = (e.payload as { interaction?: Interaction }).interaction;
      if (interaction?.id === id) found = interaction;
    }
    return found;
  }

  /** Every snapshot of `id` from `mark` on, normalized. */
  const snapshotsSince = (id: InteractionId, mark: number) =>
    rec.timeline
      .slice(mark)
      .flatMap((e) =>
        e.kind === "event" && e.name === "stateChanged" && (e.payload as { interaction?: Interaction }).interaction?.id === id
          ? [normalize((e.payload as { interaction: Interaction }).interaction)]
          : [],
      );
  const cardOf = (id: InteractionId) => api.cards.find((c) => c.threads.some((t) => t.providerInteractionId === id));

  /** Brings the contact to "the agent is on it". */
  async function start(script: ScenarioScript, how: "player" | "startInbound"): Promise<InteractionId> {
    if (how === "player") {
      const id = customer.playScenario(script.id);
      await until(() => latest(id) !== undefined, "scenario contact");
      if (script.start.answer === "agent") await act(() => provider.accept(id));
      if (script.start.review) await act(() => provider.takeOver(id, { handoff: false }));
      await until(() => latest(id)?.state === "active" && !latest(id)?.review && latest(id)?.acceptedAt !== undefined, "answered");
      return id;
    }
    const { skillId, ...request } = startRequest(script);
    const id = customer.startInbound({ ...request, ...(skillId ? { skillId } : {}) });
    await until(() => latest(id)?.state === "offered", "offered");
    await act(() => provider.accept(id));
    await until(() => latest(id)?.state === "active", "accepted");
    return id;
  }

  /** The follow-ups, recording what the contact and its card look like after each. */
  async function followUps(id: InteractionId, phone: string) {
    const steps: { label: string; snapshots: ReturnType<typeof normalize>[]; card: ReturnType<typeof normalizeCard> }[] = [];
    let mark = rec.timeline.length;
    const step = async (label: string) => {
      await settle();
      steps.push({ label, snapshots: snapshotsSince(id, mark), card: normalizeCard(cardOf(id)) });
      mark = rec.timeline.length;
    };
    await step("answered");

    // A second inbound call is accepted: this one is auto-held.
    const other = customer.startInbound({ channel: "voice", address: "+15559870000", displayName: "Second Caller" });
    await until(() => latest(other)?.state === "offered", "second offered");
    await act(() => provider.accept(other));
    await until(() => latest(id)?.state === "held", "auto-held");
    await step("auto-held by a second call");

    // One call per customer: a Quick Dial to this customer's number is refused.
    const refusedBefore = alreadyOnCall;
    act(() => api.dial.quickDial(phone, "general"));
    await until(() => alreadyOnCall === refusedBefore + 1, "already on a call");
    await step("quick dial refused");

    // Resume from the hold chip: the second call is held instead.
    const thread = () => cardOf(id)!.threads.find((t) => t.type === "voice")!;
    act(() => {
      api.commands.setHold(thread(), false);
    });
    await until(() => latest(id)?.state === "active" && latest(other)?.state === "held", "resumed");
    await step("resumed");

    // Hang up → wrap-up (card and chip), then the outcome closes it.
    act(() => {
      api.commands.hangUp(thread());
    });
    await until(() => latest(id)?.state === "wrap-up", "wrap-up");
    await step("wrap-up");
    await act(() => provider.completeWrapUp(id, { dispositionCode: "resolved", tags: ["eq"] }));
    await until(() => latest(id)?.state === "ended", "ended");
    await step("ended");

    // Clear the second caller so the next run starts from the same place.
    customer.hangUp({ interactionId: other });
    await until(() => latest(other)?.state === "wrap-up", "second caller hung up");
    await act(() => provider.completeWrapUp(other, {}));
    await until(() => latest(other)?.state === "ended", "second caller ended");
    await settle();
    return steps;
  }

  async function run(script: ScenarioScript, how: "player" | "startInbound") {
    await mount();
    const id = await start(script, how);
    const steps = await followUps(id, script.entity.phone!);
    const ended = rec.events("ended").filter((e) => e.interactionId === id).map((e) => e.reason);
    await unmount();
    return { steps, ended };
  }

  it.each([
    ["Tom (rings, agent accepts)", TOM_LEWIS_SCRIPT],
    ["Maya (auto-answered)", MAYA_CHEN_SCRIPT],
    ["Marcus (delivered in review, taken over)", MARCUS_WEBB_SCRIPT],
  ] as const)("%s behaves like a hand-started inbound call", async (_label, script) => {
    const byPlayer = await run(script, "player");
    expect(byPlayer.ended).toEqual(["agent"]);
    // The held step shows the hold clock on the card (chip timer and SLA).
    const held = byPlayer.steps.find((s) => s.label === "auto-held by a second call")!;
    expect(held.card?.threads[0]).toMatchObject({ heldByAgent: true, heldSinceTick: true });
    expect(byPlayer.steps.find((s) => s.label === "wrap-up")!.card).toMatchObject({ voiceCallEnded: true, threads: [{ wrapUpSinceTick: true }] });
    expect(byPlayer.steps.find((s) => s.label === "ended")!.card).toBeUndefined();

    const byHand = await run(script, "startInbound");
    expect(byPlayer.steps.map((s) => s.label)).toEqual(byHand.steps.map((s) => s.label));
    for (const [index, step] of byPlayer.steps.entries()) {
      const other = byHand.steps[index];
      // At the answered point the paths got there differently (offer vs. auto
      // vs. review); from then on the snapshots must be the same events.
      if (index > 0) expect(step.snapshots, step.label).toEqual(other.snapshots);
      expect(step.card, step.label).toEqual(other.card);
    }
    expect(byPlayer.ended).toEqual(byHand.ended);
  });
});
