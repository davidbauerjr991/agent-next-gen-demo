// @vitest-environment jsdom
// Digital assignments load as cards (user, 2026-10-16): a chat, email, SMS or
// WhatsApp offer is accepted by the workspace itself; only an inbound call
// rings for Accept / Decline.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { PROFILES } from "@/settings/profiles";
import { SettingsView } from "@/components/settings/SettingsView";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

async function stateOf(id: string) {
  let state: string | undefined;
  await act(async () => {
    const snapshot = h.provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(50);
    state = (await snapshot).interactions.find((i) => i.id === id)?.state;
  });
  return state;
}

describe("digital offers load as cards", () => {
  it("an inbound chat goes live and shows as a card without an accept", async () => {
    await act(async () => getSettingsStore().update("channels", { chat: true }));
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    const id = await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz");
    await h.advance(500);
    expect(await stateOf(id)).toBe("active");
    expect(h.navCard("Dan Ortiz")).toBeTruthy();
  });

  // Browser check round 2, item 1: the email card is selected (the sim has no
  // inbound email, so it's an outbound one), then a chat arrives for the same
  // address. It joins the card as a second row and activates "added": the
  // panel opens with the chat, the main column stays on the email.
  for (const omnichannel of [true, false]) {
    it(`a chat arriving for the selected email card joins it and opens beside it (omnichannel ${omnichannel ? "on" : "off"})`, async () => {
      await act(async () => {
        getSettingsStore().update("channels", { chat: true, email: true });
        getSettingsStore().update("assignments", { omnichannel });
      });
      await h.show(AgentWorkspaceAdvancedPage);
      await h.goAvailable();
      await act(async () => {
        const dialed = h.provider.dial({ channel: "email", address: "lauren@example.com", skillId: "general", contactName: "Lauren Briggs" });
        await vi.advanceTimersByTimeAsync(300);
        await dialed;
      });
      await h.click(h.navCard("Lauren Briggs"));
      const main = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
      const panel = () => h.container.querySelector("[data-slot=right-panel]");
      expect(main()).toBe("email");

      await h.startInbound("chat", "lauren@example.com", "Lauren Briggs");
      await h.advance(1_000);
      const rows = [...h.navCard("Lauren Briggs").closest("li, [data-slot=nav-card], div")!.parentElement!.querySelectorAll("[aria-label$=' channel'], [aria-label*=' channel,']")]
        .map((row) => row.getAttribute("aria-label")!.split(" ")[0]);
      expect(rows).toEqual(expect.arrayContaining(["Email", "Chat"]));
      expect(main()).toBe("email");
      expect(panel()?.getAttribute("data-open")).toBe("true");
      expect(panel()?.getAttribute("data-thread")).toBe("chat");
    });
  }

  describe("Settings → Assignments → Auto-accept off for a channel", () => {
    const offerButton = (label: string) =>
      [...h.navCard("Dan Ortiz").closest("aside")!.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === label);

    async function chatOfferWithAutoAcceptOff() {
      await act(async () => {
        getSettingsStore().update("channels", { chat: true });
        getSettingsStore().update("assignments", { autoAccept: { chat: false, email: true, sms: true, whatsapp: true } });
      });
      await h.show(AgentWorkspaceAdvancedPage);
      await h.goAvailable();
      const id = await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz");
      await h.advance(500);
      return id;
    }

    it("the chat stays offered and shows as a card with Accept / Decline; Accept puts it live", async () => {
      const id = await chatOfferWithAutoAcceptOff();
      expect(await stateOf(id)).toBe("offered");
      expect(h.navCard("Dan Ortiz")).toBeTruthy();
      expect(offerButton("Accept")).toBeDefined();
      await h.click(offerButton("Accept")!);
      await h.advance(500);
      expect(await stateOf(id)).toBe("active");
    });

    it("Decline: the offer ends and its card goes", async () => {
      const id = await chatOfferWithAutoAcceptOff();
      await h.click(offerButton("Decline")!);
      await h.advance(500);
      expect(await stateOf(id)).not.toBe("offered");
      expect(h.container.querySelector("aside")?.textContent).not.toContain("Dan Ortiz");
      // The toast names the channel: a chat, not a call.
      expect(document.body.textContent).toContain("Dan Ortiz chat declined");
    });

    it("Settings: one checkbox per digital channel writes it; every built-in profile leaves auto-accept on", async () => {
      await h.render(<SettingsView />);
      const row = h.container.querySelector('[data-checkbox-row="Auto-accept"]')!;
      const boxes = [...row.querySelectorAll<HTMLElement>('button[role="checkbox"]')];
      expect(boxes).toHaveLength(4);
      expect(boxes.every((b) => b.getAttribute("aria-checked") === "true")).toBe(true);
      await h.click(boxes[0]);
      expect(getSettingsStore().getState().values.assignments.autoAccept).toEqual({ chat: false, email: true, sms: true, whatsapp: true });
      for (const id of ["phase1", "phase2", "aifirst"] as const) {
        expect(Object.values(PROFILES[id].assignments.autoAccept).every(Boolean)).toBe(true);
      }
    });
  });

  it("an inbound call still rings: it stays offered until the agent accepts", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    const id = await h.startInbound("voice", "(312) 555-0164", "Lauren Briggs");
    await h.advance(500);
    expect(await stateOf(id)).toBe("offered");
  });
});
