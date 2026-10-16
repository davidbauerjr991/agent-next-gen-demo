import { expect, test, type Page } from "@playwright/test";

// AI display "main" (the AI-first profile, P-AIFIRST): the main column is the
// AI workspace and every conversation thread, the chat included, opens in the
// docked right panel; a nav row swaps the panel's thread. Layout, so Chrome.

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

async function chatAndEmailCard(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 1, value: { omnichannel: true } }));
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "main" } }));
    localStorage.setItem(
      "agent-next-gen:settings:channels",
      JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true } }),
    );
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  // A chat offer is a notification, not a nav card: accept it directly. The
  // offer is refused until the agent's Available state reaches the sim, so
  // offer again until one can be accepted.
  const failure = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let last: unknown = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const id = window.__simCustomer!.startInbound({ channel: "chat", address: "lauren@example.com", displayName: "Lauren Briggs" });
      await wait(500);
      try {
        await window.__providers!.interaction.accept(id);
        await wait(300);
        const { interactions } = await window.__providers!.interaction.getSnapshot();
        const chat = interactions.find((i) => i.id === id)!;
        await window.__providers!.interaction.dial({ channel: "email", address: "lauren@example.com", skillId: "general", journeyId: chat.journeyId });
        return null;
      } catch (error) {
        last = error;
      }
    }
    return JSON.stringify(last);
  });
  expect(failure).toBeNull();
  await expect(page.locator("aside [aria-label^='Lauren Briggs']").first()).toBeVisible();
  // `force`: the new-assignment card animates, so it never reads as "stable".
  await page.locator("aside [aria-label^='Lauren Briggs']").first().click({ force: true });
}

const navRow = (page: Page, label: string) => page.locator(`aside [aria-label^='${label} channel']`).first();
const panel = (page: Page, thread: string) => page.locator(`[data-slot=right-panel][data-open=true][data-thread=${thread}]`);

test("chat in the panel, AI in the main column; a nav row swaps the panel's thread", async ({ page }) => {
  await chatAndEmailCard(page);
  const main = page.locator("[data-main-thread=ai]");
  await expect(main).toBeVisible();
  await expect(main.locator("[data-slot=ai-workspace]")).toBeVisible();
  await expect(main.locator("[data-slot=copilot-composer]")).toBeVisible();

  // A thread is open in the panel (the chat, or the email that was just
  // added, depending on timing); the other row swaps it.
  const rightPanel = page.locator("[data-slot=right-panel][data-open=true]");
  await expect(rightPanel).toHaveAttribute("data-thread", /^(chat|email)$/);
  if ((await rightPanel.getAttribute("data-thread")) === "chat") {
    await navRow(page, "Email").click({ force: true });
    await expect(panel(page, "email")).toBeVisible();
  }
  await navRow(page, "Chat").click({ force: true });
  await expect(panel(page, "chat")).toBeVisible();
  // The chat's composer is in the panel, beside the AI column, not under it.
  const panelBox = (await page.locator("[data-slot=right-panel]").boundingBox())!;
  const mainBox = (await main.boundingBox())!;
  expect(panelBox.x).toBeGreaterThanOrEqual(mainBox.x + mainBox.width - 1);
  await expect(page.locator("[data-slot=right-panel] textarea").first()).toBeVisible();

  await navRow(page, "Email").click({ force: true });
  await expect(panel(page, "email")).toBeVisible();
  await expect(page.locator("[data-main-thread=ai]")).toBeVisible();
});
