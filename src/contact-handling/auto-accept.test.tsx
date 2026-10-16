// @vitest-environment jsdom
// Digital assignments load as cards (user, 2026-10-16): a chat, email, SMS or
// WhatsApp offer is accepted by the workspace itself; only an inbound call
// rings for Accept / Decline.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

async function stateOf(id: string) {
  let state: string | undefined;
  await act(async () => {
    const snapshot = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    state = (await snapshot).interactions.find((i) => i.id === id)?.state;
  });
  return state;
}

describe("digital offers load as cards", () => {
  it("an inbound chat goes live and shows as a card without an accept", async () => {
    await act(async () => getSettingsStore().update("channels", { chat: true }));
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    const id = await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz");
    await h.advance(500);
    expect(await stateOf(id)).toBe("active");
    expect(h.navCard("Dan Ortiz")).toBeTruthy();
  });

  it("an inbound call still rings: it stays offered until the agent accepts", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    const id = await h.startInbound("voice", "(312) 555-0164", "Lauren Briggs");
    await h.advance(500);
    expect(await stateOf(id)).toBe("offered");
  });
});
