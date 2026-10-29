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
/** Contact Details on screen (P-HOME-1n): the reference slide-over, its button pressed. */
const detailsShowing = () => !!h.container.querySelector("[data-slot=reference-slide-over]") && pressed(contactDetailsButton());

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
    it(`a Customers-table WhatsApp card (AI display ${mode}): the hover's View customer info opens Contact Details in the slide-over`, async () => {
      await customersTableWhatsApp(mode);
      if (mode === "main") expect(panelShows()).toBe("whatsapp");
      await viewCustomerInfoFromHover();
      // P-HOME-1n: Contact Details is the reference slide-over, its toggle pressed; the docked panel keeps what it
      // had — the WhatsApp thread under "main" (both on screen), panel mode's AI Overview under "panel".
      expect(detailsShowing()).toBe(true);
      if (mode === "main") {
        expect(panelShows()).toBe("whatsapp");
        expect(pressed(headerIcon("WhatsApp"))).toBe(true);
        expect(headerIcon("WhatsApp")!.getAttribute("data-in-main")).toBeNull();
      } else {
        // Panel mode: WhatsApp is the card's lone thread, in the main column with no tab (k3).
        expect(headerIcon("WhatsApp")).toBeNull();
        expect(panelShows()).toBe("details");
      }
      // The toggle closes it again.
      await h.click(contactDetailsButton()!);
      await h.advance(400);
      expect(pressed(contactDetailsButton())).toBe(false);
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
      getSettingsStore().update("ai", { displayLocation: "inline" });
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    // A WhatsApp, then an email on the same card: tabs (AI display inline), the email (newest) is the main tab.
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

    // Contact Details open (the reference slide-over, P-HOME-1n), the email in main: both active; WhatsApp default.
    if (!detailsShowing()) await h.click(contactDetailsButton()!);
    expect(detailsShowing()).toBe(true);
    const [email, whatsApp, details] = [headerIcon("Email")!, headerIcon("WhatsApp")!, contactDetailsButton()!];
    expect([active(email), active(details), anyActive(whatsApp)]).toEqual([true, true, false]);
    // Omnichannel off, so the icons are tabs (P-AIFIRST (k)): the main tab is the pressed one.
    expect([pressed(email), pressed(details)]).toEqual([true, true]);
    const whatsAppOff = classes(whatsApp);
    const emailOn = classes(email);
    const detailsOn = classes(details);

    // The WhatsApp tab swaps the main column: it's the one active tab; Contact Details stays.
    await h.click(whatsApp);
    expect(h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread")).toBe("whatsapp");
    expect(detailsShowing()).toBe(true);
    const [email2, whatsApp2] = [headerIcon("Email")!, headerIcon("WhatsApp")!];
    expect([active(whatsApp2), anyActive(email2), active(contactDetailsButton()!)]).toEqual([true, false, true]);
    for (const el of [whatsApp2, email2]) expect(el.getAttribute("data-preview-open")).toBeNull();
    const whatsAppOn = classes(whatsApp2);
    // Clicking the active tab changes nothing.
    await h.click(whatsApp2);
    expect(h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread")).toBe("whatsapp");

    // Contact Details off: the slide-over closes.
    await h.click(contactDetailsButton()!);
    await h.advance(400);
    expect(pressed(contactDetailsButton())).toBe(false);
    const detailsOff = classes(contactDetailsButton()!);

    // Becoming active adds and removes the same classes on an icon and on Contact Details,
    // and the two tabs carry the same classes when active.
    expect(minus(whatsAppOn, whatsAppOff)).toEqual(minus(detailsOn, detailsOff));
    expect(minus(whatsAppOff, whatsAppOn)).toEqual(minus(detailsOff, detailsOn));
    expect([...emailOn].sort()).toEqual([...whatsAppOn].sort());
  });

  it("tabs (inline, panel): exactly one tab is main and pressed, the other swaps it, the panel never shows a thread; main: only the panel's thread", async () => {
    await chatAndEmailCard();
    const inMain = (label: string) => headerIcon(label)!.getAttribute("data-in-main") === "true";
    const mainThread = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
    for (const displayLocation of ["inline", "panel"] as const) {
      await act(async () => {
        getSettingsStore().update("ai", { displayLocation });
        await vi.advanceTimersByTimeAsync(50);
      });
      const [main, other] = mainThread() === "chat" ? ["Chat", "Email"] : ["Email", "Chat"];
      expect([pressed(headerIcon(main)), inMain(main), pressed(headerIcon(other)), inMain(other)]).toEqual([true, true, false, false]);
      // The other tab swaps the main column; the panel never shows a thread.
      await h.click(headerIcon(other)!);
      expect(mainThread()).toBe(other.toLowerCase());
      expect([pressed(headerIcon(other)), pressed(headerIcon(main))]).toEqual([true, false]);
      expect(["chat", "email"]).not.toContain(panelShows());
      // Clicking the main tab is a no-op.
      await h.click(headerIcon(other)!);
      expect(mainThread()).toBe(other.toLowerCase());
    }
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
