import { expect, test, type Page } from "@playwright/test";

// P-AIFIRST (k8), the browser half of round 4: 1 the header "+" picker's
// Select Phone opens with every option visible and none on the field; 5 the
// voice bar's call switcher; 7 a thread menu hangs from its icon for every
// channel (voice included); 10 a multi-thread icon's menu opens on hover.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function setUp(page: Page, ai: "inline" | "panel" | "main" = "inline") {
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

/** Dials each `[channel, address]` on one journey (provider dials, entity optional). */
async function dialAll(page: Page, contactName: string, threads: [string, string][], entityId?: string) {
  await page.evaluate(
    async ({ entityId, contactName, threads }) => {
      const p = (window as any).__providers.interaction;
      let journeyId: string | undefined;
      for (const [channel, address] of threads) {
        const id = await p.dial({ channel, address, skillId: "general", contactName, ...(entityId ? { entityId } : {}), ...(journeyId ? { journeyId } : {}) });
        journeyId ??= (await p.getSnapshot()).interactions.find((i: any) => i.id === id).journeyId;
        await new Promise((r) => setTimeout(r, 400));
      }
    },
    { entityId, contactName, threads },
  );
  await page.locator(`aside [aria-label^='${contactName}']:visible`).first().click({ force: true });
}

/** An inbound call, retried until routing offers it, accepted through the provider. */
async function call(page: Page, address: string, displayName: string) {
  const failure = await page.evaluate(
    async ({ address, displayName }) => {
      const w = window as any;
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const routed = async () =>
        (await w.__providers.interaction.getSnapshot()).interactions.find(
          (i: any) => i.channel === "voice" && i.address?.value === address && i.state === "offered",
        );
      let id = "";
      for (let attempt = 0; attempt < 20 && !id; attempt++) {
        w.__simCustomer.startInbound({ channel: "voice", address, displayName });
        for (let poll = 0; poll < 10 && !id; poll++) {
          await wait(150);
          id = (await routed())?.id ?? "";
        }
      }
      if (!id) return "never offered";
      await w.__providers.interaction.accept(id);
      await wait(400);
      return null;
    },
    { address, displayName },
  );
  expect(failure).toBeNull();
}

/** The two boxes touch or overlap by at most `gap` px on some side (adjacent). */
function adjacent(a: { x: number; y: number; width: number; height: number }, b: typeof a, gap = 16) {
  const horizontal = a.x < b.x + b.width + gap && b.x < a.x + a.width + gap;
  const vertical = a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
  return horizontal && vertical;
}

test("1: the header \"+\" picker's Select Phone opens with every option visible, none over the field", async ({ page }) => {
  await setUp(page);
  await dialAll(page, "Alex Miller", [["email", "alex.miller@example.com"], ["sms", "(212) 555-0100"]], "customer-1");
  const plus = page.locator("[data-slot=header-add-channel] button").first();
  await expect(plus).toBeVisible();
  await plus.click();
  await page.locator("label").filter({ hasText: /^WhatsApp$/ }).first().click();
  const field = page.getByRole("combobox").filter({ hasText: /\(\d{3}\)/ }).first();
  // The field shows its value once, not stacked copies.
  await expect(field).toHaveText(/^\(200\) 200-1000$/);
  // Measured before opening: an open Radix Select hides everything else from the accessibility tree.
  const fieldBox = (await field.boundingBox())!;
  await field.click();
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  const values = await options.allTextContents();
  expect(new Set(values).size).toBe(values.length);
  for (let i = 0; i < (await options.count()); i++) {
    const box = (await options.nth(i).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(1000);
    await expect(options.nth(i)).toBeInViewport();
  }
});

test("5: two calls → the bar's label is a menu of both; choosing the held one selects its card, Resume shows, it stays held", async ({ page }) => {
  await setUp(page);
  await call(page, "(312) 555-0164", "Lauren Briggs");
  const bar = page.locator("[data-slot=voice-bar]");
  await expect(bar).toBeVisible();
  await expect(bar.locator("[data-slot=call-switcher]")).toHaveCount(0);
  await call(page, "(415) 555-0199", "Dana Wu");
  const switcher = bar.locator("[data-slot=call-switcher]");
  await expect(switcher).toBeVisible();
  await switcher.click();
  const menu = page.locator("[data-slot=call-switcher-menu]");
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  const held = menu.getByRole("menuitem").filter({ hasText: "On hold" });
  await expect(held).toContainText("Lauren Briggs");
  await expect(menu).toBeInViewport();
  await held.click();
  await expect(menu).toBeHidden();
  await expect(page.locator(".lyra-page-header-container").filter({ hasText: "Lauren Briggs" }).first()).toBeVisible();
  await expect(bar.getByRole("button", { name: /Resume/ })).toBeVisible();
  const state = await page.evaluate(async () => {
    const s = await (window as any).__providers.interaction.getSnapshot();
    return s.interactions.find((i: any) => i.channel === "voice" && i.address?.value === "(312) 555-0164").state;
  });
  expect(state).toBe("held");
});

for (const ai of ["inline", "panel"] as const) {
  test(`7, AI display ${ai}: a thread menu hangs from its icon, for two calls as for two emails`, async ({ page }) => {
    await setUp(page, ai);
    await dialAll(page, "Lauren Briggs", [
      ["email", "lauren@example.com"],
      ["email", "lauren.work@example.com"],
      ["voice", "(312) 555-0164"],
      ["voice", "(415) 555-0123"],
    ]);
    for (const label of ["Email", "Voice Transcript"]) {
      const icon = page.locator(`[aria-label='Open ${label} preview'], [aria-label='Close ${label} preview']`).first();
      await expect(icon).toBeVisible();
      await icon.click();
      const menu = page.locator("[data-slot=channel-thread-menu]");
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem")).toHaveCount(2);
      await page.waitForTimeout(250);
      const menuBox = (await menu.boundingBox())!;
      const iconBox = (await icon.boundingBox())!;
      expect(menuBox.x + menuBox.y).toBeGreaterThan(20); // not the window's top-left corner
      expect(adjacent(menuBox, iconBox)).toBe(true);
      await page.keyboard.press("Escape");
      await page.mouse.move(5, 500);
      await expect(menu).toBeHidden();
    }
  });
}

test("10: Lauren Kim with two emails, email active: hovering the icon shows the menu with the current one marked; choosing the other swaps the content", async ({ page }) => {
  await setUp(page);
  // The seeded Lauren Kim email card, plus a second email on it.
  const laurenKim = page.locator("aside [aria-label^='Lauren Kim']:visible").first();
  await expect(laurenKim).toBeVisible();
  await page.evaluate(async () => {
    const p = (window as any).__providers.interaction;
    const s = await p.getSnapshot();
    const seed = s.interactions.find((i: any) => i.channel === "email" && /Lauren Kim/.test(JSON.stringify(i)));
    await p.dial({ channel: "email", address: "lauren.kim.work@example.com", skillId: "general", contactName: "Lauren Kim", journeyId: seed.journeyId, ...(seed.entityId ? { entityId: seed.entityId } : {}) });
  });
  await laurenKim.click({ force: true });
  const icon = page.locator("[data-channel-icon=email]");
  await expect(icon).toBeVisible();
  await expect(page.locator("[data-main-thread]").first()).toHaveAttribute("data-main-thread", "email");
  await page.mouse.move(5, 500);
  await icon.hover();
  const menu = page.locator("[data-slot=channel-thread-menu]");
  await expect(menu).toBeVisible();
  await expect(page.locator("[data-slot=hover-preview]")).toHaveCount(0);
  const rows = menu.getByRole("menuitem");
  await expect(rows).toHaveCount(2);
  const current = rows.filter({ hasText: "Current" });
  await expect(current).toHaveCount(1);
  // The pointer crosses into the menu without it closing.
  const other = rows.filter({ hasNotText: "Current" });
  const before = await page.locator("[data-main-thread]").first().innerText();
  await other.hover();
  await expect(menu).toBeVisible();
  await other.click();
  await expect(menu).toBeHidden();
  await expect.poll(() => page.locator("[data-main-thread]").first().innerText()).not.toBe(before);
  // Leaving the icon closes a hover-opened menu.
  await icon.hover();
  await expect(menu).toBeVisible();
  await page.mouse.move(5, 500);
  await expect(menu).toBeHidden();
});
