import { expect, test, type Page } from "@playwright/test";

// White-labeling (P-AIFIRST): Settings → Appearance. An uploaded logo and a
// new app name show in the header (and the tab title); a brand primary
// recolors lyra's primary through its CSS variables (computed styles, so
// Chrome, not jsdom).

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

for (const theme of ["light", "dark"] as const) {
  test(`a brand primary changes a primary Button's computed background (${theme})`, async ({ page }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem(
        "agent-next-gen:settings:appearance",
        JSON.stringify({ v: 1, value: { theme, brand: { appName: "", logo: null, colors: { primary: "#c2185b", accent: null } } } }),
      );
    }, theme);
    await page.goto("?provider=sim&latency=off#/agent-advanced");
    // The welcome modal's "Go Available" is a primary (default) Button.
    const button = page.getByRole("button", { name: "Go Available" });
    await expect(button).toBeVisible();
    await expect(button).toHaveCSS("background-color", "rgb(194, 24, 91)");
    await expect(button).toHaveCSS("color", "rgb(255, 255, 255)");
  });
}

test("a primary typed in Settings reaches the header; Reset colors restores lyra's", async ({ page }) => {
  await openAppearance(page);
  await page.getByLabel("Primary (hex)").fill("#c2185b");
  const headerPrimary = () =>
    page.locator("header").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--lyra-color-bg-primary").trim().toLowerCase());
  await expect.poll(headerPrimary).toBe("#c2185b");
  await page.getByRole("button", { name: "Reset colors" }).click();
  await expect.poll(headerPrimary).toBe("#166cca");
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
