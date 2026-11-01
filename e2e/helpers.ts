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

/** A card-presenting Copilot result (one with an artifact: it opens on its own, its row reopens it) for `question`,
 *  for a spec whose way into the slide-over is an Ask Copilot question: a plain answer is an inline line with no row
 *  or slide-over (P-LAYOUT-F1 F). The e2e twin of src/test-utils/copilot-results.ts: the same card, the question's
 *  sim's answer read from the app through the dev-only `window.__copilotAnswers` and registered through
 *  `window.__copilotResults` (P-LAYOUT-F2 5b), not a copy; call it after the
 *  page has loaded. */
export async function registerCardResult(page: Page, question: string) {
  await page.waitForFunction(() => !!window.__copilotResults && !!window.__copilotAnswers);
  await page.evaluate((q) => {
    window.__copilotResults!.register(q, { ...window.__copilotAnswers!.placeholder(q), artifact: { kind: "panel" } });
  }, question);
}
