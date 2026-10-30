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

describe("Assignments placement → Interior panel (0c; lyra SidePanel left since P-LAYOUT)", () => {
  const panel = () => h.container.querySelector<HTMLElement>("[data-slot=assignments-panel]");
  /** The rail's Assignments item: the expanded rail is a TreeMenu (a text
   *  label, then the badge's count); collapsed, an icon button named "Assignments, N". */
  const railItem = () =>
    [...h.container.querySelectorAll<HTMLElement>("aside button")].find(
      (b) => b.getAttribute("aria-label")?.startsWith("Assignments") || /^Assignments\d*$/.test(b.textContent?.trim() ?? ""),
    ) ?? null;
  const panelChips = () =>
    [...(panel()?.querySelectorAll("[data-slot=assignment-card] span") ?? [])].filter(
      (el) => el.textContent === "Chat" && !el.classList.contains("sr-only"),
    );

  async function inPanel() {
    await act(async () => {
      store().update("channels", { chat: true });
      store().update("assignments", { placement: "interiorPanel" });
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.accept(await h.startInbound("chat", "ana@example.com", "Ana Ruiz"));
    await h.advance(1000);
  }

  it("the cards move from the left nav into a docked left SidePanel, the content card's first child (P-LAYOUT fix (a))", async () => {
    await inPanel();
    expect(panel()).not.toBeNull();
    expect(panel()!.getAttribute("data-docked")).toBe("true");
    expect(panel()!.querySelectorAll("[data-slot=assignment-card]")).toHaveLength(1);
    expect(h.container.querySelectorAll("aside [data-slot=assignment-card]")).toHaveLength(0);
    // Inside the content card, before the content column (supersedes P-HOME-1n's panel outside it, 0819bfa).
    const card = panel()!.closest("[data-slot=content-card]");
    expect(card).not.toBeNull();
    const header = card!.querySelector("[data-slot=record-header], [data-home-layout]");
    expect(header).not.toBeNull();
    expect(panel()!.compareDocumentPosition(header!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // "auto" hides the channel chip in the panel.
    expect(panelChips()).toHaveLength(0);
  });

  it("\"auto\" chips: hidden in the interior panel, shown at the top of Home (there's room there; P-HOME-1n)", async () => {
    await act(async () => {
      store().update("channels", { chat: true });
      store().update("assignments", { placement: "none" });
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.accept(await h.startInbound("chat", "ana@example.com", "Ana Ruiz"));
    await h.advance(1000);
    await h.click([...h.container.querySelectorAll<HTMLElement>("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!);
    const stackChips = [...h.container.querySelectorAll("[data-slot=assignments-stack][data-mount=homeTop] [data-slot=assignment-card] span")].filter(
      (el) => el.textContent === "Chat" && !el.classList.contains("sr-only"),
    );
    expect(stackChips.length).toBeGreaterThan(0);
  });

  it("docked: no rail item; its pin unpins it to an overlay, its close hides it and the toggle brings it back; resizable (P-LAYOUT fix (a))", async () => {
    await inPanel();
    expect(railItem()).toBeNull();
    const button = (label: RegExp) => [...h.container.querySelectorAll<HTMLButtonElement>("button")].find((b) => label.test(b.getAttribute("aria-label") ?? ""));
    const toggle = () => h.container.querySelector("[data-slot=assignments-panel-toggle] button");
    // Resizable, no narrower than the card width (SidePanel's own 200 would crush the cards).
    expect(panel()!.querySelector("[role=separator]")!.getAttribute("aria-valuemin")).toBe("350");
    expect(toggle()).toBeNull();
    // Unpinned: SidePanel's overlay, so the rail item and the toggle show; pinned again, it pushes once more.
    await h.click(button(/^Unpin panel$/)!);
    expect(panel()!.getAttribute("data-docked")).toBeNull();
    expect(railItem()).not.toBeNull();
    await h.click(button(/^Pin panel$/)!);
    expect(panel()!.getAttribute("data-docked")).toBe("true");
    // Closed: the toggle at the content card's top start reopens it, docked.
    await h.click(button(/^Close panel$/)!);
    expect(panel()!.getAttribute("data-docked")).toBeNull();
    expect(toggle()!.getAttribute("aria-expanded")).toBe("false");
    await h.click(toggle() as HTMLElement);
    expect(panel()!.getAttribute("data-docked")).toBe("true");
  });

  it("its width comes from the working state, clamped to 350–425; a resize is saved there", async () => {
    localStorage.setItem("agent-next-gen:working:assignments", JSON.stringify({ panelWidth: 900 }));
    await inPanel();
    const separator = () => panel()!.querySelector<HTMLElement>("[role=separator]")!;
    expect(separator().getAttribute("aria-valuenow")).toBe("425");
    await act(async () => {
      separator().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    const resized = Number(separator().getAttribute("aria-valuenow"));
    expect(resized).toBeLessThan(425);
    await h.advance(500);
    expect(JSON.parse(localStorage.getItem("agent-next-gen:working:assignments")!).panelWidth).toBe(resized);
  });

  it("where it doesn't fit, pinned is an overlay that starts closed; unpinning and pinning again keep a shown panel shown", async () => {
    // Every element measures 600px wide: less than the panel and the action area's minimum, so it doesn't fit.
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 600, height: 800, x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 800, toJSON: () => ({}) } as DOMRect);
    try {
      await inPanel();
      const button = (label: RegExp) => [...h.container.querySelectorAll<HTMLButtonElement>("button")].find((b) => label.test(b.getAttribute("aria-label") ?? ""));
      const toggle = () => h.container.querySelector<HTMLElement>("[data-slot=assignments-panel-toggle] button");
      expect(panel()!.getAttribute("data-docked")).toBeNull();
      // Closed: the toggle shows. Opened, it's the overlay (the toggle's button goes while it's shown).
      expect(toggle()).not.toBeNull();
      await h.click(toggle()!);
      expect(toggle()).toBeNull();
      await h.click(button(/^Unpin panel$/)!);
      expect(toggle()).toBeNull();
      await h.click(button(/^Pin panel$/)!);
      expect(toggle()).toBeNull();
      expect(panel()!.getAttribute("data-docked")).toBeNull();
    } finally {
      rect.mockRestore();
    }
  });

  it("off again: the cards are back in the left nav and the rail item goes", async () => {
    await inPanel();
    await act(async () => {
      store().update("assignments", { placement: "leftNav" });
    });
    expect(panel()).toBeNull();
    expect(railItem()).toBeNull();
    expect(h.container.querySelectorAll("aside [data-slot=assignment-card]")).toHaveLength(1);
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

describe("sort popover", () => {
  it("offers sort modes and direction, no channel chips control (that stays a setting)", async () => {
    await threeChats();
    await h.click(h.container.querySelector('aside [aria-label^="Sort by"]')!);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Custom");
    expect(text).not.toContain("Show channel chips");
  });
});

describe("collapsed list keeps only the active card open", () => {
  const labeled = (...labels: string[]) =>
    h.container.querySelectorAll(labels.flatMap((l) => [`aside [title="${l}"]`, `aside [aria-label="${l}"]`]).join(", "));
  const openCount = () => labeled("Collapse channels").length;
  const closedCount = () => labeled("Expand channels").length;
  const bulk = () => h.container.querySelector('aside [aria-label="Collapse all"], aside [aria-label="Expand all"]')!;

  it("Collapse all leaves the active card open; selecting another opens it and closes the previous; Expand all opens everything", async () => {
    await threeChats();
    await h.click(h.navCard("Cy Park"));
    await h.click(bulk());
    expect(openCount()).toBe(1);
    expect(closedCount()).toBe(2);

    await h.click(h.navCard("Ana Ruiz"));
    expect(openCount()).toBe(1);
    expect(closedCount()).toBe(2);
    const open = () => labeled("Collapse channels")[0].closest("[data-slot=assignment-card]");
    expect(open()?.textContent).toContain("Ana Ruiz");

    await h.click(bulk());
    expect(openCount()).toBe(3);
    expect(closedCount()).toBe(0);
  });

  it("survives collapsing the nav to the rail and expanding it, and the placement swap leftNav → interior → leftNav", async () => {
    await threeChats();
    await h.click(h.navCard("Cy Park"));
    await h.click(bulk());
    expect(openCount()).toBe(1);

    const toggleNav = () => h.container.querySelector<HTMLElement>('aside [aria-label="Collapse sidebar"], aside [aria-label="Expand sidebar"]')!;
    await h.click(toggleNav());
    await h.click(toggleNav());
    expect(openCount()).toBe(1);
    expect(closedCount()).toBe(2);
    expect(bulk().getAttribute("aria-label")).toBe("Expand all");

    const anywhere = (label: string) => h.container.querySelectorAll(`[title="${label}"], [aria-label="${label}"]`).length;
    await act(async () => {
      store().update("assignments", { placement: "interiorPanel" });
    });
    expect(anywhere("Collapse channels")).toBe(1);
    expect(anywhere("Expand channels")).toBe(2);
    await act(async () => {
      store().update("assignments", { placement: "leftNav" });
    });
    expect(openCount()).toBe(1);
    expect(closedCount()).toBe(2);
    expect(bulk().getAttribute("aria-label")).toBe("Expand all");
  });
});
