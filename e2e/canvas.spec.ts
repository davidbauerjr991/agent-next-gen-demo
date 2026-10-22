import { expect, test, type Page } from "@playwright/test";

// P-CANVAS: the main column as a work surface. Under AI display inline and
// main the two-column canvas puts the reference cards in a column at lyra's
// max card width (--lyra-size-card-max-width) on the main column's right
// edge, docked while it fits and an overlay behind the record header's
// "Summaries" toggle when it doesn't; "stacked" keeps one column. Contact
// Details' tab set follows the mode. Layout and widths, so Chrome.

type Ai = { displayLocation: "inline" | "panel" | "main"; canvasLayout: "stacked" | "twoColumn" };

async function setUp(page: Page, ai: Ai, width = 1600) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript((value) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true } }));
  }, ai);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  // Noah Patel's seeded email (it loads as a card; let it settle before selecting it).
  const card = page.locator("aside [aria-label^='Noah Patel']").first();
  await card.waitFor();
  await page.waitForTimeout(500);
  await card.click({ force: true });
  await expect(page.locator("[data-main-thread]")).toBeVisible();
  await page.waitForTimeout(500);
}

const action = (page: Page) => page.locator("[data-canvas-region=action]");
const reference = (page: Page) => page.locator("[data-canvas-region=reference]");
const summaries = (page: Page) => page.locator("[data-summaries-toggle]");
const box = async (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  }, selector);
/** The token, in px. */
const tokenWidth = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lyra-size-card-max-width")));
/** The row the action area and the column share. */
const row = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector("[data-canvas-region=action]")!.parentElement!.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  });

for (const displayLocation of ["inline", "main"] as const) {
  test(`${displayLocation}, two columns: the reference column is docked at the token's width on the main column's right edge`, async ({ page }) => {
    // Under "main" the card's email opens in the docked panel too, so give it room.
    await setUp(page, { displayLocation, canvasLayout: "twoColumn" }, displayLocation === "main" ? 2200 : 1600);
    await expect(reference(page)).toHaveAttribute("data-docked", "true");
    await expect(summaries(page)).toHaveCount(0);
    const token = await tokenWidth(page);
    expect(token).toBeGreaterThan(0);
    const col = await box(page, "[data-canvas-region=reference]");
    const r = await row(page);
    const act = await box(page, "[data-canvas-region=action]");
    expect(Math.round(col.width)).toBe(Math.round(token));
    expect(Math.round(col.right)).toBe(Math.round(r.right));
    // Side by side: the action area takes the rest.
    expect(Math.round(act.right)).toBeLessThanOrEqual(Math.round(col.left));
    expect(Math.round(act.width + col.width)).toBe(Math.round(r.width));
    await expect(reference(page).locator("[data-canvas-cell=customer-info]")).toBeVisible();
  });

  test(`${displayLocation}, stacked: no reference column; the action area spans the row`, async ({ page }) => {
    await setUp(page, { displayLocation, canvasLayout: "stacked" });
    await expect(reference(page)).toHaveCount(0);
    await expect(summaries(page)).toHaveCount(0);
    const act = await box(page, "[data-canvas-region=action]");
    const r = await row(page);
    expect(Math.round(act.width)).toBe(Math.round(r.width));
    await expect(action(page).locator("[data-canvas-cell=customer-info]")).toBeVisible();
  });
}

test("narrow: the column becomes the Summaries overlay; outside click and its close button close it", async ({ page }) => {
  // 1000px: the row (~730px) is under the action area's minimum plus the column.
  await setUp(page, { displayLocation: "inline", canvasLayout: "twoColumn" }, 1000);
  await expect(summaries(page)).toBeVisible();
  await expect(reference(page)).not.toHaveAttribute("data-docked", "true");
  const before = await box(page, "[data-canvas-region=action]");
  const r = await row(page);
  // Closed: the action area keeps the whole row.
  expect(Math.round(before.width)).toBe(Math.round(r.width));
  await summaries(page).click();
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400);
  const col = await box(page, "[data-canvas-region=reference]");
  expect(Math.round(col.width)).toBe(Math.round(await tokenWidth(page)));
  expect(Math.round(col.right)).toBe(Math.round(r.right));
  // Over the action area, not beside it: the action area didn't shrink.
  expect(Math.round((await box(page, "[data-canvas-region=action]")).width)).toBe(Math.round(before.width));
  // Outside click closes it.
  await page.mouse.click(before.left + 40, 300);
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(400);
  expect(Math.round((await box(page, "[data-canvas-region=reference]")).width)).toBe(0);
  // So does its close button.
  await summaries(page).click();
  await reference(page).getByRole("button", { name: "Close panel" }).click();
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "false");
});

test("main with the card's thread open in the docked panel: the column is the overlay at a width where inline docks it", async ({ page }) => {
  // 1300px: inline's row (~1030px) docks the column; under main the open thread panel leaves ~690px.
  await setUp(page, { displayLocation: "main", canvasLayout: "twoColumn" }, 1300);
  await expect(page.locator("[data-slot=right-panel][data-open=true]")).toBeVisible();
  await expect(summaries(page)).toBeVisible();
  await summaries(page).click();
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "true");
});

for (const [displayLocation, tabs] of [
  ["inline", ["Customer Information", "Notes", "Detail", "Transcript", "Session"]],
  ["main", ["Customer Information", "Notes", "Detail", "Transcript", "Session"]],
  ["panel", ["Overview", "Customer Information", "Notes", "Detail", "Transcript", "Session"]],
] as const) {
  test(`${displayLocation}: Contact Details' tab set`, async ({ page }) => {
    await setUp(page, { displayLocation, canvasLayout: "twoColumn" }, 2200);
    const panel = page.locator("[data-slot=right-panel]");
    if ((await panel.getAttribute("data-thread")) !== "details" || (await panel.getAttribute("data-open")) !== "true") {
      await page.getByRole("button", { name: /Contact Details$/ }).first().click();
    }
    await expect(panel).toHaveAttribute("data-thread", "details");
    await expect(panel.locator("[data-slot=contact-details-tabs] [role=tab]")).toHaveText([...tabs]);
  });
}
