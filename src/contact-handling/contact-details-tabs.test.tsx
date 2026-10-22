// @vitest-environment jsdom
// P-CANVAS: Contact Details' tabs come from a registry. Inline and main:
// Customer Information, Notes, Detail, Transcript, Session (an unknown
// contact: Detail, Transcript, Session). Panel keeps Overview first, with the
// AI feed and Copilot dock as before. Transcript is the thread read-only.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { SIM_DEMO_SEED } from "@/adapters/sim/sim-fixtures";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { profileValues } from "@/settings/profiles";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiDisplayLocation } from "@/settings/settings-schema";
import { resolveContactDetailsView } from "./contact-details-tabs";

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
    it(`AI display ${displayLocation}: Overview (the customer's record), Notes, Detail, Transcript, Session`, async () => {
      await open(displayLocation);
      await noah();
      await showContactDetails();
      expect(tabRow()).toEqual(["Overview", "Notes", "Detail", "Transcript", "Session"]);
      // It opens on the first tab, labelled Overview: the record's own body (Customer Information's).
      expect(tab("Overview").getAttribute("aria-selected")).toBe("true");
    });

    it(`AI display ${displayLocation}: an unknown contact has Detail, Transcript, Session`, async () => {
      await open(displayLocation);
      await dialedUnknown();
      await showContactDetails();
      expect(tabRow()).toEqual(["Detail", "Transcript", "Session"]);
    });
  }

  it("AI display panel: Overview first, still holding the AI feed and the Copilot dock", async () => {
    await open("panel");
    await noah();
    await showContactDetails();
    expect(tabRow()).toEqual(["Overview", "Customer Information", "Notes", "Detail", "Transcript", "Session"]);
    expect(tab("Overview").getAttribute("aria-selected")).toBe("true");
    expect(panel().querySelector("[data-slot=ai-feed]")).not.toBeNull();
    expect(panel().querySelector("[data-slot=copilot-dock]")).not.toBeNull();
  });
});

describe("the tabs' bodies", () => {
  it("Transcript: the chat read-only (its bubbles, no composer)", async () => {
    await open("inline");
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
