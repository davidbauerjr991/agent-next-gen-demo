// @vitest-environment jsdom
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlaceholderAssistProvider,
  createPlaceholderCustomerDataProvider,
  createPlaceholderMediaProvider,
} from "@/adapters/placeholder/placeholder-providers";
import { createMemoryBus } from "@/adapters/sim/memory-transport";
import { SIM_DEMO_DIRECTORY } from "@/adapters/sim/sim-demo-directory";
import { createSimCustomerClient, type SimCustomerClient } from "@/adapters/sim/sim-customer-client";
import { createSimulatedInteractionProvider, type SimulatedInteractionProvider } from "@/adapters/sim/simulated-interaction-provider";
import { AgentWorkspace2WithDeskPage } from "@/components/AgentWorkspace2WithDeskPage";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import type { ChannelKind, InteractionId } from "@/domain";
import { DEFAULT_SLA } from "@/profiles/contact-center-profile";
import { ProviderRoot } from "@/provider-context";

// Both workspace pages, whole, against the sim (5d.1 recheck): the incoming
// tile's answer SLA, session controls while ringing, the docked voice bar
// and a tier switch. Parity: every page-level check runs on both pages.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout. The pages measure their containers to pick narrow
// modes, so every box reads as desktop-sized, and the browser APIs they
// call exist as no-ops.
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
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;
// Charts draw on a canvas; nothing here tests them, so every 2D-context
// call is a no-op.
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
type PageComponent = ComponentType<{ showPageHeader?: boolean; showPanelToggle?: boolean; showInteriorPanel?: boolean }>;
const PAGES: [string, PageComponent][] = [
  ["Advanced (Phase 1)", AgentWorkspaceAdvancedPage],
  ["Desk (Phase 2)", AgentWorkspace2WithDeskPage],
];

let container: HTMLElement;
let root: Root;
let provider: SimulatedInteractionProvider;
let customer: SimCustomerClient;
let databaseCounter = 0;
let databaseId = "";

/** Renders `Page` under the same provider (a tier switch keeps it). */
async function show(Page: PageComponent) {
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
        {/* The props App renders both pages with. */}
        <Page showPageHeader showPanelToggle showInteriorPanel />
      </ProviderRoot>,
    );
    await vi.advanceTimersByTimeAsync(100);
  });
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function startInbound(channel: ChannelKind, address: string, displayName: string): Promise<InteractionId> {
  let id = "" as InteractionId;
  await act(async () => {
    id = customer.startInbound({ channel, address, displayName });
    await vi.advanceTimersByTimeAsync(50);
  });
  return id;
}

async function accept(id: InteractionId) {
  await act(async () => {
    void provider.accept(id);
    await vi.advanceTimersByTimeAsync(200);
  });
}

/** The nav card for `name` (its button's label starts with the name). */
function navCard(name: string): HTMLElement {
  const card = [...container.querySelectorAll("aside [aria-label]")].find((el) => {
    const label = el.getAttribute("aria-label")!;
    return label === name || label.startsWith(`${name},`);
  });
  if (!card) throw new Error(`no nav card for ${name}`);
  return card as HTMLElement;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
    await vi.advanceTimersByTimeAsync(100);
  });
}

/** Titles / labels of the controls outside the left nav. */
function mainControls(): string[] {
  return [...container.querySelectorAll("[title], button[aria-label]")]
    .filter((el) => !el.closest("aside"))
    .map((el) => el.getAttribute("title") ?? el.getAttribute("aria-label")!);
}

/** Texts in the left nav colored with a status tier. */
function navTexts(tier: "warning" | "critical"): string[] {
  return [...container.querySelectorAll(`aside .text-lyra-status-${tier}-strong`)].map((el) => el.textContent ?? "");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  databaseCounter += 1;
  databaseId = `pages-${databaseCounter}`;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe.each(PAGES)("%s", (_label, Page) => {
  it("an unselected ringing card goes warning at 6s and critical at 11s (answer SLA)", async () => {
    await show(Page);
    await startInbound("voice", "(312) 555-0164", "Lauren Briggs");
    await advance(6000);
    // Never selected: still a new assignment.
    expect(navCard("Lauren Briggs").getAttribute("aria-label")).toContain("new assignment");
    expect(navTexts("warning")).toContainEqual(expect.stringMatching(/^00:0[67]$/));
    expect(navTexts("critical")).not.toContainEqual(expect.stringMatching(/^00:/));
    await advance(5000);
    expect(navTexts("critical")).toContainEqual(expect.stringMatching(/^00:1[12]$/));
  });

  it("a ringing call's session controls are hidden until it's accepted", async () => {
    await show(Page);
    const id = await startInbound("voice", "(312) 555-0164", "Lauren Briggs");
    await click(navCard("Lauren Briggs"));
    const ringing = mainControls();
    for (const control of ["Outcome", "Consult / Transfer", "Add Participant", "Add Channel"]) {
      expect(ringing, `${control} while ringing`).not.toContain(control);
    }
    await accept(id);
    expect(mainControls(), "Outcome once accepted").toContain("Outcome");
  });

  it("docks the voice bar below the main container, outside the assignment content", async () => {
    await show(Page);
    const id = await startInbound("voice", "(312) 555-0164", "Lauren Briggs");
    await click(navCard("Lauren Briggs"));
    await accept(id);
    const bars = container.querySelectorAll("[data-slot=voice-bar]");
    expect(bars).toHaveLength(1);
    const bar = bars[0];
    // The content column holds the main container (the call's assignment:
    // its session row), then the bar.
    const mainContainer = bar.previousElementSibling!;
    expect(mainContainer.textContent).toMatch(/#CTX-/);
    expect(mainContainer.contains(bar)).toBe(false);
    expect(bar.parentElement!.firstElementChild).toBe(mainContainer);
  });
});

describe("tier switch", () => {
  it("Desk → Advanced: a carried-over chat shows once, never also in the docked preview", async () => {
    await show(AgentWorkspace2WithDeskPage);
    const id = await startInbound("chat", "priya.shah@example.com", "Priya Shah");
    await accept(id);
    await click(navCard("Priya Shah"));

    await show(AgentWorkspaceAdvancedPage);
    // The carried-over card isn't selected on this page yet; the agent
    // selects it through its chat row. That switches to the card (the chat
    // is its main-column thread) and used to also open the same chat in the
    // docked channel preview.
    const chatRow = [...container.querySelectorAll("aside button[aria-label]")].find((el) =>
      el.getAttribute("aria-label")!.startsWith("Chat channel"),
    ) as HTMLElement;
    await click(chatRow);
    const leafTexts = (pattern: RegExp) =>
      [...document.body.querySelectorAll("*")].filter((el) => el.children.length === 0 && !el.closest("aside") && pattern.test(el.textContent ?? ""));
    // One conversation on screen (each has its own "Chat with Customer"
    // input), and no docked preview titled "Chat".
    expect(leafTexts(/^Chat with Customer$/)).toHaveLength(1);
    expect(leafTexts(/^Chat$/)).toHaveLength(0);
  });
});
