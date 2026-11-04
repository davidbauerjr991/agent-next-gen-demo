import { expect, test, type Page } from "@playwright/test";

// P-LAYOUT-F3 4: a right-side panel that pushes docks beside the whole page column (header and body), in the page's
// right host, so the page header narrows with the body and the panel runs the content card's height; where it
// doesn't fit, it overlays and the header keeps its width. As AdminShell's right SidePanel. Widths, so Chrome.

async function go(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

async function openQueuePanel(page: Page) {
  const queue = page.locator("[data-home-section=queue]");
  await expect(queue).toBeVisible();
  await queue.locator("button, [role=button]").first().click();
  const panel = page.locator("[data-slot=home-detail-panel]");
  await expect(panel).toBeVisible();
  await page.waitForTimeout(500); // the slide-in
  return panel;
}

test("Home: the queue's detail panel pushes the page header with the body, at the content card's full height", async ({ page }) => {
  await go(page, 1800);
  const panel = await openQueuePanel(page);
  await expect(page.locator("[data-slot=page-right-host] [data-slot=home-detail-panel]")).toHaveCount(1);
  const header = await box(page, "[data-home-header]");
  const p = (await panel.boundingBox())!;
  const card = await box(page, "[data-slot=content-card]");
  expect(Math.abs(header.x + header.width - p.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.y - card.y)).toBeLessThanOrEqual(2);
});

test("Home, narrow: the panel overlays, and the page header keeps its width", async ({ page }) => {
  await go(page, 1000);
  await expect(page.locator("[data-home-header]")).toBeVisible();
  const before = await box(page, "[data-home-header]");
  await openQueuePanel(page);
  await expect(page.locator("[data-slot=page-right-host] [data-slot=home-detail-panel]")).toHaveCount(0);
  const after = await box(page, "[data-home-header]");
  expect(Math.round(after.width)).toBe(Math.round(before.width));
});

test("an interaction with a reference column: Contact Details covers the column and leaves the record header's width (P-LAYOUT-F4 3)", async ({ page }) => {
  await go(page, 2400);
  await page.keyboard.press("b"); // Maya Chen, answered at once
  await page.locator("[data-slot=assignment-card]").getByText("Maya Chen").first().click();
  await expect(page.locator("[data-canvas-region=reference]")).toBeVisible({ timeout: 15_000 });
  const headerBefore = await box(page, "[data-slot=record-header]");
  await page.locator("button[data-contact-details]").first().click();
  const slideOver = page.locator("[data-slot=reference-slide-over]");
  await expect(slideOver).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator("[data-slot=page-right-host] [data-slot=reference-slide-over]")).toHaveCount(0);
  const header = await box(page, "[data-slot=record-header]");
  expect(Math.round(header.width)).toBe(Math.round(headerBefore.width));
  // Over the column, below the record header.
  const column = await box(page, "[data-canvas-region=reference]");
  const s = (await slideOver.boundingBox())!;
  expect(Math.abs(column.x + column.width - (s.x + s.width))).toBeLessThanOrEqual(1);
  expect(s.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
});
