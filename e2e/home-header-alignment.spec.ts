import { expect, test, type Page } from "@playwright/test";

// P-LAYOUT-F2 3: Home's header (the greeting and the tab strip) takes the active tab's body width, so their edges are
// the body's — centred at the dashboard's width on the one-column Dashboard, full width on an app tab and in two
// columns. Widths at a wide window, so Chrome.

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
const title = (page: Page) => box(page, "[data-home-header] h1");

test("Phase 1 Home: the greeting's left edge is the queue cards' and history's", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-home-layout=oneColumn]")).toBeVisible();
  await expect(page.locator("[data-home-header]")).toHaveAttribute("data-home-header-width", "centred");
  const body = await box(page, "[data-home-layout=oneColumn] > div");
  const cards = await box(page, "[data-home-layout=oneColumn] [data-home-section]");
  expect(Math.round((await title(page)).x)).toBe(Math.round(body.x));
  expect(Math.round(cards.x)).toBe(Math.round(body.x));
});

test("one-column Home → Customers: the header and the tab strip line up with the full-width table", async ({ page }) => {
  await open(page, "Phase 2");
  const tabs = page.locator("[data-slot=home-tabs]");
  await expect(tabs).toBeVisible();
  // On Dashboard both are centred at the dashboard's width.
  await expect(page.locator("[data-home-header]")).toHaveAttribute("data-home-header-width", "centred");
  const dashboard = tabs.getByRole("tab", { name: "Dashboard" });
  await expect(dashboard).toBeVisible();
  const dashTab = (await dashboard.boundingBox())!;
  const dashBody = await box(page, "[data-home-layout=oneColumn] > div");
  expect(Math.round(dashTab.x)).toBe(Math.round(dashBody.x));
  // Customers: full width, the title, the first tab and the table on one left edge; the strip's right edge the table's.
  // The strip isn't remounted by the switch: the clicked tab keeps focus.
  await tabs.getByText("Customers", { exact: true }).click();
  await expect(page.locator("[data-home-header]")).toHaveAttribute("data-home-header-width", "full");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Customers");
  const table = page.locator("table").first();
  await expect(table).toBeVisible();
  const t = (await table.boundingBox())!;
  const first = (await tabs.locator("button").first().boundingBox())!;
  expect(Math.round((await title(page)).x)).toBe(Math.round(t.x));
  expect(Math.round(first.x)).toBe(Math.round(t.x));
});

test("two-column Home (AI-first): the header spans the columns' outer edges", async ({ page }) => {
  await open(page, "AI-first");
  const layout = page.locator("[data-home-layout=twoColumn]");
  await expect(layout).toBeVisible();
  const header = await box(page, "[data-home-header]");
  const columns = (await layout.boundingBox())!;
  expect(Math.round(header.x)).toBe(Math.round(columns.x));
  expect(Math.round(header.x + header.width)).toBe(Math.round(columns.x + columns.width));
});
