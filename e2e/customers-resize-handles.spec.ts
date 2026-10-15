import { expect, test, type Page } from "@playwright/test";

// The Customers page (Customers placed in the left nav): the table's
// column-resize handles stay inside the main content container. A handle the
// table has scrolled out of view is clipped, so the check is on what
// actually paints (`elementFromPoint` at the handle's center): every painted
// handle lies inside the page, and none paints over the left nav, including
// the nav's hover overlay at narrow widths (the original bug: lyra's z-10
// handles painted over it).
async function openCustomersPage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "agent-next-gen:settings:header",
      JSON.stringify({ v: 2, value: { apps: { customers: { enabled: true, placement: "leftnav" } } } }),
    );
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.locator("aside").getByText("Customers", { exact: true }).first().click();
  await expect(page.locator("[data-slot=left-nav-page] table")).toBeVisible();
}

async function paintedHandles(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("[data-slot=left-nav-page]")!.getBoundingClientRect();
    // The nav's painted extent: its hover overlay is a wider panel inside
    // the rail's own (narrow) box, so take the rightmost visible element.
    const aside = document.querySelector("aside")!;
    const navRight = Math.max(
      aside.getBoundingClientRect().right,
      ...[...aside.querySelectorAll("*")]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => r.right),
    );
    const nav = { x: aside.getBoundingClientRect().x, right: navRight };
    const handles = [...document.querySelectorAll("[data-slot=left-nav-page] .cursor-col-resize")].map((h) => {
      const r = h.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { left: r.x, right: r.right, painted: !!hit && (hit === h || h.contains(hit)) };
    });
    return { main: { left: main.x, right: main.right }, nav: { left: nav.x, right: nav.right }, handles };
  });
}

async function expectHandlesInside(page: Page) {
  const { main, nav, handles } = await paintedHandles(page);
  expect(handles.length).toBeGreaterThan(0);
  const painted = handles.filter((h) => h.painted);
  expect(painted.length).toBeGreaterThan(0);
  for (const h of painted) {
    expect(h.left, "painted handle inside the page (left)").toBeGreaterThanOrEqual(main.left - 0.5);
    expect(h.right, "painted handle inside the page (right)").toBeLessThanOrEqual(main.right + 0.5);
    expect(h.left >= nav.right - 0.5 || h.right <= nav.left + 0.5, "painted handle clear of the left nav").toBe(true);
  }
}

test("Customers page: the column-resize handles stay inside the main content container", async ({ page }) => {
  await openCustomersPage(page);
  await expectHandlesInside(page);
});

test("Customers page at a narrow width: the handles stay inside too", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await openCustomersPage(page);
  await expectHandlesInside(page);
});

test("Customers page with the left nav's hover overlay open: no handle paints over it", async ({ page }) => {
  // Opened wide (the rail's labels show), then narrowed: the nav becomes a
  // rail that opens as an overlay on hover.
  await openCustomersPage(page);
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForTimeout(600);
  await page.mouse.move(20, 300);
  await page.waitForTimeout(600);
  await expectHandlesInside(page);
});
