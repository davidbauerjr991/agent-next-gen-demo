// @vitest-environment jsdom
// P-AIFIRST (k5), the browser-pass fixes that jsdom can see: a call under
// AI display "main" is a panel thread (A); Session Details per thread (B);
// Outcome and the status pill on a new outbound tab (C); the Journey Summary
// enters like the AI cards (E); the Contact Details hover preview hands an
// action off to the docked panel (G); unread badges on inactive tabs (I).
// Layout and animation (the voice tab's width, the cross-fade D, the preview
// with no enter animation H) are in e2e/k5-browser-pass.spec.ts.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { AI_CARD_ENTER } from "@/components/transcript/InteractionTranscript";
import type { EntityId, JourneyId } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiDisplayLocation } from "@/settings/settings-schema";

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
const panel = () => h.container.querySelector("[data-slot=right-panel]")!;
const panelShows = () => (panel()?.getAttribute("data-open") === "true" ? panel().getAttribute("data-thread") : null);
const main = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");

async function setUp(ai: AiDisplayLocation) {
  await act(async () => {
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, whatsapp: true, sms: true });
    getSettingsStore().update("ai", { displayLocation: ai });
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
}

async function dial(channel: "whatsapp" | "email" | "sms", journeyId?: string) {
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
    const id = await dialed;
    const snapshot = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    journey = (await snapshot).interactions.find((i) => i.id === id)!.journeyId;
  });
  return journey;
}

/** Priya: a call, then an email on the same card; the card selected. */
async function callAndEmail() {
  const callId = await h.startInbound("voice", priya.firstPhone, priya.name);
  await h.accept(callId);
  const snapshot = await act(async () => {
    const s = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    return s;
  });
  await dial("email", snapshot.interactions.find((i) => i.id === callId)!.journeyId);
  await h.click(h.navCard(priya.name));
}

describe("A: a call under AI display \"main\" is a panel thread", () => {
  it("its own header icon opens its transcript in the panel; the main column stays the AI workspace; the voice bar stays", async () => {
    await setUp("main");
    await callAndEmail();
    expect(main()).toBe("ai");
    await h.click(headerIcon("Voice Transcript")!);
    expect(panelShows()).toBe("voice");
    expect(main()).toBe("ai");
    expect(h.container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
  });
});

describe("B: Session Details is per channel", () => {
  // P-HOME-1n: Session Details is its own slide-over (the reference slot), opened from the session row; no tab.
  const sessionSlideOver = () => h.container.querySelector("[data-slot=reference-slide-over] [data-slot=session-slide-over]");
  const sessionLink = () =>
    [...h.container.querySelectorAll<HTMLElement>("[data-slot=record-session-row] button")].find((b) => /Session Details|View Details/.test(b.textContent ?? ""))!;

  it("inline: the session row's Session Details opens the selected tab's channel in the slide-over, never the 'Select View Details' placeholder", async () => {
    await setUp("inline");
    const journey = await dial("whatsapp");
    await dial("email", journey);
    await h.click(h.navCard(priya.name));
    await h.click(sessionLink());
    await h.advance(100);
    const body = () => sessionSlideOver()?.textContent ?? "";
    expect(body()).not.toContain("on a session to see its details");
    expect(body()).toContain("Email");
    await h.click(headerIcon("WhatsApp")!);
    expect(main()).toBe("whatsapp");
    await h.click(sessionLink());
    await h.advance(100);
    expect(body()).not.toContain("on a session to see its details");
    expect(body()).toContain("WhatsApp");
  });

  it("main: the panel thread's session row is in the panel header; its View Details opens Session Details in the reference slide-over, the thread staying in the panel", async () => {
    await setUp("main");
    const journey = await dial("whatsapp");
    await dial("email", journey);
    await h.click(h.navCard(priya.name));
    if (panelShows() !== "email") await h.click(headerIcon("Email")!);
    expect(panelShows()).toBe("email");
    // A new outbound email is a draft (no Outcome) until its Send (E2).
    await h.click(panel().querySelector<HTMLElement>("[data-slot=email-draft-send]")!);
    const row = () => panel().querySelector("[data-slot=panel-session-row]");
    expect(row()).not.toBeNull();
    expect(row()!.querySelector('[aria-label="Outcome"], [title="Outcome"]')).not.toBeNull();
    const sessionDetails = [...row()!.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("View Details"))!;
    expect(sessionDetails).toBeTruthy();
    await h.click(sessionDetails);
    await h.advance(100);
    // P-HOME-1n: Session Details is the reference slide-over under every AI display; the thread stays in the panel.
    expect(sessionSlideOver()?.textContent).toContain("Contact ID");
    expect(panelShows()).toBe("email");
    expect(panel().textContent).toContain("Coming soon");
  });
});

describe("C: Outcome and the status pill on every channel tab", () => {
  for (const ai of ["inline", "panel"] as const) {
    it(`AI display ${ai}: an outbound SMS tab, once a message is sent, shows Outcome and its status pill`, async () => {
      await setUp(ai);
      await dial("sms");
      await h.click(h.navCard(priya.name));
      const mainColumn = h.container.querySelector("[data-main-thread=sms]")!;
      expect(mainColumn).not.toBeNull();
      // k6 9: a draft until something is sent.
      const input = mainColumn.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Type a message"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Hi Priya");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(10);
      });
      await h.click([...mainColumn.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === "Send")!);
      // The tab's session row is the record header's second line (P-CANVAS browser pass).
      const sessionRow = h.container.querySelector("[data-slot=record-header] [data-slot=record-session-row]")!;
      expect(sessionRow.querySelector('[aria-label="Outcome"], [title="Outcome"]')).not.toBeNull();
      expect([...sessionRow.querySelectorAll("button, [role=button]")].some((el) => /^(New|Open|Pending)/.test(el.textContent?.trim() ?? ""))).toBe(true);
    });
  }
});

describe("E: the Journey Summary enters with the other AI cards", () => {
  it("its card carries the AI cards' enter animation (panel mode: on the docked panel's AI Overview, P-HOME-1n)", async () => {
    await setUp("panel");
    await dial("email");
    await h.click(h.navCard(priya.name));
    const card = panel().querySelector("[data-slot=journey-summary]");
    expect(card).not.toBeNull();
    const entering = card!.closest(`.${"animate-in"}`);
    expect(entering).not.toBeNull();
    for (const c of AI_CARD_ENTER.split(" ")) expect(entering!.className).toContain(c);
  });
});

describe("G: the Contact Details hover preview hands an action to Contact Details", () => {
  it("AI display panel: an action in the preview closes it and opens Contact Details (the reference slide-over, P-HOME-1n)", async () => {
    await setUp("panel");
    await dial("email");
    await h.click(h.navCard(priya.name));
    await act(async () => {
      contactDetailsButton().dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(400);
    });
    const preview = document.body.querySelector("[data-slot=hover-preview]")!;
    expect(preview).not.toBeNull();
    // Any action in it (a link or button; not an expand toggle or a tab).
    const action = [...preview.querySelectorAll<HTMLElement>("button, a")].find(
      (el) => !el.hasAttribute("aria-expanded") && el.getAttribute("role") !== "tab" && !el.closest("[data-slot=contact-details-tabs]"),
    )!;
    expect(action).toBeTruthy();
    await h.click(action);
    await h.advance(100);
    expect(h.container.querySelector("[data-slot=reference-slide-over]")).not.toBeNull();
    expect(document.body.querySelector("[data-slot=hover-preview]")).toBeNull();
  });
});

describe("I: unread badges on inactive tabs", () => {
  it("customer messages on a tab that isn't the main one count on its icon; showing it clears the count", async () => {
    await setUp("inline");
    const chatId = await h.startInbound("chat", priya.emailAddress!, priya.name);
    await h.advance(500);
    const snapshot = await act(async () => {
      const s = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      return s;
    });
    await dial("email", snapshot.interactions.find((i) => i.id === chatId)!.journeyId);
    await h.click(h.navCard(priya.name));
    // On the chat tab, send two messages; the (simulated) replies land 2.5s
    // later, after the agent has moved to the email tab.
    if (main() !== "chat") await h.click(headerIcon("Chat")!);
    for (const text of ["One moment", "Checking now"]) {
      const input = h.container.querySelector<HTMLTextAreaElement>('[data-main-thread] textarea[placeholder^="Type a message"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(10);
      });
      await h.click([...h.container.querySelectorAll<HTMLElement>("[data-main-thread] button")].find((b) => b.textContent?.trim() === "Send")!);
    }
    await h.click(headerIcon("Email")!);
    expect(main()).toBe("email");
    await h.advance(4_000);
    const badge = () => headerIcon("Chat")!.parentElement!.textContent?.trim();
    expect(badge()).toBe("2");
    await h.click(headerIcon("Chat")!);
    expect(main()).toBe("chat");
    expect(badge()).toBe("");
  });
});
