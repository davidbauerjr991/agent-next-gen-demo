// @vitest-environment jsdom
// P-AIFIRST (k6), browser-pass round 3: the record header's "+" (1), "Already
// open" in the add-channel pickers (2), the status-chip setting (3), the
// channel thread picker (4), the call badge (7), Session Details per channel
// in every mode (8), drafts vs live threads (9). The preview without AI (5)
// is in header-previews.test; the slide-over's layout (6, 10) and the
// picker in a real browser (4) in e2e/k6-browser-pass.spec.ts.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { SettingsView } from "@/components/settings/SettingsView";
import type { EntityId, Interaction, InteractionId, JourneyId } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { profileValues } from "@/settings/profiles";
import type { AiDisplayLocation } from "@/settings/settings-schema";
import { ALREADY_OPEN_REASON, alreadyOpenReasons } from "./already-open";
import { callBadge } from "./call-badge";
import { isDraftThread } from "./channel-thread";

const h = createWorkspaceHarness();
const customer = (id: string) => CREATE_NEW_CUSTOMERS.find((c) => c.id === id)!;
const alex = customer("customer-1"); // WhatsApp; one number (listed three times)
const miguel = customer("customer-4"); // WhatsApp; two numbers
const sarah = customer("customer-2"); // SMS
const priya = customer("priya-shah-history");

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
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
const panel = () => h.container.querySelector("[data-slot=right-panel]")!;
const panelShows = () => (panel()?.getAttribute("data-open") === "true" ? panel().getAttribute("data-thread") : null);
const mainColumn = () => h.container.querySelector("[data-main-thread]")!;
/** The main thread's current session row: the record header's second line (P-CANVAS browser pass). */
const sessionRow = () => h.container.querySelector("[data-slot=record-header] [data-slot=record-session-row]")!;
/** What the main thread shows: its session row and its column. */
const threadView = () => `${sessionRow()?.textContent ?? ""}|${mainColumn().textContent}`;
const radio = (label: string) =>
  [...document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
    (r) =>
      (r.id && document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim()) === label ||
      r.closest("label")?.textContent?.trim() === label ||
      r.getAttribute("value") === label.toLowerCase(),
  );
const buttonText = (root: ParentNode, text: string | RegExp) =>
  [...root.querySelectorAll<HTMLElement>("button")].find((b) => (typeof text === "string" ? b.textContent?.trim() === text : text.test(b.textContent?.trim() ?? "")));

async function setUp(ai: AiDisplayLocation, phase2 = false) {
  await act(async () => {
    if (phase2) getSettingsStore().updateMany(profileValues("phase2"));
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
    getSettingsStore().update("ai", { displayLocation: ai });
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
}

async function dial(channel: Interaction["channel"], who: { id: string; name: string }, address: string, journeyId?: string) {
  let journey = "";
  await act(async () => {
    const dialed = h.provider.dial({
      channel,
      address,
      skillId: "general",
      entityId: who.id as EntityId,
      contactName: who.name,
      ...(journeyId ? { journeyId: journeyId as JourneyId } : {}),
    });
    await vi.advanceTimersByTimeAsync(300);
    const id = await dialed;
    const snapshot = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    journey = (await snapshot).interactions.find((i) => i.id === id)!.journeyId;
  });
  return journey;
}

async function sendInMain(text: string) {
  const input = mainColumn().querySelector<HTMLTextAreaElement>('textarea[placeholder^="Type a message"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
  });
  await h.click(buttonText(mainColumn(), "Send")!);
}

/** In the open Outcome form: pick the first disposition code (required), then Save & Dismiss. */
async function saveAndDismiss() {
  await h.click(buttonText(document.body, /Select disposition code/)!);
  await h.click(document.body.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")!);
  await h.click(buttonText(document.body, "Save & Dismiss")!);
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

describe("1: the record header's \"+\"", () => {
  for (const ai of ["inline", "panel", "main"] as const) {
    it(`AI display ${ai}: in the header (k8: before Contact Details), the same control as the nav card's`, async () => {
      await setUp(ai);
      await dial("email", priya, priya.emailAddress!);
      await h.click(h.navCard(priya.name));
      const plus = h.container.querySelector<HTMLElement>("[data-slot=header-add-channel] button");
      expect(plus).not.toBeNull();
      expect(contactDetailsButton().compareDocumentPosition(plus!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
      // The nav card has the same control (lyra's AddChannelButton, "Add Outbound").
      const navPlus = h.navCard(priya.name).closest("aside")!.querySelector('[aria-label="Add Outbound"]');
      expect(navPlus).not.toBeNull();
      expect(plus!.getAttribute("aria-label")).toBe(navPlus!.getAttribute("aria-label"));
    });
  }
});

describe("2: a channel already open on every address is disabled \"Already open\"", () => {
  it("the rule: one number (listed three times) open → blocked; two numbers, one open → not", () => {
    expect(alreadyOpenReasons(alex, { whatsapp: [alex.firstPhone] })).toEqual({ whatsapp: ALREADY_OPEN_REASON });
    expect(alreadyOpenReasons(miguel, { whatsapp: [miguel.phones[0].value] })).toEqual({});
    expect(alreadyOpenReasons(undefined, { sms: ["(415) 555-0100"] })).toEqual({ sms: ALREADY_OPEN_REASON });
  });

  it("WhatsApp open on Alex Miller: disabled in the header \"+\", the nav \"+\", the Customers table and New Outbound", async () => {
    await setUp("inline", true);
    await dial("whatsapp", alex, alex.firstPhone);
    await h.click(h.navCard(alex.name));
    const whatsApp = () => radio("WhatsApp")!;
    // Header "+".
    await h.click(h.container.querySelector<HTMLElement>("[data-slot=header-add-channel] button")!);
    expect(whatsApp().disabled).toBe(true);
    expect(whatsApp().closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(ALREADY_OPEN_REASON);
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
    // Nav "+".
    await h.click(h.navCard(alex.name).closest("aside")!.querySelector<HTMLElement>('[aria-label="Add Outbound"]')!);
    expect(whatsApp().disabled).toBe(true);
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
    // Customers table.
    const home = [...h.container.querySelectorAll<HTMLElement>("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!;
    await h.click(home);
    const tab = [...h.container.querySelectorAll<HTMLElement>('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!;
    await h.click(tab);
    const row = [...h.container.querySelectorAll<HTMLElement>("table tr")].find((tr) => tr.textContent?.includes("Alex") && tr.textContent?.includes("Miller"))!;
    await h.click(row.querySelector<HTMLElement>('[title="Voice"], [aria-label="Voice"]')!);
    expect(whatsApp().disabled).toBe(true);
    expect(whatsApp().closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(ALREADY_OPEN_REASON);
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
    // New Outbound (disabled; lyra CreateNew takes no per-contact reason).
    await h.click([...h.container.querySelectorAll<HTMLElement>("aside button")].find((b) => b.textContent?.includes("New Outbound"))!);
    const field = document.getElementById("new-outbound-search") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, alex.name);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    const inPopover = (match: (el: HTMLElement) => boolean) =>
      [...document.querySelectorAll<HTMLElement>("[data-radix-popper-content-wrapper] *")].find(
        (el) => (el.getAttribute("role") === "button" || el.tagName === "BUTTON") && match(el),
      );
    const all = inPopover((el) => !!el.textContent?.trim().startsWith("All"));
    if (all) await h.click(all);
    await h.click(inPopover((el) => !!el.textContent?.includes(alex.name))!);
    expect(whatsApp().disabled).toBe(true);
  });

  it("Miguel Alvarez (two numbers), WhatsApp open on one: enabled, and the second thread opens on the unused number", async () => {
    await setUp("inline", true);
    await dial("whatsapp", miguel, miguel.phones[0].value);
    await h.click(h.navCard(miguel.name));
    await h.click(h.container.querySelector<HTMLElement>("[data-slot=header-add-channel] button")!);
    expect(radio("WhatsApp")!.disabled).toBe(false);
    await h.click(radio("WhatsApp")!);
    await h.click(buttonText(document.body, "Start Interaction")!);
    await h.advance(1_000);
    const whatsapps = (await snapshot()).filter((i) => i.channel === "whatsapp" && i.entityId === miguel.id && i.state !== "ended");
    expect(whatsapps.map((i) => i.address?.value).sort()).toEqual([miguel.phones[0].value, miguel.phones[1].value].sort());
  });
});

// E3: an address with an open thread on the channel stays in Select Phone / Select Email, disabled "Already
// open" (the agent sees the channel is active there), in every add-channel picker; only a channel open on
// every address is disabled itself (k6 2, above).
describe("E3: an open address stays listed, disabled \"Already open\"", () => {
  const escape = () =>
    act(async () => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
  /** The address Select's options, read from its open list (opened from its trigger, which shows `shown`). */
  async function addressOptions(shown: string) {
    const trigger = [...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')].find((c) => c.textContent?.includes(shown));
    expect(trigger, `the address field showing ${shown}; fields: ${[...document.body.querySelectorAll('[role="combobox"]')].map((c) => c.textContent).join(" | ")}`).toBeTruthy();
    await h.click(trigger!);
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => ({
      text: o.textContent ?? "",
      disabled: o.hasAttribute("data-disabled") || (o as HTMLButtonElement).disabled === true,
      reason: o.getAttribute("data-disabled-reason"),
    }));
    await escape();
    return options;
  }
  const optionFor = (options: { text: string; disabled: boolean; reason: string | null }[], value: string) => options.find((o) => o.text.includes(value));
  const navPlusOf = (name: string) => {
    let scope: HTMLElement | null = h.navCard(name);
    while (scope && !scope.querySelector('[aria-label="Add Outbound"]')) scope = scope.parentElement;
    return scope!.querySelector<HTMLElement>('[aria-label="Add Outbound"]')!;
  };
  // Priya Shah: SMS and email, two numbers on record. The Customers table lists directory customers only:
  // there, the first one with SMS and two numbers on record (so the channel isn't open on all of them).
  const tableCustomer = CREATE_NEW_CUSTOMERS.find(
    (c) => /^customer-\d+$/.test(c.id) && c.channels.includes("sms") && new Set(c.phones.map((p) => p.value)).size >= 2,
  )!;
  let who = priya;
  const pickers: Record<string, () => Promise<void>> = {
    "header +": async () => {
      await h.click(h.navCard(who.name));
      await h.click(h.container.querySelector<HTMLElement>("[data-slot=header-add-channel] button")!);
    },
    "nav +": async () => {
      await h.click(navPlusOf(who.name));
    },
    "Customers table": async () => {
      await h.click([...h.container.querySelectorAll<HTMLElement>("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!);
      await h.click([...h.container.querySelectorAll<HTMLElement>('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!);
      const row = [...h.container.querySelectorAll<HTMLElement>("table tr")].find((tr) => tr.textContent?.includes(who.firstName) && tr.textContent?.includes(who.lastName))!;
      expect(row, `${who.name}'s row`).toBeTruthy();
      await h.click(row.querySelector<HTMLElement>('[title="SMS"], [aria-label="SMS"]')!);
    },
    "New Outbound": async () => {
      await h.click([...h.container.querySelectorAll<HTMLElement>("aside button")].find((b) => b.textContent?.includes("New Outbound"))!);
      const field = document.getElementById("new-outbound-search") as HTMLInputElement;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, who.name);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(50);
      });
      const inPopover = (match: (el: HTMLElement) => boolean) =>
        [...document.querySelectorAll<HTMLElement>("[data-radix-popper-content-wrapper] *")].find(
          (el) => (el.getAttribute("role") === "button" || el.tagName === "BUTTON") && match(el),
        );
      const all = inPopover((el) => !!el.textContent?.trim().startsWith("All"));
      if (all) await h.click(all);
      await h.click(inPopover((el) => !!el.textContent?.includes(who.name))!);
    },
  };

  /** The address field's current value (its default), as its trigger shows it. */
  const shownAddress = () =>
    [...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')].map((c) => c.textContent?.trim() ?? "").find((t) => /\d{3}.*\d{4}/.test(t)) ?? "";

  for (const [picker, open] of Object.entries(pickers)) {
    it(`${picker}: an SMS thread open on the customer's default number lists it disabled "Already open"; closing the thread re-enables it`, async () => {
      who = picker === "Customers table" ? tableCustomer : priya;
      await setUp("inline", true);
      // An email keeps her card while the SMS thread comes and goes.
      const journey = await dial("email", who, who.emailAddress!);
      await open();
      await h.click(radio("SMS")!);
      const number = shownAddress();
      expect(number, "the picker's default number").not.toBe("");
      await escape();

      await dial("sms", who, number, journey);
      await open();
      // Another number is still free: the channel stays enabled, and defaults to it.
      expect(radio("SMS")!.disabled).toBe(false);
      await h.click(radio("SMS")!);
      const other = shownAddress();
      expect(other).not.toBe(number);
      let options = await addressOptions(other);
      expect(optionFor(options, number), "the open number is listed").toBeTruthy();
      expect(optionFor(options, number)!.disabled).toBe(true);
      expect(optionFor(options, number)!.reason).toBe(ALREADY_OPEN_REASON);
      expect(optionFor(options, other)!.disabled).toBe(false);
      await escape();

      // Close the SMS thread (end it and complete its wrap-up).
      const sms = (await snapshot()).find((i) => i.channel === "sms" && i.entityId === who.id && i.state !== "ended")!;
      await act(async () => {
        const ended = h.provider.end(sms.id as InteractionId);
        await vi.advanceTimersByTimeAsync(300);
        await ended;
      });
      await act(async () => {
        const done = h.provider.completeWrapUp(sms.id as InteractionId, { dispositionCode: "resolved", tags: [], summary: "" });
        await vi.advanceTimersByTimeAsync(300);
        await done.catch(() => undefined);
      });
      await h.advance(500);
      await open();
      await h.click(radio("SMS")!);
      expect(shownAddress()).toBe(number);
      options = await addressOptions(number);
      expect(optionFor(options, number)!.disabled).toBe(false);
      expect(optionFor(options, number)!.reason).toBeNull();
    });
  }
});

// E4: WhatsApp reaches the customer's phone number (WhatsApp Business routes by number), so already-open
// matching compares numbers.
describe("E4: WhatsApp is a phone channel", () => {
  it("Alex Miller with WhatsApp open on (200) 200-1000: the Customers table's WhatsApp field lists that number, disabled \"Already open\"", async () => {
    expect(alex.firstPhone).toBe("(200) 200-1000");
    await setUp("inline", true);
    await dial("whatsapp", alex, alex.firstPhone);
    await h.click([...h.container.querySelectorAll<HTMLElement>("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!);
    await h.click([...h.container.querySelectorAll<HTMLElement>('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!);
    const row = [...h.container.querySelectorAll<HTMLElement>("table tr")].find((tr) => tr.textContent?.includes("Alex") && tr.textContent?.includes("Miller"))!;
    await h.click(row.querySelector<HTMLElement>('[title="WhatsApp"], [aria-label="WhatsApp"]')!);
    // One number on record, open: the channel is "Already open" (k6 2), and its number is listed, greyed.
    expect(radio("WhatsApp")!.disabled).toBe(true);
    expect(document.body.textContent).toContain("Select Phone");
    expect(document.body.textContent).not.toContain("WhatsApp Handle");
    const field = [...document.body.querySelectorAll<HTMLElement>('[role="combobox"]')].find((c) => /available|\d{3}/.test(c.textContent ?? ""))!;
    await h.click(field);
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options.some((o) => o.textContent?.includes("@"))).toBe(false);
    const number = options.find((o) => o.textContent?.includes("(200) 200-1000"));
    expect(number, "the open number is listed").toBeTruthy();
    expect(number!.hasAttribute("data-disabled")).toBe(true);
    expect(number!.getAttribute("data-disabled-reason")).toBe(ALREADY_OPEN_REASON);
  });

  it("a WhatsApp thread started from the header \"+\" is on one of the customer's numbers", async () => {
    await setUp("inline", true);
    const journey = await dial("email", miguel, miguel.emailAddress!);
    await h.click(h.navCard(miguel.name));
    await h.click(h.container.querySelector<HTMLElement>("[data-slot=header-add-channel] button")!);
    await h.click(radio("WhatsApp")!);
    expect(document.body.textContent).not.toContain("WhatsApp Handle");
    await h.click(buttonText(document.body, "Start Interaction")!);
    await h.advance(1_000);
    const whatsapp = (await snapshot()).find((i) => i.channel === "whatsapp" && i.journeyId === journey)!;
    expect(miguel.phones.map((p) => p.value)).toContain(whatsapp.address?.value);
  });
});

describe("3: Settings → Assignments → Show status chip in the session row", () => {
  it("on by default and in every built-in profile; off hides the session row's status pill", async () => {
    expect(getSettingsStore().getState().values.assignments.showStatusChip).toBe(true);
    for (const id of ["phase1", "phase2", "aifirst"] as const) expect(profileValues(id).assignments?.showStatusChip ?? true).toBe(true);
    await setUp("inline");
    await act(async () => getSettingsStore().update("channels", { chat: true }));
    await h.accept(await h.startInbound("chat", priya.emailAddress!, priya.name));
    await h.click(h.navCard(priya.name));
    const pill = () => [...sessionRow().querySelectorAll("button, [role=button]")].some((el) => /^(New|Open|Pending|Escalated|Resolved)\b/.test(el.textContent?.trim() ?? ""));
    expect(pill()).toBe(true);
    await act(async () => getSettingsStore().update("assignments", { showStatusChip: false }));
    expect(pill()).toBe(false);
    expect(sessionRow().querySelector('[aria-label="Outcome"], [title="Outcome"]')).not.toBeNull();
  });

  it("the Settings switch", async () => {
    await h.render(<SettingsView />);
    const label = [...h.container.querySelectorAll("label, span")].find((el) => el.textContent?.trim() === "Show status chip in the session row");
    expect(label).toBeTruthy();
  });
});

describe("4: one icon per channel with a thread picker", () => {
  it("Sarah Brown with two SMS threads: one SMS icon reading 2; its menu lists both; choosing the second swaps the content", async () => {
    await setUp("inline");
    const journey = await dial("sms", sarah, sarah.firstPhone);
    await dial("sms", sarah, "(300) 555-0199", journey);
    await h.click(h.navCard(sarah.name));
    const sms = headerIcon("SMS")!;
    expect(h.container.querySelectorAll('[aria-label="Open SMS preview"], [aria-label="Close SMS preview"]')).toHaveLength(1);
    expect(sms.parentElement!.textContent?.trim()).toBe("2");
    await h.click(sms);
    const menu = document.body.querySelector("[data-slot=channel-thread-menu]")!;
    expect(menu).not.toBeNull();
    const rows = [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")];
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining(sarah.firstPhone), expect.stringContaining("(300) 555-0199")]);
    const before = threadView();
    const other = rows.find((r) => !before?.includes(r.textContent!.split(" ")[0]!)) ?? rows[1];
    await h.click(other);
    expect(document.body.querySelector("[data-slot=channel-thread-menu]")).toBeNull();
    expect(threadView()).not.toBe(before);
  });

  it("one thread: a plain icon, no menu", async () => {
    await setUp("inline");
    const journey = await dial("sms", sarah, sarah.firstPhone);
    await dial("email", sarah, sarah.emailAddress, journey);
    await h.click(h.navCard(sarah.name));
    expect(headerIcon("SMS")!.parentElement!.textContent?.trim()).toBe("");
    await h.click(headerIcon("SMS")!);
    expect(document.body.querySelector("[data-slot=channel-thread-menu]")).toBeNull();
  });
});

describe("7: the record-header call badge", () => {
  const card = { threads: [{ type: "voice", providerInteractionId: "call" }] };
  const contact = (state: Interaction["state"]) => [{ id: "call", state } as Interaction];
  it("from the call's state", () => {
    expect(callBadge(card, contact("active"))).toBe("Active Call");
    expect(callBadge(card, contact("held"))).toBe("Call On Hold");
    expect(callBadge(card, contact("offered"))).toBe("Ringing");
    expect(callBadge(card, contact("wrap-up"))).toBe("Wrap-up");
    expect(callBadge(card, contact("ended"))).toBeUndefined();
    expect(callBadge({ threads: [{ type: "email" }] }, [])).toBeUndefined();
  });

  for (const ai of ["inline", "main"] as const) {
    it(`AI display ${ai}: Active Call on a live call, Call On Hold once held`, async () => {
      await setUp(ai);
      const callId = await h.startInbound("voice", priya.firstPhone, priya.name);
      await h.accept(callId);
      await h.click(h.navCard(priya.name));
      const header = () => h.container.querySelector("[data-record-header]")?.textContent ?? h.container.textContent ?? "";
      expect(header()).toContain("Active Call");
      await act(async () => {
        const held = h.provider.hold(callId, true);
        await vi.advanceTimersByTimeAsync(300);
        await held;
      });
      expect(header()).toContain("Call On Hold");
    });
  }
});

describe("8: Session Details' channel matches the selected tab (P-HOME-1n: its own slide-over, opened from the session row)", () => {
  const details = () => h.container.querySelector("[data-slot=reference-slide-over] [data-slot=session-slide-over]");
  for (const ai of ["inline", "panel", "main"] as const) {
    it(`AI display ${ai}: voice, SMS and email on one card`, async () => {
      await setUp(ai);
      const callId = await h.startInbound("voice", priya.firstPhone, priya.name);
      await h.accept(callId);
      const journey = (await snapshot()).find((i) => i.id === callId)!.journeyId;
      await dial("sms", priya, priya.firstPhone, journey);
      await dial("email", priya, priya.emailAddress!, journey);
      await h.click(h.navCard(priya.name));
      for (const [label, channel] of [["Voice Transcript", "Voice"], ["SMS", "SMS"], ["Email", "Email"]] as const) {
        if (ai === "main") {
          // The panel thread's session row → View Details → the slide-over.
          if (panelShows() !== label.split(" ")[0].toLowerCase()) await h.click(headerIcon(label)!);
          const viewDetails = buttonText(panel().querySelector("[data-slot=panel-session-row]")!, /View Details/)!;
          if (!details()) await h.click(viewDetails);
          await h.advance(100);
          expect(details()?.textContent, label).toContain(`Channel${channel}`);
        } else {
          if (headerIcon(label)!.getAttribute("aria-pressed") !== "true") await h.click(headerIcon(label)!);
          // The tab's session row (the record header's second line) → Session Details.
          if (!details()) {
            const row = h.container.querySelector("[data-slot=record-session-row]")!;
            await h.click([...row.querySelectorAll<HTMLElement>("button")].find((b) => /Session Details|View Details/.test(b.textContent ?? ""))!);
            await h.advance(100);
          }
          expect(details()?.textContent, label).toContain(`Channel${channel}`);
        }
      }
    });
  }
});

describe("9: drafts vs live threads (one derivation)", () => {
  it("isDraftThread: agent-initiated digital, nothing sent; a call never; an email until its Send (E2)", () => {
    const thread = (type: string, startedFresh = true, draftSent?: boolean) => ({ id: `${type}:1`, type, startedFresh, draftSent }) as never;
    expect(isDraftThread({ liveMessages: {} }, thread("sms"))).toBe(true);
    expect(isDraftThread({ liveMessages: { "sms:1": [{ sender: "agent" } as never] } }, thread("sms"))).toBe(false);
    expect(isDraftThread({ liveMessages: {} }, thread("sms", false))).toBe(false);
    expect(isDraftThread({ liveMessages: {} }, thread("voice"))).toBe(false);
    expect(isDraftThread({ liveMessages: {} }, thread("email"))).toBe(true);
    expect(isDraftThread({ liveMessages: {} }, thread("email", true, true))).toBe(false);
    expect(isDraftThread({ liveMessages: {} }, thread("email", false))).toBe(false);
  });

  // E2: a new outbound email is a draft like chat/SMS/WhatsApp; the temporary Send under its "Coming soon"
  // body (P-PARKED's composer replaces it) marks it sent and makes it live.
  for (const ai of ["inline", "panel"] as const) {
    it(`AI display ${ai}: a new outbound email is a draft (nav delete icon, "Discard draft", no Outcome); Send makes it live with Outcome`, async () => {
      await setUp(ai);
      await dial("email", priya, priya.emailAddress!);
      await h.click(h.navCard(priya.name));
      expect(mainColumn().getAttribute("data-main-thread")).toBe("email");
      const deleteDraft = () => h.navCard(priya.name).closest("aside")!.querySelector('[title="Delete Draft"], [aria-label="Delete Draft"]');
      expect(deleteDraft()).not.toBeNull();
      expect(buttonText(sessionRow(), /Discard draft/)).toBeTruthy();
      expect(sessionRow().querySelector('[aria-label="Outcome"]')).toBeNull();
      await h.click(mainColumn().querySelector<HTMLElement>("[data-slot=email-draft-send]")!);
      expect(deleteDraft()).toBeNull();
      expect(buttonText(sessionRow(), /Discard draft/)).toBeFalsy();
      expect(mainColumn().querySelector("[data-slot=email-draft-send]")).toBeNull();
      expect(sessionRow().querySelector('[aria-label="Outcome"]')).not.toBeNull();
    });
  }

  it("AI display main: a new outbound email is a draft in the panel's session row; Send in its body makes it live with Outcome", async () => {
    await setUp("main");
    await dial("email", priya, priya.emailAddress!);
    await h.click(h.navCard(priya.name));
    if (panelShows() !== "email") await h.click(headerIcon("Email")!);
    const row = () => panel().querySelector("[data-slot=panel-session-row]")!;
    expect(buttonText(row(), /Discard draft/)).toBeTruthy();
    expect(row().querySelector('[aria-label="Outcome"]')).toBeNull();
    await h.click(panel().querySelector<HTMLElement>("[data-slot=email-draft-send]")!);
    expect(buttonText(row(), /Discard draft/)).toBeFalsy();
    expect(row().querySelector('[aria-label="Outcome"]')).not.toBeNull();
  });

  for (const ai of ["inline", "panel"] as const) {
    it(`AI display ${ai}: a new outbound SMS is a draft (nav delete icon, "Discard draft", no Outcome or pill); after a send it's live; Outcome → Save & Dismiss dismisses it`, async () => {
      await setUp(ai);
      const journey = await dial("email", priya, priya.emailAddress!);
      await dial("sms", priya, priya.firstPhone, journey);
      await h.click(h.navCard(priya.name));
      if (mainColumn().getAttribute("data-main-thread") !== "sms") await h.click(headerIcon("SMS")!);
      const navRow = () => h.container.querySelector<HTMLElement>("aside [aria-label^='SMS channel']")!;
      const navScope = () => navRow().closest("[class]")!.parentElement!;
      expect(buttonText(sessionRow(), /Discard draft/)).toBeTruthy();
      expect(sessionRow().querySelector('[aria-label="Outcome"], [title="Outcome"]')).toBeNull();
      expect(navScope().querySelector('[aria-label="Outcome"], [title="Outcome"]')).toBeNull();
      // The SMS row's own delete icon (the email dialed first is a draft too, E2).
      const deleteDraft = () => navScope().querySelector('[title="Delete Draft"], [aria-label="Delete Draft"]');
      expect(deleteDraft()).not.toBeNull();
      await sendInMain("Hi Priya");
      expect(deleteDraft()).toBeNull();
      expect(buttonText(sessionRow(), /Discard draft/)).toBeFalsy();
      const outcome = sessionRow().querySelector<HTMLElement>('[aria-label="Outcome"]')!;
      expect(outcome).not.toBeNull();
      await h.click(outcome);
      await saveAndDismiss();
      await h.advance(500);
      expect((await snapshot()).find((i) => i.channel === "sms")?.state ?? "ended").not.toMatch(/active|held|connecting/);
      expect(h.container.querySelector("aside [aria-label^='SMS channel']")).toBeNull();
      expect(h.navCard(priya.name)).toBeTruthy();
    });
  }

  it("AI display main: the panel's session row shows \"Discard draft\" for a draft SMS, and Outcome once it's live", async () => {
    await setUp("main");
    const journey = await dial("email", priya, priya.emailAddress!);
    await dial("sms", priya, priya.firstPhone, journey);
    await h.click(h.navCard(priya.name));
    if (panelShows() !== "sms") await h.click(headerIcon("SMS")!);
    const row = () => panel().querySelector("[data-slot=panel-session-row]")!;
    expect(buttonText(row(), /Discard draft/)).toBeTruthy();
    expect(row().querySelector('[aria-label="Outcome"]')).toBeNull();
    const input = panel().querySelector<HTMLTextAreaElement>('textarea[placeholder^="Type a message"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Hi Priya");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(10);
    });
    await h.click(buttonText(panel(), "Send")!);
    expect(buttonText(row(), /Discard draft/)).toBeFalsy();
    expect(row().querySelector('[aria-label="Outcome"]')).not.toBeNull();
  });

  it("AI display main: an outcomed email's Outcome → Save & Dismiss dismisses it", async () => {
    await setUp("main");
    const journey = await dial("sms", priya, priya.firstPhone);
    await dial("email", priya, priya.emailAddress!, journey);
    await h.click(h.navCard(priya.name));
    if (panelShows() !== "email") await h.click(headerIcon("Email")!);
    // A new outbound email is a draft until its Send (E2).
    await h.click(panel().querySelector<HTMLElement>("[data-slot=email-draft-send]")!);
    const row = panel().querySelector("[data-slot=panel-session-row]")!;
    await h.click(row.querySelector<HTMLElement>('[aria-label="Outcome"]')!);
    await saveAndDismiss();
    await h.advance(500);
    expect(h.container.querySelector("aside [aria-label^='Email channel']")).toBeNull();
  });
});
