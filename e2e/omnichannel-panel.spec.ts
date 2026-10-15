import { expect, test, type Page } from "@playwright/test";

// Omnichannel: an async thread opens in the same docked right panel as
// Contact Details (it pushes the main column, not an overlay), and a channel
// icon's hover preview shows only while that channel isn't open in the panel.
// Layout and hover, so Chrome, not jsdom.

declare global {
  interface Window {
    __simCustomer?: { startInbound(r: { channel: string; address: string; displayName: string }): string };
    __providers?: {
      interaction: {
        accept(id: string): Promise<void>;
        getSnapshot(): Promise<{ interactions: { id: string; journeyId: string }[] }>;
        dial(r: { channel: string; address: string; skillId: string; journeyId: string }): Promise<unknown>;
      };
    };
  }
}

async function voiceAndEmailCard(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 1, value: { omnichannel: true } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, email: true } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  const id = await page.evaluate(() =>
    window.__simCustomer!.startInbound({ channel: "voice", address: "(312) 555-0164", displayName: "Lauren Briggs" }),
  );
  // Ringing: its card is in the nav.
  await expect(page.locator("aside [aria-label^='Lauren Briggs']").first()).toBeVisible();
  const failure = await page.evaluate(async (id) => {
    const step = async (name: string, run: () => Promise<unknown>) => {
      try {
        await run();
        return null;
      } catch (error) {
        return `${name}: ${JSON.stringify(error)}`;
      }
    };
    const accepted = await step("accept", () => window.__providers!.interaction.accept(id));
    if (accepted) return accepted;
    await new Promise((r) => setTimeout(r, 300));
    const { interactions } = await window.__providers!.interaction.getSnapshot();
    const call = interactions.find((i) => i.id === id)!;
    return step("dial", () =>
      window.__providers!.interaction.dial({ channel: "email", address: "lauren@example.com", skillId: "general", journeyId: call.journeyId }),
    );
  }, id);
  expect(failure).toBeNull();
  // `force`: the new-assignment card animates, so it never reads as "stable".
  await page.locator("aside [aria-label^='Lauren Briggs']").first().click({ force: true });
  await expect(page.locator("[data-main-thread=voice]")).toBeVisible();
  // A newly added channel opens where it routes (the email: the panel).
  // Start each test from a closed panel.
  await expect(page.locator("[data-slot=right-panel][data-thread=email][data-open=true]")).toBeVisible();
  await page.locator("[aria-label='Close Email preview']").click();
  await expect(page.locator("[data-slot=right-panel][data-open=false]")).toHaveCount(1);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400); // the panel's width transition
}

const emailIcon = (page: Page) => page.locator("[aria-label='Open Email preview'], [aria-label='Close Email preview']").first();
const hoverPreview = (page: Page) => page.locator("[data-radix-popper-content-wrapper]").filter({ hasText: "Email" });

test("the email opens in the docked right panel: it pushes the main column, which narrows", async ({ page }) => {
  await voiceAndEmailCard(page);
  const main = page.locator("[data-main-thread]");
  const before = (await main.boundingBox())!;
  await emailIcon(page).click();
  const panel = page.locator("[data-slot=right-panel][data-thread=email][data-open=true]");
  await expect(panel).toBeVisible();
  await page.waitForTimeout(400); // the panel's width transition
  const after = (await main.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(after.width).toBeLessThan(before.width - 100);
  // Docked beside the main column, not over it.
  expect(panelBox.x).toBeGreaterThanOrEqual(after.x + after.width - 1);
});

test("a channel icon's hover preview shows only while its thread isn't open in the panel", async ({ page }) => {
  await voiceAndEmailCard(page);
  await emailIcon(page).hover();
  await expect(hoverPreview(page)).toBeVisible();
  // Clicking opens the panel; with the pointer still on the icon, the
  // preview goes away (it would show what the panel now shows).
  await emailIcon(page).click();
  await expect(page.locator("[data-slot=right-panel][data-thread=email][data-open=true]")).toBeVisible();
  await page.waitForTimeout(300);
  await expect(hoverPreview(page)).toHaveCount(0);
  // Hovering again while it's open: still none.
  await page.mouse.move(5, 5);
  await emailIcon(page).hover();
  await page.waitForTimeout(500);
  await expect(hoverPreview(page)).toHaveCount(0);
});
