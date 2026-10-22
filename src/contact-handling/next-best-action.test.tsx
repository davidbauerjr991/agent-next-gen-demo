// @vitest-environment jsdom
// P-CANVAS: the Next Best Action pinned first in the action area (AI display
// inline and main) and the reference column's three Agentic AI cards. The
// card's footer follows the suggestion and the channel; using a suggestion
// or putting it aside logs a compact AI row and moves the card on.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { MAYA_CHEN_SCRIPT } from "@/scenarios/scripts/maya-chen";
import { MARCUS_WEBB_SCRIPT } from "@/scenarios/scripts/marcus-webb";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiSettings } from "@/settings/settings-schema";
import { DEFAULT_CANVAS_CELLS } from "@/components/workspace/canvas-cells";
import { canvasCellDefinition, resetCanvasRegistry } from "./canvas-registry";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetCanvasRegistry();
  h.setUp();
});
afterEach(async () => {
  resetCanvasRegistry();
  await h.tearDown();
});

async function open(ai: AiSettings) {
  await act(async () => {
    getSettingsStore().updateMany(profileValues("phase2"));
    getSettingsStore().update("ai", ai);
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await h.advance(500);
}

async function maya() {
  await h.play(MAYA_CHEN_SCRIPT.id);
  await h.click(h.navCard("Maya Chen"));
  await h.advance(300);
}

async function priyaChat() {
  const id = await h.startInbound("chat", priya.emailAddress!, priya.name);
  await h.accept(id);
  await h.click(h.navCard(priya.name));
  await h.advance(300);
}

const nba = () => h.container.querySelector<HTMLElement>("[data-slot=next-best-action]");
const frame = () => nba()?.getAttribute("data-frame");
const button = (label: string, scope: Element | null = nba()) =>
  [...(scope?.querySelectorAll<HTMLElement>("button") ?? [])].find((b) => b.textContent?.trim() === label);
const outcomes = () => [...h.container.querySelectorAll<HTMLElement>("[data-slot=nba-outcome]")].map((r) => `${r.dataset.outcome}: ${r.textContent}`);
const action = () => h.container.querySelector<HTMLElement>("[data-canvas-region=action]");

describe("the registry", () => {
  it("has the Next Best Action at action order 0 and exactly the three reference cells", () => {
    expect(canvasCellDefinition("next-best-action")).toMatchObject({ region: "action", order: 0 });
    expect(canvasCellDefinition("autosummary")).toBeUndefined();
    expect(canvasCellDefinition("artifacts")).toBeUndefined();
    const reference = DEFAULT_CANVAS_CELLS.filter((c) => c.region === "reference").sort((a, b) => a.order - b.order).map((c) => c.id);
    expect(reference).toEqual(["real-time-summary", "journey-summary", "customer-info"]);
  });
});

describe("the Next Best Action", () => {
  for (const displayLocation of ["inline", "main"] as const) {
    it(`AI display ${displayLocation}: first in the action area, above the thread, opening with the greeting`, async () => {
      await open({ displayLocation, canvasLayout: "twoColumn" });
      await maya();
      const cells = [...action()!.querySelectorAll("[data-canvas-cell]")].map((c) => c.getAttribute("data-canvas-cell"));
      expect(cells[0]).toBe("next-best-action");
      expect(frame()).toBe("say");
      expect(nba()!.textContent).toContain("Greet Maya and say the call is recorded");
    });
  }

  it("a call: Say → Said it (logged as used) → its queued Ask → Do → Run it opens its panel and plays its branch → nothing at wrap-up", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await maya();
    expect(button("Said it")).toBeDefined();
    expect(button("Insert into reply")).toBeUndefined();
    // The Ask is queued behind the greeting once its step plays.
    await h.advance(2_500);
    expect(frame()).toBe("say");
    await h.click(button("Said it")!);
    await h.advance(300);
    expect(outcomes()).toEqual([expect.stringMatching(/^used: Used at .* — Greet Maya and say the call is recorded$/)]);
    expect(frame()).toBe("ask");
    await h.click(button("Said it")!);
    await h.advance(300);
    // Nothing queued yet: the last used one shows until the Do arrives.
    expect(frame()).toBe("used");
    await h.advance(14_000);
    expect(frame()).toBe("do");
    await h.click(button("Run it")!);
    await h.advance(600);
    expect(h.container.querySelector("[data-slot=reference-slide-over]")).not.toBeNull();
    await h.advance(2_000);
    expect(h.container.textContent).toContain("Refund of $412.00 to Visa 4417 issued");
    expect(outcomes()).toHaveLength(3);
    // Hang up: wrap-up leaves nothing to suggest.
    await act(async () => {
      const snapshot = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      const id = (await snapshot).interactions.find((i) => i.caseId === "CASE-30402")!.id;
      const ended = h.provider.end(id);
      await vi.advanceTimersByTimeAsync(300);
      await ended;
    });
    expect(frame()).toBe("nothing");
  });

  it("a chat: Insert into reply fills the chat composer, logs it, and the next suggestion is the Ask", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await priyaChat();
    expect(frame()).toBe("say");
    expect(button("Said it")).toBeUndefined();
    const text = nba()!.querySelector("[role=note]")!.textContent!;
    await h.click(button("Insert into reply")!);
    await h.advance(300);
    const textarea = [...h.container.querySelectorAll<HTMLTextAreaElement>("[data-main-thread] textarea")].find((el) => el.value);
    expect(textarea?.value).toBe(text);
    expect(outcomes()).toEqual([expect.stringMatching(/^used: Used at .* — Greet Priya/)]);
    expect(frame()).toBe("ask");
  });

  it("Not now logs it as dismissed and moves on; the rule set ends with nothing to suggest", async () => {
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await priyaChat();
    await h.click(button("Not now")!);
    await h.advance(300);
    expect(outcomes()).toEqual([expect.stringMatching(/^dismissed: Dismissed at .* — Greet Priya/)]);
    expect(frame()).toBe("ask");
    await h.click(button("Not now")!);
    await h.advance(300);
    expect(frame()).toBe("nothing");
  });

  it("Marcus Webb keeps his own card: no generic Next Best Action", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await h.play(MARCUS_WEBB_SCRIPT.id);
    await h.click(h.navCard("Marcus Webb"));
    await h.advance(500);
    expect(nba()).toBeNull();
    expect(action()!.querySelector("[data-canvas-cell=marcus-card]")).not.toBeNull();
  });
});

describe("the reference column", () => {
  const expanded = () =>
    ["real-time-summary", "journey-summary", "customer-info-card"].filter(
      (slot) => h.container.querySelector(`[data-slot=${slot}] [aria-expanded]`)?.getAttribute("aria-expanded") === "true",
    );
  const header = (slot: string) => h.container.querySelector<HTMLElement>(`[data-slot=${slot}] [aria-expanded]`)!;

  it("is a single-open accordion: the Real-Time Summary open at first; opening another closes it", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await maya();
    expect(expanded()).toEqual(["real-time-summary"]);
    await h.click(header("journey-summary"));
    expect(expanded()).toEqual(["journey-summary"]);
    await h.click(header("customer-info-card"));
    expect(expanded()).toEqual(["customer-info-card"]);
    await h.click(header("customer-info-card"));
    expect(expanded()).toEqual([]);
  });

  it("Maya's cards: the summary follows her turns; her journey is found after the lookup; Customer Info is a link", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await h.play(MAYA_CHEN_SCRIPT.id);
    await h.click(h.navCard("Maya Chen"));
    expect(h.container.querySelector("[data-slot=journey-summary]")!.getAttribute("data-frame")).toBe("looking-up");
    await h.advance(1_000);
    expect(h.container.querySelector("[data-slot=journey-summary]")!.getAttribute("data-frame")).toBe("found");
    await h.advance(1_000);
    const summary = h.container.querySelector<HTMLElement>("[data-slot=real-time-summary]")!;
    expect(summary.getAttribute("data-frame")).toBe("live");
    expect(summary.textContent).toContain("cracked water tank");
    expect(summary.textContent).not.toContain("Wants a refund, not a replacement");
    // Her second turn (12s after answer) adds the next line.
    await h.advance(11_000);
    expect(summary.textContent).toContain("Wants a refund, not a replacement");
    await h.click(header("customer-info-card"));
    expect(h.container.querySelector("[data-slot=customer-info-card]")!.textContent).toContain("View customer info");
  });
});
