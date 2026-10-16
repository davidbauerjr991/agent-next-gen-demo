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
  it("selected = what the panel shows (single); inline/panel also mark the main column's thread 'in main'; main: no in-main mark", async () => {
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
  });
});
