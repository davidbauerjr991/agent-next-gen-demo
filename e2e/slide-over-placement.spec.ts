import { expect, test, type Page } from "@playwright/test";
import { lucasInPanelMode } from "./helpers";

// Where the interior slide-over (card links, Copilot results) sits. Inline:
// over the whole content card, from its top (over the record header) to its
// bottom edge. Panel: inside the Contact Details panel. Layout, so Chrome.

/** Lucas with AI display inline, his approval request up. */
async function lucasInline(page: Page) {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.keyboard.press("a");
  await page.getByText("Lucas Thomas").first().click();
  await expect(page.getByText("How would you like to proceed?")).toBeVisible({ timeout: 30_000 });
}

/** Opens "Purchase history" through its Copilot chip; resolves with the
 *  slide-over's box and the box of the container it's mounted in. */
async function openPurchaseHistory(page: Page, container: string) {
  // The chip row shows once the agent has the chat (none while the bot holds it).
  await page.getByRole("button", { name: /^Takeover/ }).first().click();
  await page.waitForTimeout(1_500);
  // Taken over, the inline composer opens on Chat with Customer; the chips are on its Ask Copilot side.
  const askCopilot = page.getByRole("radio", { name: "Ask Copilot" });
  if (await askCopilot.count()) await askCopilot.first().click();
  await page.locator("[data-slot=copilot-composer] [role=button]", { hasText: "Show purchase history" }).click();
  const close = page.getByRole("button", { name: "Close Purchase history" });
  await expect(close).toBeVisible({ timeout: 5_000 });
  // Let the slide-in finish before measuring.
  await page.waitForTimeout(600);
  return close.evaluate((button, selector) => {
    // The slide-over's outer element: the ancestor whose parent is the container.
    let el: HTMLElement | null = button as HTMLElement;
    while (el && !el.parentElement?.matches(selector)) el = el.parentElement;
    if (!el) return null;
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return { slideOver: box(el), container: box(el.parentElement!) };
  }, container);
}

test("inline: the slide-over covers the content card from its top to its bottom edge", async ({ page }) => {
  await lucasInline(page);
  const boxes = await openPurchaseHistory(page, "[data-slot=content-card]");
  expect(boxes, "the slide-over is a child of the content card").not.toBeNull();
  const { slideOver, container } = boxes!;
  expect(Math.abs(slideOver.top - container.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(slideOver.bottom - container.bottom)).toBeLessThanOrEqual(1);
  // Above the record header, not below it.
  const header = await page.locator("[data-main-thread]").boundingBox();
  expect(slideOver.top).toBeLessThan(header!.y);
});

test("panel: the slide-over stays within the Contact Details panel", async ({ page }) => {
  await lucasInPanelMode(page);
  const boxes = await openPurchaseHistory(page, "[data-slot=right-panel]");
  expect(boxes, "the slide-over is a child of the panel").not.toBeNull();
  const { slideOver, container } = boxes!;
  expect(slideOver.top).toBeGreaterThanOrEqual(container.top - 0.5);
  expect(slideOver.bottom).toBeLessThanOrEqual(container.bottom + 0.5);
  expect(slideOver.left).toBeGreaterThanOrEqual(container.left - 0.5);
  expect(slideOver.right).toBeLessThanOrEqual(container.right + 0.5);
});
