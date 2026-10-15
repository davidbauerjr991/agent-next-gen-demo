import { expect, test } from "@playwright/test";

// One workspace (P0.5d.2): the app menu's Phase 1 / Phase 2 apply a profile
// and stay on Advanced. The header and Home update in place, with no reload
// and no remount; Desk's old route redirects here on Phase 2.
test("the app menu's Phase 2 stays on Advanced and updates the header and Home in place", async ({ page }) => {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();

  const dashboard = page.locator("[data-home-section]").first();
  await expect(dashboard).toBeVisible();
  // Tag the Dashboard node: a remount would replace it, a re-render keeps it.
  await dashboard.evaluate((el) => el.setAttribute("data-e2e-marker", "kept"));
  await expect(page.locator("[data-slot=home-tabs]")).toHaveCount(0);

  await page.getByText("Agent Workspace 2.0 | Phase 1", { exact: true }).first().click();
  await page.getByText("Agent Workspace 2.0 | Phase 2", { exact: true }).last().click();

  await expect(page).toHaveURL(/#\/agent-advanced$/);
  await expect(page.getByText("Agent Workspace 2.0 | Phase 2", { exact: true }).first()).toBeVisible();
  const tabs = page.locator("[data-slot=home-tabs] [role=tab]");
  await expect(tabs).toHaveText(["Dashboard", "Customers", "Accounts", "Tickets"]);
  await expect(page.locator("[data-e2e-marker=kept]")).toHaveCount(1);

  // Back to Phase 1: the tabs go, still in place.
  await page.getByText("Agent Workspace 2.0 | Phase 2", { exact: true }).first().click();
  await page.getByText("Agent Workspace 2.0 | Phase 1", { exact: true }).last().click();
  await expect(page.locator("[data-slot=home-tabs]")).toHaveCount(0);
  await expect(page.locator("[data-e2e-marker=kept]")).toHaveCount(1);
});

test("Desk's old route lands on Advanced with the Phase 2 profile", async ({ page }) => {
  await page.goto("?provider=sim&latency=off#/agent-premium");
  await expect(page).toHaveURL(/#\/agent-advanced$/);
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.getByText("Agent Workspace 2.0 | Phase 2", { exact: true }).first()).toBeVisible();
  await expect(page.locator("[data-slot=home-tabs]")).toBeVisible();
});
