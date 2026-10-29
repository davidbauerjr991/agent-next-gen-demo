import { expect, test, type Page } from "@playwright/test";

// P-HOME-1n: reference cards show only when they have something and enter with the AI cards' enter when they fill.
// Maya Chen (dev hotkey B) is a repeat customer: Journey Summary and Customer Info from the start, the Real-Time
// Summary after her first summary turn.

async function setUp(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "inline", canvasLayout: "twoColumn" } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

const cells = (page: Page) =>
  page.locator("[data-canvas-region=reference] [data-canvas-cell]").evaluateAll((els) => els.map((el) => el.getAttribute("data-canvas-cell")));

test("an unknown contact arriving: Customer Info alone, its Link to existing customer", async ({ page }) => {
  await setUp(page);
  // The sim's customer side in dev (`window.__simCustomer`, until the P0.6 console): an inbound chat from an unknown
  // address (chat auto-accepts by default).
  await page.evaluate(() =>
    window.__simCustomer!.startInbound({ channel: "chat", address: "nobody@example.com", displayName: "nobody@example.com" }),
  );
  const card = page.locator("aside [aria-label^='nobody@example.com']").first();
  await card.click({ force: true });
  await expect.poll(() => cells(page)).toEqual(["customer-info"]);
  await expect(page.locator("[data-canvas-cell=customer-info]")).toContainText("Link to existing customer");
});

test("Maya at arrival: Journey Summary and Customer Info; the Real-Time Summary enters after her first summary turn", async ({ page }) => {
  await setUp(page);
  await page.keyboard.press("b");
  await page.locator("aside [aria-label^='Maya Chen']").first().click({ force: true });
  await expect.poll(() => cells(page)).toEqual(["journey-summary", "customer-info"]);
  await expect.poll(() => cells(page), { timeout: 10_000 }).toEqual(["real-time-summary", "journey-summary", "customer-info"]);
  await expect(page.locator("[data-canvas-cell=real-time-summary] .animate-in").first()).toBeAttached();
});
