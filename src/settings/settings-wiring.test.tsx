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
import { applyStoredTheme, useApplyTheme } from "./hooks";
import { derivePreset } from "./presets";
import { getSettingsStore, resetSettingsStoreForTests, sectionStorageKey } from "./settings-store";
import type { SectionKey, SettingsState } from "./settings-schema";

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

async function openSettings() {
  const settings = [...h.container.querySelectorAll("aside button, aside [role=button]")].find(
    (el) => el.textContent?.trim() === "Settings" || el.getAttribute("aria-label") === "Settings",
  );
  if (!settings) throw new Error("no Settings nav item");
  await h.click(settings);
}

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

    await setSettings("header", { agentChat: false, appsGrid: false });
    expect(headerHas("Agent Chat")).toBe(false);
    expect(headerHas("View All Apps")).toBe(false);
    expect(headerHas("Search")).toBe(true);
  });

  it("an extra pin shows its app", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await setSettings("header", { showAppIcons: true });
    expect(headerHas("WEM")).toBe(false);
    await setSettings("header", { pins: { ...store().getState().values.header.pins, wem: true } });
    expect(headerHas("WEM")).toBe(true);
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
