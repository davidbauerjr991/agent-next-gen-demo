// @vitest-environment jsdom
// P-EXTRACT, Bug 2: a slide-over wouldn't open after an AI display switch.
// Lucas's approve and decline rows (the "AI agent is performing this now…"
// interstitials) remount when the layout moves them, and a remounted row
// showed its 1.8s spinner again: not clickable. The row's "performed" state
// is a time on the message now, so a row past it is clickable at once. The
// slide-over's placement follows AI display and its content kind in the same
// render, and its selection is the card's.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import type { EntityId } from "@/domain";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { LUCAS_THOMAS_SCRIPT } from "@/scenarios";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiDisplayLocation } from "@/settings/settings-schema";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const APPROVE_ROW = "Authorize and place order NR-11056";
const DECLINE_NOTE = "Card payments are paused";
const DECLINE_ROW = `Declined: ${DECLINE_NOTE}`;

const PERFORMING = "AI agent is performing this now";
const buttonText = (root: ParentNode, text: string) => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === text);
const radio = (title: string) => [...document.body.querySelectorAll<HTMLElement>('[role="radio"]')].find((r) => r.textContent?.trim() === title)!;
/** An instruction row: a button starting with its title, by John Smith. */
const row = (title: string) =>
  [...document.body.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith(title) && b.textContent.includes("John Smith"));
const performing = () => document.body.textContent?.includes(PERFORMING) ?? false;
/** The interior slide-over showing `title` while open (closed, it stays mounted, hidden): lyra
 *  `InteriorPanel`'s content whose header carries the row's title. The docked Contact Details panel
 *  is an InteriorPanel too, and its Artifacts card names the same panel; the header tells them apart. */
const openSlideOver = (title: string) =>
  [...document.body.querySelectorAll<HTMLElement>('[style*="visibility"]')].find(
    (el) => el.style.visibility === "visible" && el.firstElementChild?.textContent?.includes(title),
  ) ?? null;

async function setAi(displayLocation: AiDisplayLocation) {
  await act(async () => {
    getSettingsStore().update("ai", { displayLocation });
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function lucas() {
  await h.show(AgentWorkspaceAdvancedPage);
  await setAi("inline");
  await h.play(LUCAS_THOMAS_SCRIPT.id);
  await h.click(h.navCard("Lucas Thomas"));
  // Past "Approval requested" (12.3s) and the approval card.
  await h.advance(14_000);
}

async function approve() {
  await h.click(radio("Approve the Exception"));
  await h.click(buttonText(document.body, "Authorize and Place Order")!);
  // The instruction beat (150ms), then its spinner (1.8s).
  await h.advance(3_000);
}

async function decline() {
  await h.click(radio("Decline the exception"));
  const note = document.body.querySelector<HTMLTextAreaElement>("#approval-decision-note")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(note, DECLINE_NOTE);
    note.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.click(buttonText(document.body, "Perform Task")!);
  await h.advance(3_000);
}

/** The Settings page and back to Lucas's card, the way an agent switches (Settings deselects the card). */
async function settingsRoundTrip(displayLocation: AiDisplayLocation) {
  const settings = [...h.container.querySelectorAll<HTMLElement>("aside button, aside [role=button]")].find(
    (el) => el.textContent?.trim() === "Settings" || el.getAttribute("aria-label") === "Settings",
  )!;
  await h.click(settings);
  await setAi(displayLocation);
  await h.click(h.navCard("Lucas Thomas"));
}

const decisions = [
  { name: "approve", act: approve, title: APPROVE_ROW },
  { name: "decline", act: decline, title: DECLINE_ROW },
] as const;
const switches = [
  { name: "a direct switch", to: (ai: AiDisplayLocation) => setAi(ai) },
  { name: "the Settings round trip", to: settingsRoundTrip },
] as const;

describe("Bug 2a: an interstitial row is clickable right after a mode switch", () => {
  // Guards: these pass on HEAD too (a finished row stays finished across a remount) and must keep passing.
  for (const decision of decisions) {
    for (const via of switches) {
      for (const to of ["panel", "main"] as const) {
        it(`${decision.name}, inline → ${to} by ${via.name}: the row is a button at once and opens its slide-over`, async () => {
          await lucas();
          await decision.act();
          expect(row(decision.title)).toBeTruthy();
          expect(performing()).toBe(false);

          await via.to(to);
          await h.advance(100);
          expect(performing()).toBe(false);
          const r = row(decision.title);
          expect(r).toBeTruthy();
          await h.click(r!);
          expect(openSlideOver(decision.title)).not.toBeNull();
        });
      }
    }
  }
});

// `it.fails`: fails on HEAD (the spinner restarts on the remount); P-EXTRACT C4 flips these to `it`.
describe("Bug 2a: a switch during the spinner doesn't restart it", () => {
  for (const to of ["panel", "main"] as const) {
    it.fails(`approve, inline → ${to} 300ms after deciding: the row is clickable 1.8s after it appeared, not 1.8s after the switch`, async () => {
      await lucas();
      await h.click(radio("Approve the Exception"));
      await h.click(buttonText(document.body, "Authorize and Place Order")!);
      // The instruction beat lands at 150ms; switch while its spinner runs.
      await h.advance(300);
      expect(performing()).toBe(true);
      await setAi(to);
      // 150ms + 1,800ms after deciding the row is done; the switch was at ~400ms.
      await h.advance(1_700);
      expect(performing()).toBe(false);
      expect(row(APPROVE_ROW)).toBeTruthy();
    });
  }
});

// The reported path: Copilot result rows (`useCopilotAsk`, not scenario annotations) on an ordinary card,
// asked under one AI display, then the display switched: the pre-switch row in Contact Details' Overview feed
// did nothing, a row asked after the switch opened.
describe("Bug 2c: a Copilot result row asked before a mode switch still opens its result", () => {
  const david = CREATE_NEW_CUSTOMERS.find((c) => c.name === "David Santos") ?? CREATE_NEW_CUSTOMERS[0];
  const composer = () => document.body.querySelector<HTMLElement>("[data-slot=copilot-composer]")!;
  /** The slide-over's Copilot result while it's open (closed, it stays mounted but hidden). */
  const openResult = () => {
    const result = document.body.querySelector<HTMLElement>("[data-slot=copilot-result]");
    const shell = result?.closest<HTMLElement>('[style*="visibility"]');
    return result && shell?.style.visibility === "visible" ? result : null;
  };
  /** Asks Copilot with the composer's first chip ("Draft a reply" first on an email); the chips move on
   *  once one is used. Returns the chip's text, which is the row's title. */
  async function ask(rotate = false): Promise<string> {
    if (rotate) await h.click(composer().querySelector("[data-slot=copilot-chips-refresh] button")!);
    const chip = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!;
    const text = chip.textContent!.trim();
    await h.click(chip);
    await h.click(composer().querySelector('button[aria-label="Submit"]')!);
    await h.advance(2_500);
    return text;
  }
  async function davidsEmail(displayLocation: AiDisplayLocation) {
    await h.show(AgentWorkspaceAdvancedPage);
    await act(async () => {
      getSettingsStore().update("channels", { email: true });
      await vi.advanceTimersByTimeAsync(50);
    });
    await setAi(displayLocation);
    await h.goAvailable();
    await act(async () => {
      const dialed = h.provider.dial({ channel: "email", address: david.emailAddress!, skillId: "general", entityId: david.id as EntityId, contactName: david.name });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    await h.click(h.navCard(david.name));
  }

  // The Copilot composer is portaled into whichever dock node exists; a switch changes the node, so the composer
  // remounts and its chips start over. One stable host per surface (C6) keeps it mounted. `it.fails` until C6.
  it.fails("panel → main: the composer keeps its moved-on chips across the switch", async () => {
    await davidsEmail("panel");
    await h.click(composer().querySelector("[data-slot=copilot-chips-refresh] button")!);
    const first = composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!.textContent!.trim();
    await setAi("main");
    await h.advance(300);
    expect(composer().querySelector<HTMLElement>("[data-slot=copilot-chips] [role=button]")!.textContent!.trim()).toBe(first);
  });

  // A row's result is identified by its link, `instruction:copilot:<text>:<h:mm>`: the same question asked again in
  // the same minute (the chips start over after a switch, so the agent re-asks) gives two rows one identity, and
  // clicking one while the other's result is open closes it instead of opening its own. Keyed by the row (its
  // message id) from P-EXTRACT C4. `it.fails` until then.
  it.fails("the same question asked twice (before and after a switch): each row opens its own result, and only it reads active", async () => {
    await davidsEmail("inline");
    const question = await ask();
    await setAi("panel");
    await h.advance(300);
    expect(await ask()).toBe(question); // the chips started over
    const rows = () => [...document.body.querySelectorAll<HTMLElement>("button")].filter((b) => b.textContent?.startsWith(question) && b.textContent.includes("John Smith"));
    expect(rows()).toHaveLength(2);
    await h.click(rows()[1]);
    expect(openResult()).not.toBeNull();
    expect(rows().map((r) => r.getAttribute("aria-current"))).toEqual([null, "true"]);
    // The other row (asked before the switch) swaps to its own result; it doesn't close the open one.
    await h.click(rows()[0]);
    expect(openResult()).not.toBeNull();
    expect(rows().map((r) => r.getAttribute("aria-current"))).toEqual(["true", null]);
  });

  // Guards in jsdom (pass on HEAD); the reported failure is checked in Chrome, e2e/interstitial-mode-switch.spec.ts.
  for (const [from, to] of [
    ["inline", "panel"],
    ["inline", "main"],
    ["main", "panel"],
    ["panel", "main"],
  ] as const) {
    it(`${from} → ${to}: the pre-switch row opens its result, like a row asked after the switch`, async () => {
      await davidsEmail(from);
      const before = await ask();
      expect(row(before), before).toBeTruthy();

      await setAi(to);
      await h.advance(300);
      // A row asked after the switch opens (the control).
      // (The chips start over after a switch, so move them on for a different question.)
      const after = await ask(true);
      expect(after).not.toBe(before);
      await h.click(row(after)!);
      expect(openResult()?.textContent).toContain(after);
      await h.click(row(after)!);
      expect(openResult()).toBeNull();

      // The row asked before the switch.
      await h.click(row(before)!);
      expect(openResult()?.textContent).toContain(before);
    });
  }
});

describe("Bug 2b: the slide-over follows the layout, and its selection is the card's", () => {
  it("an open slide-over stays open across inline → panel → inline, in the content card inline and in the panel under panel", async () => {
    await lucas();
    await approve();
    await h.click(row(APPROVE_ROW)!);
    const open = () => openSlideOver(APPROVE_ROW);
    expect(open()?.closest("[data-slot=content-card]")).toBeTruthy();
    expect(open()?.closest("[data-slot=right-panel]")).toBeNull();

    await setAi("panel");
    await h.advance(100);
    expect(open()?.closest("[data-slot=right-panel]")).toBeTruthy();

    await setAi("inline");
    await h.advance(100);
    expect(open()?.closest("[data-slot=content-card]")).toBeTruthy();
    expect(open()?.closest("[data-slot=right-panel]")).toBeNull();
  });
});
