// @vitest-environment jsdom
// A Copilot result row toggles the interior slide-over inside the container
// the row lives in (the main column inline, the Contact Details panel in
// panel mode): click opens it with that result, the same row or its close
// closes it, another row swaps the content. On a contact with no script,
// on a channel with no chat thread (email).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { registerCardResult } from "@/test-utils/copilot-results";
import { registerCopilotResult } from "@/contact-handling/copilot-results";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
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

/** An outbound email to Priya (the sim has no inbound email), her card selected. */
async function emailContact(displayLocation: AiSettings["displayLocation"]) {
  await h.show(AgentWorkspaceAdvancedPage);
  await act(async () => {
    getSettingsStore().update("channels", { email: true });
    getSettingsStore().update("ai", { displayLocation });
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.goAvailable();
  await act(async () => {
    const dialed = h.provider.dial({ channel: "email", address: priya.emailAddress!, skillId: "general" });
    await vi.advanceTimersByTimeAsync(300);
    await dialed;
  });
  await h.click(h.navCard(priya.emailAddress!));
}

const composer = () => document.body.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;

/** Asks Copilot with the composer's first chip (Settings → AI's default chip
 *  behaviour, "run": the click asks it); `rotate` first moves the chips on
 *  with the refresh button. */
async function ask(rotate = false): Promise<string> {
  if (rotate) await h.click(composer().querySelector('[data-slot=copilot-chips-refresh] button')!);
  const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
  const text = chip.textContent!.trim();
  // A card result (a plain answer is a line, with no row, P-LAYOUT-F1 F).
  registerCardResult(text);
  await h.click(chip);
  await h.advance(2_500);
  return text;
}

const row = (text: string) =>
  [...document.body.querySelectorAll<HTMLElement>("button")].find(
    (b) => b.textContent?.startsWith(text) && b.textContent.includes("John Smith"),
  )!;

/** The slide-over's Copilot result, while it's open (closed, it stays mounted but hidden). */
function openResult(): HTMLElement | null {
  const result = document.body.querySelector<HTMLElement>("[data-slot=copilot-result]");
  const shell = result?.closest<HTMLElement>('[style*="visibility"]');
  return result && shell?.style.visibility === "visible" ? result : null;
}

/** Inline and main: in the reference slot beside the main column (not inside
 *  the main column or the panel), below the record header. Panel: inside the
 *  panel. */
function expectSlideOverPlacement(displayLocation: AiSettings["displayLocation"]) {
  const result = openResult()!;
  if (displayLocation !== "panel") {
    expect(result.closest("[data-slot=content-card]")).not.toBeNull();
    expect(result.closest("[data-slot=reference-slide-over]")).not.toBeNull();
    expect(result.closest("[data-main-thread]")).toBeNull();
    expect(result.closest("[data-slot=right-panel]")).toBeNull();
  } else {
    expect(result.closest("[data-slot=right-panel]")).not.toBeNull();
  }
}

describe("a Copilot result row toggles the interior slide-over (email contact)", () => {
  for (const displayLocation of AI_DISPLAY_LOCATIONS) {
    it(`AI display ${displayLocation}: open, close by the row and by its X, swap to another row`, async () => {
      await emailContact(displayLocation);
      const first = await ask();
      const second = await ask(true);
      expect(first).not.toBe(second);
      const rowContainer = displayLocation !== "panel" ? "[data-main-thread]" : "[data-slot=right-panel]";
      expect(row(first).closest(rowContainer)).not.toBeNull();
      // Each ask opens its result once Copilot "finishes" (P-HOME-1j): the last one asked is showing.
      expect(openResult()!.textContent).toContain(second);
      await h.click(row(second));
      expect(openResult()).toBeNull();

      // Click → open, with that result: over the whole content card inline,
      // inside the Contact Details panel in panel mode.
      await h.click(row(first));
      expect(openResult()).not.toBeNull();
      expectSlideOverPlacement(displayLocation);
      expect(openResult()!.textContent).toContain(first);

      // The same row again → closed.
      await h.click(row(first));
      expect(openResult()).toBeNull();

      // Another row → open with the other content; a different row while open swaps it.
      await h.click(row(first));
      await h.click(row(second));
      expect(openResult()!.textContent).toContain(second);
      expect(openResult()!.textContent).not.toContain(first);

      // Its close → closed.
      const shell = openResult()!.closest<HTMLElement>('[style*="visibility"]')!;
      const close = [...shell.querySelectorAll<HTMLElement>("button")].find((b) => /close/i.test(b.getAttribute("aria-label") ?? ""))!;
      await h.click(close);
      expect(openResult()).toBeNull();
    });
  }
});

describe("a card result with no artifact (P-LAYOUT-F1 F)", () => {
  it("logs its row and result but opens nothing on its own; the row opens it", async () => {
    await emailContact("inline");
    const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
    const text = chip.textContent!.trim();
    // Too long for a line (four bullets), with no artifact: the rule itself, so this test's own result.
    registerCopilotResult(text, { summary: "What Copilot found.", points: ["One.", "Two.", "Three.", "Four."] });
    await h.click(chip);
    await h.advance(2_500);
    expect(row(text)).toBeTruthy();
    expect(openResult()).toBeNull();
    await h.click(row(text));
    expect(openResult()!.textContent).toContain("Four.");
  });
});

describe("an unscripted voice call has an AI feed for its Copilot rows", () => {
  /** An outbound call to an unknown number (no script, no utterances), its card selected. */
  async function unscriptedCall(displayLocation: AiSettings["displayLocation"]) {
    await h.show(AgentWorkspaceAdvancedPage);
    await act(async () => {
      getSettingsStore().update("ai", { displayLocation });
      await vi.advanceTimersByTimeAsync(50);
    });
    await h.goAvailable();
    await act(async () => {
      const dialed = h.provider.dial({ channel: "voice", address: "(161) 474-9179", skillId: "general" });
      await vi.advanceTimersByTimeAsync(500);
      await dialed;
    });
    await h.click(h.navCard("(161) 474-9179"));
  }

  for (const displayLocation of AI_DISPLAY_LOCATIONS) {
    it(`AI display ${displayLocation}: "Summarize this call" adds a row in the feed, and the row toggles the slide-over`, async () => {
      await unscriptedCall(displayLocation);
      const chip = [...composer().querySelectorAll<HTMLElement>("[data-slot=copilot-chips] [role=button]")].find(
        (c) => c.textContent?.trim() === "Summarize this call",
      )!;
      expect(chip).toBeTruthy();
      registerCardResult("Summarize this call");
      // The chip asks on the click ("run").
      await h.click(chip);
      await h.advance(2_500);

      // The interstitial row, in the feed: the main column inline and main, the panel in panel mode (k5: a call follows AI display).
      const feed = displayLocation !== "panel" ? "[data-main-thread]" : "[data-slot=right-panel]";
      const summarize = row("Summarize this call");
      expect(summarize).toBeTruthy();
      expect(summarize.closest(feed)).not.toBeNull();

      // Its result (the unscripted placeholder) opened by itself once Copilot "finished" (P-HOME-1j); the row closes
      // it and reopens it.
      expect(openResult()?.textContent).toContain("Summarize this call");
      expectSlideOverPlacement(displayLocation);
      await h.click(summarize);
      expect(openResult()).toBeNull();
      await h.click(row("Summarize this call"));
      expect(openResult()?.textContent).toContain("Summarize this call");
    });
  }
});

describe("a plain answer's line goes where the AI rows go (P-LAYOUT-F1 F)", () => {
  /** The line answering `question`, in `container`. */
  const lineIn = (container: string, question: string) =>
    [...document.body.querySelectorAll<HTMLElement>(`${container} [data-event-line]`)].find((l) => l.textContent?.includes(`Copilot · ${question}`));

  for (const displayLocation of AI_DISPLAY_LOCATIONS) {
    it(`AI display ${displayLocation}: an email's chip answers with a line in the feed (the panel under panel), not the other column; nothing opens`, async () => {
      await emailContact(displayLocation);
      const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
      const text = chip.textContent!.trim();
      await h.click(chip);
      await h.advance(2_500);
      const [feed, other] = displayLocation !== "panel" ? ["[data-main-thread]", "[data-slot=right-panel]"] : ["[data-slot=right-panel]", "[data-main-thread]"];
      expect(lineIn(feed, text)).toBeTruthy();
      expect(lineIn(other, text)).toBeUndefined();
      expect(row(text)).toBeUndefined();
      expect(openResult()).toBeNull();
    });
  }

  it("while Copilot works, the instruction row's \"performing\" state stands where the line will land; then the line replaces it", async () => {
    await emailContact("panel");
    const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
    const text = chip.textContent!.trim();
    await h.click(chip);
    await h.advance(100);
    const panel = () => document.body.querySelector<HTMLElement>("[data-slot=right-panel]")!;
    expect(panel().textContent).toContain("AI agent is performing this now…");
    expect(lineIn("[data-slot=right-panel]", text)).toBeUndefined();
    await h.advance(2_000);
    expect(lineIn("[data-slot=right-panel]", text)).toBeTruthy();
    expect(panel().textContent).not.toContain("AI agent is performing this now…");
    expect(row(text)).toBeUndefined();
  });

  it("an unscripted call's \"Summarize this call\" answers with a line in its feed", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await act(async () => {
      const dialed = h.provider.dial({ channel: "voice", address: "(161) 474-9179", skillId: "general" });
      await vi.advanceTimersByTimeAsync(500);
      await dialed;
    });
    await h.click(h.navCard("(161) 474-9179"));
    const chip = [...composer().querySelectorAll<HTMLElement>("[data-slot=copilot-chips] [role=button]")].find((c) => c.textContent?.trim() === "Summarize this call")!;
    await h.click(chip);
    await h.advance(2_500);
    expect(lineIn("[data-main-thread]", "Summarize this call")?.textContent).toContain("Here is what Copilot found");
    expect(openResult()).toBeNull();
  });
});
