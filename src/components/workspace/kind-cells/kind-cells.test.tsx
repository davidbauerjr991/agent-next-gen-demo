// @vitest-environment jsdom
// Schedule items as assignments (P-HOME-1): a meeting, training or task row
// opens a minimal per-kind cell and a rail card; saving its placeholder
// outcome completes it into History. A persona switch re-seeds the feed and
// swaps the Home cards.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import { withPersonaSections } from "@/settings/persona";

const h = createWorkspaceHarness({ schedule: true });

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  // The agent persona's Home: the Activity feed on (the default Home doesn't have it).
  const store = getSettingsStore();
  store.update("home", { sections: withPersonaSections(store.getState().values.home.sections, "agent") });
  h.setUp();
  vi.setSystemTime(new Date(2026, 9, 24, 10, 30));
});

afterEach(async () => {
  await h.tearDown();
});

async function showHome() {
  await h.show(AgentWorkspaceAdvancedPage);
  await h.advance(100);
}

const feed = () => h.container.querySelector<HTMLElement>("[data-activity-feed]");
const rowNamed = (text: string) => [...(feed()?.querySelectorAll<HTMLElement>("[data-feed-row]") ?? [])].find((r) => r.textContent?.includes(text));
const cell = () => h.container.querySelector<HTMLElement>("[data-kind-cell]");
const button = (label: string) => [...h.container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === label);
const homeButton = () => [...h.container.querySelectorAll("aside button, aside [role=button]")].find((el) => el.textContent?.trim() === "Home")!;
const view = (label: string) => [...(feed()?.querySelectorAll<HTMLElement>("[data-feed-views] [role=radio]") ?? [])].find((b) => b.textContent?.trim().startsWith(label));

async function type(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
  });
}

const outcomeForm = () => document.querySelector<HTMLElement>("[data-kind-outcome]");

describe("schedule items open as assignments", () => {
  it.each([
    ["Returns team stand-up", "meeting", "Agenda", "notes"],
    ["RET-1.3 refund policy update", "training", "Module", "completion"],
    ["Ticket #4821 · subscription renewal refund", "task", "Ticket #4821", "ticket"],
    ["Callback · Priya Shah", "callback", "Refund RF-20451", "disposition"],
  ] as const)("%s opens its %s cell and a rail card; the card's Outcome is the kind's form, and saving completes it into History", async (title, kind, body, shape) => {
    await showHome();
    await h.click(rowNamed(title)!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe(kind);
    expect(cell()?.textContent).toContain(body);
    // The outcome is on the card, not the cell.
    expect(cell()?.querySelector("[data-kind-outcome]")).toBeNull();
    const card = h.container.querySelector("aside [data-kind-nav-card]")!;
    expect(card).not.toBeNull();
    expect(feed()).toBeNull();

    await h.click(card.querySelector("[data-kind-outcome-trigger]")!);
    expect(outcomeForm()?.getAttribute("data-kind-outcome")).toBe(shape);
    const save = () => [...document.querySelectorAll<HTMLButtonElement>("[data-kind-outcome] button")].find((b) => b.textContent?.trim() === "Save outcome")!;
    if (shape === "disposition") {
      // A callback's outcome is a disposition, as a contact's: Save waits for one.
      expect(save().disabled).toBe(true);
      return;
    }
    if (shape === "completion") {
      await h.click(outcomeForm()!.querySelector('[role="checkbox"], input[type="checkbox"]')!);
    } else {
      await type(outcomeForm()!.querySelector("textarea")!, "Done for today");
    }
    await h.click(save());
    expect(cell()).toBeNull();
    expect(h.container.querySelector("aside [data-kind-nav-card]")).toBeNull();
    // Out of the time groups; in History (the All view shows it) as completed.
    expect(rowNamed(title)?.getAttribute("data-feed-status")).toBe("completed");
    await h.click(view("History")!);
    expect(rowNamed(title)?.getAttribute("data-feed-status")).toBe("completed");
  });

  it("a kind card is formatted like an interaction card: the kind chip with its icon and the due time; collapsed, the kind icon sits top-left", async () => {
    await showHome();
    await h.click(rowNamed("Returns team stand-up")!);
    const card = () => h.container.querySelector<HTMLElement>("aside [data-kind-nav-card]")!;
    const body = card().querySelector("[data-kind-card-body]")!;
    expect(body.textContent).toContain("Meeting");
    expect(body.querySelector("svg")).not.toBeNull();
    expect(body.querySelector("[data-kind-card-due]")?.textContent).toMatch(/\d/);
    await h.click(h.container.querySelector('aside [aria-label="Collapse sidebar"]')!);
    expect(card().querySelector("[data-kind-icon] svg")).not.toBeNull();
  });

  it("the rail card reopens the cell after going Home", async () => {
    await showHome();
    await h.click(rowNamed("Returns team stand-up")!);
    await h.click(homeButton());
    expect(cell()).toBeNull();
    await h.click(h.container.querySelector("aside [data-kind-nav-card] [role=button], aside [data-kind-nav-card] button")!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("meeting");
  });
});

describe("calls from schedule items (until P0.9)", () => {
  const phoneField = () => [...document.querySelectorAll<HTMLInputElement>("input")].find((i) => i.getAttribute("aria-label") === "Phone number" || i.placeholder === "Phone number");
  /** The provider's voice contacts (the sim's transport runs on the faked timers: advance, then read). */
  const voiceCalls = async () => {
    let calls: Awaited<ReturnType<typeof h.provider.getSnapshot>>["interactions"] = [];
    await act(async () => {
      const snapshot = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      calls = (await snapshot).interactions.filter((i) => i.channel === "voice");
    });
    return calls;
  };

  /** Opens `title`'s cell, clicks its call button and dials from the pad; returns the call. */
  async function callFrom(title: string) {
    await h.click(rowNamed(title)!);
    await h.click(cell()!.querySelector("[data-schedule-call]")!);
    await h.click([...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Dial Number")!);
    // The pad shows "Connecting…" for 2s before it dials (lyra's CONNECTING_DURATION_MS); then the call rings and connects.
    await h.advance(3000);
    const [call] = await voiceCalls();
    return call!;
  }

  /** The customer hangs up and the agent saves the call's wrap-up. */
  async function wrapUp(callId: string, outcome: { dispositionCode: string; summary?: string }) {
    await act(async () => {
      h.customer.hangUp({ interactionId: callId as never });
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      const saved = h.provider.completeWrapUp(callId as never, outcome);
      await vi.advanceTimersByTimeAsync(300);
      await saved;
      await vi.advanceTimersByTimeAsync(300);
    });
  }

  it("Dial opens the existing dial pad prefilled with the customer's number, skill and all; it never dials by itself", async () => {
    await showHome();
    await h.goAvailable();
    await h.click(rowNamed("Callback · Priya Shah")!);
    await h.click(cell()!.querySelector("[data-schedule-call]")!);
    expect(phoneField()?.value).toBe("(646) 555-0143");
    expect([...document.querySelectorAll("[role=combobox]")].map((c) => c.textContent)).toContain("General Support");
    await h.advance(1000);
    expect(await voiceCalls()).toEqual([]);
  });

  it("a callback's call carries its customer and reason; the call's wrap-up completes the callback with the disposition and it leaves the rail", async () => {
    await showHome();
    await h.goAvailable();
    const call = await callFrom("Callback · Priya Shah");
    expect(call.contactName).toBe("Priya Shah");
    expect(call.preContactSummary).toEqual(["Refund RF-20451 hasn't posted"]);
    expect([...h.container.querySelectorAll("h1, h2")].map((el) => el.textContent?.trim())).toContain("Priya Shah");
    // The callback is still open while the call is.
    expect(h.container.querySelector('aside [data-kind-nav-card="agent-cb-priya"]')).not.toBeNull();

    await wrapUp(call.id, { dispositionCode: "Issue Resolved" });
    expect(h.container.querySelector('aside [data-kind-nav-card="agent-cb-priya"]')).toBeNull();
    const done = await act(async () => {
      const snapshot = h.schedule!.listItems({ role: "agent" });
      await vi.advanceTimersByTimeAsync(50);
      return (await snapshot).items.find((i) => i.id === "agent-cb-priya");
    });
    expect(done).toMatchObject({ state: "done", outcome: { disposition: "Issue Resolved" } });
    await h.click(homeButton());
    await h.click(view("History")!);
    expect(rowNamed("Callback · Priya Shah")?.getAttribute("data-feed-status")).toBe("completed");
  });

  it("a task's call leaves the task open; the call's summary joins the task's notes", async () => {
    await showHome();
    await h.goAvailable();
    const call = await callFrom("Ticket #4821 · subscription renewal refund");
    expect(call.contactName).toBe("Priya Shah");
    await wrapUp(call.id, { dispositionCode: "Issue Resolved", summary: "Billing will release the credit today" });
    expect(h.container.querySelector('aside [data-kind-nav-card="agent-tk-4821"]')).not.toBeNull();
    await h.click(h.container.querySelector('aside [data-kind-nav-card="agent-tk-4821"] [role=button], aside [data-kind-nav-card="agent-tk-4821"] button')!);
    expect(cell()?.querySelector("[data-task-notes]")?.textContent).toContain("Billing will release the credit today");
  });
});

describe("persona", () => {
  it("switching to Supervisor re-seeds the feed and swaps the Home cards; back to Agent restores them", async () => {
    await showHome();
    expect(rowNamed("Callback · Priya Shah")).toBeDefined();
    expect(h.container.querySelector('[data-home-section="dueSoon"]')).not.toBeNull();

    const store = getSettingsStore();
    await act(async () => {
      store.updateMany({ workspace: { persona: "supervisor" }, home: { sections: withPersonaSections(store.getState().values.home.sections, "supervisor") } });
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(rowNamed("Callback · Priya Shah")).toBeUndefined();
    expect(rowNamed("Coaching · John Smith")).toBeDefined();
    expect(feed()?.textContent).toContain("Escalation · Lauren Briggs · Voice");
    const sections = [...h.container.querySelectorAll("[data-home-section]")].map((el) => el.getAttribute("data-home-section"));
    expect(sections).toEqual(["activity", "teamQueues", "teamToday", "needsYou"]);
    expect(h.container.querySelector('[data-home-card="teamToday"]')?.textContent).toContain("78%");

    await act(async () => {
      store.updateMany({ workspace: { persona: "agent" }, home: { sections: withPersonaSections(store.getState().values.home.sections, "agent") } });
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(rowNamed("Callback · Priya Shah")).toBeDefined();
    expect(h.container.querySelector('[data-home-section="dueSoon"]')).not.toBeNull();
  });
});
