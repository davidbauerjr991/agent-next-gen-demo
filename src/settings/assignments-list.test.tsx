// @vitest-environment jsdom
// The assignments list (P-PROFILES 0b): the sort is a setting, a drag (here
// its keyboard form, Ctrl+Shift+Arrow) switches it to Custom with the order
// kept per browser, new cards land on top, and the channel chips follow
// `assignments.channelChips`.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { resetAssignmentsWorkingStateForTests } from "@/contact-handling/assignments-working-state";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetAssignmentsWorkingStateForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const store = () => getSettingsStore();
const cardEls = () => [...h.container.querySelectorAll<HTMLElement>("aside [data-slot=assignment-card]")];
const cardNames = () => cardEls().map((el) => el.getAttribute("data-reorder-key"));

async function threeChats() {
  await act(async () => {
    store().update("channels", { chat: true });
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  const ids = [];
  for (const [address, name] of [
    ["ana@example.com", "Ana Ruiz"],
    ["ben@example.com", "Ben Ito"],
    ["cy@example.com", "Cy Park"],
  ]) {
    const id = await h.startInbound("chat", address, name);
    await h.accept(id);
    await h.advance(1000);
    ids.push(id as string);
  }
  return ids;
}

async function move(cardIndex: number, key: "ArrowUp" | "ArrowDown") {
  await act(async () => {
    cardEls()[cardIndex].dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey: true, bubbles: true }));
    await vi.advanceTimersByTimeAsync(50);
  });
}

describe("assignment sort modes", () => {
  it("Last updated (newest first) is the default; the sort lives in settings", async () => {
    await threeChats();
    expect(cardEls()).toHaveLength(3);
    expect(store().getState().values.assignments.sort).toEqual({ mode: "lastUpdated", direction: "desc" });
    const before = cardNames();
    await act(async () => {
      store().update("assignments", { sort: { mode: "lastUpdated", direction: "asc" } });
    });
    expect(cardNames()).toEqual([...before].reverse());
  });

  it("moving a card switches to Custom with the order on screen; a new card lands on top", async () => {
    await threeChats();
    const [first, second, third] = cardNames();
    await move(0, "ArrowDown");
    expect(cardNames()).toEqual([second, first, third]);
    expect(store().getState().values.assignments.sort.mode).toBe("custom");
    // Kept per browser, not in settings.
    expect(localStorage.getItem("agent-next-gen:working:assignments")).toContain(first!);

    const fresh = await h.startInbound("chat", "dee@example.com", "Dee Moss");
    await h.accept(fresh);
    await h.advance(1000);
    const after = cardNames();
    expect(after).toHaveLength(4);
    expect([first, second, third]).not.toContain(after[0]);
    expect(after.slice(1)).toEqual([second, first, third]);
  });
});

describe("channel chips", () => {
  /** The visible "Chat" pill on the card's rows. */
  const chips = () =>
    [...h.container.querySelectorAll("aside [data-slot=assignment-card] span")].filter(
      (el) => el.textContent === "Chat" && !el.classList.contains("sr-only"),
    );
  const srChat = () => [...h.container.querySelectorAll("aside [data-slot=assignment-card] .sr-only")].filter((el) => el.textContent === "Chat");

  it("show by default in the left nav; hide removes them; the channel name stays for screen readers", async () => {
    await act(async () => {
      store().update("channels", { chat: true });
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.accept(await h.startInbound("chat", "ana@example.com", "Ana Ruiz"));
    await h.advance(1000);
    expect(chips()).toHaveLength(1);
    expect(srChat()).toHaveLength(0);

    await act(async () => {
      store().update("assignments", { channelChips: "hide" });
    });
    expect(chips()).toHaveLength(0);
    expect(srChat()).toHaveLength(1);

    // "auto" shows them in the left nav (the interior panel hides them).
    await act(async () => {
      store().update("assignments", { channelChips: "auto" });
    });
    expect(chips()).toHaveLength(1);
  });
});
