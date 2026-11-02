// @vitest-environment jsdom
// (the module pulls in canvas-registry and the working state, which load lyra.)
import { describe, expect, it, vi } from "vitest";

// The row width is the workspace UI store's; a fixed one stands in (no provider tree).
vi.mock("./workspace-ui-store", () => ({ useWorkspaceUiField: () => [1500, () => {}] }));
import { LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "./canvas-registry";
import { clampReferenceWidth, referenceColumnBounds } from "./reference-column-width";

describe("the right column's width (P-LAYOUT-F4 19)", () => {
  it("is the card width until dragged, and never below it", () => {
    const bounds = referenceColumnBounds(1500);
    expect(clampReferenceWidth(null, bounds)).toBe(LYRA_CARD_MAX_WIDTH);
    expect(clampReferenceWidth(200, bounds)).toBe(LYRA_CARD_MAX_WIDTH);
    expect(clampReferenceWidth(500, bounds)).toBe(500);
  });

  it("never leaves the action area less than its minimum", () => {
    const bounds = referenceColumnBounds(1000);
    expect(bounds.max).toBe(1000 - ACTION_AREA_MIN_WIDTH);
    expect(clampReferenceWidth(900, bounds)).toBe(1000 - ACTION_AREA_MIN_WIDTH);
    // A row too narrow for more than the card width still has the card width.
    expect(referenceColumnBounds(700).max).toBe(LYRA_CARD_MAX_WIDTH);
  });
});

describe("a drag is previewed and written once (P-LAYOUT-F4 22b)", () => {
  it("preview keeps the width in a ref, with no working-state write, until commit", async () => {
    const { createRoot } = await import("react-dom/client");
    const { act, createElement } = await import("react");
    const { useReferenceColumnWidth } = await import("./reference-column-width");
    const { useAssignmentsWorkingState, resetAssignmentsWorkingStateForTests } = await import("./assignments-working-state");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    resetAssignmentsWorkingStateForTests();
    let api!: ReturnType<typeof useReferenceColumnWidth>;
    let stored: number | null = null;
    let renders = 0;
    const Probe = () => {
      api = useReferenceColumnWidth();
      stored = useAssignmentsWorkingState().referenceWidth;
      renders++;
      return null;
    };
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe)));
    const before = renders;
    for (const w of [400, 420, 450]) api.preview(w);
    expect(renders).toBe(before);
    expect(stored).toBeNull();
    await act(async () => api.commit());
    expect(stored).toBe(450);
    // A second commit with nothing previewed writes nothing.
    const after = renders;
    await act(async () => api.commit());
    expect(renders).toBe(after);
    await act(async () => root.unmount());
  });
});
