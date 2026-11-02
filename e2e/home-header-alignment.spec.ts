import { expect, test, type Page } from "@playwright/test";

// P-LAYOUT-F3 2: Home's header is lyra's PageHeader in every layout (the greeting its title, Home's tabs its tabs
// row), always the page's full width — reverses P-LAYOUT-F2 3 (the header following the active tab's width). Its
// title and its first tab share the header's 24px inset. Widths at a wide window, so Chrome.

async function open(page: Page, profile?: string) {
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  if (profile) {
    await page.locator("aside").getByText("Settings", { exact: true }).first().click();
    await page.getByRole("combobox", { name: "Profile" }).click();
    await page.getByRole("option", { name: profile, exact: true }).click();
    await page.locator("aside").getByText("Home", { exact: true }).first().click();
  }
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;
/** The header against the page column Home fills (its root's box: the header's parent column). */
async function expectFullWidth(page: Page) {
  const header = await box(page, "[data-home-header]");
  const column = await box(page, "[data-home-layout]");
  expect(Math.round(header.x)).toBe(Math.round(column.x));
  expect(Math.round(header.x + header.width)).toBe(Math.round(column.x + column.width));
}

test("Phase 1 Home: the header spans the page, its title at the header's inset", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-home-layout=oneColumn]")).toBeVisible();
  await expectFullWidth(page);
  const header = await box(page, "[data-home-header]");
  const title = await box(page, "[data-home-header] h1");
  expect(Math.round(title.x - header.x)).toBe(24);
});

test("one-column Home → Customers: the tabs are the header's row, full width on every tab; the switch keeps focus", async ({ page }) => {
  await open(page, "Phase 2");
  const tabs = page.locator("[data-home-header] [data-slot=home-tabs]");
  await expect(tabs).toBeVisible();
  await expectFullWidth(page);
  const title = await box(page, "[data-home-header] h1");
  const dashboard = (await tabs.getByRole("tab", { name: "Dashboard" }).boundingBox())!;
  expect(Math.round(dashboard.x)).toBe(Math.round(title.x));
  // The header's width doesn't follow the tab: the same on Customers, and the clicked tab keeps focus.
  const before = await box(page, "[data-home-header]");
  await tabs.getByText("Customers", { exact: true }).click();
  await expect(page.locator("table").first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Customers");
  const after = await box(page, "[data-home-header]");
  expect(Math.round(after.width)).toBe(Math.round(before.width));
});

test("two-column Home (AI-first): the same header, spanning the columns' outer edges", async ({ page }) => {
  await open(page, "AI-first");
  const layout = page.locator("[data-home-layout=twoColumn]");
  await expect(layout).toBeVisible();
  await expect(page.locator("[data-home-header] [data-home-page-header]")).toBeVisible();
  const header = await box(page, "[data-home-header]");
  const columns = (await layout.boundingBox())!;
  expect(Math.round(header.x)).toBe(Math.round(columns.x));
  expect(Math.round(header.x + header.width)).toBe(Math.round(columns.x + columns.width));
});
