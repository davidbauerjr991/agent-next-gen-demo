import { expect, type Page } from "@playwright/test";

// How marcus-arc.spec.ts makes Marcus Webb's decisions. The spec's
// assertions don't change between implementations; only these clicks do.
// This one drives his decisions as Next Best Actions (P-SHRINK): a Do with
// its alternatives, a note where the option asks for one, and the Copilot
// composer for anything else.

/** The Next Best Action showing `title` (its own or an alternative's). */
async function nba(page: Page, title: string) {
  const card = page.locator("[data-slot=next-best-action]").filter({ hasText: title }).last();
  await expect(card).toBeVisible({ timeout: 20_000 });
  return card;
}

/** Uses the alternative `text`; with a note, fills it and runs it from its own field. */
async function pickAlternative(page: Page, title: string, text: string, note?: string) {
  const card = await nba(page, title);
  await card.locator("li").filter({ hasText: text }).getByRole("button", { name: "Use" }).click();
  if (note === undefined) return;
  const field = card.locator("[data-slot=nba-alternative-note]");
  await field.locator("textarea, input").first().fill(note);
  await field.getByRole("button", { name: "Run it" }).click();
}

export const marcus = {
  async approve(page: Page) {
    await (await nba(page, "Approve the refund")).getByRole("button", { name: "Run it" }).first().click();
  },
  async reject(page: Page, reason: string) {
    await pickAlternative(page, "Approve the refund", "Reject the refund", reason);
  },
  async takeOver(page: Page) {
    await page.getByRole("button", { name: "Takeover Call" }).click();
  },
  /** The greeting after takeover is the agent's line: said when the agent says it. */
  async greet(page: Page) {
    await (await nba(page, "Greet Marcus")).getByRole("button", { name: "Said it" }).click();
  },
  async issueCredit(page: Page, amount: string) {
    const card = await nba(page, "Issue store credit");
    await card.getByPlaceholder("200").fill(amount);
    await card.getByRole("button", { name: "Run it" }).first().click();
  },
  async sendDiscount(page: Page, percent: string) {
    await pickAlternative(page, "Issue store credit", `Send a ${percent}% discount code`);
  },
  /** A Copilot chip under the composer. */
  async askChip(page: Page, chip: string) {
    await page.getByRole("button", { name: chip }).click();
  },
  /** A free-form instruction: a question to Copilot. */
  async instruct(page: Page, text: string) {
    const input = page.getByRole("textbox", { name: /Ask Copilot/ }).first();
    await input.fill(text);
    await input.press("Enter");
  },
  /** Opens the row titled `title` in the slide-over, unless it's already showing it. The row
   *  performs for a moment first (and a result may open on its own when it's done). */
  async openRow(page: Page, title: string, shows: string) {
    const row = page.locator("[data-canvas-region=action]").getByText(title, { exact: true }).last();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    const slideOver = page.locator("[data-slot=reference-slide-over]");
    if (await slideOver.getByText(shows).first().isVisible()) return;
    await row.click();
  },
};
