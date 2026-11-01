// @vitest-environment jsdom
// Settings → Layout (P-LAYOUT): a preset writes the map and its legacy field, "Custom" when the map matches no value;
// Advanced moves a part between the slots it allows (and refuses the rest, saying why), reorders within a slot, and
// the preview follows; Reset restores the applied profile's map; the `layout` lock makes all of it read-only, and the
// legacy placement controls elsewhere too.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { getProfileLibrary } from "@/settings/saved-profiles";
import { applyProfile } from "@/settings";
import { patchParts } from "@/layout/layout-section";
import { SettingsView } from "./SettingsView";

const h = createWorkspaceHarness();
beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  getProfileLibrary().setApplied(null);
  h.setUp();
});
afterEach(async () => {
  getProfileLibrary().setApplied(null);
  await h.tearDown();
});

const values = () => getSettingsStore().getState().values;
const preset = (field: string) => h.container.querySelector<HTMLElement>(`[data-layout-preset="${field}"]`)!;
const radioIn = (el: HTMLElement, label: string) => [...el.querySelectorAll<HTMLElement>("[role=radio]")].find((r) => r.textContent?.trim() === label)!;
const part = (id: string) => h.container.querySelector<HTMLElement>(`[data-layout-part="${id}"]`)!;
const slotOf = (id: string) => part(id)?.closest("[data-layout-slot]")?.getAttribute("data-layout-slot");
const previewSlotOf = (id: string) => h.container.querySelector(`[data-layout-preview] [data-preview-part="${id}"]`)?.closest("[data-preview-slot]")?.getAttribute("data-preview-slot");
const liveRegion = () => document.getElementById("lyra-tabs-live-region")?.textContent ?? "";

/** The Advanced accordion's trigger. */
const advancedTrigger = () =>
  [...h.container.querySelectorAll<HTMLElement>("[data-settings-group=layout] button")].find((b) => b.textContent?.includes("Advanced") && b.hasAttribute("aria-expanded"))!;

async function openAdvanced(page: "Home" | "Interaction") {
  // Advanced moves parts only with the Advanced layout switch on (P-LAYOUT-F1 E).
  if (!values().layout.advanced) {
    await act(async () => {
      getSettingsStore().update("layout", { advanced: true });
    });
  }
  const header = advancedTrigger();
  await h.click(header);
  await h.click(radioIn(h.container.querySelector<HTMLElement>("[data-settings-group=layout]")!, page));
}

async function press(id: string, key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") {
  await act(async () => {
    part(id).focus();
    part(id).dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey: true, bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);
  });
}

describe("Settings → Layout presets (P-LAYOUT)", () => {
  it("a preset writes the map and the legacy field together; the canvas layout is then unused, with the reason", async () => {
    await h.render(<SettingsView />);
    await h.click(radioIn(preset("ai.displayLocation"), "In the Contact Details panel"));
    expect(values().ai.displayLocation).toBe("panel");
    expect(values().layout.parts.aiFeed.slot).toBe("docked-panel");
    expect(values().layout.parts.copilotInput.slot).toBe("docked-panel");
    expect(radioIn(preset("ai.displayLocation"), "In the Contact Details panel").getAttribute("aria-checked")).toBe("true");
    const canvas = preset("ai.canvasLayout");
    expect([...canvas.querySelectorAll("[role=radio]")].every((r) => r.hasAttribute("disabled"))).toBe(true);
    // The reason on hover and as text.
    const reason = "Not used when AI display is In the Contact Details panel";
    expect(canvas.querySelector("[data-disabled-reason]")?.getAttribute("data-disabled-reason")).toBe(reason);
    expect(canvas.textContent).toContain(reason);
  });

  it("a map no value of a field reproduces shows Custom, nothing checked, and leaves the field as it was", async () => {
    await h.render(<SettingsView />);
    expect(preset("home.layout").textContent).not.toContain("Custom");
    await act(async () => {
      getSettingsStore().update("layout", { parts: patchParts(values().layout.parts, { queue: { slot: "main-trailing" } }) });
    });
    expect(preset("home.layout").textContent).toContain("Custom");
    expect([...preset("home.layout").querySelectorAll("[role=radio]")].some((r) => r.getAttribute("aria-checked") === "true")).toBe(false);
    expect(values().home.layout).toBe("oneColumn");
    // Picking the value the field already holds applies its preset too: the queue goes back, Custom clears.
    await h.click(radioIn(preset("home.layout"), "One column"));
    expect(values().layout.parts.queue.slot).toBe("main");
    expect(preset("home.layout").textContent).not.toContain("Custom");
    expect(radioIn(preset("home.layout"), "One column").getAttribute("aria-checked")).toBe("true");
    // And another value is that preset: every side section moves.
    await h.click(radioIn(preset("home.layout"), "Two columns"));
    expect(values().home.layout).toBe("twoColumn");
    expect(preset("home.layout").textContent).not.toContain("Custom");
  });
});

describe("the Advanced layout switch (P-LAYOUT-F1 E)", () => {
  it("off (the default): the presets apply and Advanced is disabled, with its reason", async () => {
    await h.render(<SettingsView />);
    expect(values().layout.advanced).toBe(false);
    expect(advancedTrigger().hasAttribute("disabled")).toBe(true);
    expect(h.container.querySelector("[data-settings-group=layout]")!.textContent).toContain("Turn on Advanced layout to drag parts.");
    expect([...preset("home.layout").querySelectorAll("[role=radio]")].some((r) => r.hasAttribute("disabled"))).toBe(false);
  });

  it("on: every placement preset is disabled with its reason, and Advanced opens", async () => {
    await h.render(<SettingsView />);
    // The group's first switch: Advanced layout, above the presets.
    await h.click(h.container.querySelector<HTMLElement>("[data-settings-group=layout] button[role=switch]")!);
    expect(values().layout.advanced).toBe(true);
    for (const field of ["home.layout", "assignments.placement", "ai.displayLocation", "ai.canvasLayout", "voice.controlsLocation"]) {
      const row = preset(field);
      expect([...row.querySelectorAll("[role=radio]")].every((r) => r.hasAttribute("disabled")), field).toBe(true);
      expect(row.textContent, field).toContain("Advanced layout is on.");
      // The reason describes the group, so the keyboard reaches it (lyra F1-L2 `ariaDescribedBy`).
      const group = row.querySelector("[role=radiogroup]")!;
      expect(document.getElementById(group.getAttribute("aria-describedby") ?? "")?.textContent, field).toBe("Advanced layout is on.");
    }
    await h.click(advancedTrigger());
    expect(advancedTrigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("turned off with Advanced open: the lists go read-only — no keyboard move, the menus disabled", async () => {
    await h.render(<SettingsView />);
    await openAdvanced("Home");
    await h.click(h.container.querySelector<HTMLElement>("[data-settings-group=layout] button[role=switch]")!);
    expect(values().layout.advanced).toBe(false);
    // The move the first Advanced test makes (main → the Cards column), refused now.
    await press("activityFeed", "ArrowRight");
    expect(values().layout.parts.activityFeed.slot).toBe("main");
    const menu = part("activityFeed").querySelector<HTMLElement>("button[role=combobox]");
    expect(menu?.closest("fieldset")?.disabled).toBe(true);
  });
});

describe("Settings → Layout → Advanced (P-LAYOUT)", () => {
  it("lists a page's parts by slot; the keyboard moves one to the next slot it allows, focus follows, and the preview shows it", async () => {
    // The feed on (the preview draws only what the page would render).
    await act(async () => {
      getSettingsStore().update("home", (prev) => ({ sections: prev.sections.map((s) => (s.key === "activity" ? { ...s, enabled: true } : s)) }));
    });
    await h.render(<SettingsView />);
    await openAdvanced("Home");
    expect(slotOf("activityFeed")).toBe("main");
    expect(previewSlotOf("activityFeed")).toBe("main");
    await press("activityFeed", "ArrowRight");
    expect(values().layout.parts.activityFeed.slot).toBe("main-trailing");
    expect(slotOf("activityFeed")).toBe("main-trailing");
    expect(document.activeElement).toBe(part("activityFeed"));
    // Home is one column without the feed in main (`homeIsTwoColumn`): the preview draws it in main, as Home does.
    expect(previewSlotOf("activityFeed")).toBe("main");
    expect(h.container.querySelector('[data-layout-preview] [data-preview-slot="main-trailing"]')).toBeNull();
    expect(liveRegion()).toContain("Activity, moved to Cards column");
    // Switched off, a section leaves the preview (not the lists: it keeps its slot).
    await act(async () => {
      getSettingsStore().update("home", (prev) => ({ sections: prev.sections.map((s) => (s.key === "activity" ? { ...s, enabled: false } : s)) }));
    });
    expect(previewSlotOf("activityFeed")).toBeUndefined();
    expect(slotOf("activityFeed")).toBe("main-trailing");
  });

  it("the preview is two columns only when Home is: a section in the Cards column and the feed on in main", async () => {
    await h.render(<SettingsView />);
    await openAdvanced("Home");
    await act(async () => {
      getSettingsStore().update("layout", { parts: patchParts(values().layout.parts, { queue: { slot: "main-trailing" } }) });
    });
    // The feed off (the default Home): one column, the queue in main.
    expect(previewSlotOf("queue")).toBe("main");
    expect(h.container.querySelector('[data-layout-preview] [data-preview-slot="main-trailing"]')).toBeNull();
    await act(async () => {
      getSettingsStore().update("home", (prev) => ({ sections: prev.sections.map((s) => (s.key === "activity" ? { ...s, enabled: true } : s)) }));
    });
    expect(previewSlotOf("queue")).toBe("main-trailing");
  });

  it("a slot the part doesn't allow refuses the move and says why, announced and shown under that list until a move lands", async () => {
    await h.render(<SettingsView />);
    await openAdvanced("Home");
    const before = values().layout.parts;
    await press("contactHistory", "ArrowRight");
    expect(values().layout.parts).toBe(before);
    expect(slotOf("contactHistory")).toBe("main");
    expect(liveRegion()).toBe("Contact history can't go in the Cards column");
    const shown = () => h.container.querySelector<HTMLElement>("[data-layout-refusal]");
    expect(shown()?.getAttribute("data-layout-refusal")).toBe("main-trailing");
    expect(shown()?.textContent).toContain("Contact history can't go in the Cards column");
    // One announcement: the hook's; the notification isn't a second live region.
    expect(shown()?.getAttribute("role")).toBe("note");
    await press("queue", "ArrowDown");
    expect(shown()).toBeNull();
  });

  it("a part that follows another is placed by its rule: its Slot menu is disabled and its row says why", async () => {
    await h.render(<SettingsView />);
    await openAdvanced("Interaction");
    const copilot = part("copilotInput");
    expect(copilot.textContent).toContain("Ask Copilot");
    expect(copilot.textContent).toContain("Follows the AI feed");
    const slotMenu = copilot.querySelector<HTMLElement>('[role=combobox][aria-label="Slot for Ask Copilot"]')!;
    expect(slotMenu.hasAttribute("disabled") || slotMenu.getAttribute("aria-disabled") === "true").toBe(true);
    // The disabled menu takes no focus: the row, which does, is described by the reason.
    const described = copilot.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain("Follows the AI feed");
    // A free part's menu isn't.
    const conversationMenu = part("conversation").querySelector<HTMLElement>('[role=combobox][aria-label="Slot for Conversation"]')!;
    expect(conversationMenu.hasAttribute("disabled") || conversationMenu.getAttribute("aria-disabled") === "true").toBe(false);
  });

  it("moving within a slot reorders it, and Home's section order follows", async () => {
    await h.render(<SettingsView />);
    await openAdvanced("Home");
    const order = () => values().home.sections.map((s) => s.key);
    const before = order();
    const queueAt = before.indexOf("queue");
    await press("queue", "ArrowDown");
    const after = order();
    expect(after.indexOf("queue")).toBe(queueAt + 1);
    expect(after.filter((k) => k !== "queue")).toEqual(before.filter((k) => k !== "queue"));
  });

  it("the preview renders the real reference cards on Maya's case; a cell switched off leaves it, and on again drops the override", async () => {
    await h.render(<SettingsView />);
    await openAdvanced("Interaction");
    expect(h.container.querySelector('[data-layout-preview] [data-preview-part="customerInfo"]')?.textContent).toContain("Maya Chen");
    expect(previewSlotOf("journeySummary")).toBe("reference");
    const toggle = () => [...h.container.querySelectorAll<HTMLElement>("[data-layout-reference-cells] [role=switch]")].find((s) => s.closest("label, div")?.textContent?.includes("Journey Summary"))!;
    await h.click(toggle());
    expect(values().canvas.cells["journey-summary"]).toEqual({ enabled: false });
    expect(previewSlotOf("journeySummary")).toBeUndefined();
    await h.click(toggle());
    expect(values().canvas.cells["journey-summary"]).toBeUndefined();
    expect(previewSlotOf("journeySummary")).toBe("reference");
  });

  it("Reset to profile default writes the applied profile's map back", async () => {
    await h.render(<SettingsView />);
    await act(async () => applyProfile("phase2"));
    const profileMap = values().layout.parts;
    await openAdvanced("Home");
    await press("activityFeed", "ArrowRight");
    expect(values().layout.parts).not.toEqual(profileMap);
    await h.click([...h.container.querySelectorAll<HTMLElement>("[data-settings-group=layout] button")].find((b) => b.textContent === "Reset to profile default")!);
    expect(values().layout.parts).toEqual(profileMap);
  });
});

describe("the layout lock (P-LAYOUT)", () => {
  it("a lock on another section a move would reach refuses it and says so, never a write that snaps back", async () => {
    await h.render(<SettingsView />);
    await act(async () => getProfileLibrary().setApplied({ id: "phase1", locks: ["home"] }));
    await openAdvanced("Home");
    const before = values();
    // Reordering Home's main column writes Home's section order: Home is locked.
    await press("queue", "ArrowDown");
    expect(values().layout.parts).toBe(before.layout.parts);
    expect(values().home.sections).toBe(before.home.sections);
    expect(h.container.querySelector("[data-layout-notice]")?.textContent).toBe("Queue can't move: Locked by: Phase 1 agent profile");
    // Moving the feed beside it reaches no locked field (a custom map leaves Home's layout as it is): it lands.
    await press("activityFeed", "ArrowRight");
    expect(values().layout.parts.activityFeed.slot).toBe("main-trailing");
    expect(values().home).toBe(before.home);
  });

  it("makes Settings → Layout read-only (every placement's one place since P-LAYOUT-F1 E), and Home's activity view with it", async () => {
    await act(async () => {
      getSettingsStore().update("header", (prev) => ({ showAppIcons: true, apps: { ...prev.apps, customers: { ...prev.apps.customers, enabled: true } } }));
    });
    await h.render(<SettingsView />);
    await act(async () => getProfileLibrary().setApplied({ id: "phase1", locks: ["layout"] }));
    const layout = h.container.querySelector<HTMLFieldSetElement>("[data-settings-group=layout]")!;
    expect(layout.disabled).toBe(true);
    expect(layout.querySelector("legend")?.textContent).toContain("Locked by: Phase 1 agent profile");
    // The parts are shown, not behind the (disabled) accordion; a keyboard move that would otherwise land does nothing.
    expect(slotOf("customerInfo")).toBe("reference");
    const before = values().layout.parts;
    await press("customerInfo", "ArrowLeft");
    expect(values().layout.parts).toBe(before);
    expect(slotOf("customerInfo")).toBe("reference");
    // The presets, the voice controls' and the header apps' display among them, are inside the locked group.
    expect(layout.querySelector("[data-layout-preset='voice.controlsLocation']")).not.toBeNull();
    expect(layout.querySelector("[data-layout-preset='header.apps.customers.placement']")).not.toBeNull();
    // Elsewhere: Home's activity view sits in the lock's read-only scope, with its tag.
    const lockedScope = (el: Element | null) => el?.closest<HTMLFieldSetElement>("fieldset[data-section-locked]");
    const activityView = h.container.querySelector("[data-setting='home.activityView']");
    expect(lockedScope(activityView)?.disabled).toBe(true);
    // Queue's down move is enabled unlocked (home-settings.test); the lock holds it.
    const queueDown = h.container.querySelector<HTMLButtonElement>('[title="Move Queue down"], [aria-label="Move Queue down"]');
    expect(queueDown?.disabled).toBe(true);
    expect(h.container.querySelector("[data-settings-group=home]")?.textContent).toContain("Order — Locked by: Phase 1 agent profile");
  });
});
