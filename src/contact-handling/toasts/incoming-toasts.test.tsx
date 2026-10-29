// @vitest-environment jsdom
// The incoming toast (P-HOME-1n): a new assignment arriving — routed and auto-accepted, offered, or delivered —
// raises a toast with View; off by default, forced on (with its reason in Settings) while the assignments are at the
// top of Home, where "Quiet during a call" doesn't hold it back either. Cards the agent starts never toast.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedScheduleDay } from "@/adapters/sim/sim-schedule-seeds";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SECTIONS } from "@/settings/settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { ARRIVAL_GRACE_MS, inArrivalGrace, isRoutedContact, newArrivals } from "./arrivals";
import { toastAllowed } from "./assignment-toasts";

const defaults = SECTIONS.notifications.defaults.toasts;

describe("arrivals", () => {
  it("a card is an arrival when it's new and holds a routed contact; seen or agent-started cards aren't", () => {
    const card = (id: string, ...providerIds: string[]) => ({ id, threads: providerIds.map((p) => ({ providerInteractionId: p })) });
    const routed = new Set(["i-routed"]);
    expect(newArrivals(new Set(), [card("a", "i-routed"), card("b", "i-dialed")], routed).map((c) => c.id)).toEqual(["a"]);
    expect(newArrivals(new Set(["a"]), [card("a", "i-routed")], routed)).toEqual([]);
    expect(isRoutedContact({ origin: "routed" })).toBe(true);
    expect(isRoutedContact({ origin: "agent-initiated" })).toBe(false);
    expect(isRoutedContact({ origin: "reopened" })).toBe(false);
    // The grace: before Available everything is the baseline; then for ARRIVAL_GRACE_MS after the first Available.
    expect(inArrivalGrace(undefined, 10_000)).toBe(true);
    expect(inArrivalGrace(1_000, 1_000 + ARRIVAL_GRACE_MS - 1)).toBe(true);
    expect(inArrivalGrace(1_000, 1_000 + ARRIVAL_GRACE_MS)).toBe(false);
  });

  it("forced, the incoming toast shows during a call even with Quiet during a call on", () => {
    const quiet = { ...defaults, quietOnVoice: true, events: { ...defaults.events, incoming: true } };
    expect(toastAllowed("incoming", quiet, true)).toBe(false);
    expect(toastAllowed("incoming", quiet, true, true)).toBe(true);
  });
});

describe("the incoming toast in the workspace", () => {
  const h = createWorkspaceHarness();
  beforeEach(() => {
    localStorage.clear();
    resetSettingsStoreForTests();
    getSettingsStore().update("channels", { voice: true, chat: true });
    h.setUp();
  });
  afterEach(async () => {
    await h.tearDown();
  });

  const toasts = () => [...document.querySelectorAll<HTMLElement>("[data-assignment-toast]")];
  const incoming = () => toasts().filter((el) => /Assigned to you|Offered to you/.test(el.textContent ?? ""));
  const setIncoming = (on: boolean) =>
    act(async () => {
      getSettingsStore().update("notifications", (n) => ({ toasts: { ...n.toasts, events: { ...n.toasts.events, incoming: on } } }));
    });

  it("off by default: a routed chat arriving raises no toast", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.startInbound("chat", "ana@example.com", "Ana Silva");
    await h.advance(500);
    expect(incoming()).toHaveLength(0);
  });

  it("on, within the grace after Go Available: the day's starting cards join the baseline and don't toast", async () => {
    await setIncoming(true);
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.startInbound("chat", "early@example.com", "Early Bird");
    await h.advance(500);
    expect(incoming()).toHaveLength(0);
    // After the grace, a new one does.
    await h.advance(ARRIVAL_GRACE_MS);
    await h.startInbound("chat", "ana@example.com", "Ana Silva");
    await h.advance(500);
    expect(incoming().map((el) => el.textContent?.includes("Ana Silva"))).toEqual([true]);
  });

  it("on: an auto-accepted chat and an offered call each raise one, with View; the offer's says it's offered", async () => {
    await setIncoming(true);
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.advance(ARRIVAL_GRACE_MS);
    await h.startInbound("chat", "ana@example.com", "Ana Silva");
    await h.advance(500);
    expect(incoming()).toHaveLength(1);
    expect(incoming()[0].textContent).toContain("Ana Silva");
    expect(incoming()[0].textContent).toContain("Assigned to you");
    expect([...incoming()[0].querySelectorAll("button")].some((b) => b.textContent?.trim() === "View")).toBe(true);

    const ben = await h.startInbound("voice", "+14155550199", "Ben Ortiz");
    await h.advance(500);
    const offer = incoming().find((el) => el.textContent?.includes("Ben Ortiz"));
    expect(offer?.textContent).toContain("Offered to you");
    // Accepting the same offer later doesn't raise a second.
    await h.accept(ben);
    await h.advance(500);
    expect(incoming().filter((el) => el.textContent?.includes("Ben Ortiz"))).toHaveLength(1);
  });

  it("placement none forces it on with toasts off, and Settings shows the switch disabled with the reason", async () => {
    await act(async () => {
      getSettingsStore().update("notifications", { toasts: { ...defaults, enabled: false } });
      getSettingsStore().update("assignments", { placement: "none" });
    });
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.advance(ARRIVAL_GRACE_MS);
    await h.startInbound("chat", "ana@example.com", "Ana Silva");
    await h.advance(500);
    expect(incoming()).toHaveLength(1);

    await h.show(NotificationSettings);
    const forced = h.container.querySelector<HTMLElement>('[data-forced-setting="notifications.toasts.events.incoming"]');
    expect(forced?.textContent).toContain("On — required while assignments aren't in the left nav");
    expect(forced?.querySelector("button[role=checkbox], input[type=checkbox]")?.hasAttribute("disabled")).toBe(true);
    // The master switch is held on too (its reason on hover; the note once, on incoming).
    const master = h.container.querySelector<HTMLElement>('[data-forced-setting="notifications.toasts.enabled"]');
    expect(master?.querySelector("button[role=switch]")?.hasAttribute("disabled")).toBe(true);
    expect(h.container.textContent?.match(/On — required/g)).toHaveLength(1);
  });
});

describe("the incoming toast for schedule items (a kind card's arrival)", () => {
  const h = createWorkspaceHarness({ schedule: true });
  beforeEach(() => {
    localStorage.clear();
    resetSettingsStoreForTests();
    getSettingsStore().update("notifications", (n) => ({ toasts: { ...n.toasts, events: { ...n.toasts.events, incoming: true } } }));
    h.setUp();
    vi.setSystemTime(new Date(2026, 9, 24, 10, 30));
  });
  afterEach(async () => {
    await h.tearDown();
  });

  const toasts = () => [...document.querySelectorAll<HTMLElement>("[data-assignment-toast]")];
  async function add(id: string, state: "scheduled" | "offered") {
    const [template] = seedScheduleDay("agent", Date.now());
    await act(async () => {
      const added = h.schedule!.add({ ...template!, id, state, title: `Callback · ${id}`, customer: { name: id }, dueAt: Date.now() + 45 * 60_000 });
      await vi.advanceTimersByTimeAsync(50);
      await added;
    });
  }

  it("a scheduled item and an offered item each raise one incoming toast, never a second work-item toast", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.advance(100);
    expect(toasts()).toHaveLength(0);
    await add("Ana Lopez", "scheduled");
    await add("Raj Patel", "offered");
    expect(toasts().map((el) => el.getAttribute("data-assignment-toast"))).toEqual(["incoming", "incoming"]);
    expect(toasts().find((el) => el.textContent?.includes("Raj Patel"))?.textContent).toContain("Offered to you");
  });
});
