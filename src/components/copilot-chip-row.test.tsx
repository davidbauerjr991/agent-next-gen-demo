// @vitest-environment jsdom
// Copilot suggestion chips: one line, never wrapping; as many as fit (up to
// 3) beside an always-present refresh button that rotates the suggestions.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { InteractionComposer } from "@/components/agent-next-gen-transcript";

const h = createWorkspaceHarness();

// Widths the fit reads: the chip row, each chip's measuring copy, and the
// refresh button's wrapper. Everything else keeps the harness's size.
const CHIP_WIDTH = 120;
const REFRESH_WIDTH = 24;
let rowWidth = 1000;
const harnessRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const rect = harnessRect.call(this);
  if (this.matches("[data-slot=copilot-chips]")) return { ...rect, width: rowWidth } as DOMRect;
  if (this.matches("[data-chip-measure]")) return { ...rect, width: CHIP_WIDTH } as DOMRect;
  if (this.matches("[data-slot=copilot-chips-refresh]")) return { ...rect, width: REFRESH_WIDTH } as DOMRect;
  return rect;
};

const SUGGESTIONS = ["Summarize this conversation", "Suggest a reply", "What is the customer's history?", "Check fraud screening"];

beforeEach(() => h.setUp());
afterEach(async () => {
  await h.tearDown();
});

async function renderAt(width: number) {
  rowWidth = width;
  await h.render(<InteractionComposer copilotOnly onSend={() => {}} copilotSuggestions={SUGGESTIONS} />);
}

const row = () => h.container.querySelector("[data-slot=copilot-chips]")!;
/** The visible chips (not the invisible measuring copies). */
const chips = () => [...row().querySelectorAll(':scope > [role="button"]')].map((el) => el.textContent?.trim());
const refresh = () => row().querySelector<HTMLElement>("[data-slot=copilot-chips-refresh] button")!;

describe("Copilot chip row", () => {
  it("narrow: exactly one chip plus the refresh button; refresh swaps in the next suggestion", async () => {
    // 200 - 24 refresh - 8 gap = 168: one 120px chip fits, two (248) don't.
    await renderAt(200);
    expect(chips()).toEqual([SUGGESTIONS[0]]);
    expect(refresh()).toBeTruthy();

    await act(async () => {
      refresh().click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(chips()).toEqual([SUGGESTIONS[1]]);
  });

  it("wide: up to three chips on one line, with the refresh button", async () => {
    await renderAt(1000);
    expect(chips()).toEqual(SUGGESTIONS.slice(0, 3));
    expect(refresh()).toBeTruthy();
    expect(row().className).toContain("flex-nowrap");
    expect(row().className).not.toContain("flex-wrap ");
  });

  it("in between: as many as fit (two)", async () => {
    // 300 - 32 = 268: two chips (248) fit, three (376) don't.
    await renderAt(300);
    expect(chips()).toEqual(SUGGESTIONS.slice(0, 2));
    await act(async () => {
      refresh().click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(chips()).toEqual(SUGGESTIONS.slice(2, 4));
  });
});
