import { expect, test, type Page } from "@playwright/test";

// The Activity Home (P-HOME-1) in a real browser: the feed's groups and
// counts, Offered pinned, a scheduled row moving to the rail, the History
// chip, one column vs two (layout), and the persona switch. The rules
// themselves are in jsdom (activity-feed.test.ts, home-activity.test.tsx).

/** The default Home (Queue, Contact History, Performance) with the Activity feed turned on after them. */
const HOME_WITH_FEED = {
  v: 2,
  value: {
    sections: [
      { key: "queue", enabled: true },
      { key: "contactHistory", enabled: true },
      { key: "performance", enabled: true },
      { key: "productivity", enabled: false },
      { key: "activity", enabled: true },
    ],
  },
};

async function open(page: Page) {
  await page.addInitScript((home) => {
    if (!localStorage.getItem("agent-next-gen:settings:home")) localStorage.setItem("agent-next-gen:settings:home", JSON.stringify(home));
  }, HOME_WITH_FEED);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.locator("[data-activity-feed]")).toBeVisible();
}

const feed = (page: Page) => page.locator("[data-activity-feed]");
const group = (page: Page, title: string) => feed(page).locator(`[data-feed-group="${title}"]`);
/** A view in the All · Assignments · History switcher. */
const view = (page: Page, label: string) => feed(page).locator("[data-feed-views]").getByRole("radio", { name: new RegExp(`^${label}`) });

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
  await expect(view(page, "Assignments")).toContainText("8");
  await expect(view(page, "All")).toHaveAttribute("aria-checked", "true");
  await expect(feed(page).locator('[data-feed-group="Completed today"]')).toHaveCount(0);
  // Completed work is History, never a time group.
  await view(page, "Assignments").click();
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

test("opening a scheduled row moves it to the rail and off the time groups; History lists it; the views switch", async ({ page }) => {
  await open(page);
  await feed(page).locator("[data-feed-row]", { hasText: "Returns team stand-up" }).click();
  await expect(page.locator("[data-kind-cell=meeting]")).toBeVisible();
  await expect(page.locator("aside [data-kind-nav-card]")).toHaveCount(1);
  await home(page);
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]', { hasText: "Returns team stand-up" })).toHaveCount(0);
  const history = group(page, "History");
  await expect(history.locator('[data-feed-row][data-feed-status="inRail"]', { hasText: "Returns team stand-up" })).toBeVisible();

  await view(page, "History").click();
  await expect(group(page, "Today")).toHaveCount(0);
  await expect(history).toBeVisible();

  await view(page, "Assignments").click();
  await expect(history).toHaveCount(0);
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]')).toHaveCount(7);
});

test("one column: the feed is a row among the sections; two columns: the feed left, the other sections stacked right", async ({ page }) => {
  await open(page);
  const perf = page.locator('[data-home-section="performance"]');
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
  await expect(side.locator("[data-home-section]")).toHaveCount(3);
  const feedBox = (await page.locator('[data-home-section="activity"]').boundingBox())!;
  const sideBox = (await side.boundingBox())!;
  expect(sideBox.x).toBeGreaterThanOrEqual(feedBox.x + feedBox.width - 1);
  expect(Math.abs(sideBox.y - feedBox.y)).toBeLessThan(40);
  await expect(page.locator("[data-welcome-counts]")).toContainText("to decide");
});

test("two columns: the header stays put, the feed and the right column scroll on their own, the column pushes the feed or collapses to the overlay, and a queue row opens the drill-down", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 640 });
  await page.addInitScript((home) => {
    localStorage.setItem("agent-next-gen:settings:home", JSON.stringify({ ...home, value: { ...home.value, layout: "twoColumn" } }));
  }, HOME_WITH_FEED);
  await open(page);
  const header = page.locator("[data-home-header]");
  const feedScroll = page.locator("[data-home-scroll=feed]");
  const side = page.locator('[data-canvas-region="reference"][data-docked="true"]');
  await expect(side).toBeVisible();

  // Independent scroll, fixed header.
  const headerTop = (await header.boundingBox())!.y;
  await feedScroll.evaluate((el) => el.scrollTo(0, 400));
  expect(await feedScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await side.evaluate((el) => el.scrollTop)).toBe(0);
  expect((await header.boundingBox())!.y).toBe(headerTop);
  await side.evaluate((el) => el.scrollTo(0, 200));
  expect(await side.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect((await header.boundingBox())!.y).toBe(headerTop);

  // Docked, the column pushes the feed narrower; collapsed, the feed takes the width back.
  const dockedWidth = (await feedScroll.boundingBox())!.width;
  await page.locator("[data-home-side-toggle]").click();
  await expect(side).toHaveCount(0);
  expect((await feedScroll.boundingBox())!.width).toBeGreaterThan(dockedWidth + 200);
  // Collapsed, the toggle opens the overlay over the feed, which keeps its width; the overlay's pin docks it again.
  await page.locator("[data-home-side-toggle]").click();
  const overlay = page.locator('[data-canvas-region="reference"]').filter({ hasText: "Cards" });
  await expect(overlay).toBeVisible();
  expect((await feedScroll.boundingBox())!.width).toBeGreaterThan(dockedWidth + 200);
  await overlay.getByRole("button", { name: /pin/i }).click();
  await expect(side).toBeVisible();

  // Too narrow to dock: the column is the overlay whatever the agent chose.
  await page.setViewportSize({ width: 1000, height: 640 });
  await expect(side).toHaveCount(0);
  await page.setViewportSize({ width: 1600, height: 640 });
  await expect(side).toBeVisible();

  // The queue is one compact card; a row opens the skills drill-down.
  await page.locator('[data-home-card="queueList"] [data-queue-row="2"]').click();
  await expect(page.getByText(/Skills/).first()).toBeVisible();
});

test("switching persona re-seeds the feed and swaps the Home cards", async ({ page }) => {
  await open(page);
  await expect(feed(page)).toContainText("Callback · Priya Shah");
  await expect(page.locator('[data-home-section="queue"]')).toBeVisible();

  await settingsSection(page);
  await page.getByRole("radio", { name: "Supervisor" }).click();
  await home(page);
  await expect(feed(page)).toContainText("Coaching · John Smith");
  await expect(feed(page)).not.toContainText("Callback · Priya Shah");
  await expect(group(page, "Needs a decision")).toContainText("Escalation · Lauren Briggs");
  await expect(page.locator('[data-home-card="teamToday"]')).toContainText("78%");
  await expect(page.locator('[data-home-card="dueSoon"]')).toHaveCount(0);
  await expect(page.locator('[data-home-section="queue"]')).toHaveCount(0);
});
