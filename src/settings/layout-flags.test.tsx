// @vitest-environment jsdom
// P0.5d.2: Desk's layout pieces in Advanced, each behind its setting. Phase 1
// (the defaults) renders none of them; the Phase 2 profile renders them all.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { SettingsView } from "@/components/settings/SettingsView";
import { LUCAS_THOMAS_SCRIPT } from "@/scenarios";
import { getSettingsStore, resetSettingsStoreForTests } from "./settings-store";
import { deriveProfile, profileValues } from "./profiles";
import { SECTIONS, type AppPlacement, type ExtraHeaderApp, type SectionKey, type SettingsState } from "./settings-schema";

const h = createWorkspaceHarness();

// The header hides its app icons one by one while they'd crowd the app name,
// and jsdom gives every box the same size. As in settings-wiring.test.tsx:
// the app name ends at 300px and the icon row starts at 1000px.
const harnessRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const rect = harnessRect.call(this);
  if (this.querySelector(":scope > [draggable=true]")) return { ...rect, left: 1000, x: 1000 } as DOMRect;
  if (this.children.length === 1 && this.querySelector(":scope > [data-slot=brand-mark]")) return { ...rect, right: 300 } as DOMRect;
  return rect;
};

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

describe("Apps placed in the left nav open as pages", () => {
  const railItem = (label: string) =>
    [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
      (el) => el.textContent?.trim() === label || el.getAttribute("aria-label") === label,
    );
  const page = () => h.container.querySelector("[data-slot=left-nav-page]");
  /** The header-style floating panel's blank body ("Nothing here yet."), anywhere but a page. */
  const floatingPanelShown = () =>
    [...document.body.querySelectorAll("*")].some(
      (el) => !el.closest("[data-slot=left-nav-page]") && el.children.length === 0 && el.textContent?.trim() === "Nothing here yet.",
    );

  it("leftnav: the rail item renders the page in the main column, not the floating panel", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("header", { showAppIcons: true });
    await placeApp("tickets", "leftnav");
    await h.click(railItem("Tickets")!);
    expect(page()?.getAttribute("data-app")).toBe("Tickets");
    expect(page()?.textContent).toContain("Nothing here yet.");
    expect(floatingPanelShown()).toBe(false);
    // Home leaves the page.
    await h.click(railItem("Home")!);
    expect(page()).toBeNull();
  });

  it("leftnav Customers: the table and row panel; Open Tab adds a closable customer tab", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await placeApp("customers", "leftnav");
    await h.click(railItem("Customers")!);
    expect(page()?.getAttribute("data-app")).toBe("Customers");
    expect(customersTableShown()).toBe(true);
    await h.click(page()!.querySelector("tbody tr")!);
    await h.click(h.container.querySelector<HTMLElement>('[title="Open Tab"], [aria-label="Open Tab"]')!);
    const tabs = [...page()!.querySelector('[role="tablist"]')!.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
    expect(tabs[0]).toBe("Customers");
    expect(tabs).toHaveLength(2);
  });

  it("selecting a card leaves the page", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await placeApp("tickets", "leftnav");
    await setSettings("channels", { chat: true });
    await h.accept(await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz"));
    await h.click(railItem("Tickets")!);
    expect(page()).not.toBeNull();
    await h.click(h.navCard("Dan Ortiz"));
    expect(page()).toBeNull();
  });

  it("header: the icon opens the floating panel, no page", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("header", { showAppIcons: true });
    await placeApp("tickets", "header");
    const icon = h.container.querySelector<HTMLElement>('header [aria-label="Tickets"], header [title="Tickets"]');
    expect(icon).not.toBeNull();
    await h.click(icon!);
    expect(page()).toBeNull();
    expect(floatingPanelShown()).toBe(true);
  });
});

describe("Omnichannel layout (assignments.omnichannel)", () => {
  const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;
  /** What the right panel (Contact Details' panel) shows: a thread type, "details", or null when closed. */
  const panelShows = () => {
    const panel = h.container.querySelector("[data-slot=right-panel]");
    return panel?.getAttribute("data-open") === "true" ? panel.getAttribute("data-thread") : null;
  };
  const mainThread = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
  const headerIcon = (label: string) =>
    h.container.querySelector<HTMLElement>(`[aria-label="Open ${label} preview"], [aria-label="Close ${label} preview"]`);
  /** The record header's Contact Details button (absent while the panel shows Contact Details). */
  const contactDetailsButton = () =>
    [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
      (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
    );
  /** The right panel's toggle group (the channel icons and Contact Details): which are pressed. */
  const pressed = () =>
    [headerIcon("Email"), contactDetailsButton()].filter((b) => b?.getAttribute("aria-pressed") === "true").map((b) =>
      b === contactDetailsButton() ? "Contact Details" : "Email",
    );
  /** Highlighted (blue) channel rows in the left nav (only the active card highlights rows). */
  const highlightedRows = () =>
    [...h.container.querySelectorAll("aside [aria-label$=' channel'], aside [aria-label*=' channel,']")].filter((row) =>
      row.closest(".bg-lyra-status-info-subtle"),
    ).length;

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

  it("voice + email: the email opens in the right panel (Contact Details' panel), the call stays in the main column", async () => {
    await voiceAndEmail();
    await setSettings("assignments", { omnichannel: true });
    expect(mainThread()).toBe("voice");
    expect(panelShows()).toBeNull();
    await h.click(headerIcon("Email")!);
    expect(panelShows()).toBe("email");
    expect(h.container.querySelector("[data-slot=right-panel]")?.textContent).toContain("Coming soon");
    expect(mainThread()).toBe("voice");
    // The same icon closes it.
    await h.click(headerIcon("Email")!);
    expect(panelShows()).toBeNull();
  });

  it("the channel icons and Contact Details are one toggle group: the panel follows the last one clicked", async () => {
    await voiceAndEmail();
    await setSettings("assignments", { omnichannel: true });
    expect(pressed()).toEqual([]);
    await h.click(headerIcon("Email")!);
    expect(pressed()).toEqual(["Email"]);
    expect(panelShows()).toBe("email");
    await h.click(contactDetailsButton()!);
    expect(panelShows()).toBe("details");
    expect(pressed()).toEqual(["Contact Details"]); // the email icon is released
    await h.click(headerIcon("Email")!);
    expect(pressed()).toEqual(["Email"]);
    expect(panelShows()).toBe("email");
  });

  it("the Contact Details button is always visible: selected while its panel shows Contact Details, which it then closes", async () => {
    await voiceAndEmail();
    await setSettings("assignments", { omnichannel: true });
    expect(contactDetailsButton()?.getAttribute("aria-pressed")).toBe("false");
    await h.click(contactDetailsButton()!);
    expect(panelShows()).toBe("details");
    expect(contactDetailsButton()?.getAttribute("aria-pressed")).toBe("true");
    // Clicking it again closes the panel; it stays visible.
    await h.click(contactDetailsButton()!);
    expect(panelShows()).toBeNull();
    expect(contactDetailsButton()?.getAttribute("aria-pressed")).toBe("false");
    // The email thread in the panel → the email icon selected, Contact Details released.
    await h.click(headerIcon("Email")!);
    expect(panelShows()).toBe("email");
    expect(contactDetailsButton()?.getAttribute("aria-pressed")).toBe("false");
    expect(headerIcon("Email")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("the open async thread's nav row is highlighted next to the main row; closing clears it", async () => {
    await voiceAndEmail();
    await setSettings("assignments", { omnichannel: true });
    expect(highlightedRows()).toBe(1);
    await h.click(headerIcon("Email")!);
    expect(highlightedRows()).toBe(2);
    await h.click(headerIcon("Email")!);
    expect(highlightedRows()).toBe(1);
  });

  it("off: the newest thread (the email) takes the main column, as before", async () => {
    await voiceAndEmail();
    expect(panelShows()).toBeNull();
    expect(mainThread()).toBe("email");
    // Turning it on moves the email out of the main column.
    await setSettings("assignments", { omnichannel: true });
    expect(mainThread()).toBe("voice");
  });

  it("the slide-out belongs to its card: another card closes it, coming back reopens it", async () => {
    await voiceAndEmail();
    await setSettings("assignments", { omnichannel: true });
    await h.click(headerIcon("Email")!);
    await setSettings("channels", { chat: true });
    await h.accept(await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz"));
    await h.click(h.navCard("Dan Ortiz"));
    expect(panelShows()).not.toBe("email");
    await h.click(h.navCard(priya.name));
    expect(panelShows()).toBe("email");
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
    expect(panelShows()).toBe("email");
    expect(mainThread()).toBe("voice");
  });
});

describe("AI display \"main\": the AI-first layout (ai.displayLocation)", () => {
  const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;
  const panel = () => h.container.querySelector("[data-slot=right-panel]");
  const panelShows = () => (panel()?.getAttribute("data-open") === "true" ? panel()!.getAttribute("data-thread") : null);
  const mainThread = () => h.container.querySelector("[data-main-thread]")?.getAttribute("data-main-thread");
  const navRow = (label: string) => h.container.querySelector<HTMLElement>(`aside [aria-label^="${label} channel"]`)!;
  const composers = () => [...document.body.querySelectorAll<HTMLElement>("[data-slot=copilot-composer]")];

  /** Priya's card with an accepted inbound chat and an email sent into the
   *  same journey, under the AI-first profile. */
  async function aiFirst() {
    await act(async () => {
      store().updateMany(profileValues("aifirst"));
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  async function acceptedChat() {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await aiFirst();
    const chatId = await h.startInbound("chat", priya.emailAddress!, priya.name);
    await h.accept(chatId);
    return chatId;
  }

  /** …then an email sent into the same journey (it opens in the panel). */
  async function chatAndEmail() {
    const chatId = await acceptedChat();
    await act(async () => {
      const snapshot = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      const chat = (await snapshot).interactions.find((i) => i.id === chatId)!;
      const dialed = h.provider.dial({ channel: "email", address: priya.emailAddress!, skillId: "general", journeyId: chat.journeyId });
      await vi.advanceTimersByTimeAsync(300);
      await dialed;
    });
    await h.click(h.navCard(priya.name));
  }

  it("a chat never takes the main column: it opens in the panel, the main column is the AI workspace", async () => {
    await acceptedChat();
    await h.click(h.navCard(priya.name));
    expect(mainThread()).toBe("ai");
    expect(h.container.querySelector("[data-main-thread=ai] [data-slot=ai-workspace]")).toBeTruthy();
    expect(panelShows()).toBe("chat");
  });

  it("a nav row swaps the panel's thread; the main column never changes", async () => {
    await chatAndEmail();
    // A row appearing doesn't move anything: the panel keeps its thread.
    expect(panelShows()).toBe("chat");
    await h.click(navRow("Email"));
    expect(panelShows()).toBe("email");
    expect(mainThread()).toBe("ai");
    await h.click(navRow("Chat"));
    expect(panelShows()).toBe("chat");
    expect(mainThread()).toBe("ai");
    await h.click(navRow("Email"));
    expect(panelShows()).toBe("email");
    expect(mainThread()).toBe("ai");
    // The shown thread's own row closes the panel (the same toggle as its header icon).
    await h.click(navRow("Email"));
    expect(panelShows()).toBeNull();
  });

  it("one Copilot composer, in the main column; the panel's thread composer is chat only", async () => {
    await chatAndEmail();
    const all = composers();
    expect(all).toHaveLength(1);
    expect(all[0].closest("[data-main-thread=ai]")).toBeTruthy();
    expect(panel()!.querySelector("[data-slot=copilot-composer]")).toBeNull();
  });

  it("a call on the card: the voice bar shows as with placement \"main\"", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await aiFirst();
    await h.accept(await h.startInbound("voice", priya.firstPhone, priya.name));
    await h.click(h.navCard(priya.name));
    expect(h.container.querySelectorAll("[data-slot=voice-bar]")).toHaveLength(1);
    expect(mainThread()).toBe("ai");
    // No thread besides the call: the panel stays closed.
    expect(panelShows()).toBeNull();
  });

  // The record header under "main": the session row as in every mode, and an
  // icon per thread (scripted ones included) in one toggle group with
  // Contact Details; a hover preview only while the thread isn't in the panel.
  const chatIcon = () => h.container.querySelector<HTMLElement>('[aria-label="Open Chat preview"], [aria-label="Close Chat preview"]');
  const contactDetailsButton = () =>
    [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")].find(
      (b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"),
    );
  const hover = async (el: HTMLElement) => {
    await act(async () => {
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300); // past the previews' open delay
    });
  };
  const unhover = async (el: HTMLElement) => {
    await act(async () => {
      el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
  };
  const preview = () =>
    [...document.body.querySelectorAll("[data-radix-popper-content-wrapper]")].find((w) => /Messages/.test(w.textContent ?? ""));

  async function expectMainHeader() {
    // Session row: status, Session Details, Outcome — above the AI workspace.
    const main = h.container.querySelector("[data-main-thread=ai]")!;
    expect(main.textContent).toContain("Session Details");
    expect(main.textContent).toContain("Outcome");
    // The chat's icon is there and selected: the chat is in the panel.
    expect(chatIcon()).not.toBeNull();
    expect(panelShows()).toBe("chat");
    expect(chatIcon()!.getAttribute("aria-pressed")).toBe("true");
    await hover(chatIcon()!);
    expect(preview()).toBeUndefined();
    await unhover(chatIcon()!);
    // Contact Details takes the panel; the chat icon is released and previews.
    await h.click(contactDetailsButton()!);
    expect(panelShows()).toBe("details");
    expect(chatIcon()!.getAttribute("aria-pressed")).toBe("false");
    await hover(chatIcon()!);
    expect(preview()).toBeDefined();
    await unhover(chatIcon()!);
    // The chat icon swaps the panel back.
    await h.click(chatIcon()!);
    expect(panelShows()).toBe("chat");
    expect(chatIcon()!.getAttribute("aria-pressed")).toBe("true");
  }

  it("a sim chat: the session row, the chat icon beside Contact Details, the swap, and the hover-preview rule", async () => {
    await acceptedChat();
    await h.click(h.navCard(priya.name));
    await expectMainHeader();
  });

  it("Lucas (scripted): his chat gets its header icon too, with the same swap and preview rule", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await aiFirst();
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(2_000);
    await expectMainHeader();
  });

  it("Settings: with AI display \"main\" the Omnichannel switch shows on, \"Set by AI display\"", async () => {
    await h.show(SettingsView as never);
    await aiFirst();
    const omni = h.container.querySelector("[data-setting=omnichannel]");
    expect(omni?.textContent).toContain("Set by AI display");
    expect(omni?.querySelector("[role=switch]")?.getAttribute("aria-checked")).toBe("true");
    // Another AI display: the switch is editable again.
    await setSettings("ai", { displayLocation: "inline" });
    expect(h.container.querySelector("[data-setting=omnichannel]")).toBeNull();
  });
});

// The main column's content stack owns the space under the session row in every
// AI display, whatever its first card is (the Autosummary, an approval, the
// transcript); a card never brings its own top spacing (regression from g2).
describe("the main column's content stack owns its top spacing", () => {
  const priya = CREATE_NEW_CUSTOMERS.find((c) => c.id === "priya-shah-history")!;
  const TOP_SPACING = /(^|\s)-?(p|pt|py|m|mt|my)-\d/;
  /** The current session's stack in the main column ("main": the AI workspace's feed body). */
  const stack = () => {
    const main = h.container.querySelector("[data-main-thread]")!;
    const stacks = main.querySelectorAll<HTMLElement>("[data-slot=content-stack], [data-slot=ai-workspace] [data-slot=details-panel-body]");
    return stacks[stacks.length - 1];
  };

  for (const displayLocation of ["inline", "panel", "main"] as const) {
    for (const channel of ["voice", "chat"] as const) {
      it(`${displayLocation}, a ${channel} card: the stack has the top padding, its first card none`, async () => {
        await setSettings("channels", { chat: true });
        await setSettings("ai", { displayLocation });
        await h.show(AgentWorkspaceAdvancedPage);
        await h.goAvailable();
        await h.accept(await h.startInbound(channel, channel === "voice" ? priya.firstPhone : priya.emailAddress!, priya.name));
        await h.click(h.navCard(priya.name));
        const s = stack();
        expect(s, "a content stack in the main column").toBeTruthy();
        expect(s.className).toMatch(/(^|\s)(p|pt)-4(\s|$)/);
        const first = s.firstElementChild as HTMLElement | null;
        if (first) expect(first.className).not.toMatch(TOP_SPACING);
        // What leads: the call's Autosummary (inline and "main"; "panel" has it in the
        // panel), or the chat's transcript (an email-addressed chat has no directory
        // match, so no Autosummary; under "main" the chat is in the panel).
        if (channel === "voice" && displayLocation !== "panel") expect(first?.querySelector("[data-slot=autosummary]")).toBeTruthy();
        if (channel === "chat" && displayLocation !== "main") expect(first?.textContent).toContain("Priya Shah");
      });
    }
  }
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
