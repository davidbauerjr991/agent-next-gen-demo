// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { focusReferenceCard, setReferenceCardOpen } from "./reference-cards";
import { assignmentIdFor } from "@/domain";
import { assignmentReferenceOf, createWorkspaceUiStore } from "./workspace-ui-store";

// P-CANVAS: any number of reference cards may be open. The agent's opens are
// additive; AI focus opens its target and collapses only cards the AI opened
// earlier. A manual header click wins over AI focus until the step advances.

const CARD = "card-1";
const stateOf = (store: ReturnType<typeof createWorkspaceUiStore>) => store.getState().referenceByAssignment[assignmentIdFor(CARD)]?.cards;

describe("the reference column's open cards", () => {
  it("every card starts collapsed (P-HOME-1g)", () => {
    const store = createWorkspaceUiStore();
    expect(assignmentReferenceOf(store.getState(), CARD).cards).toEqual({ open: {} });
  });

  it("AI focus opens its target, collapses the card the AI opened before, and highlights it", () => {
    const store = createWorkspaceUiStore();
    focusReferenceCard(store, CARD, "customer", "s1", 5_000);
    expect(stateOf(store)).toEqual({ open: { customer: "ai" }, highlight: { card: "customer", at: 5_000 } });
    focusReferenceCard(store, CARD, "journey", "s2", 6_000);
    expect(stateOf(store)).toEqual({ open: { journey: "ai" }, highlight: { card: "journey", at: 6_000 } });
  });

  it("a manual open keeps the previous open; AI focus leaves user-opened cards open", () => {
    const store = createWorkspaceUiStore();
    focusReferenceCard(store, CARD, "summary", "s0");
    setReferenceCardOpen(store, CARD, "journey", true, "s1");
    expect(stateOf(store)!.open).toEqual({ summary: "ai", journey: "user" });
    focusReferenceCard(store, CARD, "customer", "s2");
    expect(stateOf(store)!.open).toEqual({ journey: "user", customer: "ai" });
    // Focusing a card the agent opened keeps it theirs.
    focusReferenceCard(store, CARD, "journey", "s3");
    expect(stateOf(store)!.open).toEqual({ journey: "user" });
  });

  it("a manual click blocks AI focus until the step advances", () => {
    const store = createWorkspaceUiStore();
    setReferenceCardOpen(store, CARD, "journey", true, "s1");
    focusReferenceCard(store, CARD, "customer", "s1");
    expect(stateOf(store)!.open).toEqual({ journey: "user" });
    focusReferenceCard(store, CARD, "customer", "s2");
    expect(stateOf(store)!.open).toEqual({ journey: "user", customer: "ai" });
    expect(stateOf(store)!.manualStepId).toBeUndefined();
  });

  it("a manual close of an AI-opened card counts as the agent's choice for that step", () => {
    const store = createWorkspaceUiStore();
    focusReferenceCard(store, CARD, "summary", "s0");
    setReferenceCardOpen(store, CARD, "summary", false, "s1");
    expect(stateOf(store)).toEqual({ open: {}, manualStepId: "s1" });
    focusReferenceCard(store, CARD, "summary", "s1");
    expect(stateOf(store)!.open).toEqual({});
  });

  it("other cards are untouched", () => {
    const store = createWorkspaceUiStore();
    focusReferenceCard(store, "other", "journey", "s1");
    expect(stateOf(store)).toBeUndefined();
  });
});
