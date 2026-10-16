// @vitest-environment jsdom
// P-AIFIRST (i): presence disables, with the reason, what the agent's own
// state blocks; it never hides a control. Routing's gate is in channels.test.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { profileValues } from "@/settings/profiles";
import { AddChannelAdHocButton } from "@/components/agent-next-gen-add-channel-button";
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

/** A radio option by its label (a lyra `RadioGroupItem`: a <label> around the radio). */
const radio = (label: string) =>
  [...document.body.querySelectorAll<HTMLElement>("label")]
    .filter((l) => l.querySelector('[role="radio"]'))
    .find((l) => l.textContent?.trim() === label)
    ?.querySelector<HTMLButtonElement>('[role="radio"]');
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

  it("New Outbound's Dial Pad: Dial Number shown but disabled with \"Go Available to call\" until Available", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const launcher = [...h.container.querySelectorAll<HTMLElement>("aside button")].find((b) => b.textContent?.includes("New Outbound"))!;
    await h.click(launcher);
    const dial = () => h.buttonByText("Dial Number")!;
    expect(dial().hasAttribute("disabled")).toBe(true);
    expect(dial().closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(UNAVAILABLE_CALL_TOOLTIP);
    await h.goAvailable();
    expect(dial().closest("[data-disabled-reason]")).toBeNull();
  });

  it("the Customers table picker: Voice listed but disabled with the reason; Start Interaction too; email stays open", async () => {
    await act(async () => getSettingsStore().updateMany(profileValues("phase2")));
    await h.show(AgentWorkspaceAdvancedPage);
    const tab = [...h.container.querySelectorAll<HTMLElement>('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!;
    await h.click(tab);
    await h.click(h.container.querySelector<HTMLElement>('table [title="Voice"], table [aria-label="Voice"]')!);
    expect(radio("Voice")!.disabled).toBe(true);
    expect(radio("Voice")!.closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(UNAVAILABLE_CALL_TOOLTIP);
    expect(h.buttonByText("Start Interaction")!.closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(UNAVAILABLE_CALL_TOOLTIP);
    expect(radio("Email")!.disabled).toBe(false);
  });

  it("the ad-hoc \"+\": a typed number offers Voice disabled with the reason, SMS open", async () => {
    await h.render(<AddChannelAdHocButton onLaunch={() => {}} skillOptions={[{ value: "general", label: "General" }]} />);
    await act(async () => {
      const set = h.provider.setAgentState("unavailable");
      await vi.advanceTimersByTimeAsync(100);
      await set;
    });
    await h.click(h.container.querySelector<HTMLElement>("button")!);
    const input = document.body.querySelector<HTMLInputElement>('input[placeholder="Email or phone number"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "(312) 555-0164");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await h.click([...document.body.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith("Continue with"))!);
    expect(radio("Voice")!.disabled).toBe(true);
    expect(radio("Voice")!.closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(UNAVAILABLE_CALL_TOOLTIP);
    expect(radio("SMS")!.disabled).toBe(false);
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
