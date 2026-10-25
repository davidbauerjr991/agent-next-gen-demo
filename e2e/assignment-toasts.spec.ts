import { expect, test, type Page } from "@playwright/test";

// Toasts for other assignments (P-HOME-1) in a real browser: a message on a
// chat the agent isn't looking at toasts; View switches and focuses the
// composer; Dismiss leaves the drawer row; `enabled: false` shows nothing;
// the seeded Maya + Lucas moment (M) toasts Lucas's approval during the call.

const settings = (section: string, version: number, value: unknown) => ({ key: `agent-next-gen:settings:${section}`, body: JSON.stringify({ v: version, value }) });

async function open(page: Page, extra: { key: string; body: string }[] = []) {
  const seeded = [settings("channels", 1, { voice: true, chat: true }), settings("header", 2, { showAppIcons: true }), ...extra];
  await page.addInitScript((items) => {
    for (const { key, body } of items) localStorage.setItem(key, body);
  }, seeded);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

/** Starts two live chats and opens the first; returns the second's id. */
async function twoChats(page: Page): Promise<string> {
  const ben = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__simCustomer.startInbound({ channel: "chat", address: "ana@example.com", displayName: "Ana Silva" });
    const id = w.__simCustomer.startInbound({ channel: "chat", address: "ben@example.com", displayName: "Ben Ortiz" });
    await wait(800);
    return id as string;
  });
  await page.locator("aside [aria-label^='Ana Silva']").first().click({ force: true });
  return ben;
}

async function customerSays(page: Page, id: string, text: string) {
  await page.evaluate(
    ([interactionId, line]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__simCustomer.message({ interactionId, text: line });
    },
    [id, text] as const,
  );
}

const toasts = (page: Page) => page.locator("[data-assignment-toast]");

test("a message on the other chat toasts; View switches to it with the composer focused", async ({ page }) => {
  await open(page);
  const ben = await twoChats(page);
  await customerSays(page, ben, "Is the tank shipping today?");
  const toast = toasts(page).first();
  await expect(toast).toContainText("Ben Ortiz");
  await expect(toast).toContainText("Is the tank shipping today?");
  await toast.getByRole("button", { name: "View" }).click();
  await expect(toasts(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ben Ortiz" }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute("data-composer-input") ?? false)).toBe(true);
});

test("Dismiss closes the toast; its row stays in the Notifications drawer", async ({ page }) => {
  await open(page);
  const ben = await twoChats(page);
  await customerSays(page, ben, "Hello?");
  await toasts(page).first().getByRole("button", { name: "Dismiss" }).click();
  await expect(toasts(page)).toHaveCount(0);
  await page.locator('[aria-label^="Notifications"]').first().click();
  await expect(page.getByText("Ben Ortiz · Hello?")).toBeVisible();
});

test("notifications.toasts.enabled: false shows nothing", async ({ page }) => {
  const off = settings("notifications", 1, {
    toasts: { enabled: false, events: { message: true, approval: true, callbackDue: true }, duration: 8, quietOnVoice: false, position: "bottomEnd" },
  });
  await open(page, [off]);
  const ben = await twoChats(page);
  await customerSays(page, ben, "Hello?");
  await page.waitForTimeout(1_000);
  await expect(toasts(page)).toHaveCount(0);
});

test("the seeded moment (M): Lucas's approval request toasts during Maya's call", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await page.keyboard.press("m");
  const approval = page.locator('[data-assignment-toast="approval"]');
  await expect(approval).toContainText("Lucas Thomas", { timeout: 45_000 });
  await expect(approval).toContainText("requested approval");
  await approval.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: "Lucas Thomas" }).first()).toBeVisible();
});
