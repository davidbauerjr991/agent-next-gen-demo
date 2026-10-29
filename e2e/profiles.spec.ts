import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// P-PROFILES: saved workspace profiles on the Settings page — Save as, Export
// as a real file download, Import of that file on a fresh workspace, and a
// locked section greyed with "Set by your team profile". (The store refusing
// writes and the import's field-by-field fallback are covered in vitest.)

async function openSettings(page: Page) {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await expect(page.getByRole("combobox", { name: "Profile" })).toBeVisible();
}

// The Assignments group (P-HOME-1n: Settings is grouped; its own legend is the group's first child).
const assignmentsSection = (page: Page) => page.locator('[data-settings-group="assignments"]');

test("Save as, Export and Import: the file round-trips the profile, and its locks grey the section", async ({ page, context }) => {
  await openSettings(page);
  // Change an agent setting (reads Custom), then save it as a profile.
  await assignmentsSection(page).getByText("Confirm before closing a contact").click();
  await expect(page.getByRole("combobox", { name: "Profile" })).toHaveText("Custom");
  await page.getByRole("button", { name: "Save as…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Profile name").fill("Billing team");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("combobox", { name: "Profile" })).toHaveText("Billing team");

  // Lock Assignments, then export.
  await page.getByRole("button", { name: "Profile actions" }).click();
  await page.getByRole("menuitem", { name: "Locks…" }).click();
  await page.getByRole("dialog").getByText("Assignments", { exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Profile actions" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Export" }).click()]);
  expect(download.suggestedFilename()).toBe("Billing-team.profile.json");
  const file = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(file.kind).toBe("agent-workspace-profile");
  expect(file.locks).toEqual(["assignments"]);
  expect(file.sections.assignments.value.confirmClose).toBe(true);
  expect(file.sections.phone).toBeUndefined();

  // A fresh workspace (new storage): import the file and apply it.
  const fresh = await context.browser()!.newPage();
  await openSettings(fresh);
  await fresh.locator("[data-slot=profile-import-input]").setInputFiles((await download.path())!);
  await expect(fresh.getByRole("dialog")).toContainText("Profile imported");
  await fresh.getByRole("dialog").getByRole("button", { name: "Apply" }).click();
  await expect(fresh.getByRole("combobox", { name: "Profile" })).toHaveText("Billing team");
  // Assignments is locked: greyed, labeled, its controls disabled.
  const locked = assignmentsSection(fresh);
  await expect(locked.locator(":scope > legend")).toContainText("Set by your team profile");
  await expect(locked.getByRole("switch").first()).toBeDisabled();
  // Unlocked sections stay editable.
  const header = fresh.locator("fieldset").filter({ has: fresh.locator("legend", { hasText: /^Header/ }) });
  await expect(header.getByRole("switch").first()).toBeEnabled();
  await fresh.close();
});

test("Save writes a change back into the saved profile: modified, Save, reload, then the profile applies the new value", async ({ page }) => {
  await openSettings(page);
  const picker = page.getByRole("combobox", { name: "Profile" });
  const headerSwitch = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^Header/ }) }).getByRole("switch").first();
  const saveButton = page.locator("[data-slot=profile-save]");

  // A saved profile with confirm-before-closing on.
  await assignmentsSection(page).getByText("Confirm before closing a contact").click();
  await page.getByRole("button", { name: "Save as…" }).click();
  await page.getByRole("dialog").getByLabel("Profile name").fill("Billing team");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(picker).toHaveText("Billing team");
  await expect(saveButton).toHaveCount(0);

  // Flip a Header switch: the picker reads modified, and Save appears.
  const before = await headerSwitch.isChecked();
  await headerSwitch.click();
  await expect(picker).toHaveText("Billing team · modified");
  await saveButton.click();
  await expect(picker).toHaveText("Billing team");
  await expect(saveButton).toHaveCount(0);

  // After a reload the saved profile still applies the new value.
  await page.reload();
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await expect(picker).toHaveText("Billing team");
  await expect(headerSwitch).toBeChecked({ checked: !before });
  await picker.click();
  await page.getByRole("option", { name: "Phase 1" }).click();
  await expect(picker).toHaveText("Phase 1");
  await picker.click();
  await page.getByRole("option", { name: "Billing team" }).click();
  await expect(picker).toHaveText("Billing team");
  await expect(headerSwitch).toBeChecked({ checked: !before });
});
