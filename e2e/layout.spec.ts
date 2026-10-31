import { expect, test, type Page } from "@playwright/test";

// P-LAYOUT: the slot containers in a real browser — what pushes, what overlays, where a toggle sits. Widths and
// overlap, so Chrome.

async function setUp(page: Page, assignments: Record<string, unknown>, width = 2400) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(
    ({ assignments }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 2, value: assignments }));
      localStorage.setItem(
        "agent-next-gen:settings:channels",
        JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true, whatsapp: true } }),
      );
    },
    { assignments },
  );
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

const panel = (page: Page) => page.locator("[data-slot=assignments-panel]");
const toggle = (page: Page) => page.locator("[data-slot=assignments-panel-toggle]").getByRole("button", { name: "Show assignments" });
/** The content column: the content card's row's last flex child before any docked right panel — Home's own root here. */
const homeBox = async (page: Page) => (await page.locator("[data-home-layout]").first().boundingBox())!;

test("fix (a): pinned, the interior panel pushes the content; unpinned, it overlays it and the toggle shows", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" });
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
  const pinned = (await panel(page).boundingBox())!;
  const pushed = await homeBox(page);
  // Pinned: the content starts after the panel.
  expect(Math.round(pushed.x)).toBeGreaterThanOrEqual(Math.round(pinned.x + pinned.width) - 1);
  await expect(toggle(page)).toHaveCount(0);

  await panel(page).getByRole("button", { name: "Unpin panel" }).click();
  await expect(panel(page)).not.toHaveAttribute("data-docked", "true");
  // Unpinned: the content moves back under the panel (only the toggle's strip before it), and the panel lies over it.
  await expect.poll(async () => (await homeBox(page)).x).toBeLessThan(pushed.x);
  const overlay = (await panel(page).boundingBox())!;
  const under = await homeBox(page);
  expect(Math.round(overlay.x + overlay.width)).toBeGreaterThan(Math.round(under.x));
  // The open overlay covers the strip, so its button waits until the panel is closed.
  await expect(toggle(page)).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Close panel" }).click();
  await expect(toggle(page)).toBeVisible();
});

test("fix (a): a dragged width is kept across a reload, within 350–425", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" });
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
  const before = (await panel(page).boundingBox())!;
  const handle = (await panel(page).locator('[role="separator"]').first().boundingBox())!;
  // The handle's 8px strip is half outside the panel, which clips it: its centre is the content card's, so grab its
  // inner half.
  const grabX = handle.x + handle.width * 0.25;
  await page.mouse.move(grabX, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(grabX + 50, handle.y + handle.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await panel(page).boundingBox())!.width)).toBeGreaterThan(Math.round(before.width));
  const dragged = Math.round((await panel(page).boundingBox())!.width);
  expect(dragged).toBeLessThanOrEqual(425);
  // Saved once the drag settles.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("agent-next-gen:working:assignments") ?? "{}").panelWidth)).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
  await expect.poll(async () => Math.round((await panel(page).boundingBox())!.width)).toBe(dragged);
});

test("fix (a): the close hides the panel, the content takes its room, and the toggle at the card's top start brings it back", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" });
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
  const pushed = await homeBox(page);
  await panel(page).getByRole("button", { name: "Close panel" }).click();
  await expect(toggle(page)).toBeVisible();
  await expect.poll(async () => (await homeBox(page)).x).toBeLessThan(pushed.x);
  const card = (await page.locator("[data-slot=content-card]").boundingBox())!;
  const t = (await toggle(page).boundingBox())!;
  // The toggle sits at the content card's top start.
  expect(t.x - card.x).toBeLessThan(24);
  expect(t.y - card.y).toBeLessThan(24);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  // Kept per browser: still closed after a reload.
  await page.reload();
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(toggle(page)).toBeVisible();
  await toggle(page).click();
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
});

test("Settings → Layout: dragging the voice controls into the Left nav list moves the live call's bar there, and the legacy setting follows", async ({ page }) => {
  await setUp(page, {});
  // Maya Chen (dev hotkey B) connects at once; her bar starts at the bottom.
  await page.keyboard.press("b");
  await expect(page.locator("aside").getByText("Maya Chen").first()).toBeVisible({ timeout: 15_000 });
  const navBar = page.locator("[data-slot=left-nav-voice] [data-slot=voice-bar]");
  const bottomBar = page.locator("[data-slot=voice-bar-bottom] [data-slot=voice-bar]");
  await expect(bottomBar).toBeVisible({ timeout: 10_000 });

  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  // Tall enough for the Left nav list and the Bottom dock list together.
  await page.setViewportSize({ width: 2400, height: 2000 });
  const layout = page.locator("[data-settings-group=layout]");
  await layout.getByRole("button", { name: /Advanced/ }).click();
  const voiceRow = layout.locator('[data-layout-part="voiceBar"]');
  await expect(voiceRow).toBeVisible();
  // Until the accordion's open animation ends its content clips (overflow-hidden), and scrolling to a row scrolls
  // that box instead of the page: a drag started then misses. Wait for it to settle.
  await expect
    .poll(() => voiceRow.evaluate((el) => el.closest<HTMLElement>(".overflow-hidden[data-state=open]")?.getAnimations().length ?? -1))
    .toBe(0);
  // A real pointer drag, both lists on screen: a drag that has to scroll the page part-way never reaches the list.
  const target = layout.locator('[data-layout-slot="left-nav"] ul');
  // The target list at the top of the view, so the Bottom dock list below it is on screen too.
  await target.evaluate((el) => el.scrollIntoView({ block: "start" }));
  const from = (await voiceRow.locator("svg").first().boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x + 40 - from.x) * i) / steps, from.y + ((to.y + to.height - 8 - from.y) * i) / steps);
  }
  await page.mouse.up();

  await expect(layout.locator('[data-layout-slot="left-nav"] [data-layout-part="voiceBar"]')).toBeVisible();
  await expect(navBar).toBeVisible();
  await expect(page.locator("[data-slot=voice-bar]")).toHaveCount(1);
  // The preview and the legacy setting (Settings → Voice) follow.
  await expect(layout.locator('[data-layout-preview] [data-preview-slot="left-nav"] [data-preview-part="voiceBar"]')).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Voice controls location" })).toContainText("Top of left nav");
  await expect(layout.locator('[data-layout-preset="voice.controlsLocation"]').getByRole("radio", { name: "Top of left nav" })).toHaveAttribute("aria-checked", "true");
});
