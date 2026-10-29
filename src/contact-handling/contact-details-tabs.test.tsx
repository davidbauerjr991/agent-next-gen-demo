// @vitest-environment jsdom
// P-CANVAS: Contact Details' tabs come from a registry: Customer Information (labelled Overview), Notes, Detail, and
// Transcript only when the thread isn't already on screen (an unknown contact: Detail). P-HOME-1n: Contact Details
// opens in the reference slide-over under every AI display; Session left the tabs (its own slide-over), and panel
// mode's Overview — the Agentic reference cards, the AI feed and the Copilot dock — is the docked panel's content.
// Transcript is the thread read-only.
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

/** Contact Details' slide-over (the reference slot). */
const slideOver = () => h.container.querySelector<HTMLElement>("[data-slot=reference-slide-over]");
/** The docked right panel. */
const docked = () => h.container.querySelector<HTMLElement>("[data-slot=right-panel]")!;
const tabRow = () => [...(slideOver()?.querySelectorAll("[data-slot=contact-details-tabs] [role=tab]") ?? [])].map((t) => t.textContent?.trim());
const tab = (label: string) => [...slideOver()!.querySelectorAll<HTMLElement>("[role=tab]")].find((t) => t.textContent?.trim() === label)!;
const contactDetailsButton = () =>
  [...h.container.querySelectorAll<HTMLElement>("button[data-contact-details]")].find((b) => !b.closest("[data-slot=right-panel]"))!;

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

/** Contact Details on screen: the slide-over. */
async function showContactDetails() {
  if (!slideOver()?.querySelector("[data-slot=contact-details-tabs]")) await h.click(contactDetailsButton());
  await h.advance(100);
  expect(slideOver()?.querySelector("[data-slot=contact-details-tabs]")).not.toBeNull();
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

describe("the tab set (in the reference slide-over)", () => {
  for (const displayLocation of ["inline", "main"] as const) {
    it(`AI display ${displayLocation}: Overview (the customer's record), Notes, Detail — no Session, no Transcript while the live thread is on screen`, async () => {
      await open(displayLocation);
      await noah();
      await showContactDetails();
      expect(tabRow()).toEqual(["Overview", "Notes", "Detail"]);
      // It opens on the first tab, labelled Overview: the record's own body (Customer Information's).
      expect(tab("Overview").getAttribute("aria-selected")).toBe("true");
      // The Agentic reference cards are the reference column's, not Contact Details'.
      expect(slideOver()!.querySelector("[data-canvas-cell]")).toBeNull();
    });

    it(`AI display ${displayLocation}: an unknown live contact has Detail`, async () => {
      await open(displayLocation);
      await dialedUnknown();
      await showContactDetails();
      expect(tabRow()).toEqual(["Detail"]);
    });
  }

  it("AI display panel: the docked panel is the AI Overview — the Agentic reference cards, the AI feed and the Copilot dock — with no tab row; Contact Details' tabs are in the slide-over, Transcript among them", async () => {
    await open("panel");
    await noah();
    // The same cells (one implementation each) the reference column mounts, in its order; no Autosummary.
    expect([...docked().querySelectorAll("[data-canvas-cell]")].map((c) => c.getAttribute("data-canvas-cell"))).toEqual([
      "real-time-summary",
      "journey-summary",
      "customer-info",
    ]);
    expect(h.container.querySelector("[data-slot=autosummary]")).toBeNull();
    expect(docked().querySelector("[data-slot=ai-feed]")).not.toBeNull();
    expect(docked().querySelector("[data-slot=copilot-dock]")).not.toBeNull();
    expect(docked().querySelector("[data-slot=contact-details-tabs]")).toBeNull();
    await showContactDetails();
    expect(tabRow()).toEqual(["Customer Information", "Notes", "Detail", "Transcript"]);
  });

  it("AI display panel: an unknown contact's Overview has the summary cards and Customer Info's Link to existing customer", async () => {
    await open("panel");
    await dialedUnknown();
    expect(docked().querySelector("[data-canvas-cell=real-time-summary]")).not.toBeNull();
    expect(docked().querySelector("[data-canvas-cell=customer-info]")?.textContent).toContain("Link to existing customer");
    await showContactDetails();
    expect(tabRow()).toEqual(["Detail", "Transcript"]);
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
    // A stored "Details" (panel mode's old Overview tab) lands on the first tab in every mode.
    expect(resolveContactDetailsView("Details", ctx(false, true))).toBe("Customer Information");
    expect(resolveContactDetailsView("Details", ctx(true, false))).toBe("Customer Information");
    // On the Transcript tab when the thread comes back on screen: the first tab.
    expect(resolveContactDetailsView("Transcript", ctx(false, true))).toBe("Customer Information");
  });

  it("no thread (P-HOME-1m: a kind cell's customer): the record's tabs alone, through `applies`; Session and Overview are no tabs anywhere", () => {
    const ids = (c: Parameters<typeof contactDetailsTabs>[0]) => contactDetailsTabs(c).map((tab) => tab.id);
    for (const aiInPanel of [false, true]) {
      expect(ids({ aiInPanel, realCustomer: true, threadOnScreen: false, hasThread: false })).toEqual(["Customer Information", "Notes", "Detail"]);
    }
    expect(ids({ aiInPanel: false, realCustomer: true, threadOnScreen: false })).toEqual(["Customer Information", "Notes", "Detail", "Transcript"]);
    expect(ids({ aiInPanel: true, realCustomer: true })).not.toEqual(expect.arrayContaining(["Details"]));
    expect(ids({ aiInPanel: true, realCustomer: true })).not.toEqual(expect.arrayContaining(["Session Details"]));
  });
});

describe("the tabs' bodies", () => {
  it("Transcript: the chat read-only (its bubbles, no composer)", async () => {
    // Panel mode keeps the tab for a live chat (inline and main show the thread itself).
    await open("panel");
    await priyaChat();
    await showContactDetails();
    await h.click(tab("Transcript"));
    const transcript = slideOver()!.querySelector("[data-slot=contact-details-transcript]")!;
    expect(transcript).not.toBeNull();
    expect(transcript.querySelector("textarea")).toBeNull();
    expect(slideOver()!.querySelector("[data-slot=copilot-composer]")).toBeNull();
  });

  it("Notes: says there are none (no notes source yet)", async () => {
    await open("inline");
    await noah();
    await showContactDetails();
    await h.click(tab("Notes"));
    expect(slideOver()!.querySelector("[data-slot=customer-notes-empty]")).not.toBeNull();
  });
});

describe("one view-model for the hover preview and the slide-over (P-HOME-1n: contactDetailsFor)", () => {
  it("the preview and the slide-over show the same name and the same record fields", async () => {
    await open("inline");
    await noah();
    await act(async () => {
      contactDetailsButton().dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(400);
    });
    const preview = document.body.querySelector<HTMLElement>("[data-slot=hover-preview]")!;
    expect(preview).not.toBeNull();
    const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
    const previewRecord = norm(preview.textContent);
    expect(previewRecord).toContain("Phone #");
    await act(async () => {
      contactDetailsButton().dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(400);
    });
    await showContactDetails();
    const record = norm(slideOver()!.querySelector("[data-slot=contact-details-slide-over]")?.textContent);
    // Every field label and value the record shows in the slide-over is in the preview too, and the name matches.
    for (const label of ["Phone #", "Contact #", "Email"]) {
      const value = new RegExp(`${label.replace("#", "\\#")}\\s*([^ ]+)`).exec(record)?.[1];
      expect(value, label).toBeTruthy();
      expect(previewRecord, label).toContain(`${label}`);
      expect(previewRecord, label).toContain(value!);
    }
    expect(previewRecord).toContain("Noah Patel");
    expect(norm(slideOver()!.textContent)).toContain("Noah Patel");
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
    expect(resolveContactDetailsView("Session Details", real)).toBe("Customer Information");
  });
  it("panel mode keeps its customer drill-in; its old Overview tab lands on Customer Information", () => {
    expect(resolveContactDetailsView("Details", { aiInPanel: true, realCustomer: true })).toBe("Customer Information");
    expect(resolveContactDetailsView("Customer Info", { aiInPanel: true, realCustomer: true })).toBe("Customer Info");
  });
});
