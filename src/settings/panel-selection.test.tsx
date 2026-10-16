// @vitest-environment jsdom
// Browser check round 2 (2026-10-16): the right panel has one selection path.
// The header toggle group (Contact Details, always visible, and a thread icon
// per thread), the hover previews' actions and the nav rows all choose what
// the panel shows, so its header, selected toggle and body change together,
// in every AI display mode. Plus the header highlight rule.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { profileValues } from "./profiles";
import type { AiDisplayLocation } from "./settings-schema";
import { PANEL_TOGGLE_ACTIVE } from "@/contact-handling";
import type { JourneyId } from "@/domain";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const panel = () => h.container.querySelector("[data-slot=right-panel]");
const panelShows = () => (panel()?.getAttribute("data-open") === "true" ? panel()!.getAttribute("data-thread") : null);
const headerIcon = (label: string) =>
  h.container.querySelector<HTMLElement>(`[aria-label="Open ${label} preview"], [aria-label="Close ${label} preview"]`);
const contactDetailsButton = () =>
  [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
    (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
  );
const pressed = (el: HTMLElement | null | undefined) => el?.getAttribute("aria-pressed") === "true";

async function hover(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
  });
}

/** Phase 2 + this AI display; the Customers tab; a WhatsApp outbound to its
 *  first customer (the way Alex Miller's card was launched). Returns the name. */
async function customersTableWhatsApp(displayLocation: AiDisplayLocation): Promise<string> {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await act(async () => {
    getSettingsStore().updateMany({ ...profileValues("phase2"), ai: { displayLocation } });
    await vi.advanceTimersByTimeAsync(50);
  });
  const tab = [...h.container.querySelectorAll('[data-slot=home-tabs] [role="tab"]')].find((t) => t.textContent?.trim() === "Customers")!;
  await h.click(tab as HTMLElement);
  const icon = h.container.querySelector<HTMLElement>('table [title="WhatsApp"], table [aria-label="WhatsApp"]')!;
  await h.click(icon);
  const start = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Start Interaction")!;
  await h.click(start);
  await h.advance(800);
  return h.container.querySelector("[data-record-header] h1, h1")?.textContent?.trim() ?? "";
}

/** The hover preview's "View customer info" action (the customer's name, a
 *  link in the Contact Details preview's header). */
async function viewCustomerInfoFromHover() {
  await hover(contactDetailsButton()!);
  const link = [...document.body.querySelectorAll<HTMLElement>("[data-radix-popper-content-wrapper] button.text-lyra-fg-link")][0];
  expect(link).toBeDefined();
  await h.click(link!);
}

describe("one selection path for the right panel", () => {
  for (const mode of ["main", "panel"] as const) {
    it(`a Customers-table WhatsApp card (AI display ${mode}): the hover's View customer info selects Contact Details`, async () => {
      await customersTableWhatsApp(mode);
      if (mode === "main") expect(panelShows()).toBe("whatsapp");
      // AI display "panel" opens Contact Details on activation, and the hover
      // preview only shows while Contact Details isn't the panel's content.
      if (panelShows() === "details") await h.click(contactDetailsButton()!);
      await viewCustomerInfoFromHover();
      // Body, header and toggle together: Contact Details, the WhatsApp icon released.
      expect(panelShows()).toBe("details");
      expect(pressed(contactDetailsButton())).toBe(true);
      expect(pressed(headerIcon("WhatsApp"))).toBe(false);
      // Panel mode: WhatsApp is the main column's thread, marked "in main column", not selected.
      expect(headerIcon("WhatsApp")!.getAttribute("data-in-main")).toBe(mode === "panel" ? "true" : null);
      // The thread icon takes the panel back (main), and Contact Details is one toggle among them.
      if (mode === "main") {
        await h.click(headerIcon("WhatsApp")!);
        expect(panelShows()).toBe("whatsapp");
        expect(pressed(contactDetailsButton())).toBe(false);
      }
    });
  }

  it("Contact Details is visible in every AI display mode and whatever is selected", async () => {
    const name = await customersTableWhatsApp("inline");
    expect(name).toBeTruthy();
    for (const mode of ["inline", "panel", "main"] as const) {
      await act(async () => {
        getSettingsStore().update("ai", { displayLocation: mode });
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(contactDetailsButton()).toBeDefined();
      await h.click(contactDetailsButton()!);
      expect(contactDetailsButton()).toBeDefined();
    }
  });
});

describe("header highlight rule", () => {
  /** Phase 2 (inline): Dan Ortiz's card with a chat (the main column's thread) and an email. */
  async function chatAndEmailCard() {
    await act(async () => getSettingsStore().update("channels", { chat: true, email: true }));
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await act(async () => {
      getSettingsStore().updateMany(profileValues("phase2"));
      await vi.advanceTimersByTimeAsync(50);
    });
    const chatId = await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz");
    await h.advance(500);
    await h.click(h.navCard("Dan Ortiz"));
    await act(async () => {
      const snapshot = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      const chat = (await snapshot).interactions.find((i) => i.id === chatId)!;
      const dialed = h.provider.dial({ channel: "email", address: "dan.ortiz@example.com", skillId: "general", journeyId: chat.journeyId });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
  }

  // Item 4, revised: active = on screen (the main column's thread, the panel's
  // content), one look for every member; inline/panel can have two at once.
  it("active looks the same on every member; inline with the email in main and Contact Details in the panel, both are active", async () => {
    await act(async () => {
      getSettingsStore().update("channels", { chat: true, email: true, whatsapp: true });
      getSettingsStore().update("assignments", { omnichannel: false });
      getSettingsStore().update("ai", { displayLocation: "inline" });
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    // A WhatsApp, then an email on the same card: omnichannel off, so the email is the main thread.
    let journeyId = "";
    for (const channel of ["whatsapp", "email"] as const) {
      await act(async () => {
        const dialed = h.provider.dial({
          channel,
          address: channel === "email" ? "dan.ortiz@example.com" : "+13125550199",
          skillId: "general",
          contactName: "Dan Ortiz",
          ...(journeyId ? { journeyId: journeyId as JourneyId } : {}),
        });
        await vi.advanceTimersByTimeAsync(300);
        const id = await dialed;
        const snapshot = h.provider.getSnapshot();
        await vi.advanceTimersByTimeAsync(50);
        journeyId = (await snapshot).interactions.find((i) => i.id === id)!.journeyId;
      });
    }
    await h.click(h.navCard("Dan Ortiz"));
    expect(h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread")).toBe("email");

    const active = (el: HTMLElement) => PANEL_TOGGLE_ACTIVE.split(" ").every((c) => el.classList.contains(c));
    const anyActive = (el: HTMLElement) => PANEL_TOGGLE_ACTIVE.split(" ").some((c) => el.classList.contains(c));
    const classes = (el: HTMLElement) => new Set(el.classList);
    const minus = (a: Set<string>, b: Set<string>) => [...a].filter((c) => !b.has(c)).sort();

    // Contact Details in the panel, the email in main: both active; WhatsApp default.
    if (panelShows() !== "details") await h.click(contactDetailsButton()!);
    expect(panelShows()).toBe("details");
    const [email, whatsApp, details] = [headerIcon("Email")!, headerIcon("WhatsApp")!, contactDetailsButton()!];
    expect([active(email), active(details), anyActive(whatsApp)]).toEqual([true, true, false]);
    expect([pressed(email), pressed(details)]).toEqual([false, true]);
    const whatsAppOff = classes(whatsApp);
    const detailsOn = classes(details);

    // WhatsApp into the panel: it and the email are active, Contact Details default.
    await h.click(whatsApp);
    expect(panelShows()).toBe("whatsapp");
    const [email2, whatsApp2, details2] = [headerIcon("Email")!, headerIcon("WhatsApp")!, contactDetailsButton()!];
    expect([active(email2), active(whatsApp2), anyActive(details2)]).toEqual([true, true, false]);
    for (const el of [whatsApp2, details2]) expect(el.getAttribute("data-preview-open")).toBeNull();

    // Becoming active adds and removes the same classes on an icon and on Contact Details,
    // and two active icons (one in main, one in the panel) carry the same classes.
    const whatsAppOn = classes(whatsApp2);
    const detailsOff = classes(details2);
    expect(minus(whatsAppOn, whatsAppOff)).toEqual(minus(detailsOn, detailsOff));
    expect(minus(whatsAppOff, whatsAppOn)).toEqual(minus(detailsOff, detailsOn));
    expect([...classes(email2)].sort()).toEqual([...whatsAppOn].sort());
    // Clicking the in-main member changes nothing.
    await h.click(email2);
    expect(panelShows()).toBe("whatsapp");
  });

  it("selected = what the panel shows (single); inline/panel also mark the main column's thread 'in main'; main: no in-main mark", async () => {
    await chatAndEmailCard();
    const inMain = (label: string) => headerIcon(label)!.getAttribute("data-in-main") === "true";
    // Inline (Phase 2): the chat is in the main column → marked in-main, not selected.
    expect([pressed(headerIcon("Chat")), inMain("Chat")]).toEqual([false, true]);
    expect([pressed(headerIcon("Email")), inMain("Email")]).toEqual([false, false]);
    await h.click(headerIcon("Email")!);
    expect(panelShows()).toBe("email");
    expect([pressed(headerIcon("Chat")), inMain("Chat")]).toEqual([false, true]);
    expect([pressed(headerIcon("Email")), inMain("Email")]).toEqual([true, false]);
    // Clicking the in-main icon is a no-op.
    await h.click(headerIcon("Chat")!);
    expect(panelShows()).toBe("email");
    // Panel mode: the same rule.
    await act(async () => {
      getSettingsStore().update("ai", { displayLocation: "panel" });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect([inMain("Chat"), pressed(headerIcon("Email"))]).toEqual([true, true]);
    // "main": nothing in the main column; only the panel's thread is selected.
    await act(async () => {
      getSettingsStore().update("ai", { displayLocation: "main" });
      await vi.advanceTimersByTimeAsync(50);
    });
    const inPanel = panelShows();
    expect([inMain("Chat"), inMain("Email")]).toEqual([false, false]);
    expect(pressed(headerIcon("Chat"))).toBe(inPanel === "chat");
    expect(pressed(headerIcon("Email"))).toBe(inPanel === "email");
    // …and so exactly one member has the active look.
    const members = [headerIcon("Chat")!, headerIcon("Email")!, contactDetailsButton()!];
    expect(members.filter((el) => PANEL_TOGGLE_ACTIVE.split(" ").every((c) => el.classList.contains(c)))).toHaveLength(1);
  });
});
