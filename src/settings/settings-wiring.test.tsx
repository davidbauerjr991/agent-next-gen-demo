// @vitest-environment jsdom
// Settings → workspace wiring (P-SETTINGS): one test per ported setting,
// proving it changes Advanced (or the launch screen), plus the presets as the
// app menu and the Settings page pick them.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { LoginPage } from "@/components/LoginPage";
import { buildAppMenuGroups } from "@/components/agent-next-gen-outbound-data";
import { LUCAS_THOMAS_SCRIPT } from "@/scenarios";
import { applyStoredTheme, useApplyTheme } from "./hooks";
import { derivePreset } from "./presets";
import { getSettingsStore, resetSettingsStoreForTests, sectionStorageKey } from "./settings-store";
import type { AppPlacement, SectionKey, SettingsState } from "./settings-schema";

const h = createWorkspaceHarness();

// The header hides its app icons one by one while they'd crowd the app name.
// The harness makes every box 1600px wide, which reads as "no room", so here
// the app name ends at 300px and the icon row (its direct children are the
// draggable icons) starts at 1000px.
const harnessRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const rect = harnessRect.call(this);
  if (this.querySelector(":scope > [draggable=true]")) return { ...rect, left: 1000, x: 1000 } as DOMRect;
  if (this.children.length === 1 && this.textContent?.startsWith("Agent Workspace 2.0")) return { ...rect, right: 300 } as DOMRect;
  return rect;
};

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  document.documentElement.removeAttribute("data-theme");
  h.setUp();
});

afterEach(async () => {
  await h.tearDown();
});

const store = () => getSettingsStore();
const preset = () => derivePreset(store().getState().values);

async function setSettings<K extends SectionKey>(section: K, patch: Partial<SettingsState[K]>) {
  await act(async () => {
    store().update(section, patch);
    await vi.advanceTimersByTimeAsync(50);
  });
}

/** The page plus the app root's theme hook, as App renders it. */
function AdvancedWithTheme() {
  useApplyTheme();
  return <AgentWorkspaceAdvancedPage showPageHeader showPanelToggle showInteriorPanel />;
}

const header = () => h.container.querySelector("header") ?? h.container;
const headerHas = (label: string) =>
  !!header().querySelector(`[aria-label="${label}"], [title="${label}"]`);

/** Sets an input's value the way typing does, so React's onChange fires. */
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
  });
}

/** The input a `<label>` with this text points at. */
function fieldLabeled(text: string): HTMLInputElement {
  const label = [...h.container.querySelectorAll("label")].find((el) => el.textContent?.trim().startsWith(text));
  const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!(input instanceof HTMLInputElement)) throw new Error(`no input labeled ${text}`);
  return input;
}

/** A left-nav rail item (Home, Settings). */
function navItem(label: string): Element {
  const item = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
    (el) => el.textContent?.trim() === label || el.getAttribute("aria-label") === label,
  );
  if (!item) throw new Error(`no ${label} nav item`);
  return item;
}

/** Whether the left-nav rail has an item with this label. */
const railHas = (label: string) =>
  [...h.container.querySelectorAll("aside button, aside [role=button]")].some(
    (el) => el.textContent?.trim() === label || el.getAttribute("aria-label") === label,
  );

/** The checkbox a `<label>` with this exact text points at. */
function checkboxLabeled(text: string): Element {
  const label = [...h.container.querySelectorAll("label")].find((el) => el.textContent?.trim() === text);
  const box = label?.htmlFor ? document.getElementById(label.htmlFor) : label?.querySelector('[role="checkbox"]');
  if (!box) throw new Error(`no checkbox labeled ${text}`);
  return box;
}

async function openSettings() {
  await h.click(navItem("Settings"));
}

/** The New Outbound launcher's trigger in the left nav. */
function newOutbound(): Element {
  const el = [...h.container.querySelectorAll("aside button")].find((b) => b.textContent?.includes("New Outbound"));
  if (!el) throw new Error("no New Outbound launcher");
  return el;
}

/** The "Assignments (N)" caption. */
function assignmentsCaption(): Element {
  const el = [...h.container.querySelectorAll("aside *")].find(
    (e) => e.children.length === 0 && /^Assignments/.test(e.textContent ?? ""),
  );
  if (!el) throw new Error("no Assignments caption");
  return el;
}

const isBefore = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("Header: Show app icons", () => {
  it("is off by default (Phase 1): no app icons and no View All Apps", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(headerHas("View All Apps")).toBe(false);
    expect(headerHas("Agent Chat")).toBe(false);
  });

  it("on: the pinned apps and View All Apps appear; unpinning a flag hides that icon", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("header", { showAppIcons: true });
    expect(headerHas("View All Apps")).toBe(true);
    expect(headerHas("Agent Chat")).toBe(true);
    expect(headerHas("Search")).toBe(true);

    await setSettings("header", { agentChat: { enabled: false, placement: "header" }, appsGrid: false });
    expect(headerHas("Agent Chat")).toBe(false);
    expect(headerHas("View All Apps")).toBe(false);
    expect(headerHas("Search")).toBe(true);
  });

  it("an app's display: header shows its icon, Left Nav shows a rail item, tab is stored without rendering", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("header", { showAppIcons: true });
    const setCustomers = (enabled: boolean, placement: AppPlacement) =>
      setSettings("header", { apps: { ...store().getState().values.header.apps, customers: { enabled, placement } } });
    expect(headerHas("Customers")).toBe(false);
    expect(railHas("Customers")).toBe(false);

    await setCustomers(true, "header");
    expect(headerHas("Customers")).toBe(true);
    expect(railHas("Customers")).toBe(false);

    await setCustomers(true, "leftnav");
    expect(headerHas("Customers")).toBe(false);
    expect(railHas("Customers")).toBe(true);
    // Between Home and Settings, as in v3.
    expect(isBefore(navItem("Home"), navItem("Customers"))).toBe(true);
    expect(isBefore(navItem("Customers"), navItem("Settings"))).toBe(true);

    await setCustomers(true, "tab");
    expect(headerHas("Customers")).toBe(false);
    expect(railHas("Customers")).toBe(false);
    expect(store().getState().values.header.apps.customers).toEqual({ enabled: true, placement: "tab" });
  });

  it("Agent chat's display: header shows its icon, Left Nav shows a rail item that opens its panel", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("header", { showAppIcons: true });
    expect(headerHas("Agent Chat")).toBe(true);
    expect(railHas("Agent Chat")).toBe(false);

    await setSettings("header", { agentChat: { enabled: true, placement: "leftnav" } });
    expect(headerHas("Agent Chat")).toBe(false);
    expect(railHas("Agent Chat")).toBe(true);
    // The placeholder panel's title, outside the nav.
    const panelTitleShown = () =>
      [...document.body.querySelectorAll("*")].some(
        (el) => !el.closest("aside") && el.children.length === 0 && el.textContent?.trim() === "Agent Chat",
      );
    expect(panelTitleShown()).toBe(false);
    await h.click(navItem("Agent Chat"));
    expect(panelTitleShown()).toBe(true);
  });

  it("each display Select shows only while its app is checked", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("header", { showAppIcons: true });
    await openSettings();
    const hasLabel = (text: string) => [...h.container.querySelectorAll("label")].some((l) => l.textContent?.trim() === text);

    // Agent chat starts checked.
    expect(hasLabel("Agent chat display")).toBe(true);
    await h.click(checkboxLabeled("Agent chat"));
    expect(hasLabel("Agent chat display")).toBe(false);

    expect(hasLabel("Customers display")).toBe(false);
    await h.click(checkboxLabeled("Customers"));
    expect(hasLabel("Customers display")).toBe(true);
    expect(store().getState().values.header.apps.customers.enabled).toBe(true);
  });
});

describe("Assignments: left nav", () => {
  it("New Outbound at the bottom moves the launcher below Home/Settings", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(isBefore(newOutbound(), navItem("Home"))).toBe(true);
    await setSettings("assignments", { newOutboundAtBottom: true });
    // Home, Settings, then New Outbound — one launcher, below the rail.
    const launchers = [...h.container.querySelectorAll("aside button")].filter((b) => b.textContent?.includes("New Outbound"));
    expect(launchers).toHaveLength(1);
    expect(isBefore(navItem("Home"), navItem("Settings"))).toBe(true);
    expect(isBefore(navItem("Settings"), newOutbound())).toBe(true);
    // Still below the rail with the rail's items at the top: the footer holds only the launcher.
    await setSettings("assignments", { navItemsAtTop: true });
    expect(isBefore(navItem("Settings"), newOutbound())).toBe(true);
    expect(isBefore(assignmentsCaption(), newOutbound())).toBe(true);
  });

  it("Home and Settings at the top puts them above the Assignments caption", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(isBefore(assignmentsCaption(), navItem("Home"))).toBe(true);
    await setSettings("assignments", { navItemsAtTop: true });
    expect(isBefore(navItem("Home"), assignmentsCaption())).toBe(true);
    expect(isBefore(navItem("Settings"), assignmentsCaption())).toBe(true);
  });

  it("Don't allow interactions to collapse removes the card chevrons and Collapse all, and expands collapsed cards", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.accept(await h.startInbound("chat", "priya.shah@example.com", "Priya Shah"));
    await h.accept(await h.startInbound("chat", "dan.ortiz@example.com", "Dan Ortiz"));
    const labeled = (...labels: string[]) =>
      h.container.querySelectorAll(labels.flatMap((l) => [`aside [title="${l}"]`, `aside [aria-label="${l}"]`]).join(", "));
    const chevrons = () => labeled("Collapse channels", "Expand channels");
    const collapseAll = () => h.container.querySelector('aside [aria-label="Collapse all"], aside [aria-label="Expand all"]');
    expect(chevrons().length).toBe(2);
    expect(collapseAll()).not.toBeNull();
    // Collapse every card first.
    await h.click(collapseAll()!);
    expect(labeled("Expand channels").length).toBe(2);

    await setSettings("assignments", { noInteractionCollapse: true });
    expect(chevrons().length).toBe(0);
    expect(collapseAll()).toBeNull();
    // Both cards show their channel rows again.
    const chatRows = [...h.container.querySelectorAll("aside button[aria-label]")].filter((el) =>
      el.getAttribute("aria-label")!.startsWith("Chat channel"),
    );
    expect(chatRows.length).toBe(2);
    expect(chatRows.every((row) => !row.closest(".grid-rows-\\[0fr\\]"))).toBe(true);

    // Turned back off, the cards come back collapsible and expanded.
    await setSettings("assignments", { noInteractionCollapse: false });
    expect(labeled("Collapse channels").length).toBe(2);
  });
});

describe("Voice: controls location", () => {
  it("Top of left nav moves the bar into the nav, stacked; a collapsed nav falls back to the bottom", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.accept(await h.startInbound("voice", "(312) 555-0164", "Lauren Briggs"));
    await h.click(h.navCard("Lauren Briggs"));
    const bar = () => {
      const bars = h.container.querySelectorAll("[data-slot=voice-bar]");
      expect(bars).toHaveLength(1);
      return bars[0];
    };
    expect(bar().closest("aside")).toBeNull();
    expect(bar().getAttribute("data-placement")).toBe("bottom");

    await setSettings("voice", { controlsLocation: "top" });
    expect(bar().closest("aside")).not.toBeNull();
    expect(bar().getAttribute("data-placement")).toBe("top");
    // Stacked: Mute and End Call keep their labels.
    expect(bar().textContent).toContain("Mute");
    expect(bar().textContent).toContain("End Call");

    await h.click(h.container.querySelector('[aria-label="Collapse sidebar"]')!);
    expect(bar().closest("aside")).toBeNull();
    expect(bar().getAttribute("data-placement")).toBe("bottom");
  });
});

describe("AI: display location", () => {
  it("In the Contact Details panel moves Lucas's Autosummary and approval card out of the transcript", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(14_000);
    const occurrences = (text: string) =>
      [...h.container.querySelectorAll("*")].filter((el) => el.children.length === 0 && el.textContent === text);
    const feed = () => h.container.querySelector("[data-slot=ai-feed]");
    const prompt = "How would you like to proceed?";
    expect(occurrences(prompt)).toHaveLength(1);
    expect(feed()).toBeNull();

    await setSettings("ai", { displayLocation: "panel" });
    expect(feed()).not.toBeNull();
    // One approval card, and it's in the panel's feed.
    expect(occurrences(prompt)).toHaveLength(1);
    expect(feed()!.contains(occurrences(prompt)[0])).toBe(true);
    expect(feed()!.textContent).toContain("Autosummary");

    // Deciding from the panel reaches the provider like the inline card.
    const approve = [...feed()!.querySelectorAll("button, [role=radio], label")].find((el) =>
      /approve/i.test(el.textContent ?? ""),
    );
    expect(approve).toBeTruthy();

    await setSettings("ai", { displayLocation: "inline" });
    expect(feed()).toBeNull();
    expect(occurrences(prompt)).toHaveLength(1);
  });
});

describe("Appearance: dark mode", () => {
  it("the Settings page's switch sets <html data-theme>, and a fresh start keeps it", async () => {
    await h.render(<AdvancedWithTheme />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await openSettings();
    const darkSwitch = h.container.querySelector('[role="switch"][aria-label="Dark mode"], #dark-mode') ??
      [...h.container.querySelectorAll('[role="switch"]')].find((el) =>
        el.closest("div")?.textContent?.includes("Dark mode"),
      );
    expect(darkSwitch).toBeTruthy();
    await h.click(darkSwitch!);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(sectionStorageKey("appearance"))).toContain("dark");

    // A reload: a new store reads it back and applies it before render.
    resetSettingsStoreForTests();
    document.documentElement.removeAttribute("data-theme");
    applyStoredTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("Launch screen: phone setup and Save Preferences", () => {
  async function launchWith(setup: "Station ID" | "Phone Number", value: string, save: boolean) {
    const onNavigate = vi.fn();
    await h.render(<LoginPage onNavigate={onNavigate} />);
    const radio = [...h.container.querySelectorAll('[role="radio"]')].find((el) =>
      el.closest("label")?.textContent?.includes(setup),
    )!;
    await h.click(radio);
    await type(fieldLabeled(setup === "Station ID" ? "Enter Station ID" : "Enter Phone Number"), value);
    const checkbox = [...h.container.querySelectorAll('button[role="checkbox"]')][0] as HTMLElement;
    if ((checkbox.getAttribute("aria-checked") === "true") !== save) await h.click(checkbox);
    await h.click(h.buttonByText("Launch", h.container)!);
    await h.advance(4000);
    return onNavigate;
  }

  it("checked: launching stores the phone section, and the next launch screen is prefilled", async () => {
    const onNavigate = await launchWith("Station ID", "12345", true);
    expect(onNavigate).toHaveBeenCalledWith("agent-advanced");
    expect(store().getState().values.phone).toEqual({ setup: "work-station", phoneNumber: "", stationId: "12345" });
    expect(localStorage.getItem(sectionStorageKey("phone"))).toContain("12345");

    // A reload: a new store, and a freshly mounted card.
    resetSettingsStoreForTests();
    await h.render(<div />);
    await h.render(<LoginPage />);
    const stationInput = [...h.container.querySelectorAll("input")].find((el) => el.value === "12345");
    expect(stationInput).toBeTruthy();
    expect(h.container.querySelector('button[role="checkbox"]')!.getAttribute("aria-checked")).toBe("true");
  });

  it("unchecked: the choice applies to the session but isn't saved", async () => {
    await launchWith("Phone Number", "312 555 0164", false);
    expect(store().getState().values.phone.phoneNumber).toBe("312 555 0164");
    expect(localStorage.getItem(sectionStorageKey("phone"))).toBeNull();
  });
});

describe("Workspace preset", () => {
  it("app menu: Phase 2 picks the preset and opens Desk; Phase 1 picks it and opens Advanced", () => {
    const onNavigate = vi.fn();
    const [phase1, phase2] = buildAppMenuGroups(onNavigate, "agent-advanced")[0].items;
    phase2.onClick?.();
    expect(preset()).toBe("phase2");
    expect(store().getState().values.assignments.omnichannel).toBe(true);
    expect(onNavigate).toHaveBeenLastCalledWith("agent-with-desk");
    phase1.onClick?.();
    expect(preset()).toBe("phase1");
    expect(onNavigate).toHaveBeenLastCalledWith("agent-advanced");
  });

  it("Advanced's app name follows the preset, and Custom shows when one flag changes", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    expect(h.container.textContent).toContain("Agent Workspace 2.0 | Phase 1");
    await setSettings("header", { showAppIcons: true });
    expect(h.container.textContent).toContain("Agent Workspace 2.0 | Custom");
  });
});
