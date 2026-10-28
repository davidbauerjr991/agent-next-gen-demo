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

/** A feed row's click previews it (P-HOME-1h); the preview's Open opens it, nothing else (P-HOME-1i). */
async function openItem(row: HTMLElement) {
  await h.click(row);
  await h.click(document.querySelector<HTMLElement>("[data-home-detail=item] [data-preview-open]")!);
}

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
    await openItem(rowNamed(title)!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe(kind);
    expect(cell()?.textContent).toContain(body);
    // The outcome is on the card, not the cell.
    expect(cell()?.querySelector("[data-kind-outcome]")).toBeNull();
    const card = h.container.querySelector("aside [data-kind-nav-card]")!;
    expect(card).not.toBeNull();
    expect(feed()).toBeNull();

    await h.click(card.querySelector("[data-kind-outcome-trigger]")!);
    expect(outcomeForm()?.getAttribute("data-kind-outcome")).toBe(shape);
    const save = () => [...document.querySelectorAll<HTMLButtonElement>("[data-kind-outcome-footer] button")].find((b) => b.textContent?.trim() === "Save outcome")!;
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
    // Out of the time groups; in History as completed.
    expect(rowNamed(title)).toBeUndefined();
    await h.click(view("History")!);
    expect(rowNamed(title)?.getAttribute("data-feed-status")).toBe("completed");
  });

  it("the Outcome popover is anchored to its button as a conversation row's is: below it, aligned to its end", async () => {
    await showHome();
    await openItem(rowNamed("Returns team stand-up")!);
    await h.click(h.container.querySelector("aside [data-kind-nav-card] [data-kind-outcome-trigger]")!);
    const content = outcomeForm()!.closest<HTMLElement>("[data-side]")!;
    // jsdom's every-box-is-the-viewport geometry flips the side; the real placement is the Playwright spec's.
    expect(["bottom", "top"]).toContain(content.getAttribute("data-side"));
    expect(content.getAttribute("data-align")).toBe("end");
  });

  it("the Outcome popover has the conversation popover's slots and spacing: a header, the fields, and a padded footer", async () => {
    await showHome();
    await openItem(rowNamed("Returns team stand-up")!);
    await h.click(h.container.querySelector("aside [data-kind-nav-card] [data-kind-outcome-trigger]")!);
    expect(outcomeForm()!.parentElement!.className).toContain("pb-2 pt-1");
    expect(document.querySelector("[data-kind-outcome-footer]")!.className).toContain("px-5 pb-4 pt-1");
  });

  it("the cell's header is a conversation's two lines, with a back arrow Home; the session row has no default status and no kebab", async () => {
    await showHome();
    await openItem(rowNamed("Ticket #4821 · subscription renewal refund")!);
    const header = cell()!.querySelector<HTMLElement>('[data-slot="record-header"]')!;
    expect(header.querySelector("h1")?.textContent).toBe("Priya Shah");
    expect(header.textContent).toContain("#4821 · Credit RF-20452");
    // The kind, time and source are the session row; an open item's status (the default) isn't shown, nor a kebab.
    const row = header.querySelector<HTMLElement>('[data-slot="record-session-row"] [data-kind-session-row]')!;
    expect(row.textContent).toContain("Task");
    expect(row.textContent).toContain("Ticket queue");
    expect(row.querySelector("[data-kind-status]")).toBeNull();
    expect(row.textContent).not.toContain("Active");
    expect(row.querySelector("[data-kind-outcome-trigger]")).not.toBeNull();
    expect(row.querySelector('[aria-label="More options"]')).toBeNull();
    // The back arrow returns Home.
    await h.click(header.querySelector("[data-kind-back]")!);
    expect(cell()).toBeNull();
    expect(feed()).not.toBeNull();
  });

  it("the cell's reference column is the canvas registry's kind cells, with canvas.cells overrides; the action area ends with the Copilot input, scoped to the item", async () => {
    await showHome();
    await openItem(rowNamed("Callback · Priya Shah")!);
    const reference = () => cell()!.querySelector<HTMLElement>('[data-canvas-region="reference"]')!;
    expect([...reference().querySelectorAll("[data-canvas-cell]")].map((el) => el.getAttribute("data-canvas-cell"))).toEqual([
      "kind-summary",
      "kind-related",
      "kind-journey",
      "kind-customer",
    ]);
    // Every card starts collapsed; the Real-Time Summary is the item's own detail.
    const summaryHeader = () => reference().querySelector<HTMLElement>('[data-canvas-cell="kind-summary"] [aria-expanded]')!;
    expect(summaryHeader().getAttribute("aria-expanded")).toBe("false");
    await h.click(summaryHeader());
    expect(reference().querySelector('[data-canvas-cell="kind-summary"]')?.textContent).toContain("Refund RF-20451 hasn't posted");
    await act(async () => {
      getSettingsStore().update("canvas", { cells: { "kind-related": { enabled: false } } });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(reference().querySelector('[data-canvas-cell="kind-related"]')).toBeNull();

    // The Copilot input (lyra AIInput, single-line pill) under the action area, with the seed's chips and the kind's
    // placeholder; a chip is logged inline as the transcript's instruction row, and its scripted answer opens in the
    // reference slot's slide-over once Copilot "finishes".
    const copilot = cell()!.querySelector<HTMLElement>("[data-kind-action-area] [data-kind-copilot] [data-slot=copilot-composer]")!;
    expect(copilot).not.toBeNull();
    expect(copilot.querySelector("textarea, input")?.getAttribute("placeholder")).toBe("Ask Copilot about this callback…");
    const chip = [...copilot.querySelectorAll<HTMLElement>("button, [role=button]")].find((b) => b.textContent?.includes("Where is refund RF-20451?"))!;
    await h.click(chip);
    await h.advance(100);
    const asks = () => cell()!.querySelector<HTMLElement>("[data-kind-action-column] [data-kind-copilot-rows]")!;
    expect(asks().textContent).toContain("AI agent is performing this now…");
    expect(document.querySelector("[data-slot=copilot-result]")).toBeNull();
    await h.advance(1800);
    const answer = () => document.querySelector<HTMLElement>("[data-slot=copilot-result]");
    expect(answer()!.textContent).toContain("RF-20451 was approved on the 22nd");
    expect(answer()!.closest('[data-slot="reference-slide-over"]')).not.toBeNull();
    // The row (the question, the time, who asked; selected while its result is open) and the result card under it.
    const row = () => asks().querySelector<HTMLButtonElement>("button[aria-current], button")!;
    expect(row().textContent).toContain("Where is refund RF-20451?");
    expect(row().textContent).toContain("John Smith");
    expect(row().getAttribute("aria-current")).toBe("true");
    expect(asks().querySelector("[data-kind-copilot-result]")?.textContent).toContain("RF-20451 was approved on the 22nd");
    // The row closes the result and reopens it.
    await h.click(row());
    await h.advance(400);
    expect(answer()).toBeNull();
    await h.click(row());
    await h.advance(100);
    expect(answer()).not.toBeNull();
    // The Real-Time Summary lists the ask as a linked line that toggles the same result.
    const line = () => reference().querySelector<HTMLElement>('[data-canvas-cell="kind-summary"] [data-slot=summary-asks] a, [data-canvas-cell="kind-summary"] [data-slot=summary-asks] button');
    expect(line()?.textContent).toMatch(/\d{1,2}:\d{2}\s?[AP]M · Where is refund RF-20451\?/);
    await h.click(line()!);
    await h.advance(400);
    expect(answer()).toBeNull();
    await h.click(line()!);
    await h.advance(100);
    expect(answer()).not.toBeNull();
  });

  it("reference cards start collapsed and stay as the agent left them per assignment: Home and back, still open; another item, collapsed", async () => {
    await showHome();
    const expandedCells = () =>
      [...(cell()?.querySelectorAll<HTMLElement>('[data-canvas-region="reference"] [data-canvas-cell]') ?? [])]
        .filter((el) => el.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") === "true")
        .map((el) => el.getAttribute("data-canvas-cell"));
    await openItem(rowNamed("Callback · Priya Shah")!);
    expect(expandedCells()).toEqual([]);
    await h.click(cell()!.querySelector<HTMLElement>('[data-canvas-cell="kind-related"] [aria-expanded]')!);
    expect(expandedCells()).toEqual(["kind-related"]);
    await h.click(homeButton());
    await openItem(rowNamed("Returns team stand-up")!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("meeting");
    expect(expandedCells()).toEqual([]);
    await h.click(h.container.querySelector<HTMLElement>('aside [data-kind-nav-card="agent-cb-priya"] [aria-label^="Callback channel"]')!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("callback");
    expect(expandedCells()).toEqual(["kind-related"]);
  });

  it("a kind card's kind is a row like a channel's: the kind chip, the due time and the detail; collapsed, the kind icon sits top-left", async () => {
    await showHome();
    await openItem(rowNamed("Returns team stand-up")!);
    const card = () => h.container.querySelector<HTMLElement>("aside [data-kind-nav-card]")!;
    // lyra's kind row: a selectable row (its stretched button) labeled by the kind, the Outcome in its cluster.
    expect(card().querySelector('[aria-label^="Meeting channel"]')).not.toBeNull();
    expect(card().textContent).toContain("Teams · 15 min · 6 attendees");
    expect(card().querySelector("[data-kind-outcome-trigger]")).not.toBeNull();
    await h.click(h.container.querySelector('aside [aria-label="Collapse sidebar"]')!);
    expect(card().querySelector("[data-kind-icon] svg")).not.toBeNull();
  });

  it("a card not yet opened has the darker new outline until its first click", async () => {
    await showHome();
    await h.goAvailable();
    await h.startInbound("voice", "+15555550188", "Lena Ortiz");
    await h.advance(500);
    const lena = () => [...h.container.querySelectorAll<HTMLElement>("aside [class*='border-lyra-border-strong']")].some((el) => el.textContent?.includes("Lena Ortiz"));
    expect(lena()).toBe(true);
    await h.click(h.navCard("Lena Ortiz"));
    await h.click(homeButton());
    expect(lena()).toBe(false);
  });

  it("the session row's Outcome is the conversation header's (icon and label); the card row's stays icon-only; the action area is the conversation's 768px column; the Copilot placeholder names the kind", async () => {
    await showHome();
    await openItem(rowNamed("RET-1.3 refund policy update")!);
    const sessionTrigger = cell()!.querySelector<HTMLElement>("[data-kind-session-row] [data-kind-outcome-trigger]")!;
    expect(sessionTrigger.getAttribute("data-kind-outcome-trigger")).toBe("labeled");
    expect(sessionTrigger.textContent?.trim()).toBe("Outcome");
    const cardTrigger = h.container.querySelector<HTMLElement>("aside [data-kind-nav-card] [data-kind-outcome-trigger]")!;
    expect(cardTrigger.textContent?.trim()).toBe("");
    expect(cardTrigger.getAttribute("aria-label")).toBe("Outcome");
    const column = cell()!.querySelector<HTMLElement>("[data-kind-action-column]")!;
    expect(column.className).toContain("max-w-[768px]");
    expect(column.className).toContain("mx-auto");
    expect(cell()!.querySelector("[data-kind-copilot]")!.className).toContain("max-w-[768px]");
    const placeholder = () => cell()!.querySelector("[data-kind-copilot] textarea, [data-kind-copilot] input")?.getAttribute("placeholder");
    expect(placeholder()).toBe("Ask Copilot about this module…");
    await h.click(homeButton());
    await openItem(rowNamed("Returns team stand-up")!);
    expect(placeholder()).toBe("Ask Copilot about this meeting…");
    await h.click(homeButton());
    await openItem(rowNamed("Ticket #4821")!);
    expect(placeholder()).toBe("Ask Copilot about this ticket…");
  });

  it("a kind card closes with its X (Return to feed): on the card's row and the cell's session row; the item is Scheduled again, off the rail, with no outcome", async () => {
    await showHome();
    await openItem(rowNamed("Returns team stand-up")!);
    const card = () => h.container.querySelector<HTMLElement>('aside [data-kind-nav-card="agent-mt-standup"]');
    expect(card()!.querySelector("[data-kind-close]")).not.toBeNull();
    // No kebab: a kind has no row actions.
    expect(card()!.querySelector('[aria-label="More options"]')).toBeNull();
    const closeInCell = cell()!.querySelector<HTMLElement>("[data-kind-session-row] [data-kind-close]")!;
    expect(closeInCell.getAttribute("aria-label") ?? closeInCell.getAttribute("title")).toBe("Return to feed");
    await h.click(closeInCell);
    await h.advance(100);
    expect(cell()).toBeNull();
    expect(card()).toBeNull();
    expect(rowNamed("Returns team stand-up")?.getAttribute("data-feed-status")).toBe("scheduled");
    // From the card's row too.
    await openItem(rowNamed("Returns team stand-up")!);
    await h.click(card()!.querySelector("[data-kind-close]")!);
    await h.advance(100);
    expect(card()).toBeNull();
    const item = await act(async () => {
      const snapshot = h.schedule!.listItems({ role: "agent" });
      await vi.advanceTimersByTimeAsync(50);
      return (await snapshot).items.find((i) => i.id === "agent-mt-standup");
    });
    expect(item?.state).toBe("scheduled");
    expect(item?.outcome).toBeUndefined();
  });

  it("the kind card's X follows Settings → Assignments: hidden without Unassign & Dismiss; the Close confirm when it's on", async () => {
    await act(async () => {
      getSettingsStore().update("assignments", { allowUnassignDismiss: false });
      await vi.advanceTimersByTimeAsync(50);
    });
    await showHome();
    await openItem(rowNamed("Returns team stand-up")!);
    expect(h.container.querySelector("[data-kind-close]")).toBeNull();
    await act(async () => {
      getSettingsStore().update("assignments", { allowUnassignDismiss: true, confirmClose: true });
      await vi.advanceTimersByTimeAsync(50);
    });
    await h.click(cell()!.querySelector<HTMLElement>("[data-kind-session-row] [data-kind-close]")!);
    // The confirm holds it: still open until it's confirmed.
    expect(cell()).not.toBeNull();
    // The kind's own copy, not a contact's.
    expect(document.body.textContent).toContain("Return this meeting to the feed?");
    expect(document.body.textContent).not.toContain("Close this contact?");
    await h.click(h.buttonByText("Return to feed")!);
    await h.advance(100);
    expect(cell()).toBeNull();
  });

  it("the rail's count includes kind cards: Assignments (n) and My Assignment Queue", async () => {
    await showHome();
    const caption = () => [...h.container.querySelectorAll<HTMLElement>("aside *")].find((el) => el.children.length === 0 && /^\(\d+\)$/.test(el.textContent?.trim() ?? ""))?.textContent?.trim();
    const queueChip = () => h.buttonByText("My Assignment Queue", h.container)?.textContent ?? h.container.textContent ?? "";
    expect(caption()).toBe("(0)");
    expect(queueChip()).toContain("My Assignment Queue: Empty");
    await openItem(rowNamed("Returns team stand-up")!);
    expect(caption()).toBe("(1)");
    await h.click(homeButton());
    await openItem(rowNamed("RET-1.3 refund policy update")!);
    expect(caption()).toBe("(2)");
    await h.click(homeButton());
    expect(h.container.textContent).toContain("My Assignment Queue: 2");
  });

  it.each([
    ["Ticket #4821 · subscription renewal refund", "task"],
    ["Callback · Priya Shah", "callback"],
  ])("%s (%s) with a customer: the header's avatar, \"+\" and Contact Details (the record in the slide-over); Customer Info on file and the Journey Summary in the reference column", async (title) => {
    await showHome();
    await openItem(rowNamed(title)!);
    const header = cell()!.querySelector<HTMLElement>('[data-slot="record-header"]')!;
    expect(header.querySelector("h1")?.textContent).toBe("Priya Shah");
    expect(header.querySelector("[data-kind-avatar]")?.textContent).toBe("PS");
    expect(header.querySelector('[data-slot="header-add-channel"] button')).not.toBeNull();
    await h.click(header.querySelector<HTMLElement>("[data-kind-contact-details]")!);
    await h.advance(100);
    const record = () => document.querySelector<HTMLElement>("[data-slot=customer-record]");
    expect(record()?.getAttribute("data-entity-id")).toBe("priya-shah-history");
    expect(record()?.closest('[data-slot="reference-slide-over"]')).not.toBeNull();
    // Toggles closed.
    await h.click(header.querySelector<HTMLElement>("[data-kind-contact-details]")!);
    await h.advance(400);
    expect(header.querySelector("[data-kind-contact-details]")?.getAttribute("aria-pressed")).toBe("false");
    expect(record()).toBeNull();
    const reference = cell()!.querySelector<HTMLElement>('[data-canvas-region="reference"]')!;
    expect(reference.querySelector('[data-canvas-cell="kind-customer"]')?.textContent).toContain("On file");
    expect(reference.querySelector('[data-canvas-cell="kind-journey"] [data-slot="journey-summary"]')).not.toBeNull();
  });

  it("an unmatched customer (Sofia Ramirez): no \"+\" or Contact Details; Link to existing customer opens the directory picker in the slide-over, and linking makes the record the item's customer", async () => {
    await showHome();
    await openItem(rowNamed("Callback · Sofia Ramirez")!);
    const header = () => cell()!.querySelector<HTMLElement>('[data-slot="record-header"]')!;
    expect(header().querySelector("[data-kind-contact-details]")).toBeNull();
    expect(header().querySelector('[data-slot="header-add-channel"]')).toBeNull();
    const info = () => cell()!.querySelector<HTMLElement>('[data-canvas-cell="kind-customer"]')!;
    expect(info().textContent).toContain("Not linked");
    await h.click([...info().querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Link to existing customer")!);
    await h.advance(100);
    const picker = document.querySelector<HTMLElement>("[data-slot=link-customer]")!;
    expect(picker.closest('[data-slot="reference-slide-over"]')).not.toBeNull();
    await type(picker.querySelector("input")!, "Nathan");
    const nathan = [...picker.querySelectorAll<HTMLElement>("p")].find((p) => p.textContent === "Nathan Cole")!;
    await h.click([...nathan.closest("div.group")!.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Link To Record")!);
    await h.advance(100);
    expect(header().querySelector("h1")?.textContent).toBe("Nathan Cole");
    expect(header().querySelector("[data-kind-contact-details]")).not.toBeNull();
    expect(info().textContent).toContain("On file");
  });

  it("the rail card reopens the cell after going Home", async () => {
    await showHome();
    await openItem(rowNamed("Returns team stand-up")!);
    await h.click(homeButton());
    expect(cell()).toBeNull();
    await h.click(h.container.querySelector("aside [data-kind-nav-card] [role=button], aside [data-kind-nav-card] button")!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("meeting");
  });
});

describe("calls from schedule items (the leg-join P0.9 generalizes)", () => {
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
    await openItem(rowNamed(title)!);
    await h.click(cell()!.querySelector("[data-schedule-call]")!);
    await h.click([...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Dial Number")!);
    // The pad shows "Connecting…" for 2s before it dials (lyra's CONNECTING_DURATION_MS); then the call rings and connects.
    await h.advance(3000);
    const [call] = await voiceCalls();
    return call!;
  }

  /** The customer hangs up: the call is in wrap-up. */
  async function hangUp(callId: string) {
    await act(async () => {
      h.customer.hangUp({ interactionId: callId as never });
      await vi.advanceTimersByTimeAsync(300);
    });
  }
  /** The customer hangs up and the agent saves the call's wrap-up. */
  async function wrapUp(callId: string, outcome: { dispositionCode: string; summary?: string }) {
    await hangUp(callId);
    await saveWrapUp(callId, outcome);
  }
  async function saveWrapUp(callId: string, outcome: { dispositionCode: string; summary?: string }) {
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
    await openItem(rowNamed("Callback · Priya Shah")!);
    await h.click(cell()!.querySelector("[data-schedule-call]")!);
    expect(phoneField()?.value).toBe("(646) 555-0143");
    expect([...document.querySelectorAll("[role=combobox]")].map((c) => c.textContent)).toContain("General Support");
    await h.advance(1000);
    expect(await voiceCalls()).toEqual([]);
  });

  const preview = () => document.querySelector<HTMLElement>("[data-home-detail=item]");

  it("a callback's preview: Dial is the primary, Open beside it; Open puts the card in the rail without dialling", async () => {
    await showHome();
    await h.goAvailable();
    await h.click(rowNamed("Callback · Priya Shah")!);
    await h.advance(100);
    expect(preview()!.querySelector("[data-preview-primary]")?.textContent).toBe("Dial");
    expect(preview()!.querySelector("[data-preview-open]")?.textContent).toBe("Open");
    await h.click(preview()!.querySelector<HTMLElement>("[data-preview-open]")!);
    await h.advance(1000);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("callback");
    expect(h.container.querySelector('aside [data-kind-nav-card="agent-cb-priya"]')).not.toBeNull();
    expect(phoneField()).toBeUndefined();
    expect(await voiceCalls()).toEqual([]);
  });

  it("the preview's Dial opens the dial pad on itself; confirming opens the callback with its call joined as the active Voice row, with no second dial", async () => {
    await showHome();
    await h.goAvailable();
    await h.click(rowNamed("Callback · Priya Shah")!);
    await h.advance(100);
    await h.click(preview()!.querySelector<HTMLElement>("[data-preview-primary]")!);
    // Prefilled with the callback's number; nothing opened or dialled yet.
    expect(phoneField()?.value).toBe("(646) 555-0143");
    expect(h.container.querySelector("aside [data-kind-nav-card]")).toBeNull();
    await h.click([...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Dial Number")!);
    await h.advance(3000);
    const calls = await voiceCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.journeyId).toBe("schedule:agent-cb-priya");
    const card = h.container.querySelector<HTMLElement>('aside [data-kind-nav-card="agent-cb-priya"]')!;
    expect(card.getAttribute("data-kind-leg")).toBe("schedule:agent-cb-priya");
    expect(h.container.querySelectorAll("aside [data-kind-nav-card]")).toHaveLength(1);
    const voiceRow = card.querySelector<HTMLElement>('[aria-label^="Voice channel"]')!;
    expect(voiceRow.getAttribute("aria-current")).toBe("true");
    // The call shows; no dial pad asks again.
    expect(cell()).toBeNull();
    expect(phoneField()).toBeUndefined();
  });

  it("a training's preview Start opens it started; opened with Open, the cell's own Start starts it", async () => {
    await showHome();
    await h.click(rowNamed("RET-1.3 refund policy update")!);
    await h.advance(100);
    expect(preview()!.querySelector("[data-preview-primary]")?.textContent).toBe("Start");
    await h.click(preview()!.querySelector<HTMLElement>("[data-preview-primary]")!);
    await h.advance(100);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("training");
    expect(cell()!.querySelector("[data-kind-started]")?.textContent).toBe("Module started");
    await h.click(homeButton());
    await openItem(rowNamed("WhatsApp templates · intro")!);
    expect(cell()!.querySelector("[data-kind-started]")).toBeNull();
    await h.click(cell()!.querySelector<HTMLElement>("[data-kind-start]")!);
    expect(cell()!.querySelector("[data-kind-started]")?.textContent).toBe("Module started");
  });

  it("the kind card's X is disabled, with the reason, while its call is live", async () => {
    await showHome();
    await h.goAvailable();
    const call = await callFrom("Callback · Priya Shah");
    const close = () => h.container.querySelector<HTMLButtonElement>('aside [data-kind-nav-card="agent-cb-priya"] [data-kind-close]')!;
    expect(close().disabled).toBe(true);
    expect(close().closest("[data-disabled-reason]")?.getAttribute("data-disabled-reason") ?? h.container.textContent).toContain("End the call first");
    await hangUp(call.id);
    expect(close().disabled).toBe(false);
  });

  /** The rail's cards (each card's button is labeled with its name). */
  const railCardsNamed = (name: string) => [...h.container.querySelectorAll("aside [aria-label]")].filter((el) => el.getAttribute("aria-label")?.startsWith(name));

  it("a callback's call joins the callback's card as its voice leg; the call's wrap-up completes the callback with the disposition and it leaves the rail", async () => {
    await showHome();
    await h.goAvailable();
    const call = await callFrom("Callback · Priya Shah");
    expect(call.contactName).toBe("Priya Shah");
    expect(call.preContactSummary).toEqual(["Refund RF-20451 hasn't posted"]);
    // The leg's journey is the callback's assignment: one card, the callback's, its rows in the order they were
    // opened — the Callback row, then the Voice row.
    expect(call.journeyId).toBe("schedule:agent-cb-priya");
    const card = () => h.container.querySelector<HTMLElement>('aside [data-kind-nav-card="agent-cb-priya"]')!;
    expect(card().getAttribute("data-kind-leg")).toBe("schedule:agent-cb-priya");
    expect(railCardsNamed("Priya Shah")).toHaveLength(1);
    // One card, counted once.
    expect(h.container.querySelector("aside")?.textContent).toContain("(1)");
    const rows = () => [...card().querySelectorAll<HTMLElement>('[aria-label$=" channel"], [aria-label*=" channel,"]')];
    expect(rows().map((r) => r.getAttribute("aria-label")?.split(" channel")[0])).toEqual(["Callback", "Voice"]);
    expect(card().querySelector('[aria-label="End Call"], [title="End Call"]')).not.toBeNull();
    // The call is the selected row: the main column shows it.
    expect(rows()[1]!.getAttribute("aria-current")).toBe("true");
    expect(cell()).toBeNull();
    expect([...h.container.querySelectorAll("h1, h2")].map((el) => el.textContent?.trim())).toContain("Priya Shah");
    // The Callback row shows the callback's cell; the Voice row the call again.
    await h.click(rows()[0]!);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("callback");
    expect(rows()[0]!.getAttribute("aria-current")).toBe("true");
    await h.click(rows()[1]!);
    expect(cell()).toBeNull();
    expect(rows()[1]!.getAttribute("aria-current")).toBe("true");

    // One Outcome per card: the kind row carries it; the Voice row's ✓ is the call's wrap-up, and what the wrap-up
    // records fills the card's Outcome.
    expect(card().querySelectorAll("[data-kind-outcome-trigger]")).toHaveLength(1);
    await hangUp(call.id);
    const wrapUpCard = () => h.container.querySelector<HTMLElement>('[role="region"][aria-label="Wrap up"]');
    await type(wrapUpCard()!.querySelector("textarea")!, "Refund posted while on the call");
    await h.click(card().querySelector("[data-kind-outcome-trigger]")!);
    expect(outcomeForm()?.querySelector("textarea")?.value).toBe("Refund posted while on the call");
    await h.click([...document.querySelectorAll<HTMLButtonElement>("[data-kind-outcome-footer] button")].find((b) => b.textContent?.trim() === "Cancel")!);

    await saveWrapUp(call.id, { dispositionCode: "Issue Resolved" });
    expect(h.container.querySelector('aside [data-kind-nav-card="agent-cb-priya"]')).toBeNull();
    // Its leg went with it: no second card is left behind.
    expect(railCardsNamed("Priya Shah")).toHaveLength(0);
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

  it("the kind cell mounts with the interaction body's enter fade", async () => {
    await showHome();
    await h.goAvailable();
    await callFrom("Callback · Priya Shah");
    const enter = (el: Element | null | undefined) => (el?.className.split(/\s+/) ?? []).filter((c) => /^(animate-in|fade-in-0|duration-)/.test(c));
    // The call's main column: the keyed wrapper around its record header.
    const interactionEnter = enter(h.container.querySelector('[data-slot="record-header"]')?.closest(".animate-in"));
    expect(interactionEnter).toEqual(["animate-in", "fade-in-0", "duration-200"]);
    await h.click(h.container.querySelector<HTMLElement>('aside [data-kind-nav-card="agent-cb-priya"] [aria-label^="Callback channel"]')!);
    expect(enter(cell())).toEqual(interactionEnter);
  });

  it("a task's call joins the task's card as its voice leg and leaves the task open; the call's summary joins the task's notes", async () => {
    await showHome();
    await h.goAvailable();
    const call = await callFrom("Ticket #4821 · subscription renewal refund");
    expect(call.contactName).toBe("Priya Shah");
    expect(call.journeyId).toBe("schedule:agent-tk-4821");
    const card = h.container.querySelector<HTMLElement>('aside [data-kind-nav-card="agent-tk-4821"]')!;
    expect(card.getAttribute("data-kind-leg")).toBe("schedule:agent-tk-4821");
    expect(card.querySelector('[aria-label="End Call"], [title="End Call"]')).not.toBeNull();
    expect(railCardsNamed("Priya Shah")).toHaveLength(1);
    await wrapUp(call.id, { dispositionCode: "Issue Resolved", summary: "Billing will release the credit today" });
    expect(h.container.querySelector('aside [data-kind-nav-card="agent-tk-4821"]')).not.toBeNull();
    // The task's outcome stays its ticket status: the card's Outcome is still the ticket form, unchanged by the call.
    await h.click(h.container.querySelector('aside [data-kind-nav-card="agent-tk-4821"] [data-kind-outcome-trigger]')!);
    expect(outcomeForm()?.getAttribute("data-kind-outcome")).toBe("ticket");
    expect(outcomeForm()?.querySelector("textarea")?.value).toBe("");
    await h.click([...document.querySelectorAll<HTMLButtonElement>("[data-kind-outcome-footer] button")].find((b) => b.textContent?.trim() === "Cancel")!);
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

  it("the supervisor's escalation (Lauren Briggs): the avatar and Contact Details, no \"+\" (a review, not a working item); the conversation's Copilot chips", async () => {
    await showHome();
    const store = getSettingsStore();
    await act(async () => {
      store.updateMany({ workspace: { persona: "supervisor" }, home: { sections: withPersonaSections(store.getState().values.home.sections, "supervisor") } });
      await vi.advanceTimersByTimeAsync(100);
    });
    await h.click(rowNamed("Escalation · Lauren Briggs")!);
    await h.click([...document.querySelectorAll<HTMLButtonElement>("[data-home-detail=item] button")].find((b) => b.textContent?.trim() === "Accept")!);
    await h.advance(300);
    expect(cell()?.getAttribute("data-kind-cell")).toBe("conversation");
    const header = cell()!.querySelector<HTMLElement>('[data-slot="record-header"]')!;
    expect(header.querySelector("h1")?.textContent).toBe("Lauren Briggs");
    expect(header.querySelector("[data-kind-avatar]")?.textContent).toBe("LB");
    expect(header.querySelector("[data-kind-contact-details]")).not.toBeNull();
    expect(header.querySelector('[data-slot="header-add-channel"]')).toBeNull();
    // The composer shows what fits (the refresh rotates the rest): the visible chips are the escalation's own.
    const escalationChips = ["Summarize the conversation so far", "Why was this escalated?", "What should I tell the agent?"];
    const chips = [...cell()!.querySelectorAll("[data-slot=copilot-chips] [role=button]")].map((c) => c.textContent?.trim());
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) expect(escalationChips).toContain(chip);
  });
});
