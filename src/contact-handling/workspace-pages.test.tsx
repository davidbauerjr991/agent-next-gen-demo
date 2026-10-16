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
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { ChannelKind, InteractionId } from "@/domain";
import { DEFAULT_SLA } from "@/profiles/contact-center-profile";
import { ProviderRoot } from "@/provider-context";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, MAYA_CHEN_SCRIPT, SCENARIOS, TOM_LEWIS_SCRIPT } from "@/scenarios";

// The workspace page, whole, against the sim (5d.1 recheck): the incoming
// tile's answer SLA, session controls while ringing, the docked voice bar
// and a remount. Desk, the second page, was deleted in P0.5d.2.

// Whole-page renders run several seconds each when the full suite runs in
// parallel; vitest's 5s default timed the first one out, and the rest of the
// file then failed with it.
vi.setConfig({ testTimeout: 30_000 });

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
const PAGES: [string, PageComponent][] = [["Advanced (Phase 1)", AgentWorkspaceAdvancedPage]];

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
        {/* The props App renders both pages with. */}
        <Page showPageHeader showPanelToggle showInteriorPanel />
      </ProviderRoot>,
    );
    await vi.advanceTimersByTimeAsync(100);
  });
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

/** Settings → Channels → Chat on (Phase 1 is voice only), synced to routing. */
async function withChat() {
  await act(async () => {
    getSettingsStore().update("channels", { chat: true });
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function startInbound(channel: ChannelKind, address: string, displayName: string): Promise<InteractionId> {
  let id = "" as InteractionId;
  await act(async () => {
    id = customer.startInbound({ channel, address, displayName });
    await vi.advanceTimersByTimeAsync(50);
  });
  return id;
}

/** Accepts an offer; a digital one the workspace already auto-accepted
 *  (`useAutoAcceptDigital`) refuses a second accept, which is fine here. */
async function accept(id: InteractionId) {
  await act(async () => {
    provider.accept(id).catch(() => {});
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
  localStorage.clear();
  resetSettingsStoreForTests();
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

/** The welcome modal's button with this label, if it's open. */
const welcomeButton = (label: string) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLElement | undefined;

/** Goes Available from the welcome modal, the way an agent does; the page
 *  sends its status to the provider, which routing reads. */
async function goAvailable() {
  const button = welcomeButton("Go Available");
  if (button) await click(button);
  await advance(100);
}

/** Plays a scenario as the customer, the way the dev hotkeys do. */
async function play(scenarioId: string, { available = true }: { available?: boolean } = {}) {
  if (available) await goAvailable();
  await act(async () => {
    customer.playScenario(scenarioId);
    await vi.advanceTimersByTimeAsync(100);
  });
}

const bodyText = () => document.body.textContent ?? "";

// The scripted cases arrive as engine contacts; the page builds no card and
// runs no timer.
describe("Advanced: scripted cases from the scenario player (P0.5c)", () => {
  it("Lucas: his chat shows the setup lines, then the live ones as they play", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(LUCAS_THOMAS_SCRIPT.id);
    await click(navCard("Lucas Thomas"));
    expect(bodyText()).toContain("My card got declined on the Aurora X2 launch order. Is the price gone?");
    expect(bodyText()).toContain("Here's a secure link to pay another way.");
    expect(bodyText()).not.toContain("That failed too.");
    await advance(5000);
    expect(bodyText()).toContain("That failed too. Can someone just place it for me?");
  });

  it("Tom rings like any inbound offer; Accept connects him", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(TOM_LEWIS_SCRIPT.id);
    expect(navCard("Tom Lewis").getAttribute("aria-label")).toContain("new assignment");
    const acceptButton = [...container.querySelectorAll("aside button")].find((b) => b.textContent === "Accept") as HTMLElement;
    expect(acceptButton).toBeDefined();
    await click(acceptButton);
    await click(navCard("Tom Lewis"));
    expect(mainControls()).toContain("Outcome");
    expect(container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
  });

  it("Maya is answered by herself and opens on screen", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(MAYA_CHEN_SCRIPT.id);
    expect(navCard("Maya Chen")).toBeDefined();
    // Selected without a click: her session row and the call bar are up.
    expect(bodyText()).toMatch(/#CTX-/);
    expect(container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
  });

  it("Marcus arrives in review: Takeover Call instead of the voice bar, until the agent takes over", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(MARCUS_WEBB_SCRIPT.id);
    await click(navCard("Marcus Webb"));
    expect(container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(0);
    const takeover = [...container.querySelectorAll("button")].find((b) => b.textContent === "Takeover Call") as HTMLElement;
    expect(takeover).toBeDefined();
    await click(takeover);
    await advance(200);
    expect(container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
  });
});

// Fixes from the commit-2 browser checks (P0.5c).
describe("Advanced: P0.5c browser-check fixes", () => {
  const leafTexts = (pattern: RegExp) =>
    [...document.body.querySelectorAll("*")].filter((el) => el.children.length === 0 && pattern.test(el.textContent ?? "")).map((el) => el.textContent);
  const navDismissIcons = () => container.querySelectorAll('aside [title="Unassign & Dismiss"], aside [aria-label="Unassign & Dismiss"]');

  it("1. an auto-answered call never renders an offer (no Accept/Decline at any point)", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await goAvailable();
    const offersSeen: string[] = [];
    const observer = new MutationObserver(() => {
      for (const button of container.querySelectorAll("aside button")) {
        if (button.textContent === "Accept" || button.textContent === "Decline") offersSeen.push(button.textContent);
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    await play(MAYA_CHEN_SCRIPT.id, { available: false });
    await advance(500);
    observer.disconnect();
    expect(navCard("Maya Chen")).toBeDefined();
    expect(offersSeen).toEqual([]);
  });

  it("3. declining names the caller and writes a Declined Contact History row", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(TOM_LEWIS_SCRIPT.id);
    const decline = [...container.querySelectorAll("aside button")].find((b) => b.textContent === "Decline") as HTMLElement;
    await click(decline);
    await advance(200);
    expect(bodyText()).toContain("Call declined");
    expect(bodyText()).toContain("Tom Lewis call declined");
    expect(() => navCard("Tom Lewis")).toThrow();
    // Home's Contact History lists the declined call; its detail shows the
    // Declined status (a voice row's list subtitle shows no status).
    const row = [...document.body.querySelectorAll("*")].find((el) => el.children.length === 0 && el.textContent === "Tom Lewis") as HTMLElement;
    expect(row).toBeDefined();
    await click(row);
    expect(leafTexts(/^Declined$/).length).toBeGreaterThan(0);
  });

  it("4. a live chat row has no Unassign & Dismiss icon; it appears once the contact has ended", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await withChat();
    await goAvailable();
    const id = await startInbound("chat", "priya.shah@example.com", "Priya Shah");
    await accept(id);
    await click(navCard("Priya Shah"));
    expect(navDismissIcons()).toHaveLength(0);
    await act(async () => {
      customer.hangUp({ interactionId: id });
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(navDismissIcons()).toHaveLength(1);
  });

  it("4. a reviewed chat (Lucas) has no Unassign & Dismiss icon", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(LUCAS_THOMAS_SCRIPT.id);
    await click(navCard("Lucas Thomas"));
    expect(navDismissIcons()).toHaveLength(0);
  });

  it("5. a call into Lucas's journey joins his card: the chat stays the main thread and stays selectable", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(LUCAS_THOMAS_SCRIPT.id);
    await click(navCard("Lucas Thomas"));
    const chatLine = "My card got declined on the Aurora X2 launch order. Is the price gone?";
    expect(bodyText()).toContain(chatLine);
    // The same contact "Call now" places: an outbound voice call into his journey.
    await act(async () => {
      // Provider calls settle as the fake clock moves (the bus delivers on timers).
      const snapshot = provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      const lucas = (await snapshot).interactions.find((i) => i.caseId === LUCAS_THOMAS_SCRIPT.entity.caseId)!;
      const dialed = provider.dial({ channel: "voice", address: "(415) 555-0142", skillId: "general", journeyId: lucas.journeyId });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    expect(container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
    expect(bodyText()).toContain(chatLine);
    const chatRow = [...container.querySelectorAll("aside button[aria-label]")].find((el) =>
      el.getAttribute("aria-label")!.startsWith("Chat channel"),
    ) as HTMLElement;
    await click(chatRow);
    expect(bodyText()).toContain(chatLine);
    expect(container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
  });

  it("6. the page's own status (Unavailable on load) reaches routing: a scripted call isn't offered", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await advance(100);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await play(TOM_LEWIS_SCRIPT.id, { available: false });
    let contacts: { caseId?: string }[] = [];
    await act(async () => {
      const snapshot = provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      contacts = (await snapshot).interactions;
    });
    expect(contacts.some((i) => i.caseId === TOM_LEWIS_SCRIPT.entity.caseId)).toBe(false);
    expect([...container.querySelectorAll("aside button")].some((b) => b.textContent === "Accept")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("playScenario ignored"), expect.stringContaining("not available or working"));
    warn.mockRestore();
  });
});

/** Nothing: rendering it unmounts the page, keeping the provider. */
const NoPage: PageComponent = () => null;

describe("Advanced: an approval card's decision survives a remount (P0.5c)", () => {
  it("Lucas's approved card is still decided after the page remounts", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await play(LUCAS_THOMAS_SCRIPT.id);
    await advance(14_000);
    // Approve through the provider, the call the card's Approve makes.
    await act(async () => {
      const snapshot = provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      const lucas = (await snapshot).interactions.find((i) => i.caseId === LUCAS_THOMAS_SCRIPT.entity.caseId)!;
      const transcript = provider.getTranscript(lucas.id);
      await vi.advanceTimersByTimeAsync(50);
      const card = (await transcript).messages.find((m) => m.annotation?.kind === "approval")!;
      const answered = provider.respondToRequest(lucas.id, { value: "accept", requestId: card.id });
      await vi.advanceTimersByTimeAsync(200);
      await answered;
    });
    await show(NoPage);
    await show(AgentWorkspaceAdvancedPage);
    await click(navCard("Lucas Thomas"));
    expect(bodyText()).toContain("Exception approved");
    expect(bodyText()).not.toContain("How would you like to proceed?");
  });
});

describe("remount", () => {
  it("a carried-over chat shows once, never also in the docked preview", async () => {
    await show(AgentWorkspaceAdvancedPage);
    await withChat();
    await goAvailable();
    const id = await startInbound("chat", "priya.shah@example.com", "Priya Shah");
    await accept(id);
    await click(navCard("Priya Shah"));

    await show(NoPage);
    await show(AgentWorkspaceAdvancedPage);
    // The carried-over card isn't selected on the remounted page yet; the agent
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
