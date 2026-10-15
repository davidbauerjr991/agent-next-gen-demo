import { expect, test } from "@playwright/test";
import { lucasInPanelMode, overviewScroller, scrollMetrics } from "./helpers";

// AI display "In the Contact Details panel" (item 12): an agent action in the
// panel scrolls the Overview body to the bottom, with real layout. jsdom has
// no layout, so the companion jsdom test (settings-wiring.test.tsx) can only
// check that a scroll was requested, not that it reached the bottom after the
// result rendered.
test("Approve in the panel scrolls the Overview body to the bottom", async ({ page }) => {
  await lucasInPanelMode(page);
  const scroller = overviewScroller(page);
  await expect(scroller).toHaveCount(1);
  const before = await scrollMetrics(page);
  expect(before.height).toBeGreaterThan(before.client);

  // Scrolled to the top, the agent clicks Approve.
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.getByRole("radio", { name: "Approve the Exception" }).click();

  // Within 500ms the body is at the bottom, with the result laid out.
  await expect
    .poll(async () => {
      const m = await scrollMetrics(page);
      return m.top + m.client >= m.height - 2;
    }, { timeout: 500, intervals: [50] })
    .toBe(true);
});
