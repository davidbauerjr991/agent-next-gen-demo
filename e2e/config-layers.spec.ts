import { expect, test, type Page } from "@playwright/test";

// P-CONFIG-LAYERS: the sim's org tree in the browser. The agent persona's layers are inert but named ("Set by: Atlas
// team profile (primary)"); the supervisor persona's primary team locks Notifications read-only, and the Resolved
// settings view names that lock; switching back to Agent unlocks it.

async function openSettings(page: Page) {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
}

const group = (page: Page, id: string) => page.locator(`[data-settings-group=${id}]`);
const marker = (page: Page, id: string) => group(page, id).locator(":scope > legend [data-section-source]");
const resolvedRow = (page: Page, key: string) => page.locator(`[data-resolved-settings] [data-resolved-row='${key}']`);

test("the persona's org layers: named when inert, a lock read-only with its reason, the Resolved view, back to Agent", async ({ page }) => {
  await openSettings(page);
  // Playwright's enabled/disabled doesn't read a fieldset's own `disabled`: its attribute, and its controls.
  const firstSwitch = group(page, "notifications").getByRole("switch").first();
  await expect(marker(page, "notifications")).toHaveText("Set by: Atlas team profile (primary)");
  await expect(page.locator("[data-section-locked]")).toHaveCount(0);
  await expect(group(page, "notifications")).not.toHaveAttribute("disabled");
  await expect(firstSwitch).toBeEnabled();
  await expect(resolvedRow(page, "notifications.toasts")).toContainText("Set by: Atlas team profile (primary)");

  await page.getByRole("radio", { name: "Supervisor" }).click();
  await expect(marker(page, "notifications")).toHaveText("Locked by: Supervisors team profile");
  await expect(group(page, "notifications")).toHaveAttribute("disabled", "");
  await expect(firstSwitch).toBeDisabled();
  await expect(resolvedRow(page, "notifications.toasts")).toContainText("Locked by: Supervisors team profile");

  await page.getByRole("radio", { name: "Agent" }).click();
  await expect(marker(page, "notifications")).toHaveText("Set by: Atlas team profile (primary)");
  await expect(group(page, "notifications")).not.toHaveAttribute("disabled");
  await expect(firstSwitch).toBeEnabled();
});
