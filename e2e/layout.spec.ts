import { expect, test, type Locator, type Page } from "@playwright/test";

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
/** The page header's left toggle (lyra PageHeader `panelToggle`, P-LAYOUT-F1 A1): always in the header while the
 *  assignments are in the interior panel. */
const toggle = (page: Page) => page.locator("[aria-controls=assignments-panel]");
/** The content column: the content card's row's last flex child before any docked right panel — Home's own root here. */
const homeBox = async (page: Page) => (await page.locator("[data-home-layout]").first().boundingBox())!;

test("fix (a): pinned, the interior panel pushes the content; unpinned, hovering the toggle opens it over the content (lyra's flyout)", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" });
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
  const pinned = (await panel(page).boundingBox())!;
  const pushed = await homeBox(page);
  // Pinned: the content starts after the panel; the page header's toggle says it's open.
  expect(Math.round(pushed.x)).toBeGreaterThanOrEqual(Math.round(pinned.x + pinned.width) - 1);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

  // Unpinning closes it (as lyra's AdminShell does); the content takes the room back.
  await panel(page).getByRole("button", { name: "Unpin panel" }).click();
  await expect(panel(page)).not.toHaveAttribute("data-docked", "true");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await homeBox(page)).x).toBeLessThan(pushed.x);
  // Hovering the toggle opens it as a flyout over the content; leaving it and the panel closes it again.
  await toggle(page).hover();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(300);
  const overlay = (await panel(page).boundingBox())!;
  const under = await homeBox(page);
  expect(Math.round(overlay.x + overlay.width)).toBeGreaterThan(Math.round(under.x));
  await page.mouse.move(1200, 600);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
});

test("A1: pinned and closed, hovering the toggle shows nothing (a preview would cover the toggle); a click opens it docked", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" });
  await panel(page).getByRole("button", { name: "Close panel" }).click();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  // The panel's own width reaches 0 (its close transition is over) before the content's place is taken.
  const panelShown = () =>
    page.locator("[data-slot=assignments-panel], [data-slot=assignments-panel] [role=region]").evaluateAll((els) => Math.max(0, ...els.map((el) => el.getBoundingClientRect().width)));
  await expect.poll(panelShown).toBeLessThan(1);
  const closed = await homeBox(page);
  await toggle(page).hover();
  await page.waitForTimeout(400);
  // No preview: nothing of the panel shows, the toggle is still the element under the pointer, and the content
  // hasn't moved.
  expect(await panelShown()).toBeLessThan(1);
  const t = (await toggle(page).boundingBox())!;
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("[aria-controls=assignments-panel]"), { x: t.x + t.width / 2, y: t.y + t.height / 2 })).toBe(true);
  expect(Math.round((await homeBox(page)).x)).toBe(Math.round(closed.x));
  await toggle(page).click();
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
});

test("fix (a): a dragged width is kept across a reload, within 256–425", async ({ page }) => {
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

test("fix (a): the close hides the panel, the content takes its room, and the page header's toggle brings it back, clear of the nav's chevron", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" });
  await expect(panel(page)).toHaveAttribute("data-docked", "true");
  const pushed = await homeBox(page);
  await panel(page).getByRole("button", { name: "Close panel" }).click();
  await expect(toggle(page)).toBeVisible();
  await expect.poll(async () => (await homeBox(page)).x).toBeLessThan(pushed.x);
  const card = (await page.locator("[data-slot=content-card]").boundingBox())!;
  const t = (await toggle(page).boundingBox())!;
  // The toggle sits in the page header's own inset (lyra PageHeader's px-6), as AdminShell's does: past the left nav's
  // chevron, which hangs over the content card's edge.
  const chevron = (await page.locator("aside").getByRole("button", { name: /sidebar/ }).boundingBox())!;
  expect(t.x).toBeGreaterThan(chevron.x + chevron.width);
  expect(Math.round(t.x - card.x)).toBeGreaterThanOrEqual(24);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  // Kept per browser: still closed after a reload.
  await page.reload();
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(toggle(page)).toBeVisible();
  // Still closed (lyra L1b: StrictMode's second mount pass no longer reopens it).
  await page.waitForTimeout(500);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
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

  const layout = await openLayoutAdvanced(page);
  const voiceRow = layout.locator('[data-layout-part="voiceBar"]');
  await dragRow(page, voiceRow, layout.locator('[data-layout-slot="left-nav"] ul'));

  await expect(layout.locator('[data-layout-slot="left-nav"] [data-layout-part="voiceBar"]')).toBeVisible();
  await expect(navBar).toBeVisible();
  await expect(page.locator("[data-slot=voice-bar]")).toHaveCount(1);
  // The preview and the legacy setting (Settings → Voice) follow.
  await expect(layout.locator('[data-layout-preview] [data-preview-slot="left-nav"] [data-preview-part="voiceBar"]')).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Voice controls location" })).toContainText("Top of left nav");
  await expect(layout.locator('[data-layout-preset="voice.controlsLocation"]').getByRole("radio", { name: "Top of left nav" })).toHaveAttribute("aria-checked", "true");
});

test("Settings → Layout: a drag onto a list that refuses the part shows why under that list, until a move lands", async ({ page }) => {
  await setUp(page, {});
  const layout = await openLayoutAdvanced(page);
  const voiceRow = layout.locator('[data-layout-part="voiceBar"]');
  await dragRow(page, voiceRow, layout.locator('[data-layout-slot="interior-panel"] ul'));
  const refusal = layout.locator('[data-layout-refusal="interior-panel"]');
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText("Voice controls can't go in the Interior panel");
  // Only the list it was let go over: the ones it crossed on the way say nothing.
  await expect(layout.locator("[data-layout-refusal]")).toHaveCount(1);
  await expect(layout.locator('[data-layout-slot="dock-bottom"] [data-layout-part="voiceBar"]')).toBeVisible();
  // A move that lands clears it.
  await dragRow(page, voiceRow, layout.locator('[data-layout-slot="left-nav"] ul'));
  await expect(layout.locator('[data-layout-slot="left-nav"] [data-layout-part="voiceBar"]')).toBeVisible();
  await expect(layout.locator("[data-layout-refusal]")).toHaveCount(0);
  // Down again past the refusing lists in between: it lands, and nothing is shown (no notification pushed the
  // target away mid-drag).
  await dragRow(page, voiceRow, layout.locator('[data-layout-slot="dock-bottom"] ul'));
  await expect(layout.locator('[data-layout-slot="dock-bottom"] [data-layout-part="voiceBar"]')).toBeVisible();
  await expect(layout.locator("[data-layout-refusal]")).toHaveCount(0);
});

/** Settings → Layout → Advanced open and settled, the viewport tall enough for the Left nav, Interior panel and
 *  Bottom dock lists together. */
async function openLayoutAdvanced(page: Page) {
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
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
  return layout;
}

/** A real pointer drag of `row` by its grip onto `target`, both on screen: a drag that has to scroll the page part-way
 *  never reaches the list. Whichever of the two is higher goes to the top of the view, so the other stays on screen. */
async function dragRow(page: Page, row: Locator, target: Locator) {
  const rowY = (await row.boundingBox())!.y;
  const targetY = (await target.boundingBox())!.y;
  await (targetY < rowY ? target : row).evaluate((el) => el.scrollIntoView({ block: "start" }));
  const from = (await row.locator("svg").first().boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x + 40 - from.x) * i) / steps, from.y + ((to.y + to.height - 8 - from.y) * i) / steps);
  }
  await page.mouse.up();
}
