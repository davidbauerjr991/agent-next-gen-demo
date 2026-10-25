import { expect, test, type Locator } from "@playwright/test";
import { lucasInPanelMode } from "./helpers";

// The Copilot composer's wide/narrow layout is measured from its own width
// (a ResizeObserver), so it needs a real browser: in the 425px docked panel
// Takeover drops below the chips at full width; in a wide main column it
// shares the chips' row.

const box = async (l: Locator) => (await l.boundingBox())!;

// While the bot holds the chat there is no chip row (it shows on takeover), so the room-for-chips layout is
// checked by copilot-composer.test.tsx's stubbed widths; here Takeover sits below the input at full width.
test("docked panel (425px): input, then Takeover full width, with no chips while the bot holds", async ({ page }) => {
  await lucasInPanelMode(page);
  const composer = page.locator("[data-slot=copilot-composer][data-placement=panel]");
  const panel = page.locator("[data-slot=right-panel]");
  expect((await box(panel)).width).toBeLessThanOrEqual(425);

  const input = await box(composer.locator("textarea, input").first());
  const takeover = await box(composer.locator("[data-slot=copilot-takeover]"));
  expect(input.y + input.height).toBeLessThanOrEqual(takeover.y);
  await expect(composer.locator("[data-slot=copilot-chips]")).toHaveCount(0);
});

test("docked panel (308px): the chip row wraps instead of clipping its third chip", async ({ page }) => {
  await lucasInPanelMode(page);
  await page.getByRole("button", { name: /^Takeover/ }).first().click();
  const composer = page.locator("[data-slot=copilot-composer][data-placement=panel]");
  const row = composer.locator("[data-slot=copilot-chips]");
  await expect(row).toBeVisible();
  await page.evaluate(() => {
    (document.querySelector("[data-slot=right-panel]") as HTMLElement).style.width = "308px";
  });
  await page.waitForTimeout(400);
  const clipped = await row.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll<HTMLElement>("[role=button], [data-slot=copilot-chips-refresh]")].some((c) => {
      const b = c.getBoundingClientRect();
      return b.right > r.right + 0.5 || b.left < r.left - 0.5;
    });
  });
  expect(clipped).toBe(false);
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

test("wide main column (inline): Takeover sits below the input; no chips while the bot holds", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.keyboard.press("a");
  await page.getByText("Lucas Thomas").first().click();
  const composer = page.locator("[data-slot=copilot-composer][data-placement=inline]");
  await expect(composer.locator("[data-slot=copilot-takeover]")).toBeVisible({ timeout: 30_000 });

  const input = await box(composer.locator("textarea, input").first());
  const takeover = await box(composer.locator("[data-slot=copilot-takeover]"));
  expect(input.y + input.height).toBeLessThanOrEqual(takeover.y + 0.5);
  await expect(composer.locator("[data-slot=copilot-chips]")).toHaveCount(0);
});
