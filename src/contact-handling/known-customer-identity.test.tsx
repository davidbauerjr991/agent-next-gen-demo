// @vitest-environment jsdom
// P-EXTRACT, Bug 3: "Link to existing customer" instead of the Save-address
// card. Whether a card is a known customer was a function of its scripted
// contact's lifetime (Maya Chen counted as known only while her call was
// live), and the save-address offer needed a directory entity, which Maya
// has none of. "Known customer" is now a fact on the card, and an added
// address is kept for the card when there's no entity.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import type { Interaction, InteractionId } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { resetContactMethodsForTests } from "./contact-methods";

const h = createWorkspaceHarness();
const MAYA = "maya-chen-refund-call";
const NEW_NUMBER = "(212) 555-0177";

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetContactMethodsForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const headerPlus = () => h.container.querySelector<HTMLElement>("[data-slot=header-add-channel] button")!;
const saveCard = () => h.container.querySelector("[data-slot=save-address-card]");
const linkControl = () => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Link to existing customer");
const contactDetailsButton = () =>
  [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
    (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
  );
const buttonText = (root: ParentNode, text: string | RegExp) =>
  [...root.querySelectorAll<HTMLElement>("button")].find((b) => (typeof text === "string" ? b.textContent?.trim() === text : text.test(b.textContent?.trim() ?? "")));
const radio = (label: string) =>
  [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
    (r) =>
      (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) === label ||
      r.closest("label")?.textContent?.trim() === label ||
      r.getAttribute("value") === label.toLowerCase(),
  );
async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function snapshot() {
  let result: Interaction[] = [];
  await act(async () => {
    const s = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    result = (await s).interactions;
  });
  return result;
}

/** Maya's scripted call, live, her card selected. */
async function maya() {
  await act(async () => {
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
    getSettingsStore().update("ai", { displayLocation: "inline" });
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.play(MAYA);
  await h.advance(3_000);
  await h.click(h.navCard("Maya Chen"));
}

/** The record header's "+" → a typed number → SMS → Start Interaction. */
async function addSms(number: string) {
  await h.click(headerPlus());
  await typeInto(document.body.querySelector<HTMLInputElement>('input[placeholder="Email or phone number"]')!, number);
  await h.click(buttonText(document.body, /^Continue with/)!);
  await h.click(radio("SMS")!);
  await h.click(buttonText(document.body, "Start Interaction")!);
  await h.advance(3_000);
}

async function endMayasCall() {
  const call = (await snapshot()).find((i) => i.channel === "voice" && i.contactName === "Maya Chen" && i.state !== "ended")!;
  expect(call).toBeTruthy();
  await act(async () => {
    const ended = h.provider.end(call.id as InteractionId);
    await vi.advanceTimersByTimeAsync(300);
    await ended;
  });
  // Wrap-up done: the call is ended, the card lives on through its SMS thread.
  await act(async () => {
    const done = h.provider.completeWrapUp(call.id as InteractionId, { dispositionCode: "resolved", tags: [], summary: "" });
    await vi.advanceTimersByTimeAsync(300);
    await done;
  });
  await h.advance(500);
}

async function showContactDetails() {
  if (h.container.querySelector("[data-slot=right-panel]")?.getAttribute("data-open") !== "true") {
    const button = contactDetailsButton();
    if (button) await h.click(button);
  }
}

describe("Bug 3: a scripted case is a known customer for the card's whole life", () => {
  it("live call: no Link control (passes on HEAD; a guard)", async () => {
    await maya();
    await showContactDetails();
    expect(linkControl()).toBeUndefined();
  });

  // Failed before P-EXTRACT C8a (the bug), as `it.fails`; flipped in C8a.
  it("after the call ends, on the card's SMS thread: still no Link control", async () => {
    await maya();
    await addSms(NEW_NUMBER);
    await endMayasCall();
    await h.click(h.navCard("Maya Chen"));
    await showContactDetails();
    expect(linkControl()).toBeUndefined();
  });

  it("a new number for Maya (no directory entity) offers the Save-address card; Add makes it hers in the next \"+\"", async () => {
    await maya();
    await addSms(NEW_NUMBER);
    expect(saveCard()?.textContent).toContain(`Add ${NEW_NUMBER} as a phone number for Maya Chen?`);
    await h.click(buttonText(saveCard()!, "Add")!);
    expect(saveCard()?.textContent).toContain("Added to Maya Chen");
    await h.click(headerPlus());
    await h.click(radio("WhatsApp")!);
    const phone = [...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')].find((c) => c.textContent?.includes(NEW_NUMBER));
    expect(phone).toBeTruthy();
  });
});

describe("Bug 3: a card with no identity", () => {
  it("an ad-hoc card's second number offers Add or Link to existing customer", async () => {
    await act(async () => {
      getSettingsStore().update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await act(async () => {
      const dialed = h.provider.dial({ channel: "sms", address: "(161) 474-9179", skillId: "general" });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    await h.click(h.navCard("(161) 474-9179"));
    await addSms(NEW_NUMBER);
    const card = saveCard();
    expect(card).not.toBeNull();
    expect(buttonText(card!, "Add")).toBeTruthy();
    expect(buttonText(card!, "Link to existing customer")).toBeTruthy();
  });
});
