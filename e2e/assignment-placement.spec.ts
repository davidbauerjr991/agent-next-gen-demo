import { expect, test, type Page } from "@playwright/test";

// P-HOME-1n: the assignments part in its slots (left nav, interior panel; placement "none" migrated to Home's Active
// assignments section, P-LAYOUT-F1 B), Settings' grouping, lyra's gradient tokens, and Contact Details / Session
// Details in the reference slide-over. Layout, widths, real hover and computed styles, so Chrome.

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

test("a stored placement none migrates (P-LAYOUT-F1 B): the cards in the left nav, and Home's Active assignments section on and first, a row per card; View opens one", async ({ page }) => {
  await setUp(page, { placement: "none" });
  const cards = page.locator("aside [data-slot=assignment-card]");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  // The section is Home's first, its rows the same cards (lyra InlineNotifications in a list), with their icons.
  await expect(page.locator("[data-home-section]").first()).toHaveAttribute("data-home-section", "activeAssignments");
  await expect(page.getByRole("list", { name: "Active assignments" }).getByRole("listitem")).toHaveCount(count);
  await expect(inlineRows(page).first().locator("[data-slot=inline-notification-icon]")).toBeVisible();
  // Kept: after a reload it's still the left nav with the section on.
  await page.reload();
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.locator("[data-home-section]").first()).toHaveAttribute("data-home-section", "activeAssignments");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("agent-next-gen:settings:assignments")!).value.placement)).toBe("leftNav");
  // View opens one in the main column.
  const viewable = inlineRows(page).filter({ has: page.getByRole("button", { name: "View" }) }).first();
  await viewable.getByRole("button", { name: "View" }).click();
  await expect(page.locator("[data-slot=record-header]")).toBeVisible();
});

test("interior panel: lyra's left SidePanel inside the content card, at its start, resizable within 256–425 (P-LAYOUT fix (a); its minimum the nav's expanded width, P-LAYOUT-F1 A2)", async ({ page }) => {
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
  // Its resize handle widens it, up to SidePanel's 425.
  const handle = panel.locator('[role="separator"]').first();
  await handle.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  const wider = (await panel.boundingBox())!.width;
  expect(wider).toBeGreaterThan(box.width);
  expect(wider).toBeLessThanOrEqual(426);
});

test("interior panel (P-LAYOUT-F1 A2): the nav starts as a rail; a closed panel opens when a call comes in, and the nav stays as it was", async ({ page }) => {
  await setUp(page, { placement: "interiorPanel" });
  const toggle = page.locator("[aria-controls=assignments-panel]");
  await expect(page.locator("aside").getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.locator("[data-slot=assignments-panel]").getByRole("button", { name: "Close panel" }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // Maya Chen (dev hotkey B), a call answered on arrival.
  await page.keyboard.press("b");
  await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 15_000 });
  await expect(page.locator("[data-slot=assignments-panel]")).toContainText("Maya Chen");
  await expect(page.locator("aside").getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  // The toggle's badge counts every active assignment, in its name too.
  await expect(toggle).toHaveAttribute("aria-label", /^Assignments \(\d+\)$/);
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
