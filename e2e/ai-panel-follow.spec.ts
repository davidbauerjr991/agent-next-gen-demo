import { expect, test } from "@playwright/test";
import { lucasInPanelMode, overviewScroller, scrollMetrics } from "./helpers";

// AI display "In the Contact Details panel" (item 12): an agent action in the panel scrolls the Overview body to the
// bottom, with real layout. jsdom has no layout, so the companion jsdom test (settings-wiring.test.tsx) can only
// check that a scroll was requested, not that it reached the bottom after the result rendered. Since P-LAYOUT-F4 8 the
// approval's own actions (Approve) are the transcript's, a pushed card, so what lands in the panel is a Copilot ask.
test("A Copilot chip in the panel scrolls the Overview body to the bottom", async ({ page }) => {
  // Short, so the Overview (its reference cards) overflows the body.
  await page.setViewportSize({ width: 1600, height: 560 });
  await lucasInPanelMode(page);
  const scroller = overviewScroller(page);
  await expect(scroller).toHaveCount(1);
  const before = await scrollMetrics(page);
  expect(before.height).toBeGreaterThan(before.client);

  // The chip row shows once the agent has the chat. Scrolled to the top, the agent asks.
  await page.getByRole("button", { name: /^Takeover/ }).first().click();
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.locator("[data-slot=copilot-composer] [role=button]", { hasText: "Show purchase history" }).click();

  // Within a second the body is at the bottom, with the result row laid out.
  await expect
    .poll(async () => {
      const m = await scrollMetrics(page);
      return m.top + m.client >= m.height - 2;
    }, { timeout: 1_000, intervals: [50] })
    .toBe(true);
});
