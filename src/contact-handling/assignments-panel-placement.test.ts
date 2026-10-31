// @vitest-environment jsdom
// (canvas-registry pulls in the cell components, which load lyra.)
import { describe, expect, it } from "vitest";
import { assignmentsPanelDocks, availableForAssignmentsPanel, fitsBeside } from "./assignments-panel-placement";
import { ACTION_AREA_MIN_WIDTH } from "./canvas-registry";

const CARD = 350;

describe("the assignments interior panel's dock rule (P-PROFILES 0c)", () => {
  it("docks iff the panel, the action area's minimum and the reference slot fit", () => {
    const need = CARD + ACTION_AREA_MIN_WIDTH + CARD;
    expect(assignmentsPanelDocks({ available: need, panelWidth: CARD, referenceSlotWidth: CARD })).toBe(true);
    expect(assignmentsPanelDocks({ available: need - 1, panelWidth: CARD, referenceSlotWidth: CARD })).toBe(false);
  });

  it("an open slide-over's wider slot counts; with no reference column only the action area does", () => {
    const available = CARD + ACTION_AREA_MIN_WIDTH + CARD + 100;
    expect(assignmentsPanelDocks({ available, panelWidth: CARD, referenceSlotWidth: CARD })).toBe(true);
    expect(assignmentsPanelDocks({ available, panelWidth: CARD, referenceSlotWidth: CARD + 200 })).toBe(false);
    expect(assignmentsPanelDocks({ available: CARD + ACTION_AREA_MIN_WIDTH, panelWidth: CARD, referenceSlotWidth: 0 })).toBe(true);
  });

  it("a dragged-wider panel needs more room", () => {
    const available = CARD + ACTION_AREA_MIN_WIDTH + CARD;
    expect(assignmentsPanelDocks({ available, panelWidth: CARD + 1, referenceSlotWidth: CARD })).toBe(false);
  });

  it("available: the canvas row plus the panel while docked (the row excludes it), else the content row", () => {
    const base = { regionsRowWidth: 900, referenceSlotMounted: true, contentRowWidth: 1500, panelWidth: CARD };
    expect(availableForAssignmentsPanel({ ...base, panelDocked: true })).toBe(900 + CARD);
    expect(availableForAssignmentsPanel({ ...base, panelDocked: false })).toBe(900);
    expect(availableForAssignmentsPanel({ ...base, referenceSlotMounted: false, panelDocked: true })).toBe(1500);
    // Not laid out yet (jsdom): wide enough.
    expect(availableForAssignmentsPanel({ ...base, regionsRowWidth: 0, referenceSlotMounted: false, contentRowWidth: 0, panelDocked: false })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("fitsBeside: the one fit rule for the content card's side panels (P-LAYOUT-F1 D)", () => {
  it("a panel pushes the action area while it, the action area's minimum and anything reserved fit; else it overlays", () => {
    expect(fitsBeside({ available: CARD + ACTION_AREA_MIN_WIDTH, panelWidth: CARD })).toBe(true);
    expect(fitsBeside({ available: CARD + ACTION_AREA_MIN_WIDTH - 1, panelWidth: CARD })).toBe(false);
    expect(fitsBeside({ available: CARD + ACTION_AREA_MIN_WIDTH + 100, panelWidth: CARD, reserved: 101 })).toBe(false);
  });
});
