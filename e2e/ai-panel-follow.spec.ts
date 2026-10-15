import { expect, test } from "@playwright/test";

// AI display "In the Contact Details panel" (item 12): an agent action in the
// panel scrolls the Overview body to the bottom, with real layout. jsdom has
// no layout, so the companion jsdom test (settings-wiring.test.tsx) can only
// check that a scroll was requested, not that it reached the bottom after the
// result rendered.
test("Approve in the panel scrolls the Overview body to the bottom", async ({ page }) => {
  // AI display = panel, before the app loads.
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "panel" } }));
  });
  // `?provider`/`?latency` are read from location.search, before the hash route.
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  // Lucas Thomas (dev hotkey A); his approval request arrives ~12s in.
  await page.keyboard.press("a");
  await page.getByText("Lucas Thomas").first().click();
  await expect(page.getByText("How would you like to proceed?")).toBeVisible({ timeout: 30_000 });

  // The Overview body's scroll container: the scrolling ancestor of the
  // Details body.
  const scroller = page.locator("[data-slot=details-panel-body]").locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' overflow-y-auto ')][1]",
  );
  await expect(scroller).toHaveCount(1);
  const metrics = () =>
    scroller.evaluate((el) => ({ top: el.scrollTop, client: el.clientHeight, height: el.scrollHeight }));
  expect((await metrics()).height).toBeGreaterThan((await metrics()).client);

  // Scrolled to the top, the agent clicks Approve.
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
  await page.getByRole("radio", { name: "Approve the Exception" }).click();

  // Within 500ms the body is at the bottom, with the result laid out.
  await expect
    .poll(async () => {
      const m = await metrics();
      return m.top + m.client >= m.height - 2;
    }, { timeout: 500, intervals: [50] })
    .toBe(true);
});
