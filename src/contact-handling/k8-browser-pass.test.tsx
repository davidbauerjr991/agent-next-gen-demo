// @vitest-environment jsdom
// P-AIFIRST (k8), browser-pass round 4: the header "+" first and each number
// once in its picker (1), the record header's border (2), Session Details
// following the panel's thread (3), a new thread is the visible one (4), the
// call switcher (5), one call per customer on every "+" (6), the thread
// menu's anchor (7), offering to save a new address (8), the held call
// selected when the live one ends (9), the thread menu on hover (10).
// Layout (the Select's options, the menu's position) is in
// e2e/k8-browser-pass.spec.ts.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import type { EntityId, Interaction, InteractionId, JourneyId } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { profileValues } from "@/settings/profiles";
import type { AiDisplayLocation } from "@/settings/settings-schema";
import { ALREADY_OPEN_REASON, ON_A_CALL_REASON, customerChannelAddresses, onCallReasons } from "./already-open";
import { isKnownAddress, linkContactMethod, resetContactMethodsForTests, withLinkedContactMethods } from "./contact-methods";
import { findCallWith } from "./useOutboundDial";

const h = createWorkspaceHarness();
const customer = (id: string) => CREATE_NEW_CUSTOMERS.find((c) => c.id === id)!;
const alex = customer("customer-1"); // one number, listed three times; WhatsApp, email, voice
const priya = customer("priya-shah-history");
const MAYA = "maya-chen-refund-call";
const NEW_NUMBER = "(646) 555-0143";

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  resetContactMethodsForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const headerIcon = (label: string) =>
  h.container.querySelector<HTMLElement>(`[aria-label="Open ${label} preview"], [aria-label="Close ${label} preview"]`);
const contactDetailsButton = () =>
  [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
    (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
  )!;
const headerPlus = () => h.container.querySelector<HTMLElement>("[data-slot=header-add-channel] button")!;
const panel = () => h.container.querySelector("[data-slot=right-panel]")!;
const panelShows = () => (panel()?.getAttribute("data-open") === "true" ? panel().getAttribute("data-thread") : null);
const mainThread = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
const radio = (label: string) =>
  [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
    (r) =>
      (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) === label ||
      r.closest("label")?.textContent?.trim() === label ||
      r.getAttribute("value") === label.toLowerCase(),
  );
const reasonOf = (el: Element | undefined | null) => el?.closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason");
const buttonText = (root: ParentNode, text: string | RegExp) =>
  [...root.querySelectorAll<HTMLElement>("button")].find((b) => (typeof text === "string" ? b.textContent?.trim() === text : text.test(b.textContent?.trim() ?? "")));
const escape = () =>
  act(async () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
  });
const hover = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(400);
  });
async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function setUp(ai: AiDisplayLocation, phase2 = false) {
  await act(async () => {
    if (phase2) getSettingsStore().updateMany(profileValues("phase2"));
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
    getSettingsStore().update("ai", { displayLocation: ai });
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
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

/** A provider dial (no page activation); returns its id and journey. */
async function dial(channel: Interaction["channel"], who: { id: string; name: string }, address: string, journeyId?: string) {
  let id = "" as InteractionId;
  await act(async () => {
    const dialed = h.provider.dial({
      channel,
      address,
      skillId: "general",
      ...(who.id ? { entityId: who.id as EntityId } : {}),
      contactName: who.name,
      ...(journeyId ? { journeyId: journeyId as JourneyId } : {}),
    });
    await vi.advanceTimersByTimeAsync(300);
    id = await dialed;
  });
  const journey = (await snapshot()).find((i) => i.id === id)!.journeyId;
  return { id, journey };
}

/** An inbound call answered through the card's own Accept (the page's path). */
async function acceptCall(address: string, name: string) {
  const id = await h.startInbound("voice", address, name);
  await h.advance(300);
  await h.click(buttonText(h.navCard(name).closest("aside")!, "Accept") ?? buttonText(h.container, "Accept")!);
  await h.advance(800);
  return id;
}

describe("1: the header \"+\" comes first; each of the customer's numbers once", () => {
  it("customerChannelAddresses: one number listed three times is one option", () => {
    expect(alex.phones.length).toBeGreaterThan(1);
    expect(customerChannelAddresses(alex, "whatsapp")).toEqual([alex.firstPhone]);
  });

  for (const ai of ["inline", "panel", "main"] as const) {
    it(`AI display ${ai}: order "+", channel icons, Contact Details`, async () => {
      await setUp(ai);
      const { journey } = await dial("email", priya, priya.emailAddress!);
      await dial("sms", priya, priya.firstPhone, journey);
      await h.click(h.navCard(priya.name));
      const plus = headerPlus();
      const icon = headerIcon("SMS")!;
      expect(plus.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(icon.compareDocumentPosition(contactDetailsButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  }
});

describe("2: the record header always has its bottom border", () => {
  for (const ai of ["inline", "panel", "main"] as const) {
    it(`AI display ${ai}: with one thread and with two`, async () => {
      await setUp(ai);
      const { journey } = await dial("email", priya, priya.emailAddress!);
      await h.click(h.navCard(priya.name));
      // One border under the whole header (P-CANVAS browser pass): the session row's when it's the header's second
      // line (inline, panel), else the PageHeader's (main: the session row is the panel thread's, k5 B).
      const recordHeader = () => h.container.querySelector<HTMLElement>("[data-slot=record-header]")!;
      const borders = () => {
        const pageHeaderBorder = recordHeader().querySelector(".lyra-page-header-container")!.className.includes("border-b");
        const sessionRowBorder = !!recordHeader().querySelector("[data-slot=record-session-row] .border-b");
        return { pageHeaderBorder, sessionRowBorder };
      };
      const expected = ai === "main" ? { pageHeaderBorder: true, sessionRowBorder: false } : { pageHeaderBorder: false, sessionRowBorder: true };
      expect(recordHeader().textContent).toContain(priya.name);
      expect(borders()).toEqual(expected);
      await dial("sms", priya, priya.firstPhone, journey);
      expect(borders()).toEqual(expected);
    });
  }
});

describe("3: under \"main\", Session Details follows the panel's thread", () => {
  it("open on the email's session; switching to the SMS switches it to the SMS session, still open", async () => {
    await setUp("main");
    const { journey } = await dial("email", priya, priya.emailAddress!);
    await dial("sms", priya, priya.firstPhone, journey);
    await h.click(h.navCard(priya.name));
    if (panelShows() !== "email") await h.click(headerIcon("Email")!);
    await h.click(buttonText(panel().querySelector("[data-slot=panel-session-row]")!, /View Details/)!);
    const details = () => panel().querySelector("[data-slot=session-slide-over]");
    expect(details()?.textContent).toContain("ChannelEmail");
    await h.click(headerIcon("SMS")!);
    expect(panelShows()).toBe("sms");
    expect(details()).not.toBeNull();
    expect(details()!.textContent).toContain("ChannelSMS");
  });
});

describe("4: a newly launched or accepted thread is the visible one", () => {
  // The sim routes inbound chat and voice only: an accepted chat stands in for every digital thread. It
  // joins a card by address, which only an address-only card (no directory entity) is matched on.
  const lauren = { id: "", name: "Lauren Briggs" };
  it("AI display inline: an inbound chat joining the card selects its tab over the WhatsApp", async () => {
    await setUp("inline");
    const { journey } = await dial("email", lauren, "lauren@example.com");
    await dial("whatsapp", lauren, "(312) 555-0164", journey);
    await h.click(h.navCard(lauren.name));
    if (mainThread() !== "whatsapp") await h.click(headerIcon("WhatsApp")!);
    expect(mainThread()).toBe("whatsapp");
    await h.startInbound("chat", "lauren@example.com", lauren.name);
    await h.advance(1_000);
    expect(mainThread()).toBe("chat");
  });

  it("AI display main: the panel switches to the accepted thread", async () => {
    await setUp("main");
    const { journey } = await dial("email", lauren, "lauren@example.com");
    await dial("whatsapp", lauren, "(312) 555-0164", journey);
    await h.click(h.navCard(lauren.name));
    if (panelShows() !== "whatsapp") await h.click(headerIcon("WhatsApp")!);
    expect(panelShows()).toBe("whatsapp");
    await h.startInbound("chat", "lauren@example.com", lauren.name);
    await h.advance(1_000);
    expect(panelShows()).toBe("chat");
  });

  it("AI display main: an accepted call opens its transcript in the panel; the voice bar appears", async () => {
    await setUp("main");
    await acceptCall("(312) 555-0164", "Lauren Briggs");
    expect(panelShows()).toBe("voice");
    expect(h.container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
  });
});

describe("5: the voice bar's call switcher", () => {
  it("one call: a plain label; two: a menu of both; choosing the held one selects its card, the bar shows Resume, the call stays held", async () => {
    await setUp("inline");
    const first = await acceptCall("(312) 555-0164", "Lauren Briggs");
    expect(h.container.querySelector("[data-slot=call-switcher]")).toBeNull();
    await acceptCall("(415) 555-0199", "Dana Wu");
    const bar = () => h.container.querySelector("[data-slot=voice-bar]")!;
    expect((await snapshot()).find((i) => i.id === first)!.state).toBe("held");
    const switcher = bar().querySelector<HTMLElement>("[data-slot=call-switcher]")!;
    expect(switcher.textContent).toContain("Dana Wu");
    await h.click(switcher);
    const menu = document.body.querySelector("[data-slot=call-switcher-menu]")!;
    const rows = [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")];
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining("Lauren Briggs"), expect.stringContaining("Dana Wu")]);
    expect(rows[0].textContent).toContain("On hold");
    await h.click(rows[0]);
    expect(h.container.querySelector("[data-record-header]")?.textContent ?? contactDetailsButton().closest(".lyra-page-header-container")!.textContent).toContain("Lauren Briggs");
    expect(buttonText(bar(), /Resume/) ?? bar().querySelector('[aria-label*="Resume"]')).toBeTruthy();
    expect((await snapshot()).find((i) => i.id === first)!.state).toBe("held");
  });
});

describe("6: one call per customer on every launch path", () => {
  it("the rules: a ringing, live or held call blocks Voice by entity, card or number", () => {
    const call = (state: string, extra: Partial<Interaction> = {}) => [{ id: "c", channel: "voice", state, journeyId: "j1", ...extra } as Interaction];
    for (const state of ["offered", "connecting", "active", "held"]) expect(onCallReasons(call(state), { journeyId: "j1" })).toEqual({ voice: ON_A_CALL_REASON });
    expect(onCallReasons(call("wrap-up"), { journeyId: "j1" })).toEqual({});
    expect(onCallReasons(call("active", { entityId: "e1" as EntityId }), { entityId: "e1" })).toEqual({ voice: ON_A_CALL_REASON });
    expect(findCallWith(call("active"), { journeyId: "j1", addresses: ["(555) 000-0000"] })).toBeTruthy();
  });

  it("Maya Chen on a call: Voice disabled \"Already on a call\" in her header \"+\" and nav \"+\"", async () => {
    await setUp("inline");
    await h.play(MAYA);
    await h.advance(3_000);
    await h.click(h.navCard("Maya Chen"));
    // A known card (her scripted case): her "+" is the channel picker over her contact methods (E2), not the ad-hoc box.
    for (const plus of [headerPlus(), h.navCard("Maya Chen").closest("aside")!.querySelector<HTMLElement>('[aria-label="Add Outbound"]')!]) {
      await h.click(plus);
      expect(document.body.querySelector('input[placeholder="Email or phone number"]')).toBeNull();
      expect(radio("Voice")!.disabled).toBe(true);
      expect(reasonOf(radio("Voice"))).toBe(ON_A_CALL_REASON);
      expect(radio("SMS")!.disabled).toBe(false);
      await escape();
    }
  });

  it("a directory customer on a call (Alex Miller): header \"+\", nav \"+\", Customers table with the reason; New Outbound disabled", async () => {
    await setUp("inline", true);
    await dial("voice", alex, alex.firstPhone);
    await h.advance(3_000);
    expect((await snapshot()).some((i) => i.channel === "voice" && ["connecting", "active"].includes(i.state))).toBe(true);
    await h.click(h.navCard(alex.name));
    await h.click(headerPlus());
    expect(radio("Voice")!.disabled).toBe(true);
    expect(reasonOf(radio("Voice"))).toBe(ON_A_CALL_REASON);
    await escape();
    await h.click(h.navCard(alex.name).closest("aside")!.querySelector<HTMLElement>('[aria-label="Add Outbound"]')!);
    expect(radio("Voice")!.disabled).toBe(true);
    await escape();
    // Customers table.
    await h.click([...h.container.querySelectorAll<HTMLElement>("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!);
    await h.click([...h.container.querySelectorAll<HTMLElement>('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!);
    const row = [...h.container.querySelectorAll<HTMLElement>("table tr")].find((tr) => tr.textContent?.includes("Alex") && tr.textContent?.includes("Miller"))!;
    await h.click(row.querySelector<HTMLElement>('[title="Email"], [aria-label="Email"]')!);
    expect(radio("Voice")!.disabled).toBe(true);
    expect(reasonOf(radio("Voice"))).toBe(ON_A_CALL_REASON);
    await escape();
    // New Outbound (lyra CreateNew: disabled, no per-contact reason yet).
    await h.click([...h.container.querySelectorAll<HTMLElement>("aside button")].find((b) => b.textContent?.includes("New Outbound"))!);
    await typeInto(document.getElementById("new-outbound-search") as HTMLInputElement, alex.name);
    const inPopover = (match: (el: HTMLElement) => boolean) =>
      [...document.querySelectorAll<HTMLElement>("[data-radix-popper-content-wrapper] *")].find(
        (el) => (el.getAttribute("role") === "button" || el.tagName === "BUTTON") && match(el),
      );
    const all = inPopover((el) => !!el.textContent?.trim().startsWith("All"));
    if (all) await h.click(all);
    await h.click(inPopover((el) => !!el.textContent?.includes(alex.name))!);
    expect(radio("Voice")!.disabled).toBe(true);
  });
});

describe("7: the thread menu hangs from a channel icon that stays put", () => {
  it.each(["inline", "panel"] as const)("AI display %s, two voice threads: the voice icon's element survives opening its menu, which lists both", async (ai) => {
    await setUp(ai);
    const { journey } = await dial("voice", priya, priya.firstPhone);
    await h.advance(2_000);
    await dial("voice", priya, "(415) 555-0123", journey);
    await h.advance(2_000);
    await h.click(h.navCard(priya.name));
    const wrapper = h.container.querySelector("[data-channel-icon=voice]")!;
    expect(wrapper).not.toBeNull();
    await h.click(headerIcon("Voice Transcript")!);
    expect(document.body.querySelectorAll("[data-slot=channel-thread-menu] [role=menuitem]")).toHaveLength(2);
    expect(wrapper.isConnected).toBe(true);
    expect(h.container.querySelector("[data-channel-icon=voice]")).toBe(wrapper);
  });
});

describe("8: a thread on a new address offers to save it", () => {
  it("the overlay: an added number is the customer's from then on", () => {
    expect(isKnownAddress(alex.id, alex, NEW_NUMBER)).toBe(false);
    linkContactMethod(alex.id, "phone", NEW_NUMBER);
    expect(isKnownAddress(alex.id, alex, NEW_NUMBER)).toBe(true);
    expect(customerChannelAddresses(withLinkedContactMethods(alex.id, alex), "whatsapp")).toEqual([alex.firstPhone, NEW_NUMBER]);
  });

  it("Custom number from the \"+\" → the card appears → Add → the \"+\" picker offers the number", async () => {
    await setUp("inline", true);
    // WhatsApp open on Alex's only number: "Already open" until another is added.
    await dial("whatsapp", alex, alex.firstPhone);
    await h.click(h.navCard(alex.name));
    await h.click(headerPlus());
    expect(reasonOf(radio("WhatsApp"))).toBe(ALREADY_OPEN_REASON);
    await h.click(radio("Custom")!);
    await typeInto(document.body.querySelector<HTMLInputElement>('input[placeholder="Email or phone number"]')!, NEW_NUMBER);
    await h.click(radio("SMS")!);
    await h.click(buttonText(document.body, "Start Interaction")!);
    await h.advance(3_000);
    const card = () => h.container.querySelector("[data-slot=save-address-card]");
    expect(card()?.textContent).toContain(`Add ${NEW_NUMBER} as a phone number for ${alex.name}?`);
    await h.click(buttonText(card()!, "Add")!);
    expect(card()?.textContent).toContain(`Added to ${alex.name}`);
    await h.click(headerPlus());
    expect(radio("WhatsApp")!.disabled).toBe(false);
    await h.click(radio("WhatsApp")!);
    const phone = [...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')].find((c) => c.textContent?.includes(NEW_NUMBER));
    expect(phone).toBeTruthy();
  });

  it("Not now dismisses the card; a known number offers nothing", async () => {
    await setUp("inline", true);
    await dial("whatsapp", alex, alex.firstPhone);
    await h.click(h.navCard(alex.name));
    await h.click(headerPlus());
    await h.click(radio("Custom")!);
    await typeInto(document.body.querySelector<HTMLInputElement>('input[placeholder="Email or phone number"]')!, NEW_NUMBER);
    await h.click(radio("SMS")!);
    await h.click(buttonText(document.body, "Start Interaction")!);
    await h.advance(3_000);
    await h.click(buttonText(h.container.querySelector("[data-slot=save-address-card]")!, "Not now")!);
    expect(h.container.querySelector("[data-slot=save-address-card]")).toBeNull();
    expect(isKnownAddress(alex.id, alex, NEW_NUMBER)).toBe(false);
  });
});

describe("9: the live call ends while another is held", () => {
  it("the held call's card is selected, the bar shows it held with Resume, the ended row keeps Needs outcome", async () => {
    await setUp("inline");
    const held = await acceptCall("(312) 555-0164", "Lauren Briggs");
    const live = await acceptCall("(415) 555-0199", "Dana Wu");
    expect((await snapshot()).find((i) => i.id === held)!.state).toBe("held");
    await act(async () => {
      const ended = h.provider.end(live);
      await vi.advanceTimersByTimeAsync(300);
      await ended;
    });
    await h.advance(500);
    expect(contactDetailsButton().closest(".lyra-page-header-container")!.textContent).toContain("Lauren Briggs");
    const bar = h.container.querySelector("[data-slot=voice-bar]")!;
    expect(bar.textContent).toContain("Lauren Briggs");
    expect(buttonText(bar, /Resume/) ?? bar.querySelector('[aria-label*="Resume"]')).toBeTruthy();
    expect((await snapshot()).find((i) => i.id === held)!.state).toBe("held");
    expect(h.navCard("Dana Wu").closest("aside")!.textContent).toContain("Needs outcome");
  });
});

describe("10: a multi-thread channel icon opens its thread menu on hover", () => {
  it("two emails, email active: hover lists both with the current one marked; choosing the other swaps the content", async () => {
    await setUp("inline");
    const { journey } = await dial("email", priya, priya.emailAddress!);
    await dial("email", priya, "priya.work@example.com", journey);
    await h.click(h.navCard(priya.name));
    expect(mainThread()).toBe("email");
    await hover(h.container.querySelector("[data-channel-icon=email]")!);
    const menu = document.body.querySelector("[data-slot=channel-thread-menu]")!;
    expect(menu).not.toBeNull();
    expect(document.body.querySelector("[data-slot=hover-preview]")).toBeNull();
    const rows = [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")];
    expect(rows).toHaveLength(2);
    const current = rows.find((r) => r.textContent?.includes("Current"))!;
    expect(current).toBeTruthy();
    // The thread's view: its session row (the record header's second line, P-CANVAS browser pass) and its column.
    const threadView = () =>
      `${h.container.querySelector("[data-slot=record-session-row]")?.textContent ?? ""}|${h.container.querySelector("[data-main-thread]")!.textContent}`;
    const before = threadView();
    await h.click(rows.find((r) => r !== current)!);
    expect(threadView()).not.toBe(before);
  });

  it("a single-thread icon keeps its preview", async () => {
    await setUp("inline");
    const { journey } = await dial("email", priya, priya.emailAddress!);
    await dial("sms", priya, priya.firstPhone, journey);
    await h.click(h.navCard(priya.name));
    const inactive = mainThread() === "email" ? "sms" : "email";
    await hover(h.container.querySelector(`[data-channel-icon=${inactive}]`)!);
    expect(document.body.querySelector("[data-slot=hover-preview]")).not.toBeNull();
    expect(document.body.querySelector("[data-slot=channel-thread-menu]")).toBeNull();
  });
});
