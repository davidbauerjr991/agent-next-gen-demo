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
import { recordEvents, type Recorder } from "@/contract-tests/event-recorder";
import { ProviderRoot } from "@/provider-context";
import { SCENARIOS, TOM_LEWIS_SCRIPT } from "@/scenarios";
import { usePresenceSync } from "./usePresenceSync";

// P0.5c fix: the page's status reaches the provider, and routing offers a
// scripted contact only while the agent is available or working. Before,
// the provider stayed Available whatever the page showed (Tom rang during
// Lunch).

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZERO = { minMs: 0, maxMs: 0 };

let container: HTMLElement;
let root: Root;
let provider: SimulatedInteractionProvider;
let customer: SimCustomerClient;
let rec: Recorder;
let counter = 0;

function Harness({ status }: { status: string }) {
  usePresenceSync(status);
  return null;
}

/** Renders with `status`; `rerender` keeps the same database, so the same
 *  provider (only the page's status changes). */
async function mount(status: string, { rerender = false } = {}) {
  if (!rerender) counter += 1;
  await act(async () => {
    root.render(
      <ProviderRoot
        kind="sim"
        profile={{ id: "p", name: "P" }}
        database={{ id: `presence-${counter}`, name: "presence", profileId: "p" }}
        factory={() => {
          const bus = createMemoryBus();
          provider = createSimulatedInteractionProvider({
            createTransport: bus.createTransport,
            latency: ZERO,
            timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
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
        }}
      >
        <Harness status={status} />
      </ProviderRoot>,
    );
    await vi.advanceTimersByTimeAsync(50);
  });
  // The hydrated snapshot renders (and the sync's effect runs) when the act
  // above ends; let its setAgentState and the resulting event land.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
}

async function playTom() {
  await act(async () => {
    customer.playScenario(TOM_LEWIS_SCRIPT.id);
    await vi.advanceTimersByTimeAsync(50);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  rec?.stop();
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("usePresenceSync + the routing gate", () => {
  it.each(["lunch", "break", "unavailable"])("%s: the provider takes the status and a scripted call is refused with the dev warning", async (status) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mount(status);
    const agents = rec.events("stateChanged").flatMap((e) => (e.kind === "agent" ? [e.agent.presence.code] : []));    expect(agents[agents.length - 1]).toBe(status);
    await playTom();
    expect(rec.events("incoming")).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("playScenario ignored"), expect.stringContaining(`the agent is ${status}`));
    warn.mockRestore();
  });

  it.each(["available", "working"])("%s: the scripted call is offered", async (status) => {
    await mount(status);
    await playTom();
    expect(rec.events("incoming").map((e) => e.interaction.caseId)).toEqual([TOM_LEWIS_SCRIPT.entity.caseId]);
  });

  it("a status change after load is sent too (Available → Lunch blocks the next call)", async () => {
    await mount("available");
    await mount("lunch", { rerender: true });
    await playTom();
    expect(rec.events("incoming")).toEqual([]);
  });
});
