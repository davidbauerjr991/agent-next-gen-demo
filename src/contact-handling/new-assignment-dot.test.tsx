// @vitest-environment jsdom
// The new-assignment dot on a nav card follows the card's answer/awaiting
// SLA tier (green within target, amber at warning, red once breached) —
// the same tier as its timer and outline (lyra 119e9aa newAssignmentSeverity).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";

const h = createWorkspaceHarness();

beforeEach(() => h.setUp());
afterEach(async () => {
  await h.tearDown();
});

/** The dot's tier, read from the dot's own color; its ping ring (lyra
 *  `Badge pulse`, since b199ec9) inherits that background. */
function dotTier(name: string): string | undefined {
  const dot = h.navCard(name).closest("aside")!.querySelector('[aria-label="New assignment"]');
  if (!dot?.querySelector(".animate-ping")) return undefined;
  return dot.className.match(/bg-lyra-status-(success|warning|critical)-strong/)?.[1];
}

describe("new-assignment dot", () => {
  it("an unselected ringing card's dot is success at 0s, warning at 6s, critical at 11s", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.startInbound("voice", "(312) 555-0164", "Lauren Briggs");
    expect(h.navCard("Lauren Briggs").getAttribute("aria-label")).toContain("new assignment");
    expect(dotTier("Lauren Briggs")).toBe("success");
    await h.advance(6000);
    expect(dotTier("Lauren Briggs")).toBe("warning");
    await h.advance(5000);
    expect(dotTier("Lauren Briggs")).toBe("critical");
  });
});
