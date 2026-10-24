import { expect, type Page } from "@playwright/test";

// How marcus-arc.spec.ts makes Marcus Webb's decisions. The spec's
// assertions don't change between implementations; only these clicks do.
// This one drives his scripted card (agent-next-gen-marcus-webb-next-best-action-card.tsx).

/** The card's pill radios: the label covers the (visually hidden) radio, so click the label. */
async function pick(page: Page, option: string) {
  const label = page.locator("[data-canvas-region=action]").getByText(option, { exact: true }).last();
  await expect(label).toBeVisible({ timeout: 15_000 });
  await label.click();
}

export const marcus = {
  async approve(page: Page) {
    await pick(page, "Approve the refund");
    await page.getByRole("button", { name: "Authorize the Refund" }).click();
  },
  async reject(page: Page, reason: string) {
    await pick(page, "Reject the refund");
    await page.getByPlaceholder("e.g. the damage report needs photos").fill(reason);
    await page.getByRole("button", { name: "Reject the Refund" }).click();
  },
  async takeOver(page: Page) {
    await page.getByRole("button", { name: "Takeover Call" }).click();
  },
  /** The greeting after takeover plays on its own. */
  async greet() {},
  async issueCredit(page: Page, amount: string) {
    await pick(page, "Store Credit");
    await page.getByLabel("Credit amount").fill(amount);
    await page.getByRole("button", { name: "Perform Task" }).click();
  },
  async sendDiscount(page: Page, percent: string) {
    await pick(page, "Discount Code");
    await pick(page, `${percent}% Off`);
    await page.getByRole("button", { name: "Perform Task" }).click();
  },
  /** A Copilot chip under the composer. */
  async askChip(page: Page, chip: string) {
    await page.getByRole("button", { name: chip }).click();
  },
  /** A free-form instruction: the card's "Something else". */
  async instruct(page: Page, text: string) {
    await pick(page, "Something else");
    await page.getByPlaceholder("Describe what you'd like the AI agent to do instead").fill(text);
    await page.getByRole("button", { name: "Perform Task" }).click();
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
