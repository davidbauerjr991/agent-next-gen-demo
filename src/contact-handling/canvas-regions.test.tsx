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
import { LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { LUCAS_THOMAS_SCRIPT } from "@/scenarios/scripts/lucas-thomas";
import { MAYA_CHEN_SCRIPT } from "@/scenarios/scripts/maya-chen";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { SECTIONS, type AiSettings } from "@/settings/settings-schema";
import { registerCanvasCell, resetCanvasRegistry, canvasCellDefinition } from "./canvas-registry";
import { getWorkspaceUiStore } from "./workspace-ui-store";
import { resetReferenceCardsWorkingStateForTests } from "./reference-cards-working-state";
import { showEmptyReferenceCards } from "@/test-utils/reference-cards";
import { registerCardResult } from "@/test-utils/copilot-results";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;
const UNKNOWN = "(161) 474-9179";

beforeEach(() => {
  localStorage.clear();
  resetReferenceCardsWorkingStateForTests();
  resetSettingsStoreForTests();
  resetCanvasRegistry();
  // These tests are about the regions, not when an empty card hides (canvas-hascontent.test.tsx).
  showEmptyReferenceCards();
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
async function open(ai: Partial<AiSettings>) {
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
  // The Next Best Action isn't a cell: it surfaces in the conversation (next-best-action.test).
  lucas: { action: [], reference: REFERENCE, unmatched: false },
  noah: { action: [], reference: REFERENCE, unmatched: false },
  // A chat from her directory email matches her record (P-LAYOUT-F3 8, Dave; was unmatched: chats never matched).
  simChat: { action: [], reference: REFERENCE, unmatched: false },
  dialed: { action: [], reference: REFERENCE, unmatched: true },
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
      expect(cellsIn(region("action"))).toEqual(REFERENCE);
    });
  }

  it("stacked: the reference cells are pinned above the conversation's scroll, start collapsed, and keep the agent's open / collapsed choice per browser across assignments (P-LAYOUT-F1 D)", async () => {
    await open({ displayLocation: "inline", canvasLayout: "stacked" });
    // A plain inbound chat: no guidance bringing a card forward.
    await CASES.simChat();
    const pinned = () => h.container.querySelector<HTMLElement>("[data-slot=canvas-pinned]")!;
    expect(cellsIn(pinned())).toEqual(REFERENCE);
    // Outside the transcript's scroll: the pinned band is their nearest scroller.
    for (const cell of pinned().querySelectorAll("[data-canvas-cell]")) expect(cell.closest(".overflow-y-auto")).toBe(pinned());
    const toggleOf = (cell: string) => h.container.querySelector<HTMLElement>(`[data-canvas-cell=${cell}] [aria-expanded]`)!;
    expect(REFERENCE.map((cell) => toggleOf(cell!).getAttribute("aria-expanded"))).toEqual(["false", "false", "false"]);
    await h.click(toggleOf("customer-info"));
    expect(toggleOf("customer-info").getAttribute("aria-expanded")).toBe("true");
    expect(JSON.parse(localStorage.getItem("agent-next-gen:working:reference-cards")!)).toEqual({ customer: true });
    // Another assignment: Customer Info is still open there (per browser, not per assignment).
    await CASES.noah();
    expect(toggleOf("customer-info").getAttribute("aria-expanded")).toBe("true");
  });

  it("a custom map splits the reference cells: Customer Info above the action area, the summaries in the column (P-LAYOUT)", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await act(async () => {
      const store = getSettingsStore();
      const parts = store.getState().values.layout.parts;
      store.update("layout", { parts: { ...parts, customerInfo: { ...parts.customerInfo, slot: "main", order: 0 } } });
      await vi.advanceTimersByTimeAsync(50);
    });
    await CASES.noah();
    expect(cellsIn(region("reference"))).toEqual(["real-time-summary", "journey-summary"]);
    expect(cellsIn(region("action"))).toEqual(["customer-info"]);
  });

  it("a cell the map puts after the conversation renders after it, as Settings → Layout lists it (P-LAYOUT review)", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await act(async () => {
      const store = getSettingsStore();
      const parts = store.getState().values.layout.parts;
      // Customer Info's canvas order (30, the conversation's own) would put it above; the map's says after it.
      store.update("layout", { parts: { ...parts, customerInfo: { ...parts.customerInfo, slot: "main", order: parts.aiFeed.order + 1 } } });
      await vi.advanceTimersByTimeAsync(50);
    });
    await CASES.noah();
    // After the conversation: the transcript's trailing block, not the overview above the messages.
    const trailing = region("action")!.querySelector("[data-slot=transcript-trailing]");
    expect(cellsIn(trailing as HTMLElement | null)).toEqual(["customer-info"]);
  });

  it("AI display panel: no canvas, whatever the layout setting; the reference cells are Contact Details' Overview", async () => {
    await open({ displayLocation: "panel", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(region("action")).toBeNull();
    expect(region("reference")).toBeNull();
    const cells = [...h.container.querySelectorAll("[data-canvas-cell]")];
    expect(cells.map((c) => c.getAttribute("data-canvas-cell"))).toEqual(REFERENCE);
    for (const cell of cells) expect(cell.closest("[data-slot=right-panel]")).not.toBeNull();
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
  it("re-registering the Journey Summary as an action cell moves it into the action area, with no other change", async () => {
    registerCanvasCell({ ...canvasCellDefinition("journey-summary")!, region: "action", order: 25 });
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(cellsIn(region("action"))).toEqual(["journey-summary"]);
    expect(cellsIn(region("reference"))).toEqual(["real-time-summary", "customer-info"]);
    expect(region("action")!.querySelector("[data-slot=journey-summary]")).not.toBeNull();
  });

  it("the conversation can't leave the action area", () => {
    expect(() => registerCanvasCell({ id: "conversation", region: "reference", order: 30 })).toThrow();
  });
});

describe("canvas.cells overrides the registry (P-PROFILES)", () => {
  async function withCells(cells: Record<string, { enabled?: boolean; region?: "action" | "reference"; order?: number }>) {
    await act(async () => {
      getSettingsStore().update("canvas", { cells });
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  it("an override turns a cell off, moves it to the other region, or reorders it", async () => {
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(cellsIn(region("reference"))).toEqual(["real-time-summary", "journey-summary", "customer-info"]);

    await withCells({ "real-time-summary": { enabled: false } });
    expect(cellsIn(region("reference"))).toEqual(["journey-summary", "customer-info"]);

    await withCells({ "customer-info": { order: 5 } });
    expect(cellsIn(region("reference"))).toEqual(["customer-info", "real-time-summary", "journey-summary"]);

    await withCells({ "journey-summary": { region: "action", order: 25 } });
    expect(cellsIn(region("action"))).toEqual(["journey-summary"]);
    expect(cellsIn(region("reference"))).toEqual(["real-time-summary", "customer-info"]);
  });

  it("the conversation anchor ignores on/off and region; an unknown id is ignored", async () => {
    await withCells({ conversation: { enabled: false, region: "reference" }, "no-such-cell": { enabled: false } });
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    expect(region("action")).not.toBeNull();
    expect(cellsIn(region("reference"))).toEqual(["real-time-summary", "journey-summary", "customer-info"]);
  });

  it("the stored value is read field by field: malformed entries are dropped", () => {
    const read = SECTIONS.canvas.read(
      { cells: { a: { enabled: "no", order: 3 }, b: "x", c: { region: "sideways" }, d: { region: "reference", enabled: true } } },
      SECTIONS.canvas.defaults,
    );
    expect(read.cells).toEqual({ a: { order: 3 }, d: { region: "reference", enabled: true } });
  });
});

describe("a slide-over takes the reference slot (inline and main)", () => {
  const slideOver = () => h.container.querySelector<HTMLElement>("[data-slot=reference-slide-over]");
  const composer = () => document.body.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;
  /** The composer's first chip, its answer a card (a plain one is a line with no slide-over, P-LAYOUT-F1 F). */
  const cardChip = () => {
    const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
    registerCardResult(chip.textContent!.trim());
    return chip;
  };
  const resultRow = (text: string) =>
    [...h.container.querySelectorAll<HTMLElement>("[data-canvas-region=action] button")].find(
      (b) => b.textContent?.startsWith(text) && b.textContent.includes("John Smith"),
    )!;

  for (const [width, docks] of [
    [1400, true],
    [700, false],
  ] as const) {
    // P-LAYOUT-F3 4: docked, it's beside the whole page column (the page's right host), outside the row the
    // assignments panel's rule measures, so it reserves nothing there (was this row's sibling, counted at its width).
    it(`stacked, a ${width}px row: the slide-over ${docks ? "docks beside the page column, outside the measured row" : "overlays"} and the assignments panel's rule reserves nothing (P-LAYOUT-F1 D, P-LAYOUT-F3 4)`, async () => {
      const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 800, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 800, toJSON: () => ({}) } as DOMRect);
      try {
        await open({ displayLocation: "inline", canvasLayout: "stacked" });
        await CASES.noah();
        expect(region("reference")).toBeNull();
        await h.click(cardChip());
        await h.advance(2_500);
        expect(slideOver()).not.toBeNull();
        expect(slideOver()!.className.includes("absolute")).toBe(!docks);
        expect(!!slideOver()!.closest("[data-slot=page-right-host]")).toBe(docks);
        expect(getWorkspaceUiStore(h.provider).getState().referenceSlotWidth).toBe(0);
      } finally {
        rect.mockRestore();
      }
    });
  }

  for (const displayLocation of ["inline", "main"] as const) {
    // P-LAYOUT-F4 3 (reverses F3 10 here): with a reference column the slide-over is that column's own, over the
    // cards at the card width, however wide the row; it docks beside the page column only with no column (stacked).
    it(`AI display ${displayLocation}: it overlays the reference cards, which stay mounted (the same nodes) before, during and after`, async () => {
      await open({ displayLocation, canvasLayout: "twoColumn" });
      await CASES.noah();
      expect(region("reference")).not.toBeNull();
      expect(slideOver()).toBeNull();
      const cards = [...region("reference")!.querySelectorAll("[data-canvas-cell]")];

      // Ask Copilot with the first chip (the click asks it): its result opens in the slide-over once Copilot
      // "finishes" (P-HOME-1j).
      const chip = cardChip();
      const text = chip.textContent!.trim();
      await h.click(chip);
      await h.advance(2_500);
      expect(slideOver()).not.toBeNull();
      expect(slideOver()!.textContent).toContain(text);
      // The action area's sibling in the row, not inside it, and not in the page's right host; lyra's overlay
      // layout, over the cards.
      expect(slideOver()!.parentElement).toBe(region("action")!.parentElement);
      expect(slideOver()!.closest("[data-slot=page-right-host]")).toBeNull();
      expect(slideOver()!.className).toContain("absolute");
      expect([...region("reference")!.querySelectorAll("[data-canvas-cell]")]).toEqual(cards);

      // Close: still mounted (closed) through the transition, then gone; the cards were never re-mounted.
      await h.click(resultRow(text));
      expect(slideOver()).not.toBeNull();
      await h.advance(300);
      expect(slideOver()).toBeNull();
      expect([...region("reference")!.querySelectorAll("[data-canvas-cell]")]).toEqual(cards);

      // P-HOME-1h: the Real-Time Summary lists the ask ("{time} · {question}"); its line opens the same result.
      const summary = region("reference")!.querySelector<HTMLElement>("[data-slot=real-time-summary]")!;
      await h.click(summary.querySelector<HTMLElement>("[aria-expanded]")!);
      const line = summary.querySelector<HTMLElement>("[data-slot=summary-asks] a, [data-slot=summary-asks] button")!;
      expect(line.textContent).toMatch(new RegExp(`\\d{1,2}:\\d{2}\\s?[AP]M · ${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      await h.click(line);
      await h.advance(50);
      expect(slideOver()!.textContent).toContain(text);
    });
  }

  it("Link to existing customer opens the directory picker in the slide-over; linking names the card from the record (P-HOME-1m)", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await CASES.dialed();
    await h.click(linkCustomer()!);
    await h.advance(100);
    const picker = slideOver()!.querySelector<HTMLElement>("[data-slot=link-customer]")!;
    expect(picker).not.toBeNull();
    const input = picker.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Nathan");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(10);
    });
    const nathan = [...picker.querySelectorAll<HTMLElement>("p")].find((p) => p.textContent === "Nathan Cole")!;
    await h.click([...nathan.closest("div.group")!.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Link To Record")!);
    await h.advance(500);
    expect(h.navCard("Nathan Cole")).toBeTruthy();
    expect(linkCustomer()).toBeUndefined();
  });

  it("each assignment keeps its own slide-over: the panel, full screen and width come back with it; another assignment has nothing open", async () => {
    await open({ displayLocation: "inline", canvasLayout: "twoColumn" });
    await h.play(MAYA_CHEN_SCRIPT.id);
    await h.click(h.navCard("Maya Chen"));
    await h.advance(300);
    // The order panel (Maya's "Show the order" chip).
    const chip = [...h.container.querySelectorAll<HTMLElement>("[data-canvas-region=action] [data-slot=copilot-composer] button, [data-canvas-region=action] [data-slot=copilot-composer] [role=button]")].find(
      (c) => c.textContent?.trim() === "Show the order",
    )!;
    await h.click(chip);
    await h.advance(2_500);
    expect(slideOver()).not.toBeNull();
    const panelText = slideOver()!.textContent;
    // Wider by keyboard (the drag handle's arrow keys), then full screen.
    const handle = slideOver()!.querySelector<HTMLElement>('[role="separator"]')!;
    await act(async () => {
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    await h.click(slideOver()!.querySelector<HTMLElement>('button[aria-label="Full screen"]')!);
    // Kept on Maya's assignment, the only one with a slide-over open.
    const remembered = () =>
      Object.values(getWorkspaceUiStore(h.provider).getState().referenceByAssignment).find((r) => r.slideOver.content)?.slideOver;
    const width = remembered()!.width!;
    expect(width).toBeGreaterThan(LYRA_CARD_MAX_WIDTH);
    expect(remembered()!.fullScreen).toBe(true);

    await CASES.lucas();
    expect(slideOver()).toBeNull();

    await h.click(h.navCard("Maya Chen"));
    await h.advance(300);
    expect(slideOver()).not.toBeNull();
    expect(slideOver()!.textContent).toBe(panelText);
    expect(slideOver()!.querySelector('button[aria-label="Exit full screen"]')).not.toBeNull();
    expect(remembered()!.width).toBe(width);
  });
});

describe("the reference column and its record-header toggle", () => {
  /** The record header's right toggle (lyra PageHeader, P-LAYOUT-F1 A1; always present since P-LAYOUT-F4 7). */
  const summaries = () => h.container.querySelector<HTMLElement>('[data-slot=record-header] button[aria-label="Summaries"]');
  const fits = async (value: boolean) => {
    await act(async () => {
      getWorkspaceUiStore(h.provider).update((s) => ({ ...s, referenceColumnFits: value }));
      await vi.advanceTimersByTimeAsync(50);
    });
  };
  const columnOpen = () => region("reference")!.style.width !== "0px";

  it("the toggle is always there: pinned open by default, a click closes it, a click opens it; no header of its own (P-LAYOUT-F4 7, 9)", async () => {
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    // Fits: pinned open beside the action area, the toggle active; the column has no header, pin or close button.
    expect(summaries()).not.toBeNull();
    expect(summaries()!.getAttribute("aria-expanded")).toBe("true");
    expect(region("reference")!.getAttribute("data-docked")).toBe("true");
    expect(columnOpen()).toBe(true);
    expect(region("reference")!.textContent).not.toContain("Summaries");
    expect(region("reference")!.querySelector('button[aria-label="Close panel"]')).toBeNull();
    // A click closes it, and the choice is kept for this browser.
    await h.click(summaries()!);
    expect(summaries()!.getAttribute("aria-expanded")).toBe("false");
    expect(columnOpen()).toBe(false);
    expect(JSON.parse(localStorage.getItem("agent-next-gen:working:assignments")!).referencePinned).toBe(false);
    // A click pins it open again.
    await h.click(summaries()!);
    expect(summaries()!.getAttribute("aria-expanded")).toBe("true");
    expect(region("reference")!.getAttribute("data-docked")).toBe("true");
    expect(columnOpen()).toBe(true);
  });

  it("where it doesn't fit beside the action area it's the toggle's flyout only; the pinned choice isn't lost", async () => {
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    await fits(false);
    expect(region("reference")!.hasAttribute("data-docked")).toBe(false);
    expect(columnOpen()).toBe(false);
    await h.click(summaries()!);
    expect(summaries()!.getAttribute("aria-expanded")).toBe("true");
    expect(columnOpen()).toBe(true);
    await h.click(summaries()!);
    expect(columnOpen()).toBe(false);
    // Fits again: back to the stored choice (pinned open), still no Details toggle under "main".
    await fits(true);
    expect(region("reference")!.getAttribute("data-docked")).toBe("true");
    expect(h.container.querySelector('[data-slot=record-header] button[aria-label="Details panel"]')).toBeNull();
  });

  it("a detail panel over the column: the toggle stays and closes both, opening restores both; opening a detail while collapsed opens the right side (P-LAYOUT-F4 10, 12)", async () => {
    await open({ displayLocation: "main", canvasLayout: "twoColumn" });
    await CASES.noah();
    const details = () => [...h.container.querySelectorAll<HTMLElement>("button[data-contact-details]")][0];
    const detailOpen = () => h.container.querySelector("[data-slot=reference-slide-over]") !== null;
    await h.click(details());
    await h.advance(400);
    expect(detailOpen()).toBe(true);
    // The toggle is still there and active; it collapses the column and the detail together.
    expect(summaries()!.getAttribute("aria-expanded")).toBe("true");
    await h.click(summaries()!);
    await h.advance(400);
    expect(columnOpen()).toBe(false);
    expect(detailOpen()).toBe(false);
    // Opening restores both: the detail where it was.
    await h.click(summaries()!);
    await h.advance(400);
    expect(columnOpen()).toBe(true);
    expect(detailOpen()).toBe(true);
    // The detail's own close closes only the detail.
    await h.click(h.container.querySelector<HTMLElement>('[data-slot=reference-slide-over] button[aria-label^="Close "]')!);
    await h.advance(400);
    expect(detailOpen()).toBe(false);
    expect(columnOpen()).toBe(true);
    // Collapsed, then a detail opened from its button: the right side opens with it.
    await h.click(summaries()!);
    expect(columnOpen()).toBe(false);
    await h.click(details());
    await h.advance(400);
    expect(columnOpen()).toBe(true);
    expect(detailOpen()).toBe(true);
  });

  it("AI display panel: the record header's right toggle opens and closes the docked AI panel (P-LAYOUT-F1 A1)", async () => {
    await open({ displayLocation: "panel", canvasLayout: "twoColumn" });
    await CASES.noah();
    const toggle = () => h.container.querySelector<HTMLElement>('[data-slot=record-header] button[aria-label="Details panel"]')!;
    const shown = () => h.container.querySelector("[data-slot=right-panel]")?.getAttribute("data-open") === "true";
    const before = shown();
    expect(toggle().getAttribute("aria-expanded")).toBe(String(before));
    await h.click(toggle());
    expect(shown()).toBe(!before);
    expect(toggle().getAttribute("aria-expanded")).toBe(String(!before));
    await h.click(toggle());
    expect(shown()).toBe(before);
  });

  it("stacked never shows the toggle", async () => {
    await open({ displayLocation: "main", canvasLayout: "stacked" });
    await CASES.noah();
    await fits(false);
    expect(summaries()).toBeNull();
  });
});
