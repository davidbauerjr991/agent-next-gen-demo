// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlaceholderAssistProvider,
  createPlaceholderCustomerDataProvider,
  createPlaceholderMediaProvider,
} from "@/adapters/placeholder/placeholder-providers";
import { createMemoryBus } from "@/adapters/sim/memory-transport";
import { createSimCustomerClient, type SimCustomerClient } from "@/adapters/sim/sim-customer-client";
import { createSimulatedInteractionProvider, type SimulatedInteractionProvider } from "@/adapters/sim/simulated-interaction-provider";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { ProviderRoot } from "@/provider-context";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, SCENARIOS } from "@/scenarios";
import { LUCAS_THOMAS_ID, MARCUS_WEBB_ID, mergeRows, useScenarioCases, type ScenarioCases } from "./scenario-cases";
import { useNavCards } from "./useNavCards";

// What the Advanced page renders for a scripted case (P0.5c): the case's
// card, its transcript rows from the store (Marcus's replay, Lucas's chat,
// annotation rows), typing, review and the bot commands.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZERO = { minMs: 0, maxMs: 0 };

let container: HTMLElement;
let root: Root;
let provider: SimulatedInteractionProvider;
let customer: SimCustomerClient;
let cases: ScenarioCases;
let counter = 0;

function Harness() {
  const nav = useNavCards({ anchorMs: 0 });
  cases = useScenarioCases(nav.cards);
  return null;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  counter += 1;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ProviderRoot
        kind="sim"
        profile={{ id: "p", name: "P" }}
        database={{ id: `cases-${counter}`, name: "cases", profileId: "p" }}
        factory={() => {
          const bus = createMemoryBus();
          provider = createSimulatedInteractionProvider({
            createTransport: bus.createTransport,
            latency: ZERO,
            timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
            scripts: SCENARIOS,
          });
          customer = createSimCustomerClient(provider.sessionId, bus.createTransport());
          return {
            interaction: provider,
            media: createPlaceholderMediaProvider(),
            customerData: createPlaceholderCustomerDataProvider(),
            assist: createPlaceholderAssistProvider(),
          };
        }}
      >
        <Harness />
      </ProviderRoot>,
    );
    await vi.advanceTimersByTimeAsync(50);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const rows = (key: string): TranscriptMessage[] => cases.byKey[key]!.rows.map((r) => r.row);

async function play(id: string) {
  await act(async () => {
    customer.playScenario(id);
    await vi.advanceTimersByTimeAsync(50);
  });
}

describe("scenario cases", () => {
  it("Marcus replays his call as the same rows the page showed: bot and customer lines, in order", async () => {
    await play(MARCUS_WEBB_SCRIPT.id);
    const marcus = cases.byKey[MARCUS_WEBB_ID]!;
    expect(marcus.cardId).toBeDefined();
    expect(cases.keyOf(marcus.cardId)).toBe(MARCUS_WEBB_ID);
    expect(marcus.threadKey).toMatch(/^voice:/);
    expect(marcus.reviewing).toBe(true);
    expect(rows(MARCUS_WEBB_ID).map(({ sender, name, initials, text }) => ({ sender, name, initials, text }))).toEqual(
      MARCUS_WEBB_SCRIPT.steps.map((step) => {
        if (step.kind !== "say") throw new Error("Marcus's setup is lines only");
        return step.speaker === "customer"
          ? { sender: "customer", name: "Marcus Webb", initials: "MW", text: step.text }
          : { sender: "agent", name: "Cognigy AI Agent", initials: "AI", text: step.text };
      }),
    );
    expect(rows(MARCUS_WEBB_ID).every((r) => /^\d{1,2}:\d{2}\s?[AP]M$/i.test(r.timestamp))).toBe(true);
  });

  it("Lucas: setup rows, live rows with typing, the approval card, a decision's instruction row, takeover", async () => {
    await play(LUCAS_THOMAS_SCRIPT.id);
    const setup = rows(LUCAS_THOMAS_ID);
    expect(setup).toHaveLength(6);
    expect(setup[0]).toMatchObject({ text: "Chat started", event: true });
    expect(setup[1]).toMatchObject({ sender: "customer", name: "Lucas Thomas", initials: "LT" });
    expect(setup[2]).toMatchObject({ sender: "agent", name: "AI agent · Checkout", initials: "AI" });

    await advance(1600);
    expect(cases.byKey[LUCAS_THOMAS_ID]!.customerTyping).toBe(true);
    await advance(3000);
    expect(cases.byKey[LUCAS_THOMAS_ID]!.customerTyping).toBe(false);
    await advance(800);
    expect(cases.byKey[LUCAS_THOMAS_ID]!.aiTyping).toBe(true);

    await advance(10_000);
    const approval = rows(LUCAS_THOMAS_ID).find((r) => r.summary);
    expect(approval?.summary).toEqual(LUCAS_THOMAS_SCRIPT.content.approvals.initial);

    await act(async () => {
      cases.respond(LUCAS_THOMAS_ID, { value: "accept" });
      await vi.advanceTimersByTimeAsync(1000);
    });
    const instruction = rows(LUCAS_THOMAS_ID).find((r) => r.instruction);
    expect(instruction?.instruction).toMatchObject({ title: "Authorize and place order NR-11056", by: "John Smith" });
    expect(instruction?.instruction?.link).toMatch(/^instruction:accept:Authorize%20and%20place%20order%20NR-11056:/);

    await act(async () => {
      cases.takeOver(LUCAS_THOMAS_ID);
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(cases.byKey[LUCAS_THOMAS_ID]!.reviewing).toBe(false);
    expect(rows(LUCAS_THOMAS_ID).map((r) => r.text)).toContain("Ok, sounds good");
  });

  it("merges the page's own rows (Ask Copilot) by when they were added", () => {
    const at = (n: number, text: string) => ({ at: n, row: { id: text, sender: "agent", name: "x", initials: "X", timestamp: "", text } as TranscriptMessage });
    const own = { id: "ask", sender: "agent", name: "John Smith", initials: "JS", timestamp: "", text: "ask" } as TranscriptMessage;
    expect(mergeRows([at(1, "a"), at(3, "c")], [own], 2).map((r) => r.text)).toEqual(["a", "ask", "c"]);
    // The same row keeps its first-seen time.
    expect(mergeRows([at(1, "a"), at(3, "c"), at(5, "e")], [own], 9).map((r) => r.text)).toEqual(["a", "ask", "c", "e"]);
  });
});
