// @vitest-environment jsdom
// Browser check round 2 (2026-10-16): the record header's hover previews and
// the AI cards around them. The thread preview is the panel's own body (with
// the Autosummary); the main column's thread previews nothing; a toggle click
// closes any preview; a trigger keeps its hover look while its preview is
// open; AI display "panel" docks the Copilot composer in the Contact Details
// preview; the Autosummary is blue and enters like the other AI cards;
// Marcus's case has no Next Best Action card.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { AI_CARD_ENTER } from "@/components/agent-next-gen-transcript";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT } from "@/scenarios";
import type { EntityId, JourneyId } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import type { AiDisplayLocation } from "./settings-schema";

const h = createWorkspaceHarness();
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;

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
const previews = () => [...document.body.querySelectorAll<HTMLElement>("[data-slot=hover-preview]")];
const composers = () => [...document.body.querySelectorAll<HTMLElement>("[data-slot=copilot-composer]")];

/** Rests the pointer on `el` for `ms` (past the previews' 250ms open delay by default). */
async function hover(el: HTMLElement, ms = 300) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function leave(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
    await vi.advanceTimersByTimeAsync(300);
  });
}
async function settings(ai: AiDisplayLocation) {
  await act(async () => {
    getSettingsStore().update("channels", { chat: true, email: true, whatsapp: true });
    getSettingsStore().update("ai", { displayLocation: ai });
    await vi.advanceTimersByTimeAsync(50);
  });
}
async function dial(channel: "whatsapp" | "email", journeyId?: string) {
  let id = "";
  let journey = "";
  await act(async () => {
    const dialed = h.provider.dial({
      channel,
      address: channel === "email" ? priya.emailAddress! : priya.firstPhone,
      skillId: "general",
      entityId: priya.id as EntityId,
      contactName: priya.name,
      ...(journeyId ? { journeyId: journeyId as JourneyId } : {}),
    });
    await vi.advanceTimersByTimeAsync(300);
    const result = (await dialed) as unknown as { id: string };
    id = result.id ?? (result as unknown as string);
    const snapshot = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    journey = (await snapshot).interactions.find((i) => i.id === id)!.journeyId;
  });
  return journey;
}

/** Priya (a directory customer): WhatsApp, then an email on the same card,
 *  the card selected; inline, omnichannel off, so the email is the main thread. */
async function whatsAppAndEmail(ai: AiDisplayLocation = "inline") {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await settings(ai);
  const journey = await dial("whatsapp");
  await dial("email", journey);
  await h.click(h.navCard(priya.name));
  await h.advance(300);
}

describe("header hover previews", () => {
  it("inline, email in the main column: its icon previews nothing; WhatsApp's previews the conversation only (no AI, k6 5)", async () => {
    await whatsAppAndEmail();
    expect(h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread")).toBe("email");
    await hover(headerIcon("Email")!);
    expect(previews()).toHaveLength(0);
    await hover(headerIcon("WhatsApp")!);
    const preview = previews()[0];
    expect(preview).toBeDefined();
    const body = preview.querySelector("[data-slot=thread-preview]")!.textContent!;
    // The conversation only (k6 5): its transcript (session row), no Autosummary or other AI, no Contact Details.
    expect(body).not.toContain("Autosummary");
    expect(body).toMatch(/Messages/);
    for (const contactDetails of ["Customer Info", "Journey Summary", "Next Best Action", "Artifacts"]) expect(body).not.toContain(contactDetails);
    // Its composer is the customer chat with quick replies; no Ask Copilot.
    expect(preview.textContent).not.toContain("Ask Copilot");
    expect(preview.querySelector("[data-slot=copilot-composer]")).toBeNull();
    expect(preview.querySelector('textarea[placeholder^="Type a message"]')).not.toBeNull();
    expect(preview.querySelector('[aria-label="Quick replies"], [title="Quick replies"]')).not.toBeNull();
  });

  it("the trigger keeps its hover look while its preview is open, including with the pointer inside the popover", async () => {
    await whatsAppAndEmail();
    const icon = headerIcon("WhatsApp")!;
    expect(icon.getAttribute("data-preview-open")).toBeNull();
    await hover(icon);
    await hover(previews()[0]);
    expect(headerIcon("WhatsApp")!.getAttribute("data-preview-open")).toBe("true");
    expect(headerIcon("WhatsApp")!.className).toContain("bg-lyra-state-hover");
  });

  it("clicking a toggle closes the open preview at once and selects per the mode's rule", async () => {
    await whatsAppAndEmail();
    await hover(headerIcon("WhatsApp")!);
    expect(previews()).toHaveLength(1);
    await h.click(headerIcon("WhatsApp")!);
    expect(previews()).toHaveLength(0);
    // Omnichannel off: the icons are tabs (P-AIFIRST (k)); WhatsApp is now the main tab.
    const main = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
    expect(main()).toBe("whatsapp");
    expect(headerIcon("WhatsApp")!.getAttribute("aria-pressed")).toBe("true");
    expect(headerIcon("Email")!.getAttribute("aria-pressed")).toBe("false");
    // Clicking the active tab is a no-op; the other tab swaps back.
    await h.click(headerIcon("WhatsApp")!);
    expect(main()).toBe("whatsapp");
    await h.click(headerIcon("Email")!);
    expect(main()).toBe("email");
    expect(headerIcon("Email")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("unread: a preview that opened counts as reading (the badge clears on hover-off); a glancing hover doesn't", async () => {
    // AI display "main" (threads in the panel, where unread counts apply): a chat and a WhatsApp on Priya's card.
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await settings("main");
    await h.startInbound("chat", priya.emailAddress!, priya.name);
    await h.advance(500);
    await act(async () => {
      const snapshot = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      const chat = (await snapshot).interactions.find((i) => i.channel === "chat")!;
      const dialed = h.provider.dial({ channel: "whatsapp", address: priya.firstPhone, skillId: "general", journeyId: chat.journeyId as JourneyId });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    await h.click(h.navCard(priya.name));
    // Send three WhatsApp messages from the panel, then close it: the
    // (simulated) customer replies land while the thread isn't showing.
    await h.click(headerIcon("WhatsApp")!);
    const panel = () => h.container.querySelector("[data-slot=right-panel]")!;
    for (let i = 0; i < 3; i++) {
      const input = panel().querySelector<HTMLTextAreaElement>('textarea[placeholder^="Type a message"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, `Message ${i}`);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(10);
      });
      await h.click([...panel().querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === "Send")!);
    }
    await h.click(headerIcon("WhatsApp")!);
    await h.advance(4_000);
    // lyra's Button draws its badge as an overlay beside the button, in the same wrapper.
    const badge = () => headerIcon("WhatsApp")!.parentElement!.textContent?.trim();
    expect(badge()).toBe("3");
    // A glancing hover (shorter than the open delay) opens nothing and keeps the count.
    await hover(headerIcon("WhatsApp")!, 100);
    await leave(headerIcon("WhatsApp")!);
    expect(previews()).toHaveLength(0);
    expect(badge()).toBe("3");
    // An opened preview, then hover-off: read.
    await hover(headerIcon("WhatsApp")!);
    expect(previews()).toHaveLength(1);
    await leave(headerIcon("WhatsApp")!);
    expect(previews()).toHaveLength(0);
    expect(badge()).toBe("");
  });

  it("one header icon per channel: two email threads → one email icon reading 2; two rows in the nav", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await settings("inline");
    const journey = await dial("whatsapp");
    await act(async () => {
      for (const address of ["priya.shah@example.com", "priya.billing@example.com"]) {
        const dialed = h.provider.dial({ channel: "email", address, skillId: "general", entityId: priya.id as EntityId, journeyId: journey as JourneyId });
        await vi.advanceTimersByTimeAsync(300);
        await dialed;
      }
    });
    await h.click(h.navCard(priya.name));
    const emailIcons = h.container.querySelectorAll('[aria-label="Open Email preview"], [aria-label="Close Email preview"]');
    expect(emailIcons).toHaveLength(1);
    expect(emailIcons[0].parentElement!.textContent?.trim()).toBe("2");
    const emailRows = [...h.container.querySelectorAll("aside [aria-label^='Email channel']")];
    expect(emailRows).toHaveLength(2);
  });

  it("AI display panel: the Contact Details preview carries the one Copilot composer; the docked panel gets it back", async () => {
    await whatsAppAndEmail("panel");
    // Panel mode opens Contact Details on activation; close it to preview.
    if (contactDetailsButton().getAttribute("aria-pressed") === "true") await h.click(contactDetailsButton());
    await hover(contactDetailsButton());
    expect(previews()).toHaveLength(1);
    expect(composers()).toHaveLength(1);
    expect(composers()[0].closest("[data-slot=hover-preview]")).not.toBeNull();
    expect(composers()[0].closest("[data-main-thread]")).toBeNull();
    await h.click(contactDetailsButton());
    expect(previews()).toHaveLength(0);
    expect(composers()).toHaveLength(1);
    expect(composers()[0].closest("[data-slot=right-panel]")).not.toBeNull();
  });
});

describe("AI cards", () => {
  it("the Autosummary header uses Customer Info's header token and the shared enter animation", async () => {
    await whatsAppAndEmail();
    const title = [...h.container.querySelectorAll("[data-main-thread] *")].find(
      (el) => el.children.length === 0 && el.textContent?.trim() === "Autosummary",
    )!;
    expect(title).toBeDefined();
    expect(title.closest(".bg-lyra-status-info-subtle")).not.toBeNull();
    expect(title.closest(".lyra-purple-soft-header-fix")).toBeNull();
    for (const cls of AI_CARD_ENTER.split(" ")) expect(title.closest(`.${cls.replace(/[^\w-]/g, "\\$&")}`)).not.toBeNull();
  });

  for (const ai of ["inline", "panel", "main"] as const) {
    it(`the Autosummary is one AutosummaryCard (AI display ${ai}), once, where the mode puts the AI overview`, async () => {
      await whatsAppAndEmail(ai);
      if (ai === "panel" && h.container.querySelector("[data-slot=right-panel]")?.getAttribute("data-thread") !== "details") await h.click(contactDetailsButton());
      const cards = [...h.container.querySelectorAll("[data-slot=autosummary]")];
      expect(cards).toHaveLength(1);
      const where = ai === "panel" ? "[data-slot=right-panel]" : "[data-main-thread]";
      expect(cards[0].closest(where)).not.toBeNull();
    });
  }

  it("AI display main, Lucas: once taken over, no Takeover button in the main column; the panel's chat composer is enabled", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await settings("main");
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(14_000);
    const main = () => h.container.querySelector("[data-main-thread=ai]")!;
    const takeover = () => [...main().querySelectorAll<HTMLElement>("button")].find((b) => /takeover/i.test(b.textContent ?? ""));
    const panelInput = () => h.container.querySelector<HTMLTextAreaElement>("[data-slot=right-panel] textarea");
    expect(takeover()).toBeDefined();
    expect(panelInput()).toBeNull(); // under review: no chat input yet
    await h.click(takeover()!);
    await h.advance(3_000);
    expect(takeover()).toBeUndefined();
    expect(panelInput()).not.toBeNull();
    expect(panelInput()!.disabled).toBe(false);
  });

  for (const ai of ["inline", "panel", "main"] as const) {
    it(`Marcus (AI display ${ai}): his approval request is its own card, with no Next Best Action card`, async () => {
      await h.show(AgentWorkspaceAdvancedPage);
      await settings(ai);
      await h.play(MARCUS_WEBB_SCRIPT.id);
      await h.click(h.navCard("Marcus Webb"));
      await h.advance(20_000);
      expect(document.body.textContent).not.toContain("Next Best Action");
      expect(document.body.textContent).toContain("Approval request");
    });
  }
});
