// @vitest-environment jsdom
// P-AIFIRST (k), (k3): AI display decides where threads open. Inline and
// panel: the header channel icons are tabs for the main column, voice
// included (its tab is the call's AI workspace), shown while the card has
// more than one thread; a tab or a nav row swaps the main column, hover
// previews stay for inactive tabs, and the docked panel holds Contact
// Details only. "main" is unchanged (every thread in the docked panel).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import type { Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { EntityId, JourneyId } from "@/domain";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiDisplayLocation } from "@/settings/settings-schema";
import { tabMainKey } from "./omnichannel";
import { PANEL_TOGGLE_ACTIVE } from "./panel-toggle";

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
const navRow = (label: string) => h.container.querySelector<HTMLElement>(`aside [aria-label^="${label} channel"]`)!;
const main = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
const panel = () => h.container.querySelector("[data-slot=right-panel]");
const panelShows = () => (panel()?.getAttribute("data-open") === "true" ? panel()!.getAttribute("data-thread") : null);
const previews = () => [...document.body.querySelectorAll<HTMLElement>("[data-slot=hover-preview]")];
const active = (el: HTMLElement) => PANEL_TOGGLE_ACTIVE.split(" ").every((c) => el.classList.contains(c));

async function hover(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
  });
}

async function setUp(ai: AiDisplayLocation) {
  await act(async () => {
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, whatsapp: true });
    getSettingsStore().update("ai", { displayLocation: ai });
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
}

/** Dials Priya on `channel` (into `journeyId`'s card, if given); returns the journey. */
async function dial(channel: "whatsapp" | "email", journeyId?: string) {
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

/** Priya's card: a WhatsApp, then an email; selected. Omnichannel off: the email (newest) is the main tab. */
async function whatsAppAndEmail() {
  const journey = await dial("whatsapp");
  await dial("email", journey);
  await h.click(h.navCard(priya.name));
  await h.advance(300);
}

describe("tabMainKey", () => {
  const t = (type: Thread["type"], id: string) => ({ type, id }) as Thread;
  it("the requested thread (voice included: every thread is a tab), else the newest", () => {
    const threads = [t("voice", "voice:1"), t("whatsapp", "wa:1"), t("email", "email:1")];
    expect(tabMainKey(threads, "wa:1")).toBe("wa:1");
    expect(tabMainKey(threads, "voice:1")).toBe("voice:1");
    expect(tabMainKey(threads, undefined)).toBe("email:1");
    expect(tabMainKey(threads, "gone:1")).toBe("email:1");
  });
});

describe("AI display inline and panel: tabs", () => {
  for (const ai of ["inline", "panel"] as const) {
    it(`AI display ${ai}: a tab swaps the main column; the panel holds Contact Details only`, async () => {
      await setUp(ai);
      await whatsAppAndEmail();
      expect(main()).toBe("email");
      // Exactly one tab active: the main one.
      expect([active(headerIcon("Email")!), active(headerIcon("WhatsApp")!)]).toEqual([true, false]);
      await h.click(headerIcon("WhatsApp")!);
      expect(main()).toBe("whatsapp");
      expect([active(headerIcon("Email")!), active(headerIcon("WhatsApp")!)]).toEqual([false, true]);
      // The panel never shows a thread: Contact Details or closed.
      expect(["details", null]).toContain(panelShows());
      if (panelShows() !== "details") await h.click(contactDetailsButton());
      expect(panelShows()).toBe("details");
      expect(active(contactDetailsButton())).toBe(true);
      expect(active(headerIcon("WhatsApp")!)).toBe(true);
      // The nav row does the same as the tab.
      await h.click(navRow("Email"));
      expect(main()).toBe("email");
      expect(panelShows()).toBe("details");
    });
  }

  it("hover previews: the inactive tab previews, the active one doesn't", async () => {
    await setUp("inline");
    await whatsAppAndEmail();
    await hover(headerIcon("Email")!);
    expect(previews()).toHaveLength(0);
    await hover(headerIcon("WhatsApp")!);
    expect(previews()).toHaveLength(1);
  });

  it("a single-thread card has no tabs", async () => {
    await setUp("inline");
    await dial("email");
    await h.click(h.navCard(priya.name));
    expect(headerIcon("Email")).toBeNull();
    expect(contactDetailsButton()).toBeTruthy();
  });

  // k2: an accepted chat always becomes its card's tab, over a tab the agent
  // picked, whether or not the card is selected (the selected card stays).
  for (const selected of [true, false]) {
    it(`an accepted chat becomes its card's tab over a picked tab (card ${selected ? "selected" : "not selected"})`, async () => {
      await setUp("inline");
      // Lauren (no directory record, so the chat finds her card by address): a WhatsApp, then an email.
      let journey = "";
      for (const channel of ["whatsapp", "email"] as const) {
        await act(async () => {
          const dialed = h.provider.dial({
            channel,
            address: channel === "email" ? "lauren@example.com" : "+13125550123",
            skillId: "general",
            contactName: "Lauren Briggs",
            ...(journey ? { journeyId: journey as JourneyId } : {}),
          });
          await vi.advanceTimersByTimeAsync(300);
          const id = await dialed;
          const snapshot = h.provider.getSnapshot();
          await vi.advanceTimersByTimeAsync(50);
          journey = (await snapshot).interactions.find((i) => i.id === id)!.journeyId;
        });
      }
      await h.click(h.navCard("Lauren Briggs"));
      // The agent picks the WhatsApp tab.
      await h.click(headerIcon("WhatsApp")!);
      expect(main()).toBe("whatsapp");
      if (!selected) {
        // Another card is selected while the chat arrives.
        await act(async () => {
          const dialed = h.provider.dial({ channel: "email", address: "dan.ortiz@example.com", skillId: "general", contactName: "Dan Ortiz" });
          await vi.advanceTimersByTimeAsync(300);
          await dialed;
        });
        await h.click(h.navCard("Dan Ortiz"));
        expect(main()).toBe("email");
      }
      await h.startInbound("chat", "lauren@example.com", "Lauren Briggs");
      await h.advance(1_000);
      // It joined Lauren's card (one card for her).
      expect(h.container.querySelectorAll("aside [aria-label^='Lauren Briggs']").length).toBe(1);
      const header = () => h.container.querySelector("[data-record-header] h1, h1")?.textContent ?? "";
      if (selected) {
        expect(main()).toBe("chat");
      } else {
        // The selected card stays Dan's; Lauren's card now opens on the chat.
        expect(header()).toContain("Dan Ortiz");
        expect(main()).toBe("email");
        await h.click(h.navCard("Lauren Briggs"));
        expect(main()).toBe("chat");
      }
      expect(headerIcon("Chat")!.getAttribute("aria-pressed")).toBe("true");
      expect(headerIcon("WhatsApp")!.getAttribute("aria-pressed")).toBe("false");
    });
  }

  // k3: voice is a tab too (row 11); its main column is the call's AI workspace,
  // never empty. In panel mode the AI feed leaves Contact Details meanwhile.
  for (const ai of ["inline", "panel"] as const) {
    it(`AI display ${ai}: a call is a tab; its main column is the AI workspace (Autosummary, composer); the voice bar stays`, async () => {
      await setUp(ai);
      // Priya's call, then an email on the same card.
      const callId = await h.startInbound("voice", priya.firstPhone, priya.name);
      await h.accept(callId);
      const snapshot = await act(async () => {
        const s = h.provider.getSnapshot();
        await vi.advanceTimersByTimeAsync(50);
        return s;
      });
      await dial("email", snapshot.interactions.find((i) => i.id === callId)!.journeyId);
      await h.click(h.navCard(priya.name));
      expect(h.container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
      const voiceTab = () => headerIcon("Voice Transcript")!;
      expect(voiceTab()).toBeTruthy();
      if (main() !== "voice") await h.click(voiceTab());
      expect(main()).toBe("voice");
      expect(active(voiceTab())).toBe(true);
      const mainColumn = h.container.querySelector("[data-main-thread]")!;
      expect(mainColumn.querySelector("[data-slot=ai-workspace] [data-slot=autosummary]")).toBeTruthy();
      expect(mainColumn.querySelector("[data-slot=copilot-composer]")).toBeTruthy();
      // The feed is in one place: the main column's AI workspace, not Contact Details.
      if (panelShows() !== "details") await h.click(contactDetailsButton());
      expect(panel()!.querySelector("[data-slot=ai-feed]")).toBeNull();
      expect(document.body.querySelectorAll("[data-slot=copilot-composer]")).toHaveLength(1);
      // The email tab: the email in main; panel mode's feed is back in Contact Details.
      await h.click(headerIcon("Email")!);
      expect(main()).toBe("email");
      expect(!!panel()!.querySelector("[data-slot=ai-feed]")).toBe(ai === "panel");
    });
  }
});

describe("AI display \"main\": unchanged", () => {
  it("every thread opens in the docked panel; the main column stays the AI workspace", async () => {
    await setUp("main");
    await h.accept(await h.startInbound("chat", priya.emailAddress!, priya.name));
    const snapshot = await act(async () => {
      const s = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      return s;
    });
    await dial("email", snapshot.interactions.find((i) => i.channel === "chat")!.journeyId);
    await h.click(h.navCard(priya.name));
    expect(main()).toBe("ai");
    await h.click(headerIcon("Email")!);
    expect(panelShows()).toBe("email");
    expect(main()).toBe("ai");
  });
});
