// @vitest-environment jsdom
// P-POLISH 4: one bot-holds gate for every layout, the panel slide-over's X, Lucas's row toggle, no chips while
// the bot holds, one channel label, seeded records for the AI-led cases, and the leg timer.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceHarness } from "@/test-utils/workspace-harness";
import { AgentWorkspaceAdvancedPage } from "@/components/AgentWorkspaceAdvancedPage";
import { buildCustomerInfoFields, buildLatestInteraction } from "@/components/customer-info/customer-info-seed";
import { LUCAS_THOMAS_ORDER_DETAILS } from "@/components/agent-next-gen-lucas-thomas-panels";
import { CASE_CUSTOMER_RECORDS, LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, MAYA_CHEN_SCRIPT, formatCaseAddress } from "@/scenarios";
import { getSettingsStore, resetSettingsStoreForTests } from "@/settings/settings-store";
import type { AiDisplayLocation } from "@/settings/settings-schema";
import type { InteractionId } from "@/domain";

const h = createWorkspaceHarness();

beforeEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
  h.setUp();
});
afterEach(async () => {
  await h.tearDown();
});

const buttonText = (root: ParentNode, text: string) => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === text);
const radio = (title: string) => [...document.body.querySelectorAll<HTMLElement>('[role="radio"]')].find((r) => r.textContent?.trim() === title)!;
const panel = () => h.container.querySelector<HTMLElement>("[data-slot=right-panel]")!;
const APPROVE_ROW = "Authorize and place order NR-11056";
const row = (title: string) =>
  [...document.body.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith(title) && b.textContent.includes("John Smith"));
const openSlideOver = (title: string) =>
  [...document.body.querySelectorAll<HTMLElement>('[style*="visibility"]')].find(
    (el) => el.style.visibility === "visible" && el.firstElementChild?.textContent?.includes(title),
  ) ?? null;

async function setAi(displayLocation: AiDisplayLocation) {
  await act(async () => {
    getSettingsStore().update("ai", { displayLocation });
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function lucas(displayLocation: AiDisplayLocation) {
  await h.show(AgentWorkspaceAdvancedPage);
  await setAi(displayLocation);
  await h.play(LUCAS_THOMAS_SCRIPT.id);
  await h.click(h.navCard("Lucas Thomas"));
  await h.advance(14_000);
}

async function marcus(displayLocation: AiDisplayLocation) {
  await h.show(AgentWorkspaceAdvancedPage);
  await setAi(displayLocation);
  await h.play(MARCUS_WEBB_SCRIPT.id);
  await h.click(h.navCard("Marcus Webb"));
  await h.advance(5_000);
}

const chip = (label: string) => [...document.body.querySelectorAll<HTMLElement>("[data-slot=copilot-chips] [role=button]")].find((c) => c.textContent?.includes(label));
const outcomeButtons = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].filter((b) => b.getAttribute("aria-label") === "Outcome" || b.title === "Outcome");

describe("1. one bot-holds gate, every layout", () => {
  for (const display of ["inline", "panel", "main"] as const) {
    it(`Lucas, AI display ${display}: every Outcome is disabled before takeover and enabled after`, async () => {
      await lucas(display);
      const outcomes = () => [...outcomeButtons(h.container)];
      expect(outcomes().length).toBeGreaterThan(0);
      expect(outcomes().every((b) => b.disabled)).toBe(true);
      await h.click(buttonText(document.body, "Takeover Chat") ?? buttonText(document.body, "Takeover")!);
      await h.advance(3_000);
      expect(outcomes().some((b) => !b.disabled)).toBe(true);
    });
  }
});

describe("2. the panel slide-over's X closes only the slide-over", () => {
  it("Lucas, panel: Purchase history opens over the panel; X closes it and the panel stays with its AI feed", async () => {
    await lucas("panel");
    await h.click(buttonText(panel(), "Takeover Chat")!);
    await h.advance(3_000);
    await h.click(chip("Show purchase history")!);
    await h.advance(4_000);
    expect(openSlideOver("Purchase history")).not.toBeNull();
    const x = openSlideOver("Purchase history")!.querySelector<HTMLElement>('[aria-label="Close Purchase history"]')!;
    await h.click(x);
    await h.advance(500);
    expect(openSlideOver("Purchase history")).toBeNull();
    expect(panel().getAttribute("data-open")).toBe("true");
    expect(panel().getAttribute("data-thread")).toBe("details");
    expect(panel().querySelector("[data-slot=ai-feed]")).not.toBeNull();
  });
});

describe("3. Lucas's action row toggles its slide-over", () => {
  for (const display of ["inline", "main"] as const) {
    it(`AI display ${display}: a second click closes it`, async () => {
      await lucas(display);
      await h.click(radio("Approve the Exception"));
      await h.click(buttonText(document.body, "Authorize and Place Order")!);
      await h.advance(3_000);
      await h.click(row(APPROVE_ROW)!);
      await h.advance(500);
      expect(openSlideOver(APPROVE_ROW)).not.toBeNull();
      await h.click(row(APPROVE_ROW)!);
      await h.advance(500);
      expect(openSlideOver(APPROVE_ROW)).toBeNull();
    });
  }
});

describe("5. no Copilot chips while the bot holds", () => {
  it("Marcus: no chip row in review; the chips (and Next Best Action) arrive on takeover", async () => {
    await marcus("inline");
    expect(chip("What should I do next?")).toBeUndefined();
    expect(document.body.querySelector("[data-slot=copilot-chips]")).toBeNull();
    await h.click(buttonText(document.body, "Takeover Call")!);
    await h.advance(3_000);
    expect(chip("What should I do next?")).toBeDefined();
  });
});

describe("6. one channel label", () => {
  for (const display of ["inline", "panel", "main"] as const) {
    it(`Lucas, AI display ${display}: his chat reads "Chat" and never "SMS"`, async () => {
      await lucas(display);
      expect(h.container.textContent).toMatch(/Chat\s*\|/);
      expect(h.container.textContent).not.toMatch(/SMS\s*\|/);
    });
  }
});

describe("8. seeded customer records for the AI-led cases", () => {
  for (const script of [MARCUS_WEBB_SCRIPT, LUCAS_THOMAS_SCRIPT]) {
    it(`${script.entity.name}: Contact Details, the Latest Interaction card and the panels read one record`, () => {
      const record = CASE_CUSTOMER_RECORDS[script.entity.caseId];
      expect(record).toBeDefined();
      const fields = Object.fromEntries(buildCustomerInfoFields(script.entity.name, script.entity.caseId, []).map((f) => [f.label, f.value]));
      expect(fields).toMatchObject({ Address: record.address1, City: record.city, State: record.state, "Zip Code": record.postalCode, Balance: record.balance });
      expect(buildLatestInteraction(script.entity.name, script.entity.caseId)).toEqual(record.latestInteraction);
    });
  }

  it("the panels' addresses are the record's: Marcus's order and Lucas's orders", () => {
    expect(formatCaseAddress(CASE_CUSTOMER_RECORDS[LUCAS_THOMAS_SCRIPT.entity.caseId])).toBe("1420 Harbor St, Apt 5B, Portland, OR 97209");
    for (const order of Object.values(LUCAS_THOMAS_ORDER_DETAILS)) {
      expect(order.address).toBe(formatCaseAddress(CASE_CUSTOMER_RECORDS[LUCAS_THOMAS_SCRIPT.entity.caseId]));
    }
  });

  it("Marcus's Contact Details show the seeded record, not a generated profile", async () => {
    await marcus("inline");
    await act(async () => {
      [...h.container.querySelectorAll<HTMLElement>("button[aria-label]")]
        .find((b) => /Contact Details$/.test(b.getAttribute("aria-label")!) && !b.closest("[data-slot=right-panel]"))
        ?.click();
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(panel().textContent).toContain("Springfield");
    expect(panel().textContent).not.toContain("Portland");
  });
});

describe("9. the nav row's timer follows the leg", () => {
  const timer = (name: string) => h.navCard(name).closest("[data-slot=assignment-card]")!.textContent!.match(/\d{2}:\d{2}/)?.[0];

  it("keeps counting after the case is Resolved and stops at hang-up", async () => {
    await h.show(AgentWorkspaceAdvancedPage);
    await h.play(MAYA_CHEN_SCRIPT.id);
    await h.advance(3_000);
    const call = await (async () => {
      let found;
      await act(async () => {
        const s = h.provider.getSnapshot();
        await vi.advanceTimersByTimeAsync(50);
        found = (await s).interactions.find((i) => i.channel === "voice" && i.contactName === "Maya Chen");
      });
      return found as unknown as { id: InteractionId };
    })();
    const before = timer("Maya Chen");
    expect(before).toBeDefined();
    await act(async () => {
      const set = h.provider.setCaseStatus(call.id, "Resolved");
      await vi.advanceTimersByTimeAsync(300);
      await set;
    });
    await h.advance(5_000);
    const resolved = timer("Maya Chen");
    expect(resolved).toBeDefined();
    expect(resolved).not.toBe(before);

    await act(async () => {
      const ended = h.provider.end(call.id);
      await vi.advanceTimersByTimeAsync(300);
      await ended;
    });
    await h.advance(1_000);
    const stopped = timer("Maya Chen");
    await h.advance(5_000);
    expect(timer("Maya Chen")).toBe(stopped);
  });
});

describe("4. real skills; the status chip carries the review state", () => {
  const leaf = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLElement>("*")].filter((el) => el.children.length === 0 && el.textContent?.trim() === text);
  const cardText = (name: string) => h.navCard(name).closest("[data-slot=assignment-card]")!.textContent!;

  // A call's session row has no status chip (voice has no case-status field in the UI), so Marcus's review state is
  // read where the provider keeps it.
  const marcusCaseStatus = async () => {
    let status: string | undefined;
    await act(async () => {
      const s = h.provider.getSnapshot();
      await vi.advanceTimersByTimeAsync(50);
      status = (await s).interactions.find((i) => i.caseId === MARCUS_WEBB_SCRIPT.entity.caseId)?.caseStatus;
    });
    return status;
  };

  it("Marcus: the row's preview is Returns before and after takeover; the case reads Pending, then Open", async () => {
    await marcus("inline");
    expect(cardText("Marcus Webb")).toContain("Returns");
    expect(cardText("Marcus Webb")).not.toContain("AI Review");
    expect(await marcusCaseStatus()).toBe("Pending");
    await h.click(buttonText(document.body, "Takeover Call")!);
    await h.advance(3_000);
    expect(cardText("Marcus Webb")).toContain("Returns");
    expect(await marcusCaseStatus()).toBe("Open");
  });

  it("Lucas: the row's preview is Checkout before and after takeover; the chip reads Pending, then Open", async () => {
    await lucas("inline");
    expect(cardText("Lucas Thomas")).toContain("Checkout");
    expect(cardText("Lucas Thomas")).not.toContain("AI Review");
    const main = h.container; // the status chip sits in the record header (the session row portals there)
    expect(leaf(main, "Pending").length).toBeGreaterThan(0);
    await h.click(buttonText(document.body, "Takeover Chat") ?? buttonText(document.body, "Takeover")!);
    await h.advance(3_000);
    expect(cardText("Lucas Thomas")).toContain("Checkout");
    expect(leaf(main, "Open").length).toBeGreaterThan(0);
    expect(leaf(main, "Pending")).toHaveLength(0);
  });
});
