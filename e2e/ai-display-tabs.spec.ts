import { expect, test, type Page } from "@playwright/test";

// P-AIFIRST (k), (k3): under AI display inline and panel the record header's
// channel icons are tabs for the main column, voice included: clicking one
// swaps the main column (a call's tab is its AI workspace, never empty); the
// inactive tab still previews on hover; the docked panel never shows a
// thread. Real layout and pointer, so Chrome.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function setUp(page: Page, ai: "inline" | "panel" = "inline") {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript((displayLocation) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true } }));
  }, ai);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

const icon = (page: Page, label: string) => page.locator(`[aria-label='Open ${label} preview'], [aria-label='Close ${label} preview']`).first();
const mainThread = (page: Page) => page.locator("[data-main-thread]").first();

for (const ai of ["inline", "panel"] as const) {
  test(`AI display ${ai}: a call's tab is its AI workspace (Autosummary and Copilot in the main column), beside the email tab`, async ({ page }) => {
    await setUp(page, ai);
    const failure = await page.evaluate(async () => {
      const w = window as any;
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      // Retried until routing offers it (presence reaches the sim a moment after "Go Available").
      let id = "";
      for (let attempt = 0; attempt < 20 && !id; attempt++) {
        const tried = w.__simCustomer.startInbound({ channel: "voice", address: "(312) 555-0164", displayName: "Lauren Briggs" });
        await wait(300);
        if ((await w.__providers.interaction.getSnapshot()).interactions.some((i: any) => i.id === tried)) id = tried;
      }
      if (!id) return "the call was never offered";
      try {
        await w.__providers.interaction.accept(id);
        await new Promise((r) => setTimeout(r, 300));
        const call = (await w.__providers.interaction.getSnapshot()).interactions.find((i: any) => i.id === id);
        await w.__providers.interaction.dial({ channel: "email", address: "lauren@example.com", skillId: "general", journeyId: call.journeyId });
        return null;
      } catch (error) {
        return JSON.stringify(error);
      }
    });
    expect(failure).toBeNull();
    await page.locator("aside [aria-label^='Lauren Briggs']").first().click({ force: true });
    await expect(icon(page, "Email")).toBeVisible();
    await icon(page, "Voice Transcript").click();
    await expect(mainThread(page)).toHaveAttribute("data-main-thread", "voice");
    const workspace = page.locator("[data-main-thread=voice] [data-slot=ai-workspace]");
    await expect(workspace.locator("[data-slot=autosummary]")).toBeVisible();
    await expect(page.locator("[data-main-thread=voice] [data-slot=copilot-composer]")).toBeVisible();
    await expect(page.locator("[data-slot=voice-bar]")).toHaveCount(1);
    await icon(page, "Email").click();
    await expect(mainThread(page)).toHaveAttribute("data-main-thread", "email");
  });
}

test("AI display inline: a header tab swaps the main column; the inactive tab previews; the panel holds no thread", async ({ page }) => {
  await setUp(page);
  // Priya's inbound chat (it loads as a card), then an email on the same card.
  const failure = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const w = window as any;
    for (let attempt = 0; attempt < 20; attempt++) {
      const id = w.__simCustomer.startInbound({ channel: "chat", address: "priya.shah@example.com", displayName: "Priya Shah" });
      await wait(500);
      const chat = (await w.__providers.interaction.getSnapshot()).interactions.find((i: any) => i.id === id && i.state === "active");
      if (!chat) continue;
      await w.__providers.interaction.dial({ channel: "email", address: "priya.shah@example.com", skillId: "general", journeyId: chat.journeyId });
      return null;
    }
    return "the chat never went live";
  });
  expect(failure).toBeNull();
  await page.locator("aside [aria-label^='Priya Shah']").first().click({ force: true });

  // The accepted chat is the main tab; the email (placed beside it) is inactive.
  await expect(mainThread(page)).toHaveAttribute("data-main-thread", "chat");
  await expect(icon(page, "Chat")).toHaveAttribute("aria-pressed", "true");
  await expect(icon(page, "Email")).toHaveAttribute("aria-pressed", "false");

  // Hovering the inactive tab previews it; the active tab doesn't.
  await page.mouse.move(5, 5);
  await icon(page, "Chat").hover();
  await page.waitForTimeout(500);
  await expect(page.locator("[data-slot=hover-preview]")).toHaveCount(0);
  await page.mouse.move(5, 5);
  await icon(page, "Email").hover();
  await expect(page.locator("[data-slot=hover-preview]")).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(page.locator("[data-slot=hover-preview]")).toHaveCount(0);

  // Clicking the email tab swaps the main column; the panel never shows a thread.
  await icon(page, "Email").click();
  await expect(mainThread(page)).toHaveAttribute("data-main-thread", "email");
  await expect(icon(page, "Email")).toHaveAttribute("aria-pressed", "true");
  await expect(icon(page, "Chat")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-slot=right-panel][data-thread=chat], [data-slot=right-panel][data-thread=email]")).toHaveCount(0);

  // And back.
  await icon(page, "Chat").click();
  await expect(mainThread(page)).toHaveAttribute("data-main-thread", "chat");
});
