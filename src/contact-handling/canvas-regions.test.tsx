// @vitest-environment jsdom
// P-CANVAS: under AI display inline and main the main column is two regions
// built from the canvas registry — the action area and the reference column
// (two-column canvas) — on every kind of card: a scripted case (Lucas), a
// seeded email (Noah), a sim inbound chat and an agent-dialed outbound. Each
// gets its own cell set. "stacked" puts the reference cells at the top of the
// action area instead; panel mode has no canvas.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { LUCAS_THOMAS_SCRIPT } from "@/scenarios/scripts/lucas-thomas";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiSettings } from "@/settings/settings-schema";
import { registerCanvasCell, resetCanvasRegistry, canvasCellDefinition } from "./canvas-registry";
import { getWorkspaceUiStore } from "./workspace-ui-store";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;
const UNKNOWN = "(161) 474-9179";

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

const region = (name: "action" | "reference") => h.container.querySelector<HTMLElement>(`[data-canvas-region=${name}]`);
const cellsIn = (el: HTMLElement | null) =>
  el ? [...el.querySelectorAll("[data-canvas-cell]")].map((c) => c.getAttribute("data-canvas-cell")) : [];

/** Phase 2 (every channel on) with this AI display and canvas layout. */
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

const CASES = {
  lucas: async () => {
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(2_000);
  },
  noah: async () => {
    await h.click(h.navCard("Noah Patel"));
    await h.advance(300);
  },
  simChat: async () => {
    const id = await h.startInbound("chat", priya.emailAddress!, priya.name);
    await h.accept(id);
    await h.click(h.navCard(priya.name));
    await h.advance(300);
  },
  dialed: async () => {
    await act(async () => {
      const dialed = h.provider.dial({ channel: "voice", address: UNKNOWN, skillId: "general" });
      await vi.advanceTimersByTimeAsync(500);
      await dialed;
    });
    await h.click(h.navCard(UNKNOWN));
    await h.advance(300);
  },
} as const;

const linkCustomer = () => [...(region("reference")?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Link to existing customer");

/** Each card's own cells under the two-column canvas, and whether it's an
 *  unmatched customer (Customer Info is then "Link to existing customer"). */
const REFERENCE = ["real-time-summary", "journey-summary", "customer-info"];
const EXPECTED: Record<keyof typeof CASES, { action: string[]; reference: string[]; unmatched: boolean }> = {
  lucas: { action: ["next-best-action"], reference: REFERENCE, unmatched: false },
  noah: { action: ["next-best-action"], reference: REFERENCE, unmatched: false },
  simChat: { action: ["next-best-action"], reference: REFERENCE, unmatched: true },
  dialed: { action: ["next-best-action"], reference: REFERENCE, unmatched: true },
};

describe("two-column canvas: both regions on every kind of card, each with its own cells", () => {
  for (const [name, run] of Object.entries(CASES) as [keyof typeof CASES, () => Promise<void>][]) {
    for (const displayLocation of ["inline", "main"] as const) {
      it(`${name}, AI display ${displayLocation}`, async () => {
        await open({ displayLocation, canvasLayout: "twoColumn" });
        await run();
        const action = region("action");
        const reference = region("reference");
        expect(action).not.toBeNull();
        expect(reference).not.toBeNull();
        // The conversation anchors the action area: the transcript inline, the AI workspace under main.
        if (displayLocation === "main") {
          expect(action!.getAttribute("data-main-thread")).toBe("ai");
          expect(action!.querySelector("[data-slot=ai-workspace]")).not.toBeNull();
        } else {
          expect(action!.getAttribute("data-main-thread")).not.toBe("ai");
        }
        // The column sits beside the action area, not inside it; docked while it fits (jsdom: not measured, fits).
        expect(action!.contains(reference)).toBe(false);
        expect(reference!.hasAttribute("data-docked")).toBe(true);
        expect(cellsIn(action)).toEqual(EXPECTED[name].action);
        expect(cellsIn(reference)).toEqual(EXPECTED[name].reference);
        expect(!!linkCustomer()).toBe(EXPECTED[name].unmatched);
      });
    }
  }
});

describe("stacked canvas and panel mode", () => {
  for (const displayLocation of ["inline", "main"] as const) {
    it(`stacked, AI display ${displayLocation}: no reference column; the reference cells head the action area`, async () => {
      await open({ displayLocation, canvasLayout: "stacked" });
      await CASES.noah();
      expect(region("reference")).toBeNull();
      // The Next Best Action is pinned above the conversation; the reference cells head its scroll.
      expect(cellsIn(region("action"))).toEqual(["next-best-action", ...REFERENCE]);
    });
  }

  it("AI display panel: no canvas, whatever the layout setting", async () => {
    await open({ displayLocation: "panel", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(region("action")).toBeNull();
    expect(region("reference")).toBeNull();
    expect(h.container.querySelector("[data-canvas-cell]")).toBeNull();
  });
});

describe("the record header's second line and the docked column (browser pass, 2026-10-22)", () => {
  const header = () => h.container.querySelector<HTMLElement>("[data-slot=record-header]");
  const sessionRow = () => header()?.querySelector("[data-slot=record-session-row]");

  for (const [displayLocation, canvasLayout] of [
    ["inline", "twoColumn"],
    ["inline", "stacked"],
    ["panel", "twoColumn"],
  ] as const) {
    it(`${displayLocation} (${canvasLayout}): the current session row is the record header's second line, above both regions`, async () => {
      await open({ displayLocation, canvasLayout });
      await CASES.noah();
      const row = sessionRow();
      expect(row).not.toBeNull();
      expect(row!.textContent).toContain("#");
      // Not in the transcript too: exactly one current session row, in the header.
      const main = h.container.querySelector<HTMLElement>("[data-main-thread]")!;
      expect(main.contains(row!)).toBe(false);
      expect(main.textContent).not.toContain(row!.textContent!.trim().slice(0, 12));
      // One bottom border: the session row's, not the PageHeader's.
      expect(header()!.querySelectorAll(".border-b").length).toBeGreaterThan(0);
      expect(header()!.firstElementChild!.className).not.toContain("border-b");
    });
  }

  it("main: no second line (the session row is the panel thread's, k5 B); the PageHeader carries the border", async () => {
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(sessionRow()).toBeNull();
    expect(header()!.firstElementChild!.className).toContain("border-b");
  });

  it("the docked column has no panel header", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(region("reference")!.textContent).not.toContain("Summaries");
  });
});

describe("the registry decides the region", () => {
  it("re-registering the Next Best Action as reference moves it into the reference column, with no other change", async () => {
    registerCanvasCell({ ...canvasCellDefinition("next-best-action")!, region: "reference", order: 25 });
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(cellsIn(region("action"))).toEqual([]);
    expect(cellsIn(region("reference"))).toEqual(["real-time-summary", "journey-summary", "next-best-action", "customer-info"]);
    expect(region("reference")!.querySelector("[data-slot=next-best-action]")).not.toBeNull();
  });

  it("the conversation can't leave the action area", () => {
    expect(() => registerCanvasCell({ id: "conversation", region: "reference", order: 30 })).toThrow();
  });
});

describe("a slide-over takes the reference slot (inline and main)", () => {
  const slideOver = () => h.container.querySelector<HTMLElement>("[data-slot=reference-slide-over]");
  const composer = () => document.body.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;
  const resultRow = (text: string) =>
    [...h.container.querySelectorAll<HTMLElement>("[data-canvas-region=action] button")].find(
      (b) => b.textContent?.startsWith(text) && b.textContent.includes("John Smith"),
    )!;

  for (const displayLocation of ["inline", "main"] as const) {
    it(`AI display ${displayLocation}: the reference cards give way while it's open and come back after its close`, async () => {
      await open({ displayLocation, canvasLayout: "twoColumn" });
      await CASES.noah();
      expect(region("reference")).not.toBeNull();
      expect(slideOver()).toBeNull();

      // Ask Copilot with the first chip, then open its result row's slide-over.
      const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
      const text = chip.textContent!.trim();
      await h.click(chip);
      await h.click(composer().querySelector('button[aria-label="Submit"]')!);
      await h.advance(2_500);
      await h.click(resultRow(text));
      expect(slideOver()).not.toBeNull();
      expect(slideOver()!.textContent).toContain(text);
      expect(region("reference")).toBeNull();
      // The action area's sibling in the row, not inside it.
      expect(slideOver()!.parentElement).toBe(region("action")!.parentElement);

      // Close: still mounted (closed) through the transition, then the cards are back.
      await h.click(resultRow(text));
      expect(region("reference")).toBeNull();
      await h.advance(300);
      expect(slideOver()).toBeNull();
      expect(region("reference")).not.toBeNull();
    });
  }
});

describe("the Summaries overlay when the column doesn't fit", () => {
  const summaries = () => h.container.querySelector<HTMLElement>("[data-summaries-toggle]");
  const fits = async (value: boolean) => {
    await act(async () => {
      getWorkspaceUiStore(h.provider).update((s) => ({ ...s, referenceColumnFits: value }));
      await vi.advanceTimersByTimeAsync(50);
    });
  };
  const columnOpen = () => region("reference")!.style.width !== "0px";

  it("the toggle opens the column over the action area; outside click and its close button close it", async () => {
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(summaries()).toBeNull();
    await fits(false);
    expect(region("reference")!.hasAttribute("data-docked")).toBe(false);
    expect(columnOpen()).toBe(false);
    await h.click(summaries()!);
    expect(summaries()!.getAttribute("aria-pressed")).toBe("true");
    expect(columnOpen()).toBe(true);
    // Outside click.
    await act(async () => {
      region("action")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(columnOpen()).toBe(false);
    // Its close button.
    await h.click(summaries()!);
    await h.click(region("reference")!.querySelector<HTMLElement>('button[aria-label="Close panel"]')!);
    expect(columnOpen()).toBe(false);
    // Fits again: docked, no toggle.
    await fits(true);
    expect(summaries()).toBeNull();
    expect(region("reference")!.hasAttribute("data-docked")).toBe(true);
  });

  it("stacked never shows the toggle", async () => {
    await open({ displayLocation: "main", canvasLayout: "stacked" });
    await CASES.noah();
    await fits(false);
    expect(summaries()).toBeNull();
  });
});
