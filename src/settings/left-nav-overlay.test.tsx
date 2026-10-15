// @vitest-environment jsdom
// The responsive (overlay) left nav expands as a whole on hover, the way
// lyra's "Agent Next Gen Left Nav" story does: full InteractionNavItem cards,
// the full "New Outbound" button and the labeled Home/Settings rail, never a
// mix of expanded and collapsed pieces.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";

const h = createWorkspaceHarness();

// Every box measures 700px wide: under Advanced's 768px nav breakpoint, so
// LeftNav runs in overlay mode (collapsed rail, hover to expand).
const harnessRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  return { ...harnessRect.call(this), width: 700, right: 700 } as DOMRect;
};

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const aside = () => h.container.querySelector("aside")!;
const chatRows = () =>
  [...aside().querySelectorAll("button[aria-label]")].filter((el) => el.getAttribute("aria-label")!.startsWith("Chat channel"));
/** Visible text: collapsed lyra pieces keep their label element in the DOM
 *  but hide it (`aria-hidden="true"` on the label, zero width) — those don't
 *  count. */
const hasText = (text: string) =>
  [...aside().querySelectorAll("*")].some(
    (el) => el.children.length === 0 && el.textContent?.trim() === text && el.getAttribute("aria-hidden") !== "true",
  );

async function hover(enter: boolean) {
  await act(async () => {
    aside().dispatchEvent(
      new MouseEvent(enter ? "mouseover" : "mouseout", { bubbles: true, relatedTarget: enter ? document.body : null }),
    );
    await vi.advanceTimersByTimeAsync(enter ? 50 : 400);
  });
}

describe.each([
  ["default layout", {}],
  ["New Outbound at the bottom", { newOutboundAtBottom: true }],
])("responsive left nav, %s", (_name, assignments) => {
  it("collapsed shows compact tiles; hovering expands every piece at once", async () => {
    await act(async () => {
      getSettingsStore().update("assignments", assignments);
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.accept(await h.startInbound("chat", "priya.shah@example.com", "Priya Shah"));

    // Collapsed: the card is a compact tile (no channel rows), no labels.
    expect(chatRows()).toHaveLength(0);
    expect(hasText("New Outbound")).toBe(false);
    expect(hasText("Settings")).toBe(false);

    await hover(true);
    // The full InteractionNavItem (its channel rows), the full launcher, and
    // the rail with labels.
    expect(chatRows()).toHaveLength(1);
    expect(hasText("New Outbound")).toBe(true);
    expect(hasText("Home")).toBe(true);
    expect(hasText("Settings")).toBe(true);

    await hover(false);
    expect(chatRows()).toHaveLength(0);
  });
});
