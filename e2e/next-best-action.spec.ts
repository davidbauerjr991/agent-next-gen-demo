import { expect, test, type Page } from "@playwright/test";

// P-CANVAS: the Next Best Action is inline and on demand — a row in the
// conversation that surfaces after a pause (no customer or agent turn for
// Settings → AI's pause) or at once on the "What should I do next?" chip,
// under AI display inline and main. The reference column: the AI focuses a
// card; the agent's own opens stay. Real browser timing, so Chrome.

type Mode = "inline" | "main";
/** Short pauses so the spec doesn't wait 6–8s per case. */
const PAUSE_MS = 3000;

async function start(page: Page, displayLocation: Mode) {
  await page.setViewportSize({ width: displayLocation === "main" ? 2200 : 1600, height: 1000 });
  await page.addInitScript(
    ([display, pause]) => {
      localStorage.setItem(
        "agent-next-gen:settings:ai",
        JSON.stringify({ v: 1, value: { displayLocation: display, canvasLayout: "twoColumn", nbaPauseChatMs: pause, nbaPauseVoiceMs: pause } }),
      );
      localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true } }));
    },
    [displayLocation, PAUSE_MS] as const,
  );
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.waitForTimeout(500);
}

async function openCard(page: Page, name: string) {
  const card = page.locator(`aside [aria-label^='${name}']`).first();
  await card.waitFor({ timeout: 15_000 });
  await card.click({ force: true });
  await expect(page.locator("[data-canvas-region=action]")).toBeVisible();
}

const CONTACTS: Record<string, { who: string; open: (page: Page) => Promise<void> }> = {
  maya: {
    who: "Maya",
    open: async (page) => {
      await page.keyboard.press("b");
      await openCard(page, "Maya Chen");
    },
  },
  simChat: {
    who: "Priya",
    open: async (page) => {
      const failure = await page.evaluate(async () => {
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        for (let attempt = 0; attempt < 20; attempt++) {
          const id = w.__simCustomer.startInbound({ channel: "chat", address: "priya.shah@example.com", displayName: "Priya Shah" });
          await wait(500);
          const chat = (await w.__providers.interaction.getSnapshot()).interactions.find((i: { id: string; state: string }) => i.id === id && i.state === "active");
          if (chat) return null;
        }
        return "the chat never went live";
      });
      expect(failure).toBeNull();
      await openCard(page, "Priya Shah");
    },
  },
};

const nba = (page: Page) => page.locator("[data-slot=next-best-action]");

for (const displayLocation of ["inline", "main"] as const) {
  for (const [name, contact] of Object.entries(CONTACTS)) {
    test(`${displayLocation}, ${name}: no Next Best Action at first; after the pause it's a row in the conversation`, async ({ page }) => {
      await start(page, displayLocation);
      await contact.open(page);
      await expect(nba(page)).toHaveCount(0);
      await expect(nba(page)).toHaveAttribute("data-frame", "say", { timeout: 15_000 });
      await expect(nba(page)).toContainText(`Greet ${contact.who}`);
      // A row of the conversation (the transcript inline, the AI feed under "main"), not a canvas cell.
      const placement = await nba(page).evaluate((el) => ({ inMain: !!el.closest("[data-main-thread]"), inCell: !!el.closest("[data-canvas-cell]") }));
      expect(placement).toEqual({ inMain: true, inCell: false });
      // Exactly one reference card is expanded at first.
      expect(await page.locator("[data-canvas-region=reference] [aria-expanded=true]").count()).toBe(1);
    });

    test(`${displayLocation}, ${name}: the chip surfaces it at once`, async ({ page }) => {
      await start(page, displayLocation);
      await contact.open(page);
      await expect(nba(page)).toHaveCount(0);
      const chip = page.locator("[data-slot=copilot-chip-pinned]:visible").first();
      // An inline chat shows its chat input first; the chip is in the Ask Copilot pane.
      if (!(await chip.isVisible())) await page.getByRole("radio", { name: "Ask Copilot" }).or(page.getByRole("button", { name: "Ask Copilot" })).first().click();
      await chip.click();
      await expect(nba(page)).toHaveAttribute("data-frame", "say", { timeout: 1_500 });
    });
  }
}

test("inline, Maya: her card-on-file turn expands Customer Info beside the agent's own Journey Summary; a summary refresh changes nothing", async ({ page }) => {
  await start(page, "inline");
  await CONTACTS.maya.open(page);
  const expanded = () =>
    page.evaluate(() =>
      ["real-time-summary", "journey-summary", "customer-info-card"].filter(
        (slot) => document.querySelector(`[data-slot=${slot}] [aria-expanded]`)?.getAttribute("aria-expanded") === "true",
      ),
    );
  expect(await expanded()).toEqual(["real-time-summary"]);
  // The agent opens the Journey Summary: additive.
  await page.locator("[data-slot=journey-summary] [aria-expanded]").click();
  expect(await expanded()).toEqual(["real-time-summary", "journey-summary"]);
  // Maya names her Visa about 12s after the call connects: Customer Info opens; the AI's summary closes; the agent's card stays.
  await expect.poll(expanded, { timeout: 20_000 }).toEqual(["journey-summary", "customer-info-card"]);
  const words = () => page.locator("[data-slot=real-time-summary]").getAttribute("data-words");
  const before = await words();
  // Her next turn (20s after answer) refreshes the summary; nothing else changes.
  await expect.poll(words, { timeout: 15_000 }).not.toBe(before);
  expect(await expanded()).toEqual(["journey-summary", "customer-info-card"]);
});
