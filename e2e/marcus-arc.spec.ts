import { expect, test, type Page } from "@playwright/test";
import { marcus } from "./marcus-driver";

// P-SHRINK parity: Marcus Webb's whole arc, press L and then each decision,
// asserting the visible rows, the slide-overs and the final Outcome. Written
// against his scripted card first; the port onto the generic Next Best
// Action must pass it with no assertion change beyond the Used-row wording.
// The decisions themselves are clicks in ./marcus-driver.ts.

const LINES = {
  setup: "Sure, it's order number 48213, placed last Tuesday.",
  approved: "I've received approval from a supervisor. I'm processing your $200 refund now",
  thanks: "That's great, thank you so much for your help!",
  rejected: "unfortunately this refund wasn't approved as submitted",
  rejectionReaction: "I really don't understand why it's being denied.",
  photoRequested: "could you send a photo of the damaged ear cup?",
  photoReaction: "Fine, I'll send a photo, but this is getting frustrating.",
  greeting: "Hello, Mr. Webb. This is John.",
  reply: "I'll take store credit.",
};

async function start(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  const card = page.locator("aside [aria-label^='Marcus Webb']").first();
  // The hotkey is ignored until the sim is ready and the agent is available, so press until his card arrives.
  await expect(async () => {
    await page.keyboard.press("l");
    await expect(card).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 45_000 });
  await card.click({ force: true });
  const action = page.locator("[data-canvas-region=action]");
  await expect(action.getByText(LINES.setup).first()).toBeVisible();
  await expect(action.getByText("Approval request").first()).toBeVisible({ timeout: 10_000 });
  await expect(action.getByText("Marcus Webb is requesting a $200 refund").first()).toBeVisible();
  return action;
}

/** The visible text `text` somewhere in the action area. */
const seen = (page: Page, text: string, timeout = 15_000) =>
  expect(page.locator("[data-canvas-region=action]").getByText(text).first()).toBeVisible({ timeout });

/** Marcus's case status, as the provider has it. */
const caseStatus = (page: Page) =>
  page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot = await (window as any).__providers.interaction.getSnapshot();
    return snapshot.interactions.find((i: { caseId?: string }) => i.caseId === "MW-DEMO-0001")?.caseStatus as string | undefined;
  });

/** The case status, and the Outcome the agent logs. Outcome is locked while
 *  the bot holds the call, so opening it takes the call over. (The old card's
 *  "Exception Approved" disposition never reached the draft: it wrote to
 *  whichever Outcome popover was open, and none was.) */
async function expectOutcome(page: Page, status: string, opensOutcome: boolean) {
  await expect.poll(() => caseStatus(page), { timeout: 10_000 }).toBe(status);
  if (!opensOutcome) return;
  // The session row's Outcome button (the nav rows' are icon-only).
  const trigger = page.getByRole("button", { name: "Outcome" }).filter({ hasText: "Outcome" }).first();
  if (await trigger.isDisabled()) await marcus.takeOver(page);
  await expect(trigger).toBeEnabled({ timeout: 10_000 });
  await trigger.click();
  const popover = page.locator("[data-radix-popper-content-wrapper]").filter({ hasText: "Log Outcome" });
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
}

test.describe("Marcus Webb, the whole arc", () => {
  // Each arc plays several seconds of scripted timing.
  test.describe.configure({ timeout: 120_000 });

  test("approve: the bot tells Marcus, the disposition updates, Outcome reads Resolved", async ({ page }) => {
    await start(page);
    await marcus.approve(page);
    await seen(page, "Refund approved");
    await seen(page, LINES.approved);
    await seen(page, LINES.thanks);
    await seen(page, 'Disposition updated to "Exception Approved"');
    await seen(page, "Excellent. I have approved the refund and responded to Marcus.");
    await marcus.openRow(page, "Refund approved", "Approve the refund");
    await expect(page.locator("[data-slot=reference-slide-over]").getByText("Approve the refund").first()).toBeVisible();
    await expectOutcome(page, "Resolved", true);
  });

  test("reject with a reason: the bot offers alternatives and asks for a photo; status unchanged", async ({ page }) => {
    await start(page);
    const reason = "The damage report needs photos first";
    await marcus.reject(page, reason);
    await seen(page, "Refund rejected");
    await seen(page, reason);
    await seen(page, LINES.rejected);
    await seen(page, LINES.rejectionReaction);
    await seen(page, LINES.photoRequested);
    await seen(page, "Refund rejected. Requested customer provide visual proof");
    await seen(page, LINES.photoReaction);
    await seen(page, "I have requested the customer provide a photo of the damaged item.");
    await expectOutcome(page, "Open", false);
  });

  for (const remedy of ["credit", "discount"] as const) {
    test(`takeover, greeting and a remedy (${remedy}): Outcome reads Resolved`, async ({ page }) => {
      await start(page);
      await marcus.takeOver(page);
      await seen(page, "Agent Smith has taken over the conversation.");
      await marcus.greet(page);
      await seen(page, LINES.greeting);
      await seen(page, LINES.reply);
      await seen(page, "I have transferred the call. You are live with the customer.");
      if (remedy === "credit") {
        await marcus.issueCredit(page, "150");
        await seen(page, "I've issued $150 as store credit");
        await seen(page, "Store credit issued");
        await seen(page, "$150 store credit");
      } else {
        await marcus.sendDiscount(page, "20");
        await seen(page, "I've sent a 20% discount code");
        await seen(page, "Discount code sent");
        await seen(page, "20% off discount code");
      }
      await expectOutcome(page, "Resolved", true);
    });
  }

  test("Copilot: a chip and a free-form instruction open their results", async ({ page }) => {
    await start(page);
    const slideOver = page.locator("[data-slot=reference-slide-over]");
    await marcus.askChip(page, "Show purchase history");
    await marcus.openRow(page, "Show purchase history", "5 of them with damage claims");
    await expect(slideOver.getByText("Marcus has 10 orders in the last 12 months, 5 of them with damage claims.")).toBeVisible({ timeout: 10_000 });
    const instruction = "Check his recent returns";
    await marcus.instruct(page, instruction);
    await seen(page, instruction);
    await marcus.openRow(page, instruction, "5 of the customer's last 10 transactions");
    await expect(slideOver.getByText("5 of the customer's last 10 transactions have been damaged-product claims.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Marcus Webb has 5 damaged product claims in the last 10 transactions").first()).toBeVisible({ timeout: 10_000 });
  });
});
