// @vitest-environment jsdom
// P-CANVAS: Contact Details' tabs come from a registry. Inline and main:
// Customer Information (labelled Overview), Notes, Detail, Session, and
// Transcript only when the thread isn't already on screen (an unknown
// contact: Detail, Session). Panel keeps its Overview first: the Agentic
// reference cards, the AI feed and the Copilot dock. Transcript is the thread
// read-only.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiDisplayLocation } from "@/settings/settings-schema";
import { contactDetailsTabs, isThreadOnScreen, resolveContactDetailsView } from "./contact-details-tabs";

const h = createWorkspaceHarness({ seed: SIM_DEMO_SEED });
const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;
const UNKNOWN = "(161) 474-9179";

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const panel = () => h.container.querySelector<HTMLElement>("[data-slot=right-panel]")!;
const tabRow = () => [...panel().querySelectorAll("[data-slot=contact-details-tabs] [role=tab]")].map((t) => t.textContent?.trim());
const tab = (label: string) => [...panel().querySelectorAll<HTMLElement>("[role=tab]")].find((t) => t.textContent?.trim() === label)!;
const contactDetailsButton = () =>
  [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
    (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
  )!;

async function open(displayLocation: AiDisplayLocation) {
  await act(async () => {
    getSettingsStore().updateMany(profileValues("phase2"));
    getSettingsStore().update("ai", { displayLocation });
    await vi.advanceTimersByTimeAsync(50);
  });
  await h.show(AgentWorkspaceAdvancedPage);
  await h.goAvailable();
  await h.advance(500);
}

/** Contact Details on screen (under "main" the panel may hold a thread). */
async function showContactDetails() {
  if (panel().getAttribute("data-open") !== "true" || panel().getAttribute("data-thread") !== "details") {
    await h.click(contactDetailsButton());
  }
  expect(panel().getAttribute("data-thread")).toBe("details");
}

async function noah() {
  await h.click(h.navCard("Noah Patel"));
  await h.advance(300);
}

async function dialedUnknown() {
  await act(async () => {
    const dialed = h.provider.dial({ channel: "voice", address: UNKNOWN, skillId: "general" });
    await vi.advanceTimersByTimeAsync(500);
    await dialed;
  });
  await h.click(h.navCard(UNKNOWN));
  await h.advance(300);
}

async function priyaChat() {
  const id = await h.startInbound("chat", priya.emailAddress!, priya.name);
  await h.accept(id);
  await h.click(h.navCard(priya.name));
  await h.advance(300);
}

describe("the tab set", () => {
  for (const displayLocation of ["inline", "main"] as const) {
    it(`AI display ${displayLocation}: Overview (the customer's record), Notes, Detail, Session — no Transcript while the live thread is on screen`, async () => {
      await open(displayLocation);
      await noah();
      await showContactDetails();
      expect(tabRow()).toEqual(["Overview", "Notes", "Detail", "Session"]);
      // It opens on the first tab, labelled Overview: the record's own body (Customer Information's).
      expect(tab("Overview").getAttribute("aria-selected")).toBe("true");
      // The Agentic reference cards are the reference column's, not Contact Details'.
      expect(panel().querySelector("[data-canvas-cell]")).toBeNull();
    });

    it(`AI display ${displayLocation}: an unknown live contact has Detail, Session`, async () => {
      await open(displayLocation);
      await dialedUnknown();
      await showContactDetails();
      expect(tabRow()).toEqual(["Detail", "Session"]);
    });
  }

  it("AI display panel: Overview first — the Agentic reference cards, then the AI feed and the Copilot dock; Transcript stays", async () => {
    await open("panel");
    await noah();
    await showContactDetails();
    expect(tabRow()).toEqual(["Overview", "Customer Information", "Notes", "Detail", "Transcript", "Session"]);
    expect(tab("Overview").getAttribute("aria-selected")).toBe("true");
    // The same cells (one implementation each) the reference column mounts, in its order; no Autosummary.
    expect([...panel().querySelectorAll("[data-canvas-cell]")].map((c) => c.getAttribute("data-canvas-cell"))).toEqual([
      "real-time-summary",
      "journey-summary",
      "customer-info",
    ]);
    expect(panel().querySelector("[data-slot=real-time-summary]")).not.toBeNull();
    expect(panel().querySelector("[data-slot=journey-summary]")).not.toBeNull();
    expect(panel().querySelector("[data-slot=customer-info-card]")).not.toBeNull();
    expect(h.container.querySelector("[data-slot=autosummary]")).toBeNull();
    expect(panel().querySelector("[data-slot=ai-feed]")).not.toBeNull();
    expect(panel().querySelector("[data-slot=copilot-dock]")).not.toBeNull();
  });

  it("AI display panel: an unknown contact's Overview has the summary cards and Customer Info's Link to existing customer", async () => {
    await open("panel");
    await dialedUnknown();
    await showContactDetails();
    expect(tabRow()).toEqual(["Overview", "Detail", "Transcript", "Session"]);
    expect(panel().querySelector("[data-canvas-cell=real-time-summary]")).not.toBeNull();
    expect(panel().querySelector("[data-canvas-cell=customer-info]")?.textContent).toContain("Link to existing customer");
  });

  it("AI display panel: the Session tab is the session alone (the Journey Summary and Artifacts are Overview's cards)", async () => {
    await open("panel");
    await noah();
    await showContactDetails();
    await h.click(tab("Session"));
    expect(panel().querySelector("[data-slot=journey-summary]")).toBeNull();
    expect(panel().textContent).not.toContain("Artifacts");
  });
});

describe("the Transcript tab's rule", () => {
  const ctx = (aiInPanel: boolean, threadOnScreen: boolean) => ({ aiInPanel, realCustomer: true, threadOnScreen });
  const hasTranscript = (c: ReturnType<typeof ctx>) => contactDetailsTabs(c).some((tab) => tab.id === "Transcript");

  it("per mode, contact state and toggle", () => {
    const live = { live: true, transcriptHidden: false, callOffScreen: false };
    // Inline and main: a live thread is on screen — no tab.
    expect(isThreadOnScreen({ aiInPanel: false, ...live })).toBe(true);
    // A closed card or a past session's view, a hidden call transcript, a call off screen (Lucas's): the tab.
    expect(isThreadOnScreen({ aiInPanel: false, ...live, live: false })).toBe(false);
    expect(isThreadOnScreen({ aiInPanel: false, ...live, transcriptHidden: true })).toBe(false);
    expect(isThreadOnScreen({ aiInPanel: false, ...live, callOffScreen: true })).toBe(false);
    // Panel mode: its existing rules (always the tab).
    expect(isThreadOnScreen({ aiInPanel: true, ...live })).toBe(false);

    expect(hasTranscript(ctx(false, true))).toBe(false);
    expect(hasTranscript(ctx(false, false))).toBe(true);
    expect(hasTranscript(ctx(true, false))).toBe(true);
    // The default tab stays Overview.
    expect(resolveContactDetailsView("Details", ctx(false, true))).toBe("Customer Information");
    expect(resolveContactDetailsView("Details", ctx(true, false))).toBe("Details");
    // On the Transcript tab when the thread comes back on screen: the first tab.
    expect(resolveContactDetailsView("Transcript", ctx(false, true))).toBe("Customer Information");
  });

  it("no thread (P-HOME-1m: a kind cell's customer): the record's tabs alone — no Session, Transcript or panel mode's AI Overview, through `applies`", () => {
    const ids = (c: Parameters<typeof contactDetailsTabs>[0]) => contactDetailsTabs(c).map((tab) => tab.id);
    for (const aiInPanel of [false, true]) {
      expect(ids({ aiInPanel, realCustomer: true, threadOnScreen: false, hasThread: false })).toEqual(["Customer Information", "Notes", "Detail"]);
    }
    // Unset reads as a thread: a conversation's tabs are unchanged.
    expect(ids({ aiInPanel: false, realCustomer: true, threadOnScreen: false })).toContain("Session Details");
    expect(ids({ aiInPanel: true, realCustomer: true })).toEqual(expect.arrayContaining(["Details", "Session Details"]));
  });
});

describe("the tabs' bodies", () => {
  it("Transcript: the chat read-only (its bubbles, no composer)", async () => {
    // Panel mode keeps the tab for a live chat (inline and main show the thread itself).
    await open("panel");
    await priyaChat();
    await showContactDetails();
    await h.click(tab("Transcript"));
    const transcript = panel().querySelector("[data-slot=contact-details-transcript]")!;
    expect(transcript).not.toBeNull();
    expect(transcript.querySelector("textarea")).toBeNull();
    expect(panel().querySelector("[data-slot=copilot-composer]")).toBeNull();
  });

  it("Notes: says there are none (no notes source yet)", async () => {
    await open("inline");
    await noah();
    await showContactDetails();
    await h.click(tab("Notes"));
    expect(panel().querySelector("[data-slot=customer-notes-empty]")).not.toBeNull();
  });
});

describe("resolveContactDetailsView", () => {
  const real = { aiInPanel: false, realCustomer: true };
  it("outside panel mode, Overview and the customer drill-in land on Customer Information", () => {
    expect(resolveContactDetailsView("Details", real)).toBe("Customer Information");
    expect(resolveContactDetailsView("Customer Info", real)).toBe("Customer Information");
  });
  it("an unknown contact falls back to its first tab; sub-pages pass through", () => {
    expect(resolveContactDetailsView("Customer Information", { aiInPanel: false, realCustomer: false })).toBe("Detail");
    expect(resolveContactDetailsView("Artifacts", real)).toBe("Artifacts");
  });
  it("panel mode keeps Overview and its drill-in", () => {
    expect(resolveContactDetailsView("Details", { aiInPanel: true, realCustomer: true })).toBe("Details");
    expect(resolveContactDetailsView("Customer Info", { aiInPanel: true, realCustomer: true })).toBe("Customer Info");
  });
});
