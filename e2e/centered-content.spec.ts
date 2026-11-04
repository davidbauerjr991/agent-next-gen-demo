import { expect, test, type Page } from "@playwright/test";

// P-LAYOUT-F3 13: the main column is a max-width column centred in the width available to it — the content card less
// whatever is open beside it (the reference column, the docked panels, the Contact Details slide-over). Opening a panel
// that fits re-centres the column in what's left; one that doesn't fit overlays and leaves it alone. Measured on an
// interaction's transcript column (`CenteredColumn`) against the action area, the row's remainder. Widths, so Chrome.

async function mayaOpen(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "inline", canvasLayout: "twoColumn" } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.keyboard.press("b");
  await page.locator("[data-slot=assignment-card]").getByText("Maya Chen").first().click();
  await expect(page.locator("[data-canvas-region=action] [data-centered-column=action]").first()).toBeVisible({ timeout: 15_000 });
}

/** The centred column's centre and the action area's (the available width), in px, and the action area's right edge
 *  against what's beside it: the reference column's left edge (it sits at the card's trailing edge), and the docked
 *  slide-over's left edge when one is in the page's right host. */
async function centres(page: Page) {
  return page.evaluate(() => {
    const action = document.querySelector("[data-canvas-region=action]")!.getBoundingClientRect();
    const column = [...document.querySelectorAll("[data-canvas-region=action] [data-centered-column=action]")]
      .map((el) => el.getBoundingClientRect())
      .find((r) => r.width > 0)!;
    const reference = document.querySelector("[data-canvas-region=reference][data-docked=true]")?.getBoundingClientRect();
    const docked = document.querySelector("[data-slot=page-right-host] [data-slot=reference-slide-over]")?.getBoundingClientRect();
    const card = document.querySelector("[data-slot=content-card]")!.getBoundingClientRect();
    return {
      column: column.left + column.width / 2,
      available: action.left + action.width / 2,
      columnWidth: column.width,
      availableWidth: action.width,
      actionRight: action.right,
      referenceLeft: reference?.left,
      referenceRight: reference?.right,
      dockedLeft: docked?.left,
      cardRight: card.right,
    };
  });
}

async function openContactDetails(page: Page) {
  await page.locator("button[data-contact-details]").first().click();
  await expect(page.locator("[data-slot=reference-slide-over]")).toBeVisible();
}

/** Waits out the push: the column's centre settles on the available width's (no fixed sleep). */
async function settled(page: Page) {
  await expect.poll(async () => {
    const c = await centres(page);
    return Math.abs(c.column - c.available) <= 1;
  }).toBe(true);
  return centres(page);
}

test("fits without a panel: the column is centred in the action area, at its 768px cap", async ({ page }) => {
  await mayaOpen(page, 2400);
  const c = await settled(page);
  expect(Math.round(c.columnWidth)).toBe(768);
  // The available width is the card less the reference column, which sits at the card's trailing edge.
  expect(Math.abs(c.actionRight - c.referenceLeft!)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.referenceRight! - c.cardRight)).toBeLessThanOrEqual(2);
});

test("with a reference column, Contact Details opens over the column (P-LAYOUT-F4 3): the action area and its centred column stay put", async ({ page }) => {
  await mayaOpen(page, 2400);
  const before = await settled(page);
  await openContactDetails(page);
  // The column's own slide-over, not a panel beside the page column.
  await expect(page.locator("[data-slot=page-right-host] [data-slot=reference-slide-over]")).toHaveCount(0);
  await page.waitForTimeout(500);
  const after = await settled(page);
  expect(Math.round(after.availableWidth)).toBe(Math.round(before.availableWidth));
  expect(Math.round(after.column)).toBe(Math.round(before.column));
  // Over the column: the same right edge and width as the column it covers.
  const [col, so] = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    return [r("[data-canvas-region=reference]"), r("[data-slot=reference-slide-over]")].map((b) => ({ left: b.left, right: b.right }));
  });
  expect(Math.abs(so.right - col.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(so.left - col.left)).toBeLessThanOrEqual(1);
});

// P-LAYOUT-F3 3: Home's body under home.contentWidth — max: the 1024px column centred in the page column; full: the
// page column's width. The header is full width either way.
test("Home: Max centres the body at 1024px in the page column; Full stretches it; the header spans the page", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  const body = page.locator("[data-home-content]");
  await expect(body).toBeVisible();
  // The content column (`CenteredColumn`) inside the dashboard's scroller; the scroller spans the page column, so its
  // scrollbar is at the page's edge.
  const measure = () =>
    page.evaluate(() => {
      const b = document.querySelector("[data-home-content]")!.getBoundingClientRect();
      const scroller = document.querySelector("[data-home-layout]")!.getBoundingClientRect();
      const col = document.querySelector("[data-home-body]")!.parentElement!.getBoundingClientRect();
      const header = document.querySelector("[data-home-header]")!.getBoundingClientRect();
      return {
        bodyWidth: b.width,
        bodyCentre: b.left + b.width / 2,
        scrollerWidth: scroller.width,
        colWidth: col.width,
        colCentre: col.left + col.width / 2,
        headerWidth: header.width,
      };
    });
  const max = await measure();
  expect(Math.round(max.bodyWidth)).toBe(1024);
  expect(Math.abs(max.bodyCentre - max.colCentre)).toBeLessThanOrEqual(1);
  expect(Math.round(max.scrollerWidth)).toBe(Math.round(max.colWidth));
  expect(Math.round(max.headerWidth)).toBe(Math.round(max.colWidth));
  // Settings → Layout → Home content width: Full.
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await page.locator('[data-layout-preset="home.contentWidth"]').getByRole("radio", { name: "Full" }).click();
  await page.locator("aside").getByText("Home", { exact: true }).first().click();
  await expect(body).toBeVisible();
  const full = await measure();
  // Full: the content takes the scroller's width (less its own padding).
  expect(full.bodyWidth).toBeGreaterThan(max.bodyWidth);
  expect(Math.round(full.scrollerWidth)).toBe(Math.round(full.colWidth));
  expect(Math.round(full.headerWidth)).toBe(Math.round(full.colWidth));
});

test("doesn't fit: the slide-over overlays, and the column stays where it was", async ({ page }) => {
  await mayaOpen(page, 1350);
  const before = await settled(page);
  await openContactDetails(page);
  await expect(page.locator("[data-slot=page-right-host] [data-slot=reference-slide-over]")).toHaveCount(0);
  await page.locator("[data-slot=reference-slide-over]").getByRole("button", { name: /^Close / }).waitFor();
  const after = await settled(page);
  expect(Math.abs(after.column - before.column)).toBeLessThanOrEqual(1);
});
