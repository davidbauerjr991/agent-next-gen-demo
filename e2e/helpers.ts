import { expect, type Page } from "@playwright/test";

/** Opens Advanced with AI display = panel (set before load), goes Available,
 *  plays Lucas Thomas (dev hotkey A) and waits for his approval request. */
export async function lucasInPanelMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "panel" } }));
  });
  // `?provider`/`?latency` are read from location.search, before the hash route.
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.keyboard.press("a");
  await page.getByText("Lucas Thomas").first().click();
  await expect(page.getByText("How would you like to proceed?")).toBeVisible({ timeout: 30_000 });
}

/** The Overview body's scroll container: the scrolling ancestor of the
 *  Details body (lyra `PanelContent`). */
export function overviewScroller(page: Page) {
  return page
    .locator("[data-slot=details-panel-body]")
    .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' overflow-y-auto ')][1]");
}

export async function scrollMetrics(page: Page) {
  return overviewScroller(page).evaluate((el) => ({ top: el.scrollTop, client: el.clientHeight, height: el.scrollHeight }));
}
