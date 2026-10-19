import { expect, test, type Page } from "@playwright/test";

// E1 (P-EXTRACT browser check): with Settings → Voice controls location "Top of
// left nav", a live call's voice bar rendered nowhere. Both slots (the left
// nav's and the bottom one) became active in the same commit on load; the
// bottom one took the bar's host, then gave it up when it deactivated, and the
// nav slot never took it back. The bar lives in one stable host node
// (`usePortalHost`), whichever `HostSlot` holds it.

const MODES = ["inline", "panel", "main"] as const;

async function mayaLive(page: Page, displayLocation: (typeof MODES)[number], controlsLocation: "top" | "bottom") {
  await page.addInitScript(
    ([display, controls]) => {
      localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: display } }));
      localStorage.setItem("agent-next-gen:settings:voice", JSON.stringify({ v: 1, value: { controlsLocation: controls } }));
    },
    [displayLocation, controlsLocation] as const
  );
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  // Maya Chen (dev hotkey B) connects at once.
  await page.keyboard.press("b");
  await expect(page.locator("aside").getByText("Maya Chen").first()).toBeVisible({ timeout: 15_000 });
}

const navBar = (page: Page) => page.locator("[data-slot=left-nav-voice] [data-slot=voice-bar]");
const bottomBar = (page: Page) => page.locator("[data-slot=voice-bar-bottom] [data-slot=voice-bar]");
const anyBar = (page: Page) => page.locator("[data-slot=voice-bar]");

for (const mode of MODES) {
  test(`AI display ${mode}: the voice bar shows in the left nav, moves to the bottom and back during the call`, async ({ page }) => {
    await mayaLive(page, mode, "top");
    await expect(navBar(page)).toBeVisible({ timeout: 10_000 });
    await expect(anyBar(page)).toHaveCount(1);
    await expect(navBar(page)).toHaveAttribute("data-placement", "top");

    // Collapse the nav: the nav slot goes, the bar falls back to the bottom; expand: back in the nav.
    await page.getByRole("button", { name: /collapse|toggle/i }).first().click();
    await expect(bottomBar(page)).toBeVisible();
    await expect(anyBar(page)).toHaveCount(1);
    await page.getByRole("button", { name: /expand|toggle/i }).first().click();
    await expect(navBar(page)).toBeVisible();
    await expect(anyBar(page)).toHaveCount(1);

    // Switch the setting during the call (Settings keeps the bar on screen).
    await page.locator("aside").getByText("Settings", { exact: true }).first().click();
    await expect(navBar(page)).toBeVisible();
    const select = page.getByRole("combobox", { name: "Voice controls location" });
    await select.click();
    await page.getByRole("option", { name: "Bottom" }).click();
    await expect(bottomBar(page)).toBeVisible();
    await expect(anyBar(page)).toHaveCount(1);
    await select.click();
    await page.getByRole("option", { name: "Top of left nav" }).click();
    await expect(navBar(page)).toBeVisible();
    await expect(anyBar(page)).toHaveCount(1);
  });

  test(`AI display ${mode}: the voice bar shows at the bottom with controls set to Bottom`, async ({ page }) => {
    await mayaLive(page, mode, "bottom");
    await expect(bottomBar(page)).toBeVisible({ timeout: 10_000 });
    await expect(anyBar(page)).toHaveCount(1);
  });
}

// The "timer beside the customer name" at the top of the nav is the voice bar's own header (name + running
// timer); the nav card itself is unchanged since before P-EXTRACT (its timer is on the voice row).
test("controls in the left nav: the bar's header shows Maya's name and a running call timer", async ({ page }) => {
  await mayaLive(page, "main", "top");
  await expect(navBar(page)).toContainText("Maya Chen", { timeout: 10_000 });
  await expect(navBar(page)).toContainText(/\d{2}:\d{2}/);
  const first = (await navBar(page).innerText()).match(/\d{2}:\d{2}/)?.[0];
  await expect.poll(async () => (await navBar(page).innerText()).match(/\d{2}:\d{2}/)?.[0], { timeout: 5_000 }).not.toBe(first);
});
