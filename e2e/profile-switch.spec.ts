import { expect, test, type Page } from "@playwright/test";

// Profiles are picked in Settings (P-AIFIRST: the app-name menu has no
// profile entries). Applying one stays on Advanced; the header title is the
// brand name with no profile suffix; Desk's old route redirects here on
// Phase 2. (That applying a profile re-renders Home in place, without a
// remount, is covered in jsdom: settings-wiring.test.tsx.)

async function pickProfile(page: Page, label: string) {
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await page.getByRole("combobox", { name: "Profile" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Profile" })).toHaveText(label);
  await page.locator("aside").getByText("Home", { exact: true }).first().click();
}

test("the Settings picker applies Phase 2 and AI-first, and Phase 1 again; the title stays the brand name", async ({ page }) => {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.locator("[data-slot=brand-mark]")).toHaveText("Workspace");
  await expect(page.locator("[data-slot=home-tabs]")).toHaveCount(0);

  await pickProfile(page, "Phase 2");
  await expect(page).toHaveURL(/#\/agent-advanced$/);
  const tabs = page.locator("[data-slot=home-tabs] [role=tab]");
  await expect(tabs).toHaveText(["Dashboard", "Customers", "Accounts", "Tickets"]);
  await expect(page.locator("[data-slot=brand-mark]")).toHaveText("Workspace");

  await pickProfile(page, "AI-first");
  await expect(tabs).toHaveText(["Dashboard", "Customers", "Accounts", "Tickets"]);

  await pickProfile(page, "Phase 1");
  await expect(page.locator("[data-slot=home-tabs]")).toHaveCount(0);
});

test("Desk's old route lands on Advanced with the Phase 2 profile", async ({ page }) => {
  await page.goto("?provider=sim&latency=off#/agent-premium");
  await expect(page).toHaveURL(/#\/agent-advanced$/);
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.locator("[data-slot=home-tabs]")).toBeVisible();
  await expect(page.locator("[data-slot=brand-mark]")).toHaveText("Workspace");
});
