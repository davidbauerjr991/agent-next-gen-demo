import { expect, test, type Page } from "@playwright/test";

// Adding a channel to an open card from its "+" (P-HOME-1h): the card gains the row, the page keeps rendering (an
// Email added to Lucas while his bot's dots showed once blanked it: the tab cross-fade finished a looping
// animation), and both rows select. Real browser animations, so Chrome.

async function start(page: Page, errors: string[]) {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    // The Next Best Action inline, in the conversation.
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "inline" } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.waitForTimeout(500);
}

function card(page: Page, name: string) {
  return page.locator(`aside [aria-label^='${name}']`).first();
}

/** The card's "+" → a channel → Start Interaction. */
async function addChannel(page: Page, name: string, channel: string) {
  // The card's button overlays its body; the "+" is a sibling under the same parent.
  const item = card(page, name).locator("xpath=..");
  await card(page, name).hover({ force: true });
  await item.getByRole("button", { name: "Add Outbound" }).click({ force: true });
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await popover.getByRole("radio", { name: channel }).click({ force: true });
  await popover.getByRole("button", { name: "Start Interaction" }).click();
}

async function rowsSelectable(page: Page, rows: string[], errors: string[]) {
  for (const label of rows) {
    const row = page.locator("aside").getByRole("button", { name: new RegExp(`^${label} channel`) }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click({ force: true });
    await expect(row).toHaveAttribute("aria-current", "true");
    await expect(page.locator("[data-canvas-region=action], [data-main-thread]").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
}

test("Email to Lucas after Takeover: the page renders, and Chat and Email both select", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.keyboard.press("a");
  await card(page, "Lucas Thomas").waitFor({ timeout: 15_000 });
  await card(page, "Lucas Thomas").click({ force: true });
  await page.getByRole("button", { name: "Takeover Chat" }).first().click({ timeout: 20_000 });
  await addChannel(page, "Lucas Thomas", "Email");
  await rowsSelectable(page, ["Email", "Chat"], errors);
});

test("SMS to Maya: the page renders, and Voice and SMS both select", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.keyboard.press("b");
  await card(page, "Maya Chen").waitFor({ timeout: 15_000 });
  await card(page, "Maya Chen").click({ force: true });
  await addChannel(page, "Maya Chen", "SMS");
  await rowsSelectable(page, ["SMS", "Voice"], errors);
});

test("Lucas, Takeover within 5s: no typing bubble outlives the handoff reply", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.keyboard.press("a");
  await card(page, "Lucas Thomas").waitFor({ timeout: 15_000 });
  await card(page, "Lucas Thomas").click({ force: true });
  await page.getByRole("button", { name: "Takeover Chat" }).first().click({ timeout: 5_000 });
  // John's greeting is his turn; answering it lets the run go on, and Lucas answers "Ok, sounds good".
  await page.locator("[data-slot=next-best-action]").getByRole("button", { name: "Not now" }).click({ timeout: 10_000 });
  await expect(page.locator("[data-main-thread]")).toContainText("Ok, sounds good", { timeout: 10_000 });
  await page.waitForTimeout(3_000);
  await expect(page.locator("[aria-label='AI agent is typing'], [aria-label='Customer is typing']")).toHaveCount(0);
  // The bot's remaining launch lines never arrive.
  await expect(page.locator("[data-main-thread]")).not.toContainText("I'm aware of an issue with checkout right now");
  expect(errors).toEqual([]);
});
