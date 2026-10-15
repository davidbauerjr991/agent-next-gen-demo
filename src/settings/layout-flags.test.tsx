// @vitest-environment jsdom
// P0.5d.2: Desk's layout pieces in Advanced, each behind its setting. Phase 1
// (the defaults) renders none of them; the Phase 2 profile renders them all.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { deriveProfile, profileValues } from "./profiles";
import { SECTIONS, type AppPlacement, type ExtraHeaderApp, type SectionKey, type SettingsState } from "./settings-schema";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});

afterEach(async () => {
  await h.tearDown();
});

const store = () => getSettingsStore();

async function setSettings<K extends SectionKey>(section: K, patch: Partial<SettingsState[K]>) {
  await act(async () => {
    store().update(section, patch);
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function applyPhase2() {
  await act(async () => {
    store().updateMany(profileValues("phase2"));
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function placeApp(app: ExtraHeaderApp, placement: AppPlacement, enabled = true) {
  await setSettings("header", { apps: { ...store().getState().values.header.apps, [app]: { enabled, placement } } });
}

const tabStrip = () => h.container.querySelector("[data-slot=home-tabs]");
const homeTabLabels = () => [...(tabStrip()?.querySelectorAll('[role="tab"]') ?? [])].map((t) => t.textContent?.trim());
const homeTab = (label: string) => {
  const tab = [...(tabStrip()?.querySelectorAll('[role="tab"]') ?? [])].find((t) => t.textContent?.trim() === label);
  if (!tab) throw new Error(`no ${label} Home tab`);
  return tab;
};
/** The Customers table's own column header, as a stand-in for the table. */
const customersTableShown = () => !!h.container.querySelector("table") && h.container.textContent!.includes("Contact Number");

describe("Home tabs (apps placed as \"tab\")", () => {
  it("Phase 1: no tab bar and no Customers table", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(tabStrip()).toBeNull();
    expect(customersTableShown()).toBe(false);
  });

  it("each tab-placed app adds a tab after Dashboard; none left removes the bar", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await placeApp("tickets", "tab");
    expect(homeTabLabels()).toEqual(["Dashboard", "Tickets"]);
    await placeApp("schedule", "tab");
    expect(homeTabLabels()).toEqual(["Dashboard", "Tickets", "Schedule"]);
    await placeApp("tickets", "header");
    expect(homeTabLabels()).toEqual(["Dashboard", "Schedule"]);
    await placeApp("schedule", "tab", false);
    expect(tabStrip()).toBeNull();
  });

  it("an app tab shows that app's content; Dashboard returns to the Dashboard", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await placeApp("schedule", "tab");
    await h.click(homeTab("Schedule"));
    const body = h.container.querySelector("[data-slot=home-app-tab]");
    expect(body?.textContent).toContain("Today");
    expect(h.container.querySelector("[data-home-section]")).toBeNull();
    await h.click(homeTab("Dashboard"));
    expect(h.container.querySelector("[data-slot=home-app-tab]")).toBeNull();
    expect(h.container.querySelector("[data-home-section]")).not.toBeNull();
  });

  it("the active app's tab going away falls back to Dashboard", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await placeApp("tickets", "tab");
    await h.click(homeTab("Tickets"));
    await placeApp("tickets", "leftnav");
    expect(h.container.querySelector("[data-home-section]")).not.toBeNull();
  });

  it("Customers: the table, a row's panel, and a customer opened as a closable tab", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await placeApp("customers", "tab");
    await h.click(homeTab("Customers"));
    expect(customersTableShown()).toBe(true);
    const firstRow = h.container.querySelector("tbody tr")!;
    await h.click(firstRow);
    const openTab = h.container.querySelector<HTMLElement>('[title="Open Tab"], [aria-label="Open Tab"]');
    expect(openTab).not.toBeNull();
    await h.click(openTab!);
    const labels = homeTabLabels();
    expect(labels.slice(0, 2)).toEqual(["Dashboard", "Customers"]);
    expect(labels).toHaveLength(3);
    const close = tabStrip()?.querySelector<HTMLElement>(`[title="Close ${labels[2]}"]`);
    expect(close).not.toBeNull();
    await h.click(close!);
    expect(homeTabLabels()).toEqual(["Dashboard", "Customers"]);
  });

  it("dragging writes header.tabOrder; the stored order drives the tabs and leaves the profile alone", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await applyPhase2();
    expect(homeTabLabels()).toEqual(["Dashboard", "Customers", "Accounts", "Tickets"]);
    await setSettings("header", { tabOrder: ["tickets", "customers", "accounts", "wem", "schedule", "screenpop"] });
    expect(homeTabLabels()).toEqual(["Dashboard", "Tickets", "Customers", "Accounts"]);
  });
});

describe("Omnichannel layout (assignments.omnichannel)", () => {
  const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;
  const slideOut = () => h.container.querySelector("[data-slot=async-slideout]");
  const mainThread = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
  const headerIcon = (label: string) =>
    h.container.querySelector<HTMLElement>(`[aria-label="Open ${label} preview"], [aria-label="Close ${label} preview"]`);

  /** Priya's card with an inbound call and an email sent into the same
   *  journey (the sim has no inbound email), the card selected. */
  async function voiceAndEmail() {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    const callId = await h.startInbound("voice", priya.firstPhone, priya.name);
    await h.accept(callId);
    await act(async () => {
      const snapshot = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      const call = (await snapshot).interactions.find((i) => i.id === callId)!;
      const dialed = h.provider.dial({ channel: "email", address: priya.emailAddress!, skillId: "general", journeyId: call.journeyId });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    await h.click(h.navCard(priya.name));
  }

  it("voice + email: the email opens in the slide-out, the call stays in the main column", async () => {
    await voiceAndEmail();
    await setSettings("assignments", { omnichannel: true });
    expect(mainThread()).toBe("voice");
    expect(slideOut()?.getAttribute("data-thread")).toBeFalsy();
    await h.click(headerIcon("Email")!);
    expect(slideOut()?.getAttribute("data-thread")).toBe("email");
    expect(slideOut()?.textContent).toContain("Coming soon");
    expect(mainThread()).toBe("voice");
    // The same icon closes it.
    await h.click(headerIcon("Email")!);
    expect(slideOut()?.getAttribute("data-thread")).toBeFalsy();
  });

  it("off: no slide-out; the newest thread (the email) takes the main column, as before", async () => {
    await voiceAndEmail();
    expect(slideOut()).toBeNull();
    expect(mainThread()).toBe("email");
    // Turning it on moves the email out of the main column.
    await setSettings("assignments", { omnichannel: true });
    expect(mainThread()).toBe("voice");
  });

  it("the slide-out belongs to its card: another card closes it, coming back reopens it", async () => {
    await voiceAndEmail();
    await setSettings("assignments", { omnichannel: true });
    await h.click(headerIcon("Email")!);
    await h.accept(await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz"));
    await h.click(h.navCard("Dan Ortiz"));
    expect(slideOut()?.getAttribute("data-thread")).toBeFalsy();
    await h.click(h.navCard(priya.name));
    expect(slideOut()?.getAttribute("data-thread")).toBe("email");
  });

  it("Phase 2 profile: Home tabs and the omnichannel slide-out together", async () => {
    await voiceAndEmail();
    await applyPhase2();
    expect(homeTabLabels()).toEqual([]); // the card view, not Home
    const home = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
      (el) => el.textContent?.trim() === "Home" || el.getAttribute("aria-label") === "Home",
    )!;
    await h.click(home);
    expect(homeTabLabels()).toEqual(["Dashboard", "Customers", "Accounts", "Tickets"]);
    await h.click(h.navCard(priya.name));
    await h.click(headerIcon("Email")!);
    expect(slideOut()?.getAttribute("data-thread")).toBe("email");
    expect(mainThread()).toBe("voice");
  });
});

describe("header.tabOrder storage", () => {
  const read = (raw: unknown) => SECTIONS.header.read(raw, SECTIONS.header.defaults).tabOrder;

  it("drops unknown and repeated keys and appends missing ones in the default order", () => {
    expect(read({ tabOrder: ["tickets", "bogus", "tickets", "customers"] })).toEqual([
      "tickets",
      "customers",
      "accounts",
      "wem",
      "schedule",
      "screenpop",
    ]);
    expect(read({ tabOrder: "nope" })).toEqual(SECTIONS.header.defaults.tabOrder);
  });

  it("is part of the profile (every section is), and Reset puts it back", () => {
    store().updateMany(profileValues("phase2"));
    store().update("header", { tabOrder: ["tickets", "customers", "accounts", "wem", "schedule", "screenpop"] });
    expect(deriveProfile(store().getState().values)).toBe("custom");
    store().resetAll();
    expect(store().getState().values.header.tabOrder).toEqual(SECTIONS.header.defaults.tabOrder);
  });
});
