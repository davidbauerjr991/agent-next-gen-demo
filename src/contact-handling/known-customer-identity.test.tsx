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
// What Contact Details shows for Maya: her call's number and the email it derives from her name.
const MAYA_PHONE = "(646) 555-0143";
const MAYA_EMAIL = "maya.chen@example.com";

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
/** A radio in the radio group labelled `group`. */
const radioIn = (group: string, label: string) => {
  const groupEl = [...document.body.querySelectorAll<HTMLElement>('[role="radiogroup"]')].find((g) =>
    (g.getAttribute("aria-labelledby") ? document.getElementById(g.getAttribute("aria-labelledby")!)?.textContent : g.parentElement?.textContent)?.includes(group),
  );
  return [...(groupEl?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find(
    (r) => (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) === label || r.getAttribute("value") === label.toLowerCase(),
  );
};
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

const adHocInput = () => document.body.querySelector<HTMLInputElement>('input[placeholder="Email or phone number"]');
const combobox = (text: string) => [...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')].find((c) => c.textContent?.includes(text));

/** A card with no identity: the record header's "+" is the ad-hoc box → a typed number → SMS → Start Interaction. */
async function addSms(number: string) {
  await h.click(headerPlus());
  await typeInto(adHocInput()!, number);
  await h.click(buttonText(document.body, /^Continue with/)!);
  await h.click(radio("SMS")!);
  await h.click(buttonText(document.body, "Start Interaction")!);
  await h.advance(3_000);
}

/** A known card: the record header's "+" is the channel picker → Custom → a typed number → SMS → a skill → Start Interaction. */
async function addSmsViaCustom(number: string) {
  await h.click(headerPlus());
  await h.click(radio("Custom")!);
  await typeInto(adHocInput()!, number);
  // Custom's own "Select Channel Type" SMS, not the "Select Channel" one above it.
  await h.click(radioIn("Select Channel Type", "SMS")!);
  await pickFirstSkill();
  await h.click(buttonText(document.body, "Start Interaction")!);
  await h.advance(3_000);
}

async function pickFirstSkill() {
  const skill = [...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')].find((c) => /Select Outbound Skill/i.test(c.textContent ?? ""));
  if (!skill) return;
  await h.click(skill);
  await h.click(document.body.querySelector<HTMLElement>('[role="option"]')!);
}

/** The save-address card, once its offer has landed (it's added a render after the thread is on the card). */
async function awaitSaveCard() {
  for (let i = 0; i < 40 && !saveCard(); i++) await h.advance(100);
  return saveCard();
}

/** End Call: Maya's call goes to wrap-up and her card stays (the browser repro's state). */
async function endMayasCallToWrapUp() {
  const call = (await snapshot()).find((i) => i.channel === "voice" && i.contactName === "Maya Chen" && i.state !== "ended")!;
  expect(call).toBeTruthy();
  await act(async () => {
    const ended = h.provider.end(call.id as InteractionId);
    await vi.advanceTimersByTimeAsync(300);
    await ended;
  });
  await h.advance(500);
  return call;
}

async function endMayasCall() {
  const call = await endMayasCallToWrapUp();
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
    await addSmsViaCustom(NEW_NUMBER);
    await endMayasCall();
    await h.click(h.navCard("Maya Chen"));
    await showContactDetails();
    expect(linkControl()).toBeUndefined();
  });

  // E2 item 3: the picker reads the card's contact methods (what Contact Details shows), not only a directory record.
  it("after her call ends, Maya's \"+\" is the channel picker over her number and email, not the ad-hoc box", async () => {
    await maya();
    await endMayasCallToWrapUp();
    await h.click(h.navCard("Maya Chen"));
    await h.click(headerPlus());
    expect(adHocInput()).toBeNull();
    for (const channel of ["Voice", "SMS", "WhatsApp", "Email", "Custom"]) expect(radio(channel), channel).toBeTruthy();
    await h.click(radio("SMS")!);
    expect(combobox(MAYA_PHONE)).toBeTruthy();
    await h.click(radio("Email")!);
    expect(combobox(MAYA_EMAIL)).toBeTruthy();
  });

  it("the nav card's \"+\" is the same picker", async () => {
    await maya();
    await endMayasCallToWrapUp();
    // The "+" in Maya's own nav card (the picker's trigger is "Add Outbound", the ad-hoc one's "Add Channel").
    let scope: HTMLElement | null = h.navCard("Maya Chen");
    const plusIn = (el: HTMLElement) => el.querySelector<HTMLElement>("[aria-label='Add Outbound'], [aria-label='Add Channel']");
    while (scope && !plusIn(scope)) scope = scope.parentElement;
    const navPlus = scope && !scope.matches("aside") ? plusIn(scope) : null;
    expect(navPlus).not.toBeNull();
    await h.click(navPlus!);
    expect(adHocInput()).toBeNull();
    await h.click(radio("SMS")!);
    expect(combobox(MAYA_PHONE)).toBeTruthy();
  });

  // E2 item 4: the trigger is "known card + an address not among its contact methods", whatever the entry path.
  it("a new number for Maya through the picker's Custom offers the Save-address card; Add makes it hers in the next \"+\"", async () => {
    await maya();
    await addSmsViaCustom(NEW_NUMBER);
    expect((await awaitSaveCard())?.textContent).toContain(`Add ${NEW_NUMBER} as a phone number for Maya Chen?`);
    await h.click(buttonText(saveCard()!, "Add")!);
    expect(saveCard()?.textContent).toContain("Added to Maya Chen");
    await h.click(headerPlus());
    await h.click(radio("WhatsApp")!);
    expect(combobox(MAYA_PHONE)).toBeTruthy();
    await h.click(combobox(MAYA_PHONE)!);
    expect([...document.body.querySelectorAll('[role="option"]')].some((o) => o.textContent?.includes(NEW_NUMBER))).toBe(true);
  });

  // E3: the repro. Her call in wrap-up holds no number (a new call isn't blocked), so Voice lists it, enabled.
  it("in wrap-up, \"+\" → Voice lists her number, enabled", async () => {
    await maya();
    await endMayasCallToWrapUp();
    await h.click(h.navCard("Maya Chen"));
    await h.click(headerPlus());
    expect(radio("Voice")!.disabled).toBe(false);
    await h.click(radio("Voice")!);
    expect(combobox(MAYA_PHONE)).toBeTruthy();
    await h.click(combobox(MAYA_PHONE)!);
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.includes(MAYA_PHONE))!;
    expect(option.hasAttribute("data-disabled")).toBe(false);
  });

  // E3: in her card's picker, the number with an open SMS thread stays listed, disabled "Already open"; the
  // free one is the default.
  it("an SMS thread open on her added number lists it disabled \"Already open\" in her card's picker", async () => {
    await maya();
    // SMS on the new number (through Custom), then Add it to her contact methods.
    await addSmsViaCustom(NEW_NUMBER);
    await h.click(buttonText((await awaitSaveCard())!, "Add")!);
    await h.click(headerPlus());
    expect(radio("SMS")!.disabled).toBe(false);
    await h.click(radio("SMS")!);
    expect(combobox(MAYA_PHONE), "her free number is the default").toBeTruthy();
    await h.click(combobox(MAYA_PHONE)!);
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
    const added = options.find((o) => o.textContent?.includes(NEW_NUMBER));
    expect(added, "the open number is listed").toBeTruthy();
    expect(added!.hasAttribute("data-disabled")).toBe(true);
    expect(added!.getAttribute("data-disabled-reason")).toBe("Already open");
    expect(options.find((o) => o.textContent?.includes(MAYA_PHONE))!.hasAttribute("data-disabled")).toBe(false);
  });

  it("Maya's own number through Custom is already hers: no Save-address card", async () => {
    await maya();
    await endMayasCallToWrapUp();
    await h.click(h.navCard("Maya Chen"));
    await addSmsViaCustom(MAYA_PHONE);
    await h.advance(2_000);
    expect(saveCard()).toBeNull();
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
    // No identity: the "+" is the ad-hoc box.
    await addSms(NEW_NUMBER);
    // Awaited, not raced: the offer lands a render after the thread is on the card.
    const card = await awaitSaveCard();
    expect(card).not.toBeNull();
    expect(buttonText(card!, "Add")).toBeTruthy();
    expect(buttonText(card!, "Link to existing customer")).toBeTruthy();
    await h.click(buttonText(card!, "Add")!);
    // Saved for the card: its "+" is now the picker, with the number.
    await h.click(headerPlus());
    expect(adHocInput()).toBeNull();
    await h.click(radio("SMS")!);
    await h.click([...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')][0]!);
    expect([...document.body.querySelectorAll('[role="option"]')].some((o) => o.textContent?.includes(NEW_NUMBER))).toBe(true);
  });
});
