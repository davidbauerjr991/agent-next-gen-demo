// Renders a whole workspace page against the sim in jsdom (test-only). The
// same setup `workspace-pages.test.tsx` uses, as a reusable harness: import
// it from a test file that runs in the jsdom environment, create one harness
// per file, and call `setUp`/`tearDown` around each test.
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";
import { createPlaceholderCustomerDataProvider, createPlaceholderMediaProvider } from "@/adapters/placeholder/placeholder-providers";
import { createMemoryBus } from "@/adapters/sim/memory-transport";
import { createSimAssistProvider } from "@/adapters/sim/sim-assist-provider";
import { SIM_DEMO_DIRECTORY } from "@/adapters/sim/sim-demo-directory";
import type { SimSeedContact } from "@/adapters/sim/sim-fixtures";
import { createSimTranscriptExportProvider } from "@/adapters/sim/sim-transcript-export-provider";
import { createSimScheduleProvider, type SimScheduleProvider } from "@/adapters/sim/sim-schedule-source";
import { createSimCustomerClient, type SimCustomerClient } from "@/adapters/sim/sim-customer-client";
import { createSimulatedInteractionProvider, type SimulatedInteractionProvider } from "@/adapters/sim/simulated-interaction-provider";
import type { ChannelKind, InteractionId } from "@/domain";
import type { ProviderSet, ScheduleProvider } from "@/providers";
import { DEFAULT_SLA } from "@/profiles/contact-center-profile";
import { ProviderRoot } from "@/provider-context";
import { SCENARIOS } from "@/scenarios";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Whole-page renders run several seconds each when the full suite runs in
// parallel; vitest's 5s default is too tight for them.
vi.setConfig({ testTimeout: 30_000 });

// jsdom has no layout. The pages measure their containers to pick narrow
// modes, so every box reads as desktop-sized, and the browser APIs they call
// exist as no-ops.
Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
Element.prototype.getBoundingClientRect = () =>
  ({ x: 0, y: 0, top: 0, left: 0, right: 1600, bottom: 1000, width: 1600, height: 1000, toJSON: () => ({}) }) as DOMRect;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
// lyra `ContainerFooter`'s `scrollFade` watches a sentinel.
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;
window.matchMedia ??=((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  return new Proxy({ canvas: this } as Record<string | symbol, unknown>, {
    get: (target, prop) =>
      prop in target
        ? target[prop]
        : prop === "measureText"
          ? () => ({ width: 0 })
          : prop === "getImageData" || prop === "createImageData"
            ? () => ({ data: new Uint8ClampedArray(4) })
            : () => {},
  });
} as never;

const ZERO = { minMs: 0, maxMs: 0 };

export type WorkspacePage = ComponentType<{ showPageHeader?: boolean; showPanelToggle?: boolean; showInteriorPanel?: boolean }>;

let databaseCounter = 0;

/** `seed`: the sim's waiting assignments (e.g. `SIM_DEMO_SEED`); none by default.
 *  `schedule`: the stub schedule source (P-HOME-1), with no latency; off by default. */
export function createWorkspaceHarness(
  options: { seed?: readonly SimSeedContact[]; transcriptExport?: ProviderSet["transcriptExport"]; schedule?: boolean } = {},
) {
  let container!: HTMLElement;
  let root!: Root;
  let provider!: SimulatedInteractionProvider;
  let customer!: SimCustomerClient;
  let schedule: SimScheduleProvider | undefined;
  let databaseId = "";

  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  async function click(el: Element) {
    await act(async () => {
      (el as HTMLElement).click();
      await vi.advanceTimersByTimeAsync(100);
    });
  }

  /** Renders `node` under the provider root (a re-render keeps the provider). */
  async function render(node: ReactNode) {
    await act(async () => {
      root.render(
        <ProviderRoot
          kind="sim"
          profile={{ id: "p", name: "P", sla: DEFAULT_SLA }}
          database={{ id: databaseId, name: "pages", profileId: "p" }}
          factory={() => {
            const bus = createMemoryBus();
            provider = createSimulatedInteractionProvider({
              createTransport: bus.createTransport,
              latency: ZERO,
              timings: { ring: ZERO, legConnect: ZERO, delivery: ZERO },
              directory: SIM_DEMO_DIRECTORY,
              scripts: SCENARIOS,
              ...(options.seed ? { seed: options.seed } : {}),
            });
            customer = createSimCustomerClient(provider.sessionId, bus.createTransport());
            return {
              interaction: provider,
              media: createPlaceholderMediaProvider(),
              customerData: createPlaceholderCustomerDataProvider(),
              assist: createSimAssistProvider({ sessionId: provider.sessionId, transport: bus.createTransport() }),
              transcriptExport: options.transcriptExport ?? createSimTranscriptExportProvider({ latency: ZERO }),
              ...(options.schedule ? { schedule: (schedule = createSimScheduleProvider({ latency: ZERO })) } : {}),
            };
          }}
        >
          {node}
        </ProviderRoot>,
      );
      await vi.advanceTimersByTimeAsync(100);
    });
  }

  /** Renders a workspace page with the props App gives it. */
  const show = (Page: WorkspacePage) => render(<Page showPageHeader showPanelToggle showInteriorPanel />);

  const buttonByText = (label: string, scope: ParentNode = document.body) =>
    [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLElement | undefined;

  /** Goes Available from the welcome modal, the way an agent does. */
  async function goAvailable() {
    const button = buttonByText("Go Available");
    if (button) await click(button);
    await advance(100);
  }

  return {
    get container() {
      return container;
    },
    get provider() {
      return provider;
    },
    get customer() {
      return customer;
    },
    /** The schedule source, with `schedule: true`. */
    get schedule() {
      return schedule;
    },
    setUp() {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
      databaseCounter += 1;
      databaseId = `harness-${databaseCounter}`;
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    },
    async tearDown() {
      await act(async () => root.unmount());
      container.remove();
      vi.useRealTimers();
    },
    render,
    show,
    advance,
    click,
    buttonByText,
    goAvailable,

    async startInbound(channel: ChannelKind, address: string, displayName: string): Promise<InteractionId> {
      let id = "" as InteractionId;
      await act(async () => {
        id = customer.startInbound({ channel, address, displayName });
        await vi.advanceTimersByTimeAsync(50);
      });
      return id;
    },

    /** Accepts an offer. A digital offer the workspace already accepted
     *  (`useAutoAcceptDigital`) refuses a second accept; that's fine here. */
    async accept(id: InteractionId) {
      await act(async () => {
        provider.accept(id).catch(() => {});
        await vi.advanceTimersByTimeAsync(200);
      });
    },

    /** Plays a scenario as the customer, the way the dev hotkeys do. */
    async play(scenarioId: string) {
      await goAvailable();
      await act(async () => {
        customer.playScenario(scenarioId);
        await vi.advanceTimersByTimeAsync(100);
      });
    },

    /** The nav card for `name` (its button's label starts with the name). */
    navCard(name: string): HTMLElement {
      const card = [...container.querySelectorAll("aside [aria-label]")].find((el) => {
        const label = el.getAttribute("aria-label")!;
        return label === name || label.startsWith(`${name},`);
      });
      if (!card) throw new Error(`no nav card for ${name}`);
      return card as HTMLElement;
    },
  };
}
