import { expect, test, type Page } from "@playwright/test";

// The Activity Home (P-HOME-1) in a real browser: the feed's groups and
// counts, Offered pinned, a scheduled row moving to the rail, the History
// chip, one column vs two (layout), and the persona switch. The rules
// themselves are in jsdom (activity-feed.test.ts, home-activity.test.tsx).

async function open(page: Page) {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.locator("[data-activity-feed]")).toBeVisible();
}

const feed = (page: Page) => page.locator("[data-activity-feed]");
const group = (page: Page, title: string) => feed(page).locator(`[data-feed-group="${title}"]`);
const chip = (page: Page, label: string) => feed(page).getByRole("button", { name: new RegExp(`^${label}`) });

async function settingsSection(page: Page) {
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
}
async function home(page: Page) {
  await page.locator("aside").getByText("Home", { exact: true }).first().click();
}

test("the feed: today and this week's scheduled rows, the Assignments count matches, no Completed-today group", async ({ page }) => {
  await open(page);
  // All eight of the agent's scheduled items fall within the week, whatever the hour.
  const scheduled = feed(page).locator('[data-feed-row][data-feed-status="scheduled"]');
  await expect(scheduled).toHaveCount(8);
  await expect(chip(page, "Assignments")).toContainText("8");
  await expect(feed(page).locator('[data-feed-group="Completed today"]')).toHaveCount(0);
  await expect(feed(page).locator('[data-feed-row][data-feed-status="completed"]')).toHaveCount(0);
});

test("Offered pins to the top in Needs a decision", async ({ page }) => {
  await open(page);
  await page.keyboard.press("c");
  const pinned = group(page, "Needs a decision");
  await expect(pinned).toContainText("Tom Lewis", { timeout: 15_000 });
  // Above the chips and every time group.
  const first = await feed(page).evaluate((el) => el.firstElementChild?.getAttribute("data-feed-group"));
  expect(first).toBe("Needs a decision");
});

test("opening a scheduled row moves it to the rail and off the feed; History lists it; chips stack", async ({ page }) => {
  await open(page);
  await feed(page).locator("[data-feed-row]", { hasText: "Returns team stand-up" }).click();
  await expect(page.locator("[data-kind-cell=meeting]")).toBeVisible();
  await expect(page.locator("aside [data-kind-nav-card]")).toHaveCount(1);
  await home(page);
  await expect(feed(page).locator("[data-feed-row]", { hasText: "Returns team stand-up" })).toHaveCount(0);

  await chip(page, "History").click();
  const history = group(page, "History · left the feed today");
  await expect(history.locator('[data-feed-row][data-feed-status="inRail"]', { hasText: "Returns team stand-up" })).toBeVisible();
  await expect(group(page, "Today")).toHaveCount(0);

  await chip(page, "Assignments").click();
  await expect(history).toBeVisible();
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]')).toHaveCount(7);
});

test("one column: the feed is a row among the sections; two columns: the feed left, the other sections stacked right", async ({ page }) => {
  await open(page);
  const perf = page.locator('[data-home-section="performance productivity"]');
  const activity = page.locator('[data-home-section="activity"]');
  const perfBox = (await perf.boundingBox())!;
  const activityBox = (await activity.boundingBox())!;
  expect(activityBox.y).toBeGreaterThan(perfBox.y + perfBox.height - 1);
  await expect(page.locator("[data-welcome-counts]")).toHaveCount(0);

  await settingsSection(page);
  await page.getByRole("radio", { name: "Two columns" }).click();
  await home(page);
  await expect(page.locator("[data-home-layout=twoColumn]")).toBeVisible();
  const side = page.locator("[data-home-column=side]");
  await expect(side.locator("[data-home-section]")).toHaveCount(4);
  const feedBox = (await page.locator('[data-home-section="activity"]').boundingBox())!;
  const sideBox = (await side.boundingBox())!;
  expect(sideBox.x).toBeGreaterThanOrEqual(feedBox.x + feedBox.width - 1);
  expect(Math.abs(sideBox.y - feedBox.y)).toBeLessThan(40);
  await expect(page.locator("[data-welcome-counts]")).toContainText("to decide");
});

test("switching persona re-seeds the feed and swaps the Home cards", async ({ page }) => {
  await open(page);
  await expect(feed(page)).toContainText("Callback · Priya Shah");
  await expect(page.locator('[data-home-card="reminders"]')).toBeVisible();

  await settingsSection(page);
  await page.getByRole("radio", { name: "Supervisor" }).click();
  await home(page);
  await expect(feed(page)).toContainText("Coaching · John Smith");
  await expect(feed(page)).not.toContainText("Callback · Priya Shah");
  await expect(group(page, "Needs a decision")).toContainText("Escalation · Lauren Briggs");
  await expect(page.locator('[data-home-card="teamToday"]')).toContainText("78%");
  await expect(page.locator('[data-home-card="reminders"]')).toHaveCount(0);
  await expect(page.locator('[data-home-section="queue"]')).toHaveCount(0);
});
