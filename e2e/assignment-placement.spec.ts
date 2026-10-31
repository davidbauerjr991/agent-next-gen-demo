import { expect, test, type Page } from "@playwright/test";

// P-HOME-1n: the assignments part in its three slots, the incoming toast it forces, Settings' grouping, lyra's
// gradient tokens, and Contact Details / Session Details in the reference slide-over. Layout, widths, real hover and
// computed styles, so Chrome.

async function setUp(page: Page, assignments: Record<string, unknown>, width = 1600, ai: Record<string, unknown> = { displayLocation: "inline", canvasLayout: "twoColumn" }) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(
    ({ assignments, ai }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: ai }));
      localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 2, value: assignments }));
      localStorage.setItem(
        "agent-next-gen:settings:channels",
        JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true, whatsapp: true } }),
      );
    },
    { assignments, ai },
  );
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

const inlineRows = (page: Page) => page.locator("[data-slot=assignment-inline-row]");
const queueChip = (page: Page) => page.locator("header [data-slot=queue-chip]");

test("placement none: a row per open assignment at the top of Home; View opens one; the app header's My Assignment Queue menu switches between them and Home", async ({ page }) => {
  await setUp(page, { placement: "none" });
  await expect(inlineRows(page).first()).toBeVisible();
  const count = await inlineRows(page).count();
  expect(count).toBeGreaterThan(0);
  // None in the left nav.
  await expect(page.locator("aside [data-slot=assignment-card]")).toHaveCount(0);
  // Stacked above the dashboard, each with its avatar or kind icon, as lyra InlineNotifications in a list.
  await expect(page.getByRole("list", { name: "Assignments" }).getByRole("listitem")).toHaveCount(count);
  await expect(inlineRows(page).first().locator("[data-slot=inline-notification-icon]")).toBeVisible();
  const rowsBottom = await inlineRows(page).last().evaluate((el) => el.getBoundingClientRect().bottom);
  const dashboardTop = await page.locator("[data-home-layout]").first().evaluate((el) => el.getBoundingClientRect().top);
  expect(rowsBottom).toBeLessThanOrEqual(dashboardTop + 1);
  // View opens one in the main column.
  const viewable = inlineRows(page).filter({ has: page.getByRole("button", { name: "View" }) }).first();
  await viewable.getByRole("button", { name: "View" }).click();
  await expect(page.locator("[data-slot=record-header]")).toBeVisible();
  // The chip is in the app header on an assignment too; its menu lists Home and every open assignment.
  await queueChip(page).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(count + 1);
  await menu.getByRole("menuitem", { name: /Home/ }).click();
  await expect(page.locator("[data-slot=record-header]")).toHaveCount(0);
  await expect(inlineRows(page).first()).toBeVisible();
});

test("interior panel: lyra's left SidePanel inside the content card, at its start, resizable within 350–425 (P-LAYOUT fix (a))", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" }, 2400);
  const panel = page.locator("[data-slot=assignments-panel]");
  await expect(panel).toHaveAttribute("data-docked", "true");
  const box = (await panel.boundingBox())!;
  const content = (await page.locator("[data-slot=content-card]").boundingBox())!;
  // Inside the content card, flush with its start (supersedes P-HOME-1n's panel outside it).
  expect(Math.round(box.x)).toBeGreaterThanOrEqual(Math.round(content.x) - 1);
  expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(Math.round(content.x + content.width) + 1);
  await expect(panel.getByRole("button", { name: "Unpin panel" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close panel" })).toBeVisible();
  // Its resize handle widens it, within lyra's 350–425.
  const handle = panel.locator('[role="separator"]').first();
  await handle.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  const wider = (await panel.boundingBox())!.width;
  expect(wider).toBeGreaterThan(box.width);
  expect(wider).toBeLessThanOrEqual(426);
});

test("placement none: a new assignment raises the incoming toast with View; Settings shows the switch forced on with its reason", async ({ page }) => {
  await setUp(page, { placement: "none" });
  // The day's starting cards never toast (the grace after Go Available, ARRIVAL_GRACE_MS); then Lucas Thomas
  // (dev hotkey A), a scripted contact the sim routes in, does.
  await page.waitForTimeout(2_500);
  await expect(page.locator("[data-assignment-toast=incoming]")).toHaveCount(0);
  await page.keyboard.press("a");
  const toast = page.locator("[data-assignment-toast=incoming]").first();
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await expect(toast.getByRole("button", { name: "View" })).toBeVisible();
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  const forced = page.locator('[data-forced-setting="notifications.toasts.events.incoming"]');
  await expect(forced).toContainText("On — required while assignments aren't in the left nav");
  await expect(forced.getByRole("checkbox")).toBeDisabled();
});

test("Settings: the ten groups in order (Layout second, P-LAYOUT), each a lyra heading", async ({ page }) => {
  await setUp(page, {});
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  const legends = page.locator("[data-settings-group] > legend");
  const titles = await legends.evaluateAll((els) => els.map((el) => el.firstChild?.textContent?.trim()));
  expect(titles).toEqual(["Workspace", "Layout", "Assignments", "Home", "Notifications", "Appearance", "Channels", "Voice", "Phone", "Connections"]);
  for (const legend of await legends.all()) await expect(legend).toHaveClass(/lyra-heading-md/);
});

test("lyra's gradient tokens: a semantic tone to the surface, in light and in dark", async ({ page }) => {
  await setUp(page, {});
  const read = () =>
    page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "bg-[image:var(--lyra-gradient-info)]";
      document.body.appendChild(el);
      const image = getComputedStyle(el).backgroundImage;
      const surface = getComputedStyle(document.documentElement).getPropertyValue("--lyra-color-bg-surface-base").trim();
      el.remove();
      return { image, surface };
    });
  const light = await read();
  expect(light.image).toContain("linear-gradient");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const dark = await read();
  expect(dark.image).toContain("linear-gradient");
  // The bottom stop follows the theme's surface.
  expect(dark.image).not.toEqual(light.image);
  expect(dark.surface).not.toEqual(light.surface);
});

test("Contact Details and Session Details open in the reference slide-over; the hover preview still opens", async ({ page }) => {
  await setUp(page, { placement: "leftNav" });
  const card = page.locator("aside [aria-label^='Noah Patel']").first();
  await card.waitFor();
  await card.click({ force: true });
  const button = page.locator("button[data-contact-details]").first();
  await button.hover();
  await expect(page.locator("[data-slot=hover-preview]")).toBeVisible();
  await button.click();
  const slideOver = page.locator("[data-slot=reference-slide-over]");
  await expect(slideOver.locator("[data-slot=contact-details-tabs]")).toBeVisible();
  await expect(slideOver.locator("[data-slot=contact-details-tabs] [role=tab]", { hasText: /^Session$/ })).toHaveCount(0);
  // Escape from inside it closes it and gives focus back to its opener.
  await slideOver.locator("[role=tab]").first().focus();
  await page.keyboard.press("Escape");
  await expect(slideOver.locator("[data-slot=contact-details-tabs]")).toHaveCount(0);
  await expect(button).toBeFocused();
  await button.click();
  await expect(slideOver.locator("[data-slot=contact-details-tabs]")).toBeVisible();
  // Session Details from the session row: the same slide-over slot.
  await page.locator("[data-slot=record-session-row]").getByRole("button", { name: /Session Details|View Details/ }).first().click();
  await expect(slideOver.locator("[data-slot=session-slide-over]")).toBeVisible();
});

test("Experience Memory opens in the reference slide-over, its back arrow to Contact Details", async ({ page }) => {
  // Lucas Thomas (dev hotkey A) has an Experience Memory; his Journey Summary links to it.
  await setUp(page, { placement: "leftNav" }, 1800);
  await page.keyboard.press("a");
  await page.locator("aside [aria-label^='Lucas Thomas']").first().click({ force: true });
  const journey = page.locator("[data-canvas-region=reference] [data-slot=journey-summary]");
  await expect(journey).toBeVisible({ timeout: 15_000 });
  await journey.locator("[aria-expanded]").first().click();
  await journey.getByText("View Experience Memory").click();
  const slideOver = page.locator("[data-slot=reference-slide-over]");
  await expect(slideOver.locator("[data-slot=experience-memory]")).toBeVisible();
  await expect(page.locator("[data-slot=right-panel][data-open=true]")).toHaveCount(0);
  await slideOver.getByRole("button", { name: /^Back/ }).first().click();
  await expect(slideOver).toContainText("Contact Details");
});
