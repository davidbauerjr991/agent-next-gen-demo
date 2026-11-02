// @vitest-environment jsdom
// (the module pulls in canvas-registry and the working state, which load lyra.)
import { describe, expect, it } from "vitest";
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
