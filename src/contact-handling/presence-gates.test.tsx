// @vitest-environment jsdom
// P-AIFIRST (i): presence disables, with the reason, what the agent's own
// state blocks; it never hides a control. Routing's gate is in channels.test.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { UNAVAILABLE_CALL_TOOLTIP, UNAVAILABLE_REPLY_REASON } from "./presence-gates";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

/** Picks a status from the header's agent menu, the way an agent does. */
async function pickStatus(label: string) {
  await h.click(h.container.querySelector<HTMLElement>('button[aria-label^="Agent Status and More"]')!);
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')].find((el) => el.textContent?.trim() === label);
  expect(item, `a "${label}" status`).toBeDefined();
  await h.click(item!);
  await h.advance(200);
}

const chatInput = () => h.container.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Type a message"]');
const blocked = () => h.container.querySelector("[data-slot=reply-blocked]");

describe("presence gates", () => {
  it("a live chat's composer stays, disabled, under the notification while Unavailable; the transcript stays", async () => {
    await act(async () => getSettingsStore().update("channels", { chat: true }));
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.accept(await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz"));
    await h.click(h.navCard("Dan Ortiz"));
    expect(chatInput()!.disabled).toBe(false);
    expect(blocked()).toBeNull();

    await pickStatus("Unavailable");
    expect(blocked()?.textContent).toContain(UNAVAILABLE_REPLY_REASON);
    expect(chatInput()!.disabled).toBe(true);
    expect(h.buttonByText("Send", h.container)!.hasAttribute("disabled")).toBe(true);
    expect(h.container.querySelector<HTMLButtonElement>('button[aria-label="Quick replies"]')!.disabled).toBe(true);
    // Nothing hidden: the card and its transcript are still there.
    expect(h.navCard("Dan Ortiz")).toBeTruthy();
    expect(h.container.querySelector("[data-slot=content-stack]")).toBeTruthy();

    await pickStatus("Available");
    expect(blocked()).toBeNull();
    expect(chatInput()!.disabled).toBe(false);
  });

  it("Contact History's Redial: shown but disabled with \"Go Available to call\" until Available", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const nathan = [...h.container.querySelectorAll('[role="button"]')].find((el) => el.textContent?.includes("Nathan Cole"))!;
    await h.click(nathan as HTMLElement);
    const redial = () => h.buttonByText("Redial")!;
    expect(redial().hasAttribute("disabled")).toBe(true);
    expect(redial().closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(UNAVAILABLE_CALL_TOOLTIP);
    await h.goAvailable();
    expect(redial().hasAttribute("disabled")).toBe(false);
    expect(redial().closest("[data-disabled-reason]")).toBeNull();
  });
});
