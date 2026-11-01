import { expect, test, type Locator, type Page } from "@playwright/test";

// P-LAYOUT-F2 4: a table inside a container keeps its pagination footer at the container's bottom, its rows
// scrolling between its header and the footer. Every container table: Activity in table view (one column and two),
// Customers as a Home tab and as a left-nav page, Contact History's card. Sizes and scroll, so Chrome.

const HOME = (value: Record<string, unknown>) => ({
  v: 2,
  value: {
    sections: [
      { key: "queue", enabled: true },
      { key: "contactHistory", enabled: true },
      { key: "performance", enabled: true },
      { key: "productivity", enabled: false },
      { key: "activity", enabled: true },
    ],
    ...value,
  },
});

async function open(page: Page, seed: Record<string, unknown> = {}, height = 820) {
  await page.setViewportSize({ width: 1600, height });
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(`agent-next-gen:settings:${key}`, JSON.stringify(value));
  }, seed);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

/** The footer (lyra TableFooter's pagination nav) sits at `container`'s bottom edge and stays there while the rows
 *  scroll: the rows' scroller is between the table's header and the footer. */
async function expectFooterPinned(container: Locator, rows = "tbody", mustScroll = true) {
  await expect(container).toBeVisible();
  const footer = container.locator('nav[aria-label="Pagination"]').first();
  await expect(footer).toBeVisible();
  const c = (await container.boundingBox())!;
  // The footer row: TableFooter's root (the nav's closest bordered ancestor inside the container).
  const footerBottom = await footer.evaluate((nav, root) => {
    let el: HTMLElement = nav as HTMLElement;
    while (el.parentElement && el.parentElement !== root && !el.className.toString().includes("border-t")) el = el.parentElement;
    return el.getBoundingClientRect().bottom;
  }, await container.elementHandle());
  // At the container's bottom: within its bottom padding (lyra DashboardCard's footer row is py-3, the feed card's
  // area pb-4), nothing below it.
  const gap = c.y + c.height - footerBottom;
  expect(gap).toBeGreaterThanOrEqual(-1);
  expect(gap).toBeLessThanOrEqual(17);
  const before = (await footer.boundingBox())!.y;
  // The rows scroll inside, under a header that stays.
  // The scroller is inside the container (a page scroll outside it would carry the footer away).
  const body = container.locator(rows).first();
  const scrolled = await body.evaluate((el, root) => {
    let p: HTMLElement | null = el as HTMLElement;
    while (p && p !== root && !(/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight)) p = p.parentElement;
    if (!p || p === root) return 0;
    p.scrollTop = 200;
    return p.scrollTop;
  }, await container.elementHandle());
  if (mustScroll) expect(scrolled).toBeGreaterThan(0);
  // The footer didn't move with the rows, and it's still inside the container.
  const after = (await footer.boundingBox())!;
  expect(Math.round(after.y)).toBe(Math.round(before));
  expect(after.y + after.height).toBeLessThanOrEqual(c.y + c.height + 1);
}

test("Activity as a table, one column: the footer at the Activity card's bottom (a tall window: past lyra DashboardCard's 600px body)", async ({ page }) => {
  await open(page, { home: HOME({ activityView: "table" }) }, 1100);
  const card = page.locator("[data-feed-area]").locator("xpath=ancestor::*[contains(@class,'rounded')][1]");
  await page.locator("[data-feed-views]").getByRole("radio", { name: /^History/ }).click();
  await page.locator("[data-feed-filters]").getByRole("button", { name: /^Date:/ }).click();
  await page.getByRole("radio", { name: "Last 7 days" }).last().click();
  await page.keyboard.press("Escape");
  await expectFooterPinned(card);
});

test("Activity as a table, two columns: the footer at the feed area's bottom", async ({ page }) => {
  await open(page, { home: HOME({ layout: "twoColumn", activityView: "table" }) });
  await page.locator("[data-feed-views]").getByRole("radio", { name: /^History/ }).click();
  await page.locator("[data-feed-filters]").getByRole("button", { name: /^Date:/ }).click();
  await page.getByRole("radio", { name: "Last 7 days" }).last().click();
  await page.keyboard.press("Escape");
  await expectFooterPinned(page.locator("[data-feed-table-frame]"));
});

test("Contact History's card: the footer at the card's bottom", async ({ page }) => {
  await open(page, {}, 700);
  const card = page.locator("[data-home-section=contactHistory]").locator("> *").first();
  // Its rows are buttons in a list, five to a page by default: they scroll inside the card once they outnumber its
  // 600px body.
  await expectFooterPinned(card, "[role=button]", false);
});

for (const placement of ["tab", "leftnav"] as const) {
  test(`Customers as ${placement === "tab" ? "a Home tab" : "a left-nav page"}: the footer at the table's container bottom`, async ({ page }) => {
    await open(page, { header: { v: 2, value: { showAppIcons: true, apps: { customers: { enabled: true, placement } } } } });
    if (placement === "tab") await page.locator("[data-slot=home-tabs]").getByText("Customers", { exact: true }).click();
    else await page.locator("aside").getByText("Customers", { exact: true }).first().click();
    await expectFooterPinned(page.locator("[data-table-container=customers]:visible").first());
  });
}
