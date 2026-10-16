// @vitest-environment jsdom
// The Copilot composer on every live assignment: one composer per channel,
// placed by Settings → AI display (inline at the bottom of the main column,
// or the docked Contact Details panel's footer), its chips above the input.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { CopilotComposer } from "@/components/copilot-composer";
import { MARCUS_WEBB_SCRIPT } from "@/scenarios";
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
      it(`${channel}, AI display ${displayLocation}: exactly one composer, in the right place, the input before the chips`, async () => {
        await liveAssignment(channel, displayLocation);
        const all = composers();
        expect(all).toHaveLength(1);
        const [composer] = all;
        // "main" docks the panel-style composer at the bottom of the main column.
        expect(composer.dataset.placement).toBe(displayLocation === "inline" ? "inline" : "panel");
        if (displayLocation !== "panel") {
          expect(composer.closest("[data-main-thread]")).not.toBeNull();
          expect(composer.closest("[data-slot=right-panel]")).toBeNull();
        } else {
          expect(composer.closest("[data-slot=right-panel]")).not.toBeNull();
          expect(composer.closest("[data-main-thread]")).toBeNull();
        }
        // The input comes first, then the chips (the channel's own).
        const chips = composer.querySelector("[data-slot=copilot-chips]")!;
        const input = composer.querySelector("textarea, input")!;
        expect(chips).not.toBeNull();
        expect(input).not.toBeNull();
        expect(input.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(copilotSuggestionsFor(channel)).toContain(chips.querySelector("[role=button]")?.textContent?.trim());
      });
    }
  }

  for (const displayLocation of AI_DISPLAY_LOCATIONS) {
    it(`Marcus Webb's scripted call, AI display ${displayLocation}: exactly one composer`, async () => {
      await h.show(AgentWorkspaceAdvancedPage);
      await act(async () => {
        getSettingsStore().update("ai", { displayLocation });
        await vi.advanceTimersByTimeAsync(50);
      });
      await h.play(MARCUS_WEBB_SCRIPT.id);
      await h.click(h.navCard("Marcus Webb"));
      await h.advance(1_000);
      expect(composers()).toHaveLength(1);
      expect(composers()[0].dataset.placement).toBe(displayLocation === "inline" ? "inline" : "panel");
    });
  }
});

describe("the Hide AI Actions switch: only on a chat in the main column, AI display inline", () => {
  const hasSwitch = () => [...document.body.querySelectorAll("label")].some((l) => l.textContent?.trim() === "Hide AI Actions");

  it("present on a chat in inline mode", async () => {
    await liveAssignment("chat", "inline");
    expect(hasSwitch()).toBe(true);
  });

  for (const channel of ["voice", "email", "sms", "whatsapp"] as const) {
    it(`absent on ${channel}`, async () => {
      await liveAssignment(channel, "inline");
      expect(hasSwitch()).toBe(false);
    });
  }

  it("absent on a chat in panel mode", async () => {
    await liveAssignment("chat", "panel");
    expect(hasSwitch()).toBe(false);
  });
});

describe("CopilotComposer layout (measured, not a breakpoint)", () => {
  let root: Root;
  let host: HTMLDivElement;
  let composerWidth = 0;
  const ROW_WIDTH = 600;

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const slot = this.dataset.slot;
      const width = slot === "copilot-row-measure" ? ROW_WIDTH : slot === "copilot-composer" ? composerWidth : 0;
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  async function renderAt(width: number) {
    composerWidth = width;
    await act(async () => {
      root.render(
        <CopilotComposer
          placement="panel"
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          suggestions={copilotSuggestionsFor("chat")}
          onActivateSuggestion={() => {}}
          takeover={{ label: "Takeover Chat", onClick: () => {} }}
        />,
      );
    });
    const composer = host.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;
    const takeover = composer.querySelector<HTMLElement>("[data-slot=copilot-takeover]")!;
    const chips = composer.querySelector<HTMLElement>("[data-slot=copilot-chips]")!;
    return { composer, takeover, chips };
  }

  it("wide: the chips and Takeover share one row below the input", async () => {
    const { composer, takeover, chips } = await renderAt(ROW_WIDTH + 100);
    expect(composer.dataset.layout).toBe("row");
    expect(takeover.parentElement).toBe(chips.parentElement);
    expect(takeover.parentElement).not.toBe(composer);
    expect(takeover.className).not.toContain("w-full");
    const input = composer.querySelector("textarea, input")!;
    expect(input.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("narrow: Takeover goes below the chips, full width", async () => {
    const { composer, takeover, chips } = await renderAt(ROW_WIDTH - 1);
    expect(composer.dataset.layout).toBe("stacked");
    // Its own line in the composer's column, not inside the chips row.
    expect(takeover.parentElement).toBe(composer);
    expect(chips.compareDocumentPosition(takeover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(takeover.className).toContain("w-full");
  });
});

describe("copilotSuggestionsFor (pure)", () => {
  it("follows the channel", () => {
    expect(copilotSuggestionsFor("voice")).toContain("Summarize this call");
    expect(copilotSuggestionsFor("email")).toContain("Draft a reply");
    expect(copilotSuggestionsFor("chat")).toContain("Suggest a reply");
    expect(copilotSuggestionsFor("sms")).toContain("Suggest a reply");
  });
});
