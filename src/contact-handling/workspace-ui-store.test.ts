import { describe, expect, it, vi } from "vitest";
import { assignmentIdFor } from "@/domain";
import {
  EMPTY_ASSIGNMENT_REFERENCE,
  assignmentReferenceOf,
  createWorkspaceUiStore,
  getWorkspaceUiStore,
  INITIAL_WORKSPACE_UI_STATE,
  updateAssignmentReference,
} from "./workspace-ui-store";

describe("workspace UI store", () => {
  it("starts empty and notifies on a change, not on a no-op", () => {
    const store = createWorkspaceUiStore();
    expect(store.getState()).toBe(INITIAL_WORKSPACE_UI_STATE);
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((s) => s);
    expect(listener).not.toHaveBeenCalled();
    store.update((s) => ({ ...s, outcomeOpenFor: "card-1:chat" }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().outcomeOpenFor).toBe("card-1:chat");
  });

  it("is one store per provider: a new provider starts clean", () => {
    const providerA = {};
    const providerB = {};
    updateAssignmentReference(getWorkspaceUiStore(providerA), "card-1", (r) => ({ ...r, slideOver: { ...r.slideOver, content: { kind: "session" } } }));
    expect(assignmentReferenceOf(getWorkspaceUiStore(providerA).getState(), "card-1").slideOver.content).toEqual({ kind: "session" });
    expect(getWorkspaceUiStore(providerA)).toBe(getWorkspaceUiStore(providerA));
    expect(getWorkspaceUiStore(providerB).getState().referenceByAssignment).toEqual({});
  });

  it("keeps each assignment's reference slot apart; a new one starts with nothing open", () => {
    const store = createWorkspaceUiStore();
    updateAssignmentReference(store, "maya", (r) => ({ ...r, slideOver: { content: { kind: "session" }, fullScreen: true, width: 520 } }));
    expect(assignmentReferenceOf(store.getState(), "maya").slideOver).toEqual({ content: { kind: "session" }, fullScreen: true, width: 520 });
    expect(assignmentReferenceOf(store.getState(), "lucas")).toBe(EMPTY_ASSIGNMENT_REFERENCE);
    // Keyed on the assignment: assignmentIdFor(card key).
    expect(Object.keys(store.getState().referenceByAssignment)).toEqual([assignmentIdFor("maya")]);
  });

  it("keeps one card's entries apart from another's", () => {
    const store = createWorkspaceUiStore();
    store.update((s) => ({ ...s, revealedApprovals: new Set([...s.revealedApprovals, "card-1:approval"]) }));
    expect(store.getState().revealedApprovals.has("card-1:approval")).toBe(true);
    expect(store.getState().revealedApprovals.has("card-2:approval")).toBe(false);
    // The shared initial state is never mutated.
    expect(INITIAL_WORKSPACE_UI_STATE.revealedApprovals.size).toBe(0);
  });
});
