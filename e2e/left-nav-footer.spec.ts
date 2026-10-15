import { expect, test } from "@playwright/test";

// "New Outbound at the bottom": the left-nav footer is a column — Home, then
// Settings, then the full-width launcher below them. lyra's footer slot is a
// flex row, so the page must stack them itself; jsdom can't see this.
test("New Outbound at the bottom stacks under Home and Settings, full width", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 1, value: { newOutboundAtBottom: true } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();

  const footer = page.locator("aside [data-slot=left-nav-footer]");
  const home = footer.getByText("Home", { exact: true });
  const settings = footer.getByText("Settings", { exact: true });
  const launcher = footer.getByRole("button", { name: /New Outbound/ });
  await expect(launcher).toBeVisible();

  const [homeBox, settingsBox, launcherBox, footerBox] = await Promise.all(
    [home, settings, launcher, footer].map(async (l) => (await l.boundingBox())!)
  );
  // Home above Settings, Settings above the launcher: no shared row.
  expect(settingsBox.y).toBeGreaterThanOrEqual(homeBox.y + homeBox.height - 1);
  expect(launcherBox.y).toBeGreaterThanOrEqual(settingsBox.y + settingsBox.height - 1);
  // The launcher spans the footer's width.
  expect(launcherBox.width).toBeGreaterThanOrEqual(footerBox.width - 1);
});
