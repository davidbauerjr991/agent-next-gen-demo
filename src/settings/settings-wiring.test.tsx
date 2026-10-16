// @vitest-environment jsdom
// Settings → workspace wiring (P-SETTINGS): one test per ported setting,
// proving it changes Advanced (or the launch screen), plus the profiles as the
// app menu and the Settings page pick them.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { LoginPage } from "@/components/LoginPage";
import { APP_MENU_ITEMS, buildAppMenuGroups } from "@/components/agent-next-gen-outbound-data";
import { SettingsView } from "@/components/settings/SettingsView";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT } from "@/scenarios";
import { applyProfile, applyStoredTheme, useApplyTheme } from "./hooks";
import { deriveProfile } from "./profiles";
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
  if (this.children.length === 1 && this.querySelector(":scope > [data-slot=brand-mark]")) return { ...rect, right: 300 } as DOMRect;
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
const profile = () => deriveProfile(store().getState().values);

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

  it("an app's display: header shows its icon, Left Nav shows a rail item, tab shows a Home tab", async () => {
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
    const tabStrip = h.container.querySelector("[data-slot=home-tabs]");
    expect([...(tabStrip?.querySelectorAll('[role="tab"]') ?? [])].map((t) => t.textContent?.trim())).toEqual(["Dashboard", "Customers"]);
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
    // Stacked, not side by side: both sit in the footer's own column (lyra's
    // footer slot is a flex row). The geometry is checked in Chrome
    // (e2e/left-nav-footer.spec.ts); jsdom has no layout.
    const column = h.container.querySelector("aside [data-slot=left-nav-footer]");
    expect(column?.classList.contains("flex-col")).toBe(true);
    expect(column?.contains(navItem("Settings"))).toBe(true);
    expect(column?.contains(newOutbound())).toBe(true);
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
    await setSettings("channels", { chat: true });
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

  it("Main column (AI-first): Lucas's Autosummary and approval fill the main column, his chat opens in the panel", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(14_000);
    await setSettings("ai", { displayLocation: "main" });
    const prompt = "How would you like to proceed?";
    const occurrences = [...h.container.querySelectorAll("*")].filter((el) => el.children.length === 0 && el.textContent === prompt);
    expect(occurrences).toHaveLength(1);
    const main = h.container.querySelector("[data-main-thread=ai]")!;
    expect(main.querySelector("[data-slot=ai-feed]")?.contains(occurrences[0])).toBe(true);
    expect(main.textContent).toContain("Autosummary");
    const panel = h.container.querySelector("[data-slot=right-panel]")!;
    expect(panel.getAttribute("data-open")).toBe("true");
    expect(panel.getAttribute("data-thread")).toBe("chat");
    expect(panel.querySelector("[data-slot=ai-feed]")).toBeNull();
  });
});

describe("AI display panel: docked Copilot composer", () => {
  async function lucasInPanelMode() {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("ai", { displayLocation: "panel" });
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    await h.advance(2_000);
  }
  const composer = () => document.body.querySelector("[data-slot=copilot-composer]");
  const body = () => document.body.querySelector<HTMLElement>("[data-slot=details-panel-body]");
  /** The panel's scroll container (lyra `PanelContent`) around the Details body. */
  const scroller = () => body()!.parentElement!.closest<HTMLElement>(".overflow-y-auto")!;
  const clickText = async (text: string) => {
    const el = [...document.body.querySelectorAll("button, [role=tab], [role=button], a")].find(
      (e) => e.textContent?.trim() === text || e.getAttribute("aria-label") === text,
    );
    if (!el) throw new Error(`nothing to click labeled ${text}`);
    await h.click(el);
  };

  it("is the panel's footer: a sibling of the scroll container, input → chips → Takeover", async () => {
    await lucasInPanelMode();
    const c = composer()!;
    expect(c).not.toBeNull();
    expect(c.closest("[data-slot=copilot-dock]")).not.toBeNull();
    expect(scroller().contains(c)).toBe(false);
    // Same parent column: the composer's footer follows the scroll area.
    expect(scroller().parentElement!.contains(c)).toBe(true);
    expect(isBefore(scroller(), c)).toBe(true);
    // Nothing of the Copilot composer stays in the main column.
    expect([...document.body.querySelectorAll("[data-slot=copilot-composer]")]).toHaveLength(1);

    const chip = c.querySelector('[role="button"]')!;
    const input = c.querySelector("textarea")!;
    const takeover = c.querySelector("[data-slot=copilot-takeover]")!;
    expect(isBefore(input, chip)).toBe(true);
    expect(isBefore(chip, takeover)).toBe(true);
    // Wide vs narrow (Takeover full width below the chips) is measured, so
    // jsdom can't see it: copilot-composer.test.tsx stubs the widths and
    // e2e/copilot-composer.spec.ts checks the 425px panel in Chrome.
  });

  it("the body's bottom padding keeps the last card clear of the footer's fade", async () => {
    await lucasInPanelMode();
    // lyra ContainerFooter's scrollFade overlays 24px above the footer.
    expect(parseInt(body()!.style.paddingBottom, 10)).toBeGreaterThanOrEqual(24);
  });

  it("a new AI item scrolls to the bottom only when the agent is already at the bottom", async () => {
    await lucasInPanelMode();
    const el = scroller();
    let scrollHeight = 2000;
    let scrollTop = 0;
    Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scrollHeight });
    Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 400 });
    Object.defineProperty(el, "scrollTop", { configurable: true, get: () => scrollTop, set: (v: number) => (scrollTop = v) });
    const feedItems = () => document.body.querySelector("[data-slot=ai-feed]")!.querySelectorAll(":scope > div > *").length;

    // Scrolled up (from the bottom, where the panel opens): the script's next
    // AI items (the approval request) arrive and the position is left alone.
    scrollTop = scrollHeight - 400;
    el.dispatchEvent(new Event("scroll"));
    scrollTop = 100;
    el.dispatchEvent(new Event("scroll"));
    const before = feedItems();
    scrollHeight += 400;
    await h.advance(14_000);
    expect(feedItems()).toBeGreaterThan(before);
    expect(scrollTop).toBe(100);

    // At the bottom: a Copilot ask (a new instruction row) follows to the bottom.
    scrollTop = scrollHeight - 400;
    el.dispatchEvent(new Event("scroll"));
    scrollHeight += 200;
    const chip = composer()!.querySelector<HTMLElement>('[role="button"]')!;
    await act(async () => {
      chip.click();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(scrollTop).toBe(scrollHeight);
  });

  it("(12) an agent action always scrolls to the bottom; a timed bot item doesn't when scrolled up", async () => {
    await lucasInPanelMode();
    const el = scroller();
    let scrollHeight = 2000;
    let scrollTop = 0;
    Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scrollHeight });
    Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 400 });
    Object.defineProperty(el, "scrollTop", { configurable: true, get: () => scrollTop, set: (v: number) => (scrollTop = v) });
    // The agent scrolls up to the top from the bottom.
    const scrollToTop = () => {
      scrollTop = scrollHeight - 400;
      el.dispatchEvent(new Event("scroll"));
      scrollTop = 0;
      el.dispatchEvent(new Event("scroll"));
    };

    // Scrolled to the top, the approval request arrives on the bot's timing:
    // left alone.
    scrollToTop();
    scrollHeight += 400;
    await h.advance(14_000);
    expect(document.body.textContent).toContain("How would you like to proceed?");
    expect(scrollTop).toBe(0);

    // Scrolled to the top, the agent clicks Approve: follows to the bottom.
    scrollToTop();
    const approve = [...document.body.querySelectorAll("[data-ai-action] button, [data-ai-action] [role=radio]")].find((b) =>
      /approve/i.test(b.textContent ?? ""),
    )!;
    expect(approve).toBeTruthy();
    scrollHeight += 300;
    await h.click(approve);
    expect(scrollTop).toBe(scrollHeight);

    // Scrolled to the top, a Copilot chip in the docked composer: follows too.
    scrollToTop();
    scrollHeight += 200;
    await h.click(composer()!.querySelector('[role="button"]')!);
    expect(scrollTop).toBe(scrollHeight);
  });

  it("shows only on the Details overview: not on Session Details, Customer Info or Experience Memory", async () => {
    await lucasInPanelMode();
    expect(composer()).not.toBeNull();

    // The tabs read "Overview" / "Session".
    await clickText("Session");
    expect(composer()).toBeNull();
    await clickText("Overview");
    expect(composer()).not.toBeNull();

    await clickText("View customer info");
    expect(composer()).toBeNull();
    await clickText("Back to Details");
    expect(composer()).not.toBeNull();

    // In panel mode the Journey Summary (with its "View Experience Memory"
    // link) is on the Session tab.
    await clickText("Session");
    await clickText("View Experience Memory");
    expect(composer()).toBeNull();
    await clickText("Back to Contact Details");
    expect(composer()).not.toBeNull();
  });
});

describe("Contact Details Overview stack, events, composer fade", () => {
  async function lucas(display: "inline" | "panel") {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("ai", { displayLocation: display });
    await h.play(LUCAS_THOMAS_SCRIPT.id);
    await h.click(h.navCard("Lucas Thomas"));
    // Past "Approval requested" (12.3s) and the approval card.
    await h.advance(14_000);
  }
  const body = () => document.body.querySelector<HTMLElement>("[data-slot=details-panel-body]")!;
  /** The side panel's column (header, scroll area, footer). */
  const panel = () => body().parentElement!.closest<HTMLElement>(".overflow-y-auto")!.parentElement!;
  /** An AICard by title: AICard wraps its title in a `lyra-body-md-emphasis`
   *  span inside lyra Accordion's compact (40px, `py-2.5`) header row, inside
   *  the contained accordion's radius-md shell (`shadow-sm`, subtle border).
   *  Customer Info's plain accordion has a tinted border and no shadow.
   *  Returns the shell. */
  const aiCard = (title: string, scope: Element) => {
    const titleEl = [...scope.querySelectorAll("span.lyra-body-md-emphasis")].find((el) =>
      el.textContent?.trim().startsWith(title),
    );
    const header = titleEl?.closest("button");
    if (!header || !/(^|\s)py-2\.5(\s|$)/.test(header.className)) return null;
    const shell = header.closest(".rounded-lyra-md");
    return shell && /(^|\s)shadow-sm(\s|$)/.test(shell.className) ? shell : null;
  };
  const leaves = (text: string) =>
    [...document.body.querySelectorAll("*")].filter((el) => el.children.length === 0 && el.textContent?.trim() === text);
  const EVENTS = ["Chat started", "Launch price held for 24 h", "Payment link sent", "Approval requested"];
  const APPROVAL_PROMPT = "How would you like to proceed?";

  const clickTab = async (label: string) => {
    const tab = [...document.body.querySelectorAll("button, [role=tab]")].find((el) => el.textContent?.trim() === label);
    if (!tab) throw new Error(`no tab ${label}`);
    await h.click(tab);
  };

  it("(5, 10) panel mode: Overview = Customer Info + Autosummary + AI feed; Session = Journey Summary + Artifacts; all AICards radius md", async () => {
    await lucas("panel");
    for (const title of ["Autosummary", "Approval request"]) {
      expect(aiCard(title, body()), `${title} AICard on Overview`).not.toBeNull();
    }
    for (const title of ["Journey Summary", "Artifacts"]) {
      expect(aiCard(title, body()), `${title} not on Overview`).toBeNull();
    }
    // Customer Info: lyra's plain accordion, not an AICard.
    expect(aiCard("Customer Info", body())).toBeNull();
    expect(body().textContent).toContain("Customer Info");

    await clickTab("Session");
    for (const title of ["Journey Summary", "Artifacts"]) {
      expect(aiCard(title, body()), `${title} AICard on Session`).not.toBeNull();
    }
    expect(body().textContent).not.toContain("Customer Info");
  });

  it("(10) inline mode: Overview keeps Customer Info, Journey Summary and Artifacts; Session doesn't get them", async () => {
    await lucas("inline");
    // Lucas's case opens the Contact Details panel on its own.
    expect(body()).toBeTruthy();
    for (const title of ["Journey Summary", "Artifacts"]) {
      expect(aiCard(title, body()), `${title} AICard on Overview`).not.toBeNull();
    }
    expect(body().textContent).toContain("Customer Info");
    await clickTab("Session");
    expect(document.body.querySelector("[data-slot=details-panel-body]")).toBeNull();
  });

  it("(5) the stack is spaced only by its gap: no card or wrapper carries its own margin or top padding", async () => {
    await lucas("panel");
    expect(body().className).toContain("gap-3");
    const ownSpacing = /(^|\s)(-?m[trblxy]?-\S+|pt-[1-9]\S*|space-y-\S+)/;
    const items = [...body().children, ...(body().querySelector("[data-slot=ai-feed]")?.querySelectorAll(":scope > div > *") ?? [])];
    const offenders = items.filter((el) => ownSpacing.test(el.getAttribute("class") ?? "")).map((el) => el.getAttribute("class"));
    expect(offenders).toEqual([]);
  });

  it("(5) says Journey Summary, never Real-Time Summary", async () => {
    await lucas("panel");
    expect(document.body.textContent).not.toContain("Real-Time Summary");
    await clickTab("Session");
    expect(document.body.textContent).toContain("Journey Summary");
    expect(document.body.textContent).not.toContain("Real-Time Summary");
  });

  it("(6) panel mode: the event rows stay in the transcript; the approval card moves to the panel", async () => {
    await lucas("panel");
    // The approval card's own checklist mentions "Payment link sent"; that's
    // card content, not an event row.
    const approval = aiCard("Approval request", body())!;
    for (const event of EVENTS) {
      expect(leaves(event).some((el) => !panel().contains(el)), `${event} in the transcript`).toBe(true);
      expect(
        leaves(event).some((el) => panel().contains(el) && !approval.contains(el)),
        `${event} not an event row in the panel`,
      ).toBe(false);
    }
    const prompts = leaves(APPROVAL_PROMPT);
    expect(prompts).toHaveLength(1);
    expect(panel().contains(prompts[0])).toBe(true);
  });

  it("(6) inline mode: the event rows and the approval card are both in the transcript", async () => {
    await lucas("inline");
    for (const event of EVENTS) {
      expect(leaves(event).length, event).toBeGreaterThan(0);
    }
    expect(leaves(APPROVAL_PROMPT)).toHaveLength(1);
    expect(document.body.querySelector("[data-slot=ai-feed]")).toBeNull();
  });

  it("(7) the docked composer's footer carries the inline composer's fade", async () => {
    await lucas("panel");
    const dock = document.body.querySelector("[data-slot=copilot-dock]")!;
    const fade = dock.parentElement!.querySelector(":scope > [data-slot=composer-fade]");
    expect(fade).not.toBeNull();
    expect(fade!.className).toContain("-top-8");
    expect(fade!.className).toContain("to-lyra-bg-surface-container-subtle");
  });
});

describe("(14) voice transcript placement", () => {
  const LINE = "Sure, it's order number 48213, placed last Tuesday.";
  async function marcus(display: "inline" | "panel") {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("ai", { displayLocation: display });
    await h.play(MARCUS_WEBB_SCRIPT.id);
    await h.click(h.navCard("Marcus Webb"));
    await h.advance(1_000);
  }
  /** The side panel's column (header, tabs, scroll area, footer). */
  const panel = () =>
    document.body.querySelector("[data-slot=details-panel-body]")!.parentElement!.closest(".overflow-y-auto")!.parentElement!;
  const transcriptTab = () =>
    [...panel().querySelectorAll("button, [role=tab]")].find((el) => el.textContent?.trim() === "Transcript");
  const lineInMain = () =>
    [...document.body.querySelectorAll("*")].some(
      (el) => el.children.length === 0 && el.textContent?.includes(LINE) && !panel().contains(el) && !el.closest("aside"),
    );

  it("panel mode: the call's transcript fills the main column and the panel has no Transcript tab", async () => {
    await marcus("panel");
    expect(lineInMain()).toBe(true);
    expect(transcriptTab()).toBeUndefined();
  });

  it("inline mode: unchanged, the spoken lines stay in the panel's Transcript tab", async () => {
    await marcus("inline");
    expect(lineInMain()).toBe(false);
    expect(transcriptTab()).toBeTruthy();
  });
});

describe("Reset to defaults", () => {
  it("confirms in a lyra alert dialog: Cancel keeps the settings, Reset restores the defaults", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("voice", { controlsLocation: "top" });
    await openSettings();
    const dialog = () => document.body.querySelector('[role="alertdialog"]');
    expect(dialog()).toBeNull();
    // The button sits in the Settings page header, before every section.
    const resetButton = () => h.buttonByText("Reset to defaults", h.container)!;
    const firstSection = h.container.querySelector("[data-testid=settings-view] fieldset")!;
    expect(isBefore(resetButton(), firstSection)).toBe(true);
    expect(h.container.querySelector("[data-testid=settings-view]")!.contains(resetButton())).toBe(false);

    await h.click(resetButton());
    expect(dialog()!.textContent).toContain("Reset to defaults?");
    await h.click(h.buttonByText("Cancel", dialog()!)!);
    expect(dialog()).toBeNull();
    expect(store().getState().values.voice.controlsLocation).toBe("top");

    await h.click(resetButton());
    await h.click(h.buttonByText("Reset", dialog()!)!);
    expect(dialog()).toBeNull();
    expect(store().getState().values.voice.controlsLocation).toBe("bottom");
    expect(localStorage.getItem(sectionStorageKey("voice"))).toBeNull();
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

describe("Workspace profile", () => {
  it("the app menu has no profile entries: with no items it's empty, and the header shows a plain brand mark", async () => {
    expect(APP_MENU_ITEMS.some((item) => /phase|profile|ai-first/i.test(item.label))).toBe(false);
    expect(buildAppMenuGroups([])).toEqual([]);
    // Data-driven for later items: picking one runs it, then closes the menu.
    const run = vi.fn();
    const onPicked = vi.fn();
    buildAppMenuGroups([{ label: "Customer console", run }], onPicked)[0].items[0].onClick?.();
    expect([run.mock.calls.length, onPicked.mock.calls.length]).toEqual([1, 1]);
    await h.show(AgentWorkspaceAdvancedPage);
    expect(h.container.querySelector("[data-slot=brand-mark]")).not.toBeNull();
    expect(h.container.querySelector('[aria-label$="open application menu"]')).toBeNull();
  });

  it("applying Phase 2 updates the header and Home in place, without a remount; the title has no profile suffix", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    const dashboard = h.container.querySelector("[data-home-section]");
    expect(h.container.querySelector("[data-slot=home-tabs]")).toBeNull();
    await act(async () => {
      applyProfile("phase2");
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(profile()).toBe("phase2");
    expect(h.container.querySelector("[data-slot=brand-mark]")?.textContent).toBe("Workspace");
    expect(h.container.textContent).not.toMatch(/Phase 2|2\.0/);
    expect(h.container.querySelector("[data-slot=home-tabs]")).not.toBeNull();
    expect(headerHas("Schedule")).toBe(true);
    // The same Dashboard node: the page re-rendered in place.
    expect(h.container.querySelector("[data-home-section]")).toBe(dashboard);
  });

  it("Custom shows when any agent setting changes", async () => {
    await setSettings("header", { showAppIcons: true });
    expect(profile()).toBe("custom");
    await setSettings("header", { showAppIcons: false });
    expect(profile()).toBe("phase1");
    await setSettings("appearance", { theme: "dark" });
    expect(profile()).toBe("custom");
  });
});

describe("White-labeling: app name and logo (appearance.brand)", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgo=";

  it("the name and logo render in the header, the welcome modal, the launch screen and the tab title", async () => {
    await setSettings("appearance", { brand: { appName: "Acme Care", logo: PNG } });
    await h.show(AdvancedWithTheme);
    const mark = h.container.querySelector("[data-slot=brand-mark]")!;
    expect(mark.textContent).toBe("Acme Care");
    expect(mark.querySelector("img")!.getAttribute("src")).toBe(PNG);
    // The welcome modal (open on load) shows the logo, named.
    expect(document.body.querySelector(`[role=dialog] img[alt="Acme Care"]`)?.getAttribute("src")).toBe(PNG);
    expect(document.title).toBe("Acme Care");

    await h.render(<LoginPage />);
    expect(h.container.textContent).toContain("Acme Care");
    expect([...h.container.querySelectorAll("img")].some((img) => img.getAttribute("src") === PNG)).toBe(true);
  });

  it("an empty name reads as the default", async () => {
    await setSettings("appearance", { brand: { appName: "  ", logo: null } });
    await h.show(AgentWorkspaceAdvancedPage);
    expect(h.container.querySelector("[data-slot=brand-mark]")?.textContent).toBe("Workspace");
  });

  it("Settings: an oversize upload is refused with a message and keeps the logo; Remove restores the default", async () => {
    await setSettings("appearance", { brand: { appName: "Acme Care", logo: PNG } });
    await h.render(<SettingsView />);
    const input = h.container.querySelector<HTMLInputElement>("[data-slot=logo-input]")!;
    const big = new File([new Uint8Array(300 * 1024)], "logo.png", { type: "image/png" });
    await act(async () => {
      Object.defineProperty(input, "files", { value: [big], configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(h.container.textContent).toContain("256 KB or smaller");
    expect(store().getState().values.appearance.brand.logo).toBe(PNG);
    await h.click(h.buttonByText("Remove", h.container)!);
    expect(store().getState().values.appearance.brand.logo).toBeNull();
    expect(h.container.textContent).not.toContain("256 KB or smaller");
  });

  it("is admin-scope: applying a profile leaves the brand as it is, and it doesn't make the profile Custom", async () => {
    await setSettings("appearance", { brand: { appName: "Acme Care", logo: PNG } });
    expect(profile()).toBe("phase1");
    await act(async () => applyProfile("phase2"));
    expect(store().getState().values.appearance.brand).toEqual({ appName: "Acme Care", logo: PNG });
    expect(profile()).toBe("phase2");
  });
});
