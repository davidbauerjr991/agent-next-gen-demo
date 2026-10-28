// @vitest-environment jsdom
// Toasts for other assignments (P-HOME-1): a message on a chat the agent
// isn't looking at toasts; View switches and focuses the composer; Dismiss
// leaves the drawer row; `notifications.toasts.enabled: false` shows none.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { SECTIONS } from "@/settings/settings-schema";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { assignmentIdFor } from "@/domain";
import { LUCAS_THOMAS_SCRIPT, MAYA_CHEN_SCRIPT } from "@/scenarios";
import { seedScheduleDay } from "@/adapters/sim/sim-schedule-seeds";
import { toastAllowed, toastStack, type AssignmentToast } from "./assignment-toasts";

const defaults = SECTIONS.notifications.defaults.toasts;

describe("toast rules", () => {
  it("off, or the event off, means no toast; quiet on a call holds back non-urgent ones but not approvals", () => {
    expect(toastAllowed("message", defaults, false)).toBe(true);
    expect(toastAllowed("message", { ...defaults, enabled: false }, false)).toBe(false);
    expect(toastAllowed("message", { ...defaults, events: { ...defaults.events, message: false } }, false)).toBe(false);
    const quiet = { ...defaults, quietOnVoice: true };
    expect(toastAllowed("message", quiet, true)).toBe(false);
    expect(toastAllowed("callbackDue", quiet, true)).toBe(false);
    expect(toastAllowed("approval", quiet, true)).toBe(true);
    expect(toastAllowed("message", quiet, false)).toBe(true);
  });

  it("stacks newest first, three at a time, then +N more; dismissed ones leave the stack", () => {
    const toast = (n: number, dismissed = false): AssignmentToast => ({
      id: `toast:${n}`,
      assignmentId: assignmentIdFor(`j${n}`),
      event: "message",
      kind: "conversation",
      cardId: `j${n}`,
      name: `Customer ${n}`,
      line: "hi",
      urgent: false,
      ...(dismissed ? { dismissed } : {}),
    });
    const { shown, more } = toastStack([toast(1), toast(2), toast(3, true), toast(4), toast(5)]);
    expect(shown.map((t) => t.id)).toEqual(["toast:5", "toast:4", "toast:2"]);
    expect(more).toBe(1);
  });
});

describe("toasts in the workspace", () => {
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
  const headings = () => [...h.container.querySelectorAll("h1, h2")].map((el) => el.textContent?.trim());
  // The bell's unread count, or (header icons tucked away, as in jsdom) the "View All Apps" badge (channels-seeds.test.tsx).
  const unreadCount = () => {
    const bell = [...h.container.querySelectorAll('[aria-label^="Notifications"]')]
      .map((el) => el.getAttribute("aria-label")!)
      .find((label) => /^Notifications(, \d+ unread)?$/.test(label));
    if (bell) return Number(/(\d+) unread/.exec(bell)?.[1] ?? 0);
    const apps = h.container.querySelector('[aria-label="View All Apps"]');
    return Number(apps?.parentElement?.textContent?.match(/\d+/)?.[0] ?? 0);
  };

  async function twoChats() {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    const ana = await h.startInbound("chat", "ana@example.com", "Ana Silva");
    const ben = await h.startInbound("chat", "ben@example.com", "Ben Ortiz");
    await h.advance(300);
    await h.click(h.navCard("Ana Silva"));
    return { ana, ben };
  }

  async function customerSays(id: Parameters<typeof h.customer.message>[0]["interactionId"], text: string) {
    await act(async () => {
      h.customer.message({ interactionId: id, text });
      await vi.advanceTimersByTimeAsync(100);
    });
  }

  it("a message on the other chat toasts; one on the active chat doesn't", async () => {
    const { ana, ben } = await twoChats();
    await customerSays(ana, "Still there?");
    expect(toasts()).toHaveLength(0);
    await customerSays(ben, "Is the tank shipping today?");
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]!.textContent).toContain("Ben Ortiz");
    expect(toasts()[0]!.textContent).toContain("Is the tank shipping today?");
    expect(toasts()[0]!.textContent).toContain("Chat");
  });

  it("View switches to that assignment and focuses its composer", async () => {
    const { ben } = await twoChats();
    await customerSays(ben, "Hello?");
    const view = [...toasts()[0]!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "View")!;
    await h.click(view);
    await h.advance(300);
    expect(headings()).toContain("Ben Ortiz");
    expect(headings()).not.toContain("Ana Silva");
    expect(document.activeElement?.hasAttribute("data-composer-input")).toBe(true);
    expect(toasts()).toHaveLength(0);
  });

  it("Dismiss closes the toast and leaves its row in the Notifications drawer (one more unread)", async () => {
    // Phase 1 hides the header's app icons, the bell's among them.
    getSettingsStore().update("header", { showAppIcons: true });
    const { ben } = await twoChats();
    const before = unreadCount();
    await customerSays(ben, "Hello?");
    expect(unreadCount()).toBe(before + 1);
    const dismiss = toasts()[0]!.querySelector<HTMLElement>('[aria-label="Dismiss"]')!;
    await h.click(dismiss);
    await h.advance(400);
    expect(toasts()).toHaveLength(0);
    expect(unreadCount()).toBe(before + 1);
  });

  it("notifications.toasts.enabled: false shows nothing", async () => {
    getSettingsStore().update("notifications", { toasts: { ...defaults, enabled: false } });
    const { ben } = await twoChats();
    await customerSays(ben, "Hello?");
    expect(toasts()).toHaveLength(0);
  });

  it("the seeded moment: Lucas's approval request toasts during Maya's call, and stays", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.play(MAYA_CHEN_SCRIPT.id);
    await h.advance(3_000);
    await act(async () => {
      h.customer.playScenario(LUCAS_THOMAS_SCRIPT.id);
      await vi.advanceTimersByTimeAsync(100);
    });
    await h.advance(16_000);
    const approval = toasts().find((t) => t.getAttribute("data-assignment-toast") === "approval");
    expect(approval?.textContent).toContain("Lucas Thomas");
    expect(approval?.textContent).toContain("requested approval");
    await h.advance(30_000);
    expect(toasts().some((t) => t.getAttribute("data-assignment-toast") === "approval")).toBe(true);
  });

  it("a ringing offer doesn't toast", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.goAvailable();
    await h.startInbound("voice", "+15555550123", "Tom Lewis");
    await h.advance(300);
    expect(toasts()).toHaveLength(0);
  });
});

describe("a new work item toasts (P-HOME-1m: notifications.toasts.events.workItem)", () => {
  const h = createWorkspaceHarness({ schedule: true });
  const toasts = () => [...document.querySelectorAll<HTMLElement>("[data-assignment-toast]")];

  beforeEach(() => {
    localStorage.clear();
    resetSettingsStoreForTests();
    // The Activity feed on Home, so View has the row to preview.
    getSettingsStore().update("home", (prev) => ({ sections: prev.sections.map((s) => (s.key === "activity" ? { ...s, enabled: true } : s)) }));
    h.setUp();
    vi.setSystemTime(new Date(2026, 9, 24, 10, 30));
  });

  afterEach(async () => {
    await h.tearDown();
  });

  async function addCallback() {
    const [template] = seedScheduleDay("agent", Date.now());
    await act(async () => {
      const added = h.schedule!.add({ ...template!, id: "added-callback", title: "Callback · Ana Lopez", customer: { name: "Ana Lopez" }, dueAt: Date.now() + 45 * 60_000 });
      await vi.advanceTimersByTimeAsync(50);
      await added;
    });
  }

  it("an item added after load toasts with its kind, title and due; the seeded day doesn't; View opens its feed row's preview on Home", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.advance(100);
    expect(toasts()).toHaveLength(0);
    // Somewhere else than Home: a kind cell open.
    await h.click([...h.container.querySelectorAll<HTMLElement>("[data-feed-row]")].find((r) => r.textContent?.includes("Returns team stand-up"))!);
    await h.click(document.querySelector<HTMLElement>("[data-home-detail=item] [data-preview-open]")!);
    expect(h.container.querySelector("[data-kind-cell]")).not.toBeNull();
    await addCallback();
    expect(toasts()).toHaveLength(1);
    const toast = toasts()[0]!;
    expect(toast.getAttribute("data-assignment-toast")).toBe("workItem");
    expect(toast.textContent).toContain("Callback · Ana Lopez");
    // The kind chip (KindTag), not just the word in the title.
    expect(toast.querySelector("[data-kind-tag]")?.getAttribute("data-kind-tag")).toBe("callback");
    expect(toast.textContent).toMatch(/Due /);
    await h.click([...toast.querySelectorAll("button")].find((b) => b.textContent?.trim() === "View")!);
    await h.advance(200);
    expect(h.container.querySelector("[data-kind-cell]")).toBeNull();
    expect(document.querySelector("[data-home-detail=item]")?.getAttribute("data-schedule-item")).toBe("added-callback");
    expect(toasts()).toHaveLength(0);
  });

  it("its switch off, nothing; quiet during a call holds it back like the other non-urgent toasts", async () => {
    getSettingsStore().update("notifications", { toasts: { ...defaults, events: { ...defaults.events, workItem: false } } });
    await h.show(AgentWorkspaceAdvancedPage);
    await addCallback();
    expect(toasts()).toHaveLength(0);
    expect(toastAllowed("workItem", { ...defaults, quietOnVoice: true }, true)).toBe(false);
    expect(toastAllowed("workItem", defaults, false)).toBe(true);
  });
});
