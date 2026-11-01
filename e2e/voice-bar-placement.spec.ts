import { expect, test, type Page } from "@playwright/test";

// E1 (P-EXTRACT browser check): with Voice controls location (then under Settings → Voice) "Top of
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
  // Her card, in the left nav or the interior panel.
  await expect(page.locator("[data-slot=assignment-card]").getByText("Maya Chen").first()).toBeVisible({ timeout: 15_000 });
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
    // Settings → Layout's preset row, the setting's one place (P-LAYOUT-F1 E).
    const preset = page.locator('[data-layout-preset="voice.controlsLocation"]');
    await preset.getByRole("radio", { name: "Bottom" }).click();
    await expect(bottomBar(page)).toBeVisible();
    await expect(anyBar(page)).toHaveCount(1);
    await preset.getByRole("radio", { name: "Top of assignments" }).click();
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

// P-LAYOUT-F2 2: at the top of the assignments list, in the left nav and in the interior panel, the bar takes the
// cards' inset (its edges are theirs) and stays put while the cards scroll under it.
for (const placement of ["leftNav", "interiorPanel"] as const) {
  test(`Top of assignments (${placement}): the bar's edges are the cards', and the list scrolls under it`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 560 });
    await page.addInitScript((placement) => {
      localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 2, value: { placement } }));
      localStorage.setItem(
        "agent-next-gen:settings:channels",
        JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true, whatsapp: true } }),
      );
    }, placement);
    await mayaLive(page, "inline", "top");
    const container = placement === "leftNav" ? "aside" : "[data-slot=assignments-panel]";
    const bar = page.locator(`${container} [data-slot=voice-bar]`);
    await expect(bar).toBeVisible({ timeout: 10_000 });
    const cards = page.locator(`${container} [data-slot=assignment-card]`);
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(500);
    const b = (await bar.boundingBox())!;
    const c = (await cards.first().boundingBox())!;
    expect(Math.abs(b.x - c.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.x + b.width - (c.x + c.width))).toBeLessThanOrEqual(1);
    // Scroll the list: the bar's top doesn't move; the cards do.
    const scrolled = await cards.first().evaluate((el) => {
      let p: HTMLElement | null = el.parentElement;
      while (p && !(getComputedStyle(p).overflowY === "auto" && p.scrollHeight > p.clientHeight)) p = p.parentElement;
      if (!p) return false;
      p.scrollTop = p.scrollHeight;
      return true;
    });
    expect(scrolled).toBe(true);
    await page.waitForTimeout(200);
    expect(Math.round((await bar.boundingBox())!.y)).toBe(Math.round(b.y));
    expect((await cards.first().boundingBox())!.y).toBeLessThan(c.y);
  });
}
