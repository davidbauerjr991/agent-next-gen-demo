import { expect, test, type Page } from "@playwright/test";

// P-CANVAS: the Next Best Action is the action area's first element, above
// the thread, on every kind of contact (a scripted call, a scripted chat the
// bot hands over, a sim inbound chat, an agent-dialed call), under AI display
// inline and main. It opens with the greeting; using it ("Said it" on a call,
// "Insert into reply" on a chat) logs a Used row and the card moves on. The
// reference column opens with exactly one card expanded. Layout order, so Chrome.

type Mode = "inline" | "main";

async function start(page: Page, displayLocation: Mode) {
  await page.setViewportSize({ width: displayLocation === "main" ? 2200 : 1600, height: 1000 });
  await page.addInitScript((display) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: display, canvasLayout: "twoColumn" } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true } }));
  }, displayLocation);
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

const CONTACTS: Record<string, { use: "Said it" | "Insert into reply"; open: (page: Page) => Promise<string> }> = {
  maya: {
    use: "Said it",
    open: async (page) => {
      await page.keyboard.press("b");
      await openCard(page, "Maya Chen");
      return "Maya";
    },
  },
  lucas: {
    use: "Insert into reply",
    open: async (page) => {
      await page.keyboard.press("a");
      await openCard(page, "Lucas Thomas");
      // The bot holds the chat until the agent takes over; then the chat composer is theirs.
      await page.getByRole("button", { name: "Takeover Chat" }).first().click({ timeout: 20_000 });
      await page.waitForTimeout(500);
      return "Lucas";
    },
  },
  simChat: {
    use: "Insert into reply",
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
      return "Priya";
    },
  },
  dialed: {
    use: "Said it",
    open: async (page) => {
      await page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__providers.interaction.dial({ channel: "voice", address: "(161) 474-9179", skillId: "general" }),
      );
      await openCard(page, "(161) 474-9179");
      return "the customer";
    },
  },
};

const nba = (page: Page) => page.locator("[data-slot=next-best-action]");

for (const displayLocation of ["inline", "main"] as const) {
  for (const [name, contact] of Object.entries(CONTACTS)) {
    test(`${displayLocation}, ${name}: the Next Best Action leads the action area, opens with the greeting, and moves on once used`, async ({ page }) => {
      await start(page, displayLocation);
      const who = await contact.open(page);
      await expect(nba(page)).toHaveAttribute("data-frame", "say", { timeout: 10_000 });
      await expect(nba(page)).toContainText(`Greet ${who}`);

      // The first element in the action area, above the thread.
      // Every other visible line of the thread (not the composer, not another cell) starts below the card.
      const order = await page.evaluate(() => {
        const area = document.querySelector("[data-canvas-region=action]")!;
        const card = area.querySelector("[data-slot=next-best-action]")!;
        const cardTop = card.getBoundingClientRect().top;
        const above = [...area.querySelectorAll<HTMLElement>("*")].filter((el) => {
          if (el.children.length > 0 || !el.textContent?.trim()) return false;
          // Not the outgoing copy a tab switch fades out over the slot (ThreadCrossFade).
          if (card.contains(el) || el.closest("[data-slot=copilot-composer], [data-canvas-cell], textarea, [data-slot=record-session-row], [data-slot=thread-crossfade-out]")) return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.top < cardTop - 1;
        });
        return { first: area.querySelector("[data-canvas-cell]")?.getAttribute("data-canvas-cell"), above: above.map((el) => el.textContent!.trim().slice(0, 40)) };
      });
      expect(order.first).toBe("next-best-action");
      expect(order.above).toEqual([]);

      // Exactly one reference card expanded at load.
      const expanded = await page.locator("[data-canvas-region=reference] [aria-expanded=true]").count();
      expect(expanded).toBe(1);

      // Use it: a Used row in the thread, and the card shows its next frame.
      const step = await nba(page).getAttribute("data-step");
      await nba(page).getByRole("button", { name: contact.use }).click();
      await expect(page.locator("[data-slot=nba-outcome][data-outcome=used]").first()).toBeVisible();
      await expect(page.locator("[data-slot=nba-outcome][data-outcome=used]").first()).toContainText("Used at");
      await expect.poll(async () => (await nba(page).getAttribute("data-step")) !== step || (await nba(page).getAttribute("data-frame")) !== "say").toBe(true);
    });
  }
}
