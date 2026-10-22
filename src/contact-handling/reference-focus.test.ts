// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { focusReferenceCard, setReferenceCardOpen } from "./reference-cards";
import { createWorkspaceUiStore } from "./workspace-ui-store";

// P-CANVAS: the reference column is a single-open accordion the AI focuses.
// A manual header click wins over AI focus until the guidance step advances.

const CARD = "card-1";
const stateOf = (store: ReturnType<typeof createWorkspaceUiStore>) => store.getState().referenceFocusByCard[CARD];

describe("focusReferenceCard", () => {
  it("opens one card (closing the others) and highlights it", () => {
    const store = createWorkspaceUiStore();
    focusReferenceCard(store, CARD, "customer", "s1", 5_000);
    expect(stateOf(store)).toEqual({ open: "customer", highlight: { card: "customer", at: 5_000 } });
    focusReferenceCard(store, CARD, "journey", "s2", 6_000);
    expect(stateOf(store)).toEqual({ open: "journey", highlight: { card: "journey", at: 6_000 } });
  });

  it("a manual click blocks AI focus until the step advances", () => {
    const store = createWorkspaceUiStore();
    setReferenceCardOpen(store, CARD, "journey", true, "s1");
    expect(stateOf(store)).toEqual({ open: "journey", manualStepId: "s1" });
    focusReferenceCard(store, CARD, "customer", "s1");
    expect(stateOf(store)!.open).toBe("journey");
    // The step advanced: the AI may focus again, and the manual mark is gone.
    focusReferenceCard(store, CARD, "customer", "s2");
    expect(stateOf(store)!.open).toBe("customer");
    expect(stateOf(store)!.manualStepId).toBeUndefined();
  });

  it("closing the open card by hand leaves none open; closing another leaves it", () => {
    const store = createWorkspaceUiStore();
    setReferenceCardOpen(store, CARD, "summary", false, "s1");
    expect(stateOf(store)!.open).toBeNull();
    setReferenceCardOpen(store, CARD, "journey", true, "s1");
    setReferenceCardOpen(store, CARD, "customer", false, "s1");
    expect(stateOf(store)!.open).toBe("journey");
  });

  it("other cards are untouched", () => {
    const store = createWorkspaceUiStore();
    focusReferenceCard(store, "other", "journey", "s1");
    expect(stateOf(store)).toBeUndefined();
  });
});
