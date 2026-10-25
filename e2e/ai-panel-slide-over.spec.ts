import { expect, test } from "@playwright/test";
import { lucasInPanelMode, scrollMetrics } from "./helpers";

// Item 13: opening (and closing) a Copilot result row's slide-over leaves the
// Overview body's scroll position exactly where it was.
test("a Copilot result row's slide-over keeps the Overview body's scrollTop", async ({ page }) => {
  await lucasInPanelMode(page);

  // A Copilot result row: ask through a chip (the chip row shows once the agent has the chat); its slide-over
  // opens when the result is ready. Close it to get back to the Overview.
  await page.getByRole("button", { name: /^Takeover/ }).first().click();
  const chip = page.locator("[data-slot=copilot-composer] [role=button]", { hasText: "Show purchase history" });
  await chip.click();
  // Its slide-over ("Purchase history") opens after the result's spinner.
  const closeSlideOver = page.getByRole("button", { name: "Close Purchase history" });
  await expect(closeSlideOver).toBeVisible({ timeout: 5_000 });
  await closeSlideOver.click();
  await expect(closeSlideOver).toBeHidden();
  const row = page.locator("[data-slot=ai-feed] button", { hasText: "Show purchase history" }).first();
  await expect(row).toBeVisible();

  // The row in view first: Playwright's click scrolls its target into view,
  // which would otherwise move the body before the app does anything. (The
  // row is the newest item, so this is the bottom, where a taller body would
  // clamp scrollTop.)
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const at = (await scrollMetrics(page)).top;
  expect(at).toBeGreaterThan(0);

  await row.click();
  await expect(closeSlideOver).toBeVisible();
  await page.waitForTimeout(400);
  expect(Math.abs((await scrollMetrics(page)).top - at)).toBeLessThanOrEqual(1);

  await closeSlideOver.click();
  await page.waitForTimeout(400);
  expect(Math.abs((await scrollMetrics(page)).top - at)).toBeLessThanOrEqual(1);
});

// P-POLISH 4: the slide-over's X closes only the slide-over; the Contact Details panel and its AI feed stay.
test("the slide-over's X leaves the Contact Details panel open with its AI feed", async ({ page }) => {
  await lucasInPanelMode(page);
  await page.getByRole("button", { name: /^Takeover/ }).first().click();
  const panel = page.locator("[data-slot=right-panel]");
  await page.locator("[data-slot=copilot-composer] [role=button]", { hasText: "Show purchase history" }).click();
  const closeSlideOver = page.getByRole("button", { name: "Close Purchase history" });
  await expect(closeSlideOver).toBeVisible({ timeout: 8_000 });
  await closeSlideOver.click();
  await expect(closeSlideOver).toBeHidden();
  await expect(panel).toHaveAttribute("data-open", "true");
  await expect(panel.locator("[data-slot=ai-feed]")).toBeVisible();
});
