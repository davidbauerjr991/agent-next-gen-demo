import { expect, test, type Locator } from "@playwright/test";
import { lucasInPanelMode } from "./helpers";

// The Copilot composer's wide/narrow layout is measured from its own width
// (a ResizeObserver), so it needs a real browser: in the 425px docked panel
// Takeover drops below the chips at full width; in a wide main column it
// shares the chips' row.

const box = async (l: Locator) => (await l.boundingBox())!;

test("docked panel (425px): input, then the chips, then Takeover full width", async ({ page }) => {
  await lucasInPanelMode(page);
  const composer = page.locator("[data-slot=copilot-composer][data-placement=panel]");
  await expect(composer).toHaveAttribute("data-layout", "stacked");
  const panel = page.locator("[data-slot=right-panel]");
  expect((await box(panel)).width).toBeLessThanOrEqual(425);

  const input = await box(composer.locator("textarea, input").first());
  const chips = await box(composer.locator("[data-slot=copilot-chips]"));
  const takeover = await box(composer.locator("[data-slot=copilot-takeover]"));
  const c = await box(composer);
  expect(input.y + input.height).toBeLessThanOrEqual(chips.y);
  expect(chips.y + chips.height).toBeLessThanOrEqual(takeover.y);
  expect(Math.abs(takeover.width - c.width)).toBeLessThanOrEqual(1);
  // One chip at least, plus refresh, and nothing past the composer's edge.
  await expect(composer.locator("[data-slot=copilot-chips] [role=button]").first()).toBeVisible();
  expect(chips.x + chips.width).toBeLessThanOrEqual(c.x + c.width + 0.5);
});

for (const width of [1024, 800]) {
  test(`${width}px viewport, Contact Details open: the inline composer fits its column`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("?provider=sim&latency=off#/agent-advanced");
    await page.getByRole("button", { name: "Go Available" }).click();
    await page.keyboard.press("a");
    await page.getByText("Lucas Thomas").first().click();
    const panel = page.locator("[data-slot=right-panel]");
    if ((await panel.getAttribute("data-open")) !== "true") {
      await page.locator("button[aria-label$='Contact Details']").first().click();
    }
    await expect(panel).toHaveAttribute("data-open", "true");
    const composer = page.locator("[data-slot=copilot-composer][data-placement=inline]");
    const takeover = composer.locator("[data-slot=copilot-takeover]");
    await expect(takeover).toBeVisible({ timeout: 30_000 });
    // Let the panel's open transition and the ResizeObserver settle.
    await page.waitForTimeout(800);

    const { scrollWidth, clientWidth } = await composer.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    const column = await box(page.locator("[data-main-thread]"));
    const c = await box(composer);
    const t = await box(takeover);
    expect(c.x).toBeGreaterThanOrEqual(column.x - 0.5);
    expect(c.x + c.width).toBeLessThanOrEqual(column.x + column.width + 0.5);
    expect(t.x).toBeGreaterThanOrEqual(column.x - 0.5);
    expect(t.x + t.width).toBeLessThanOrEqual(column.x + column.width + 0.5);
    // The input's own controls (the mic) are inside the column too.
    const input = await box(composer.locator("textarea, input").first().locator("xpath=ancestor::*[2]"));
    expect(input.x + input.width).toBeLessThanOrEqual(column.x + column.width + 0.5);
  });
}

test("wide main column (inline): the chips and Takeover share one row below the input", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.keyboard.press("a");
  await page.getByText("Lucas Thomas").first().click();
  const composer = page.locator("[data-slot=copilot-composer][data-placement=inline]");
  await expect(composer).toHaveAttribute("data-layout", "row", { timeout: 30_000 });

  const input = await box(composer.locator("textarea, input").first());
  const chips = await box(composer.locator("[data-slot=copilot-chips]"));
  const takeover = await box(composer.locator("[data-slot=copilot-takeover]"));
  expect(input.y + input.height).toBeLessThanOrEqual(chips.y);
  // Same row: vertically overlapping, Takeover to the right of the chips.
  expect(takeover.y).toBeLessThan(chips.y + chips.height);
  expect(takeover.y + takeover.height).toBeGreaterThan(chips.y);
  expect(takeover.x).toBeGreaterThanOrEqual(chips.x + chips.width);
});
