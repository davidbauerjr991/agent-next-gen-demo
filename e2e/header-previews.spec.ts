import { expect, test, type Page } from "@playwright/test";

// Browser check round 2 (2026-10-16): the record header's toggle group and
// hover previews, and the Contact Details panel's Copilot composer. Layout
// and pointer, so Chrome.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function setUp(page: Page, settings: { ai: string; omnichannel: boolean }, width = 1600) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript((s) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: s.ai } }));
    localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 1, value: { omnichannel: s.omnichannel } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true } }));
  }, settings);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

/** Priya's inbound chat (it loads as a card), optionally an email on the same card; the card selected. */
async function priyaCard(page: Page, withEmail: boolean) {
  const failure = await page.evaluate(async (withEmail) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const w = window as any;
    for (let attempt = 0; attempt < 20; attempt++) {
      const id = w.__simCustomer.startInbound({ channel: "chat", address: "priya.shah@example.com", displayName: "Priya Shah" });
      await wait(500);
      const chat = (await w.__providers.interaction.getSnapshot()).interactions.find((i: any) => i.id === id && i.state === "active");
      if (!chat) continue;
      if (withEmail) await w.__providers.interaction.dial({ channel: "email", address: "priya.shah@example.com", skillId: "general", journeyId: chat.journeyId });
      return null;
    }
    return "the chat never went live";
  }, withEmail);
  expect(failure).toBeNull();
  await page.locator("aside [aria-label^='Priya Shah']").first().click({ force: true });
  await page.waitForTimeout(500);
}

const contactDetails = (page: Page) => page.getByRole("button", { name: /Contact Details$/ }).first();
const icon = (page: Page, label: string) => page.locator(`[aria-label='Open ${label} preview'], [aria-label='Close ${label} preview']`).first();
const preview = (page: Page) => page.locator("[data-slot=hover-preview]");

test("AI display main: the Contact Details hover action selects Contact Details: header, toggle and body together", async ({ page }) => {
  await setUp(page, { ai: "main", omnichannel: true });
  await priyaCard(page, false);
  await expect(page.locator("[data-slot=right-panel][data-open=true][data-thread=chat]")).toBeVisible();
  await contactDetails(page).hover();
  await expect(preview(page)).toBeVisible();
  // Its action (Link to existing customer for an unmatched contact, View customer info for a matched one).
  const action = preview(page).locator("button.text-lyra-fg-link, button:has-text('Link to existing customer')").first();
  await action.click();
  await expect(page.locator("[data-slot=right-panel][data-open=true][data-thread=details]")).toBeVisible();
  await expect(contactDetails(page)).toHaveAttribute("aria-pressed", "true");
  await expect(icon(page, "Chat")).toHaveAttribute("aria-pressed", "false");
  await expect(preview(page)).toHaveCount(0);
});

test("AI display panel: one Copilot composer, in the panel, whether it floats (narrow) or docks (wide)", async ({ page }) => {
  await setUp(page, { ai: "panel", omnichannel: false }, 1000);
  await priyaCard(page, false);
  const inPanel = page.locator("[data-slot=right-panel] [data-slot=copilot-composer]");
  await expect(inPanel).toHaveCount(1);
  await expect(page.locator("[data-main-thread] [data-slot=copilot-composer]")).toHaveCount(0);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(500);
  await expect(page.locator("[data-slot=copilot-composer]")).toHaveCount(1);
  await expect(inPanel).toHaveCount(1);
});

test("the quick-reply menu in a chat preview floats above it, fully visible, beyond the popover's bounds; the preview stays open", async ({ page }) => {
  // AI display main: Priya's chat is in the panel; select Contact Details, then preview the chat.
  await setUp(page, { ai: "main", omnichannel: true });
  await priyaCard(page, false);
  await contactDetails(page).click();
  await page.mouse.move(5, 5);
  await icon(page, "Chat").hover();
  await expect(preview(page)).toBeVisible();
  const textarea = preview(page).locator("textarea").first();
  await textarea.click();
  await textarea.type("/");
  const menu = page.locator("[data-floating-layer]");
  await expect(menu).toBeVisible();
  const m = (await menu.boundingBox())!;
  const p = (await preview(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  // Fully visible…
  expect(m.y).toBeGreaterThanOrEqual(0);
  expect(m.x).toBeGreaterThanOrEqual(0);
  expect(m.x + m.width).toBeLessThanOrEqual(viewport.width);
  expect(m.y + m.height).toBeLessThanOrEqual(viewport.height);
  // …and not confined to the popover.
  expect(m.y < p.y || m.x < p.x || m.x + m.width > p.x + p.width).toBe(true);
  // The preview stays open, its trigger still in its open state.
  await expect(preview(page)).toBeVisible();
  await expect(icon(page, "Chat")).toHaveAttribute("data-preview-open", "true");
});

test("hover previews share a min height: an empty email preview renders at it", async ({ page }) => {
  // Omnichannel: the chat holds the main column, so the email previews ("Coming soon").
  await setUp(page, { ai: "inline", omnichannel: true });
  await priyaCard(page, true);
  await icon(page, "Email").hover();
  await expect(preview(page)).toBeVisible();
  expect(Math.round((await preview(page).boundingBox())!.height)).toBe(360);
  // The placeholder is centered in the body, not stretched past the min.
  const placeholder = (await preview(page).getByText("Coming soon").boundingBox())!;
  const body = (await preview(page).locator("[data-slot=hover-preview-body]").boundingBox())!;
  expect(Math.abs(placeholder.y + placeholder.height / 2 - (body.y + body.height / 2))).toBeLessThan(4);
  // Contact Details' preview is the same frame component.
  const emailFrame = await preview(page).getAttribute("class");
  await page.mouse.move(5, 5);
  await expect(preview(page)).toHaveCount(0);
  await contactDetails(page).hover();
  await expect(preview(page)).toBeVisible();
  expect(await preview(page).getAttribute("class")).toBe(emailFrame);
});

test("a long chat preview grows to the max height and scrolls inside, the composer pinned", async ({ page }) => {
  // Lucas under AI display "main": his long chat is in the panel; with Contact
  // Details selected instead, hovering the chat icon previews it.
  await setUp(page, { ai: "main", omnichannel: true });
  await page.keyboard.press("a");
  await page.locator("aside [aria-label^='Lucas Thomas']").first().click({ force: true });
  await page.waitForTimeout(14_000);
  // Take over, so his chat has a composer (none while the AI holds it).
  await page.locator("[data-main-thread=ai]").getByRole("button", { name: /Takeover/ }).first().click();
  await page.waitForTimeout(3_000);
  await contactDetails(page).click();
  await expect(page.locator("[data-slot=right-panel][data-thread=details]")).toBeVisible();
  await page.mouse.move(5, 5);
  await icon(page, "Chat").hover();
  await expect(preview(page)).toBeVisible();
  expect(Math.round((await preview(page).boundingBox())!.height)).toBe(560);
  // Header (fixed) / transcript (the only scroller) / composer (fixed footer):
  // scrolling the transcript moves neither the header nor the composer, and the
  // popover itself never scrolls.
  const before = await preview(page).evaluate((frame) => {
    const header = frame.firstElementChild!.getBoundingClientRect();
    const textarea = frame.querySelector("textarea")!.getBoundingClientRect();
    return { headerTop: header.top, composerBottom: textarea.bottom, frameBottom: frame.getBoundingClientRect().bottom };
  });
  const after = await preview(page).evaluate((frame) => {
    const scroller = frame.querySelector<HTMLElement>("[data-slot=thread-preview] .overflow-y-auto")!;
    scroller.scrollTop = 0;
    scroller.scrollTop = scroller.scrollHeight;
    const header = frame.firstElementChild!.getBoundingClientRect();
    const textarea = frame.querySelector("textarea")!.getBoundingClientRect();
    return {
      headerTop: header.top,
      composerBottom: textarea.bottom,
      frameScrollTop: frame.scrollTop,
      scrollerScrolls: scroller.scrollHeight > scroller.clientHeight,
    };
  });
  expect(after.scrollerScrolls).toBe(true);
  expect(after.frameScrollTop).toBe(0);
  expect(after.headerTop).toBe(before.headerTop);
  expect(after.composerBottom).toBe(before.composerBottom);
  expect(before.frameBottom - before.composerBottom).toBeLessThan(80); // the composer sits at the popover's bottom
  // Scrolled up, "Scroll To Latest" sits over the transcript's bottom, never over the header.
  const scrollerBox = (await preview(page).locator("[data-slot=thread-preview] .overflow-y-auto").first().boundingBox())!;
  await page.mouse.move(scrollerBox.x + scrollerBox.width / 2, scrollerBox.y + 40);
  const latest = preview(page).getByRole("button", { name: /Scroll To Latest/ });
  // The transcript polls, and shows the button 400ms after leaving the bottom;
  // scroll up again while new lines may still be auto-scrolling it down.
  await expect(async () => {
    await page.mouse.wheel(0, -4000);
    await page.waitForTimeout(700);
    await expect(latest).toBeVisible({ timeout: 100 });
  }).toPass({ timeout: 10_000 });
  const headerBottom = await preview(page).evaluate((frame) => frame.firstElementChild!.getBoundingClientRect().bottom);
  const button = (await latest.boundingBox())!;
  expect(button.y).toBeGreaterThanOrEqual(headerBottom);
  const composerTop = (await preview(page).locator("textarea").first().boundingBox())!.y;
  expect(button.y + button.height).toBeLessThanOrEqual(composerTop);
  const frame = (await preview(page).boundingBox())!;
  const composer = (await preview(page).locator("textarea").first().boundingBox())!;
  expect(composer.y + composer.height).toBeLessThanOrEqual(frame.y + frame.height);
});
