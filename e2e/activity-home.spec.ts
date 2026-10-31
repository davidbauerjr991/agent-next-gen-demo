import { expect, test, type Page } from "@playwright/test";

// The Activity Home (P-HOME-1) in a real browser: the feed's groups and
// counts, Offered pinned, a row's preview and its Start moving it to the
// rail, Return to feed, the Assignments range, History as Contact History's
// list, one column vs two (layout), and the persona switch. The rules
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
/** A view in the Assignments · History switcher. */
const view = (page: Page, label: string) => feed(page).locator("[data-feed-views]").getByRole("radio", { name: new RegExp(`^${label}`) });

async function settingsSection(page: Page) {
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
}
async function home(page: Page) {
  await page.locator("aside").getByText("Home", { exact: true }).first().click();
}
/** A row previews in Home's detail panel (P-HOME-1h); the preview's Open opens it, nothing else (P-HOME-1i). */
async function openItem(page: Page, title: string) {
  await feed(page).locator("[data-feed-row]", { hasText: title }).click();
  await page.locator("[data-home-detail=item] [data-preview-open]").click();
}
/** The filter row every view shares (P-HOME-1m): search, kinds, History's date. */
const filters = (page: Page) => feed(page).locator("[data-feed-filters]");

/** Picks History's range in lyra's DateRangeFilterChip (Today / Yesterday / Last 7 days / Custom). */
async function historyRange(page: Page, label: string) {
  await filters(page).getByRole("button", { name: /^Date:/ }).click();
  await page.getByRole("radio", { name: label }).last().click();
  await page.keyboard.press("Escape");
}

test("the feed: today and this week's scheduled rows, the Activity count matches, no Completed-today group", async ({ page }) => {
  await open(page);
  // Eight of the agent's scheduled items fall within the week, whatever the hour; the ninth is Later, collapsed.
  const scheduled = feed(page).locator('[data-feed-row][data-feed-status="scheduled"]');
  await expect(scheduled).toHaveCount(8);
  await expect(view(page, "Activity")).toContainText("9");
  await expect(group(page, "Later")).toContainText("Later · 1");
  // Three views (Assignments | Parked | History, P-HOME-1k), Assignments by default.
  await expect(feed(page).locator("[data-feed-views]").getByRole("radio")).toHaveCount(3);
  await expect(view(page, "Activity")).toHaveAttribute("aria-checked", "true");
  await expect(feed(page).locator('[data-feed-group="Completed today"]')).toHaveCount(0);
  // Completed work is History, never a time group.
  await expect(feed(page).locator('[data-feed-row][data-feed-status="completed"]')).toHaveCount(0);
  await view(page, "History").click();
  await historyRange(page, "Last 7 days");
  await expect(feed(page).locator('[data-feed-row][data-feed-status="completed"]').first()).toBeVisible();
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]')).toHaveCount(0);
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

test("a row previews in Home's panel; Join moves it to the rail and off the time groups; its X returns it to the feed; the views switch", async ({ page }) => {
  await open(page);
  const row = feed(page).locator("[data-feed-row]", { hasText: "Returns team stand-up" });
  await row.click();
  const preview = page.locator("[data-home-detail=item]");
  await expect(preview).toBeVisible();
  await expect(row).toHaveAttribute("data-selected", "true");
  await expect(preview).toContainText("Refund policy RET-1.3 rollout");
  await expect(page.locator("[data-kind-cell]")).toHaveCount(0);
  // The second click closes it; the panel's X does too.
  await row.click();
  await expect(row).not.toHaveAttribute("data-selected", "true");
  await row.click();
  await expect(preview.getByRole("button", { name: "Open" })).toBeVisible();
  await preview.getByRole("button", { name: "Join" }).click();
  await expect(page.locator("[data-kind-cell=meeting]")).toBeVisible();
  await expect(page.locator("aside [data-kind-nav-card]")).toHaveCount(1);
  await home(page);
  // It stays in the feed, open (P-HOME-1m).
  await expect(feed(page).locator('[data-feed-row][data-feed-status="inRail"]', { hasText: "Returns team stand-up" })).toBeVisible();
  const history = group(page, "History");
  await expect(history).toHaveCount(0);

  // History is Contact History's list: the rail isn't in it.
  await view(page, "History").click();
  await expect(group(page, "Today")).toHaveCount(0);
  await expect(history).not.toContainText("Returns team stand-up");

  await view(page, "Activity").click();
  await expect(history).toHaveCount(0);
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]')).toHaveCount(7);

  // Return to feed: the card's X; the item is Scheduled again, with no outcome.
  const card = page.locator("aside [data-kind-nav-card]");
  await card.hover();
  await card.locator("[data-kind-close]").click({ force: true });
  await expect(card).toHaveCount(0);
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]', { hasText: "Returns team stand-up" })).toBeVisible();
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]')).toHaveCount(8);
});

test("a callback's preview: Open puts it in the rail undialled; Dial opens the dial pad on itself and confirming joins the call to the card as its active Voice row", async ({ page }) => {
  await open(page);
  const row = feed(page).locator("[data-feed-row]", { hasText: "Callback · Priya Shah" });
  const preview = page.locator("[data-home-detail=item]");
  const card = page.locator('aside [data-kind-nav-card="agent-cb-priya"]');
  // Open: the card, the cell, no dial pad, no call.
  await row.click();
  await expect(preview.locator("[data-preview-primary]")).toHaveText("Dial");
  await preview.locator("[data-preview-open]").click();
  await expect(page.locator("[data-kind-cell=callback]")).toBeVisible();
  await expect(card).toBeVisible();
  await expect(page.getByLabel("Phone number")).toHaveCount(0);
  await expect(card).not.toHaveAttribute("data-kind-leg", /.+/);
  // Back to the feed, then Dial from the preview.
  await card.hover();
  await card.locator("[data-kind-close]").click({ force: true });
  await expect(card).toHaveCount(0);
  await row.click();
  const dial = preview.locator("[data-preview-primary]");
  await dial.click();
  const phone = page.getByLabel("Phone number");
  await expect(phone).toHaveValue("(415) 555-0178");
  const pad = page.locator("[data-radix-popper-content-wrapper]").filter({ has: phone });
  const dialBox = (await dial.boundingBox())!;
  const padBox = (await pad.boundingBox())!;
  expect(padBox.y).toBeGreaterThanOrEqual(dialBox.y + dialBox.height - 1);
  await page.getByRole("button", { name: "Dial Number" }).click();
  await expect(card).toHaveAttribute("data-kind-leg", "schedule:agent-cb-priya", { timeout: 15_000 });
  await expect(page.locator("aside [data-kind-nav-card]")).toHaveCount(1);
  await expect(card.getByRole("button", { name: /^Voice channel/ })).toHaveAttribute("aria-current", "true");
  // The call shows, and nothing asks to dial again.
  await expect(page.locator("[data-kind-cell]")).toHaveCount(0);
  await expect(page.getByLabel("Phone number")).toHaveCount(0);
});

test("unread: the day loads read; an item that comes due is unread (tinted, a dot, the badge); a preview reads it and the badge drops", async ({ page }) => {
  await page.clock.install();
  await open(page);
  const badge = feed(page).locator("[data-feed-views] [data-feed-unread]");
  await expect(badge).toHaveCount(0);
  await expect(feed(page).locator("[data-feed-row][data-unread]")).toHaveCount(0);
  // Priya's callback comes due 30 minutes in.
  await page.clock.fastForward("31:00");
  const row = feed(page).locator("[data-feed-row]", { hasText: "Callback · Priya Shah" });
  await expect(row).toHaveAttribute("data-unread", "true");
  await expect(badge).toHaveText("1 new");
  await row.click();
  await expect(row).not.toHaveAttribute("data-unread", "true");
  await expect(badge).toHaveCount(0);
  await view(page, "History").click();
  await view(page, "Activity").click();
  await expect(badge).toHaveCount(0);
});

test("park a callback from its row's hover cluster: it leaves the feed for Parked; Unpark returns it", async ({ page }) => {
  await open(page);
  const row = feed(page).locator("[data-feed-row]", { hasText: "Callback · Priya Shah" });
  await row.hover();
  const park = row.getByRole("button", { name: "Park this callback" });
  await expect(park).toBeVisible();
  await park.click();
  await expect(row).toHaveCount(0);
  await expect(view(page, "Parked")).toContainText("1");
  await view(page, "Parked").click();
  const parked = group(page, "Parked").locator("[data-feed-row]", { hasText: "Callback · Priya Shah" });
  await expect(parked).toHaveAttribute("data-feed-status", "parked");
  await parked.hover();
  await parked.getByRole("button", { name: "Unpark" }).click();
  await expect(group(page, "Parked")).toContainText("Nothing parked");
  await view(page, "Activity").click();
  await expect(feed(page).locator('[data-feed-row][data-feed-status="scheduled"]', { hasText: "Callback · Priya Shah" })).toBeVisible();
});

test("no date control on Activity: Later is collapsed until opened; an opened item stays in the feed marked open", async ({ page }) => {
  await open(page);
  await expect(feed(page).locator("[data-feed-range]")).toHaveCount(0);
  const later = group(page, "Later");
  await expect(later.locator("[data-feed-row]")).toHaveCount(0);
  await later.getByRole("button", { name: /Later/ }).click();
  await expect(later.locator("[data-feed-row]", { hasText: "Q4 compliance refresher" })).toBeVisible();
  // Open an item: back on Home it's still in Today, with the eye and "Open".
  await openItem(page, "Returns team stand-up");
  await home(page);
  const opened = feed(page).locator("[data-feed-row]", { hasText: "Returns team stand-up" });
  await expect(opened).toHaveAttribute("data-feed-status", "inRail");
  await expect(opened).toContainText("Open");
});

test("History's rows are the Contact History card's entries, in its order and with its times; the History count is that list", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await open(page);
  await view(page, "History").click();
  await historyRange(page, "Yesterday");
  const rows = feed(page).locator('[data-feed-row^="history:"]');
  await expect(rows.first()).toBeVisible();
  const card = page.locator('[data-home-section="contactHistory"]');
  // The card's own date control (lyra's DateRangeFilterChip too, from Last 7 days): Yesterday as well.
  await card.getByRole("button", { name: /^Date:/ }).click();
  await page.getByRole("radio", { name: "Yesterday" }).last().click();
  await page.keyboard.press("Escape");
  const cardTimes = (await card.locator("span").allInnerTexts()).filter((s) => /^(\d+[mhd] ago|Just now)$/.test(s.trim()));
  const feedTimes = (await rows.allInnerTexts()).map((r) => /(\d+[mhd] ago|Just now)/.exec(r)?.[1]);
  expect(feedTimes.length).toBeGreaterThan(0);
  expect(feedTimes).toEqual(cardTimes.slice(0, feedTimes.length));
  await expect(view(page, "History")).toContainText(String(feedTimes.length));
});

test("one column: the feed is a row among the sections; two columns: the feed left, the other sections stacked right", async ({ page }) => {
  await open(page);
  const perf = page.locator('[data-home-section="performance"]');
  const activity = page.locator('[data-home-section="activity"]');
  const perfBox = (await perf.boundingBox())!;
  const activityBox = (await activity.boundingBox())!;
  expect(activityBox.y).toBeGreaterThan(perfBox.y + perfBox.height - 1);
  await expect(page.locator('[data-home-section="contactHistory"]')).toBeVisible();

  await settingsSection(page);
  await page.locator('[data-layout-preset="home.layout"]').getByRole("radio", { name: "Two columns" }).click();
  // With the feed on in two columns, Contact History is the feed's History view: no switch for it.
  await expect(page.locator('[data-home-section-row="contactHistory"]')).toContainText("Shown in the Activity feed's History view");
  await expect(page.locator('[data-home-section-row="contactHistory"]').getByRole("switch")).toHaveCount(0);
  await home(page);
  await expect(page.locator("[data-home-layout=twoColumn]")).toBeVisible();
  const side = page.locator("[data-home-column=side]");
  await expect(side.locator("[data-home-section]")).toHaveCount(2);
  await expect(page.locator('[data-home-section="contactHistory"]')).toHaveCount(0);
  const feedBox = (await page.locator('[data-home-section="activity"]').boundingBox())!;
  const sideBox = (await side.boundingBox())!;
  expect(sideBox.x).toBeGreaterThanOrEqual(feedBox.x + feedBox.width - 1);
  expect(Math.abs(sideBox.y - feedBox.y)).toBeLessThan(40);
  // Both columns start at the same y: the views' top edge meets the first right-column card's (Queues) top edge.
  const firstTops = await page.evaluate(() => [
    document.querySelector("[data-home-scroll=feed] [data-feed-views]")!.getBoundingClientRect().top,
    document.querySelector("[data-home-column=side]")!.firstElementChild!.getBoundingClientRect().top,
  ]);
  expect(firstTops[0]).toBe(firstTops[1]);
  // The welcome header is lyra's PageHeader: the greeting, oneColumn's user-name line as its subtitle (the counts are
  // on the view buttons), the actions beside.
  const header = page.locator("[data-home-page-header]");
  await expect(header.locator("h1")).toHaveText("Hello John");
  await expect(header).toContainText("User Name:");
  await expect(header).not.toContainText("to decide");
  await expect(header).toContainText("My Assignment Queue");
});

test("two columns: the header stays put, the feed and the right column scroll on their own, the column docks with no toggle and is the overlay only when it doesn't fit, and Home's panels open over the right column", async ({ page }) => {
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

  // Docked while it fits: no Cards toggle anywhere.
  await expect(page.locator("[data-summaries-toggle]")).toHaveCount(0);

  // Too narrow to dock: the overlay, opened by the Cards toggle (shown only then) — in the feed's switcher row, right
  // of the list / table toggle, not the header — over the feed.
  await page.setViewportSize({ width: 1000, height: 640 });
  await expect(side).toHaveCount(0);
  await expect(header.locator("[data-summaries-toggle]")).toHaveCount(0);
  const toggle = page.locator("[data-feed-display] [data-summaries-toggle]");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('[data-canvas-region="reference"]').filter({ hasText: "Cards" })).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 640 });
  await expect(side).toBeVisible();
  await expect(page.locator("[data-summaries-toggle]")).toHaveCount(0);

  // The queue is one compact card; a row opens the skills drill-down over the right column, beside the feed (never
  // over it): the interaction's slide-over layout, whose slot widens as the panel is dragged, pushing the feed.
  const feedWidth = (await feedScroll.boundingBox())!.width;
  await page.locator('[data-home-card="queueList"] [data-queue-row="2"]').click();
  const panel = page.locator('[data-slot="home-detail-panel"]');
  await expect(panel.locator('[data-home-detail="queue"]')).toBeVisible();
  await expect(panel).toContainText("Skills");
  const feedBox = (await feedScroll.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.x).toBeGreaterThanOrEqual(feedBox.x + feedBox.width - 1);
  expect(Math.abs(feedBox.width - feedWidth)).toBeLessThan(2);

  // A Contact History row's preview opens in the same place (its earlier contacts: History's range widened).
  await view(page, "History").click();
  await historyRange(page, "Last 7 days");
  await feed(page).locator('[data-feed-row^="history:"]').first().click();
  await expect(panel.locator('[data-home-detail="history"]')).toBeVisible();
  const historyBox = (await panel.boundingBox())!;
  expect(historyBox.x).toBeGreaterThanOrEqual(feedBox.x + feedBox.width - 1);
});

test("a kind card's Outcome popover opens below its button, aligned to its end, as a conversation row's does", async ({ page }) => {
  await open(page);
  await openItem(page, "Returns team stand-up");
  const trigger = page.locator("aside [data-kind-nav-card] [data-kind-outcome-trigger]");
  await trigger.click();
  const popover = page.locator("[data-radix-popper-content-wrapper]").filter({ has: page.locator("[data-kind-outcome]") });
  await expect(popover).toBeVisible();
  const button = (await trigger.boundingBox())!;
  const box = (await popover.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(button.y + button.height - 1);
  expect(box.y).toBeLessThan(button.y + button.height + 24);
  // End-aligned to the button (as a row's), shifted only to stay in the viewport: it spans the button.
  expect(box.x).toBeLessThanOrEqual(button.x);
  expect(box.x + box.width).toBeGreaterThanOrEqual(button.x + button.width);
});

test("a call from a callback joins the callback's card: the Callback row, then the Voice row; the main column follows the selected row", async ({ page }) => {
  await open(page);
  await openItem(page, "Callback · Priya Shah");
  await page.locator("[data-kind-cell=callback] [data-schedule-call]").click();
  await page.getByRole("button", { name: "Dial Number" }).click();
  const card = page.locator('aside [data-kind-nav-card="agent-cb-priya"]');
  await expect(card).toHaveAttribute("data-kind-leg", "schedule:agent-cb-priya", { timeout: 15_000 });
  await expect(card.locator('[title="End Call"], [aria-label="End Call"]').first()).toBeVisible();
  // One card for the customer, its rows in the order they were opened.
  await expect(page.locator("aside [data-kind-nav-card]")).toHaveCount(1);
  await expect(page.locator("aside").getByRole("button", { name: /^Priya Shah/ })).toHaveCount(1);
  const callbackRow = card.getByRole("button", { name: /^Callback channel/ });
  const voiceRow = card.getByRole("button", { name: /^Voice channel/ });
  const callbackBox = (await callbackRow.boundingBox())!;
  const voiceBox = (await voiceRow.boundingBox())!;
  expect(voiceBox.y).toBeGreaterThan(callbackBox.y);
  // The call shows; the Callback row shows the callback's cell; the Voice row the call again. (A row's content sits
  // over its stretched select button and the click bubbles to the row: `force` clicks there, as a pointer does.)
  await expect(page.locator("[data-kind-cell]")).toHaveCount(0);
  await callbackRow.click({ force: true });
  await expect(page.locator("[data-kind-cell=callback]")).toBeVisible();
  await voiceRow.click({ force: true });
  await expect(page.locator("[data-kind-cell]")).toHaveCount(0);
});

test("table mode fills the feed area (P-HOME-1m): its header stays while its body scrolls, the Customers table's footer pinned below with the page controls, no page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript((home) => {
    localStorage.setItem("agent-next-gen:settings:home", JSON.stringify({ ...home, value: { ...home.value, layout: "twoColumn", activityView: "table" } }));
  }, HOME_WITH_FEED);
  await open(page);
  // History over the week: well over a page of rows, so the body has something to scroll.
  await view(page, "History").click();
  await historyRange(page, "Last 7 days");
  const area = page.locator("[data-home-scroll=feed]");
  const frame = page.locator("[data-feed-table-frame]");
  await expect(frame).toBeVisible();
  // The frame reaches the bottom of the feed area (less its 24px bottom padding); the area itself doesn't scroll.
  const areaBox = (await area.boundingBox())!;
  const frameBox = (await frame.boundingBox())!;
  expect(Math.abs(frameBox.y + frameBox.height - (areaBox.y + areaBox.height - 24))).toBeLessThan(2);
  expect(await area.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  // The footer: pinned at the frame's bottom, with lyra's page controls.
  const footer = frame.locator('nav[aria-label="Pagination"]');
  await expect(footer).toBeVisible();
  await expect(frame.getByRole("button", { name: "Next page" })).toBeVisible();
  await expect(frame).toContainText(/Displaying 1-25 of \d+/);
  // The body scrolls; the header row stays where it was.
  const head = frame.locator("thead");
  const body = frame.locator("tbody");
  const headTop = (await head.boundingBox())!.y;
  const scrolled = await body.evaluate((el) => {
    el.scrollTop = 300;
    return el.scrollTop;
  });
  expect(scrolled).toBeGreaterThan(0);
  expect((await head.boundingBox())!.y).toBe(headTop);
});

test("the table's actions column is the pinned kebab column (P-HOME-1m): scrolled sideways, a row's kebab stays in view and its menu works", async ({ page }) => {
  // Narrow enough that the columns' minimums overflow the feed area, so the body scrolls sideways.
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.addInitScript((home) => {
    localStorage.setItem("agent-next-gen:settings:home", JSON.stringify({ ...home, value: { ...home.value, layout: "twoColumn", activityView: "table" } }));
  }, HOME_WITH_FEED);
  await open(page);
  const frame = page.locator("[data-feed-table-frame]");
  const body = frame.locator("tbody");
  await expect(body.locator("[data-feed-row]").first()).toBeVisible();
  const scrolled = await body.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
    return { left: el.scrollLeft, overflow: el.scrollWidth - el.clientWidth };
  });
  expect(scrolled.overflow).toBeGreaterThan(0);
  expect(scrolled.left).toBeGreaterThan(0);
  // A scheduled callback's row: its pinned cell sits at the body's end edge, inside the visible frame, with its kebab.
  const row = body.locator("[data-feed-row]").filter({ hasText: "Callback" }).filter({ has: page.locator("[data-feed-actions-cell] button") }).first();
  const id = await row.getAttribute("data-feed-row");
  const cell = row.locator("[data-feed-actions-cell]");
  const bodyBox = (await body.boundingBox())!;
  const cellBox = (await cell.boundingBox())!;
  expect(cellBox.x).toBeGreaterThanOrEqual(bodyBox.x);
  expect(cellBox.x + cellBox.width).toBeLessThanOrEqual(bodyBox.x + bodyBox.width + 1);
  expect(await cell.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  // Scrolled back to the start, it's still in the same place.
  await body.evaluate((el) => (el.scrollLeft = 0));
  expect(Math.abs((await cell.boundingBox())!.x - cellBox.x)).toBeLessThan(1);
  await body.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  // No icons in the cell, only the kebab; its menu holds the row's actions, and Park takes the row out of Activity.
  await expect(cell.locator("[data-feed-action]")).toHaveCount(0);
  await cell.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Park this callback" }).click();
  await expect(body.locator(`[data-feed-row="${id}"]`)).toHaveCount(0);
});

test("History behaves as Contact History: its search and date controls, a row opens its preview and closes it again", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 720 });
  await page.addInitScript((home) => {
    localStorage.setItem("agent-next-gen:settings:home", JSON.stringify({ ...home, value: { ...home.value, layout: "twoColumn" } }));
  }, HOME_WITH_FEED);
  await open(page);
  await view(page, "History").click();
  const history = group(page, "History");
  await historyRange(page, "Last 7 days");
  const entries = feed(page).locator('[data-feed-row^="history:"]');
  await expect(entries.first()).toBeVisible();
  await entries.first().click();
  await expect(entries.first()).toHaveAttribute("data-selected", "true");
  const panel = page.locator('[data-slot="home-detail-panel"]');
  await expect(panel.locator('[data-home-detail="history"]')).toBeVisible();
  await entries.first().click();
  await expect(entries.first()).not.toHaveAttribute("data-selected", "true");
  // Its search narrows the list.
  await filters(page).getByPlaceholder("Search contact history").fill("zzz-no-match");
  await expect(entries).toHaveCount(0);
  await expect(history).toContainText("No results for “zzz-no-match”");
});

test("a callback's Dial opens the outbound dial pad anchored beneath the button, prefilled with the customer's number", async ({ page }) => {
  await open(page);
  await openItem(page, "Callback · Priya Shah");
  const dial = page.locator("[data-kind-cell=callback] [data-schedule-call]");
  await dial.click();
  const phone = page.getByLabel("Phone number");
  await expect(phone).toHaveValue("(415) 555-0178");
  const pad = page.locator("[data-radix-popper-content-wrapper]").filter({ has: phone });
  const button = (await dial.boundingBox())!;
  const popover = (await pad.boundingBox())!;
  expect(popover.y).toBeGreaterThanOrEqual(button.y + button.height - 1);
  expect(popover.x).toBeLessThan(button.x + button.width);
  expect(popover.x + popover.width).toBeGreaterThan(button.x);
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
