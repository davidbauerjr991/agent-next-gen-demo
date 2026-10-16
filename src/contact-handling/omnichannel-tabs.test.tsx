// @vitest-environment jsdom
// P-AIFIRST (k): omnichannel off means tabs. The header channel icons are
// tabs for the main column (shown while the card has more than one thread;
// voice has none), a tab or a nav row swaps the main column, hover previews
// stay for inactive tabs, and the docked panel holds Contact Details only.
// Omnichannel on is unchanged (async threads open in the docked panel).
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

async function setUp(ai: AiDisplayLocation, omnichannel: boolean) {
  await act(async () => {
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, whatsapp: true });
    getSettingsStore().update("assignments", { omnichannel });
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
  it("the requested tab, else the newest tab; voice only on a voice-only card", () => {
    const threads = [t("voice", "voice:1"), t("whatsapp", "wa:1"), t("email", "email:1")];
    expect(tabMainKey(threads, "wa:1")).toBe("wa:1");
    expect(tabMainKey(threads, "voice:1")).toBe("email:1");
    expect(tabMainKey(threads, undefined)).toBe("email:1");
    expect(tabMainKey([t("voice", "voice:1")], "voice:1")).toBe("voice:1");
  });
});

describe("omnichannel off: tabs", () => {
  for (const ai of ["inline", "panel"] as const) {
    it(`AI display ${ai}: a tab swaps the main column; the panel holds Contact Details only`, async () => {
      await setUp(ai, false);
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
    await setUp("inline", false);
    await whatsAppAndEmail();
    await hover(headerIcon("Email")!);
    expect(previews()).toHaveLength(0);
    await hover(headerIcon("WhatsApp")!);
    expect(previews()).toHaveLength(1);
  });

  it("a single-thread card has no tabs", async () => {
    await setUp("inline", false);
    await dial("email");
    await h.click(h.navCard(priya.name));
    expect(headerIcon("Email")).toBeNull();
    expect(contactDetailsButton()).toBeTruthy();
  });

  it("a call beside a tab: the voice bar, the main tab stays, no voice tab", async () => {
    await setUp("inline", false);
    await dial("email");
    await h.click(h.navCard(priya.name));
    await h.accept(await h.startInbound("voice", priya.firstPhone, priya.name));
    await h.click(h.navCard(priya.name));
    expect(h.container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
    expect(main()).toBe("email");
    expect(headerIcon("Voice")).toBeNull();
    expect(headerIcon("Voice Transcript")).toBeNull();
  });
});

describe("omnichannel on: unchanged", () => {
  it("inline: the email opens in the docked panel; the tab icons don't swap the main column", async () => {
    await setUp("inline", true);
    await h.accept(await h.startInbound("chat", priya.emailAddress!, priya.name));
    const snapshot = await act(async () => {
      const s = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      return s;
    });
    await dial("email", snapshot.interactions.find((i) => i.channel === "chat")!.journeyId);
    await h.click(h.navCard(priya.name));
    expect(main()).toBe("chat");
    await h.click(headerIcon("Email")!);
    expect(panelShows()).toBe("email");
    expect(main()).toBe("chat");
  });
});
