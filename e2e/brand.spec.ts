import { expect, test, type Page } from "@playwright/test";

// White-labeling (P-AIFIRST): Settings → Appearance. An uploaded logo and a
// new app name show in the header (and the tab title).

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function openAppearance(page: Page) {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await page.locator("[data-setting=brand]").scrollIntoViewIfNeeded();
}

test("an uploaded logo and a new app name appear in the header", async ({ page }) => {
  await openAppearance(page);
  await page.locator("[data-slot=logo-input]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("App name").fill("Acme Care");

  const mark = page.locator("[data-slot=brand-mark]");
  await expect(mark).toHaveText("Acme Care");
  await expect(mark.locator("img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(page).toHaveTitle("Acme Care");
});

test("an oversize logo is refused with a message", async ({ page }) => {
  await openAppearance(page);
  await page
    .locator("[data-slot=logo-input]")
    .setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(300 * 1024) });
  await expect(page.getByText("The logo must be 256 KB or smaller.")).toBeVisible();
  // Still the default mark (Vite inlines it as a plain SVG data URL; an
  // uploaded logo is stored base64).
  await expect(page.locator("[data-slot=brand-mark] img")).not.toHaveAttribute("src", /;base64,/);
});
