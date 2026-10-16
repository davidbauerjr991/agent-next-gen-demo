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

/** Asks Copilot with the composer's first chip (it fills the input), then
 *  Submit; `rotate` first moves the chips on with the refresh button. */
async function ask(rotate = false): Promise<string> {
  if (rotate) await h.click(composer().querySelector('[data-slot=copilot-chips-refresh] button')!);
  const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
  const text = chip.textContent!.trim();
  await h.click(chip);
  await h.click(composer().querySelector('button[aria-label="Submit"]')!);
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

describe("a Copilot result row toggles the interior slide-over (email contact)", () => {
  for (const displayLocation of AI_DISPLAY_LOCATIONS) {
    it(`AI display ${displayLocation}: open, close by the row and by its X, swap to another row`, async () => {
      await emailContact(displayLocation);
      const first = await ask();
      const second = await ask(true);
      expect(first).not.toBe(second);
      const container = displayLocation === "inline" ? "[data-main-thread]" : "[data-slot=right-panel]";
      expect(row(first).closest(container)).not.toBeNull();
      expect(openResult()).toBeNull();

      // Click → open, inside the row's container, with that result.
      await h.click(row(first));
      expect(openResult()).not.toBeNull();
      expect(openResult()!.closest(container)).not.toBeNull();
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
