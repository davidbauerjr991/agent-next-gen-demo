// @vitest-environment jsdom
// The Copilot composer on every live assignment: one composer per channel,
// placed by Settings → AI display (inline at the bottom of the main column,
// or the docked Contact Details panel's footer), its chips above the input.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import type { ChannelKind } from "@/domain/interaction";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { copilotSuggestionsFor } from "@/contact-handling/copilot-suggestions";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { AI_DISPLAY_LOCATIONS, type AiSettings } from "./settings-schema";

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

const CHANNELS: ChannelKind[] = ["voice", "chat", "email", "sms", "whatsapp"];

/** A live assignment on `channel` for Priya, her card selected. */
async function liveAssignment(channel: ChannelKind, displayLocation: AiSettings["displayLocation"]) {
  await h.show(AgentWorkspaceAdvancedPage);
  await act(async () => {
    getSettingsStore().update("channels", { voice: true, chat: true, email: true, sms: true, whatsapp: true });
    getSettingsStore().update("ai", { displayLocation });
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.goAvailable();
  const address = channel === "chat" || channel === "email" ? priya.emailAddress! : priya.firstPhone;
  if (channel === "voice" || channel === "chat") {
    await h.accept(await h.startInbound(channel, address, priya.name));
    await h.click(h.navCard(priya.name));
  } else {
    // The sim has no inbound email, SMS or WhatsApp: an outbound (its card is
    // labelled by the address).
    await act(async () => {
      const dialed = h.provider.dial({ channel, address, skillId: "general" });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    await h.click(h.navCard(address));
  }
}

const composers = () => [...document.body.querySelectorAll<HTMLElement>("[data-slot=copilot-composer]")];

describe("the Copilot composer on every live assignment", () => {
  for (const displayLocation of AI_DISPLAY_LOCATIONS) {
    for (const channel of CHANNELS) {
      it(`${channel}, AI display ${displayLocation}: exactly one composer, in the right place, chips above the input`, async () => {
        await liveAssignment(channel, displayLocation);
        const all = composers();
        expect(all).toHaveLength(1);
        const [composer] = all;
        expect(composer.dataset.placement).toBe(displayLocation);
        if (displayLocation === "inline") {
          expect(composer.closest("[data-main-thread]")).not.toBeNull();
          expect(composer.closest("[data-slot=right-panel]")).toBeNull();
        } else {
          expect(composer.closest("[data-slot=right-panel]")).not.toBeNull();
          expect(composer.closest("[data-main-thread]")).toBeNull();
        }
        // Chips (the channel's own) come before the input in the DOM.
        const chips = composer.querySelector("[data-slot=copilot-chips]")!;
        const input = composer.querySelector("textarea, input")!;
        expect(chips).not.toBeNull();
        expect(input).not.toBeNull();
        expect(chips.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(copilotSuggestionsFor(channel)).toContain(chips.querySelector("[role=button]")?.textContent?.trim());
      });
    }
  }
});

describe("copilotSuggestionsFor (pure)", () => {
  it("follows the channel", () => {
    expect(copilotSuggestionsFor("voice")).toContain("Summarize this call");
    expect(copilotSuggestionsFor("email")).toContain("Draft a reply");
    expect(copilotSuggestionsFor("chat")).toContain("Suggest a reply");
    expect(copilotSuggestionsFor("sms")).toContain("Suggest a reply");
  });
});
