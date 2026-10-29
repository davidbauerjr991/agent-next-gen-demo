import { expect, test, type Page } from "@playwright/test";
import { lucasInPanelMode } from "./helpers";

// P-AIFIRST (k6), the browser half of round 3: 4 one SMS icon with a thread
// picker (Sarah Brown, two SMS threads); 6 panel mode, an interstitial in the
// Contact Details hover preview opens the docked panel and its slide-over in
// one click; 10 under "main", View Details opens the session details as the
// interior slide-over over the panel's thread, with its own close.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function setUp(page: Page, ai: "inline" | "panel" | "main") {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript((displayLocation) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation } }));
    localStorage.setItem(
      "agent-next-gen:settings:channels",
      JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true, whatsapp: true } }),
    );
  }, ai);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

/** Dials each `[channel, address]` for a directory customer, all on one journey. */
async function dialAll(page: Page, entityId: string, contactName: string, threads: [string, string][]) {
  await page.evaluate(
    async ({ entityId, contactName, threads }) => {
      const p = (window as any).__providers.interaction;
      let journeyId: string | undefined;
      for (const [channel, address] of threads) {
        const id = await p.dial({ channel, address, skillId: "general", entityId, contactName, ...(journeyId ? { journeyId } : {}) });
        journeyId ??= (await p.getSnapshot()).interactions.find((i: any) => i.id === id).journeyId;
      }
    },
    { entityId, contactName, threads },
  );
  await page.locator(`aside [aria-label^='${contactName}']:visible`).first().click({ force: true });
}

const icon = (page: Page, label: string) => page.locator(`[aria-label='Open ${label} preview'], [aria-label='Close ${label} preview']`).first();

test("4: Sarah Brown with two SMS threads: one SMS icon reading 2; its menu lists both, in view; choosing the other swaps the content", async ({ page }) => {
  await setUp(page, "inline");
  await dialAll(page, "customer-2", "Sarah Brown", [
    ["sms", "(300) 213-1071"],
    ["sms", "(300) 555-0199"],
  ]);
  await expect(page.locator("[aria-label='Open SMS preview'], [aria-label='Close SMS preview']")).toHaveCount(1);
  await expect(icon(page, "SMS").locator("xpath=..")).toContainText("2");
  await icon(page, "SMS").click();
  const menu = page.locator("[data-slot=channel-thread-menu]");
  await expect(menu).toBeVisible();
  const rows = menu.getByRole("menuitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("(300) 213-1071");
  await expect(rows.nth(1)).toContainText("(300) 555-0199");
  // In the viewport, under the icon.
  const box = (await menu.boundingBox())!;
  const iconBox = (await icon(page, "SMS").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(iconBox.y + iconBox.height - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(1600);
  const before = await page.locator("[data-main-thread]").first().innerText();
  const target = before.includes("(300) 555-0199") ? rows.nth(0) : rows.nth(1);
  await target.click();
  await expect(menu).toBeHidden();
  await expect.poll(() => page.locator("[data-main-thread]").first().innerText()).not.toBe(before);
});

// P-HOME-1n retired this test's first half: the Contact Details hover preview is the record's tabs now (panel mode's
// AI feed is the docked panel's, not a preview tab), so the interstitial is clicked where it lives.
test("6: panel mode, an interstitial in the docked AI Overview reopens its slide-over in the docked panel, in one click", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await lucasInPanelMode(page);
  // An interstitial: ask Copilot through a chip (the chip row shows once the agent has the chat); close the slide-over it opens.
  await page.getByRole("button", { name: /^Takeover/ }).first().click();
  await page.locator("[data-slot=copilot-composer] [role=button]", { hasText: "Show purchase history" }).click();
  const closeSlideOver = page.getByRole("button", { name: "Close Purchase history" });
  await expect(closeSlideOver).toBeVisible({ timeout: 5_000 });
  await closeSlideOver.click();
  await expect(closeSlideOver).toBeHidden();
  const panel = page.locator("[data-slot=right-panel]");
  await expect(panel).toHaveAttribute("data-open", "true");
  await panel.locator("[data-slot=ai-feed] button", { hasText: "Show purchase history" }).first().click();
  await expect(closeSlideOver).toBeVisible();
  // The slide-over is in the docked panel (once it has slid in).
  const dock = (await panel.boundingBox())!;
  await expect
    .poll(async () => {
      const slide = (await closeSlideOver.boundingBox())!;
      return slide.x >= dock.x - 1 && slide.x + slide.width <= dock.x + dock.width + 1;
    })
    .toBe(true);
});

test("10: AI display main, View Details opens the session details in the reference slide-over (P-HOME-1n), the thread staying in the panel, with its own close", async ({ page }) => {
  await setUp(page, "main");
  await dialAll(page, "priya-shah-history", "Priya Shah", [
    ["whatsapp", "(415) 555-0142"],
    ["email", "priya.shah@example.com"],
  ]);
  const panel = page.locator("[data-slot=right-panel]");
  if ((await panel.getAttribute("data-thread")) !== "email" || (await panel.getAttribute("data-open")) !== "true") await icon(page, "Email").click();
  await expect(panel).toHaveAttribute("data-thread", "email");
  await panel.locator("[data-slot=panel-session-row]").getByRole("button", { name: /View Details/ }).click();
  const details = page.locator("[data-slot=reference-slide-over] [data-slot=session-slide-over]");
  await expect(details).toBeVisible();
  await expect(details).toContainText("Contact ID");
  // In the main column's reference slot, left of the panel; the thread stays in the panel.
  await expect
    .poll(async () => {
      const slide = (await details.boundingBox())!;
      const dock = (await panel.boundingBox())!;
      return slide.x + slide.width <= dock.x + 1;
    })
    .toBe(true);
  await expect(panel).toHaveAttribute("data-thread", "email");
  // Its own close.
  await page.getByRole("button", { name: "Close Session Details" }).click();
  await expect(details).toBeHidden();
  await expect(panel).toHaveAttribute("data-thread", "email");
  await expect(panel).toHaveAttribute("data-open", "true");
});
