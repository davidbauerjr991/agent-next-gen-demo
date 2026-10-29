import { expect, test, type Page } from "@playwright/test";

// P-CANVAS browser pass (2026-10-23): every new assignment opens on the
// Next Best Action's greeting — a dialed outbound once the far end answers;
// an unscripted call's caller answers each suggestion with a canned line; a
// call under AI display inline can hide its transcript (only the AI rows
// stay; Contact Details offers the Transcript tab); the Ask Copilot pill's
// input sits centred after the composer toggles from the chat input.

async function start(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  // The launch screen first (it's the dialog over the page).
  await page.getByRole("button", { name: "Go Available" }).click();
  // Phase 2: New Outbound's All tab (the directory) and every channel; AI display inline (its default).
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await page.getByRole("combobox", { name: "Profile" }).click();
  await page.getByRole("option", { name: "Phase 2", exact: true }).click();
  await page.locator("aside").getByText("Home", { exact: true }).first().click();
  await page.waitForTimeout(500);
}

/** New Outbound → Nathan Cole → Voice → Start Interaction; resolves when the far end answers (its time, ms since epoch). */
async function dialNathan(page: Page): Promise<number> {
  await page.locator("aside").getByRole("button", { name: /New Outbound/ }).first().click();
  const launcher = page.getByRole("dialog").last();
  await launcher.getByLabel("Enter phone, email or search term").fill("Nathan Cole");
  await launcher.getByText(/^All/).first().click();
  await launcher.getByRole("button", { name: /^Nathan Cole CST/ }).click();
  await launcher.locator("label").filter({ hasText: /^Voice$/ }).first().click();
  await launcher.getByRole("button", { name: "Start Interaction" }).click();
  const answeredAt = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    for (let i = 0; i < 400; i++) {
      const call = (await w.__providers.interaction.getSnapshot()).interactions.find(
        (c: { channel: string; state: string; direction: string }) => c.channel === "voice" && c.direction === "outbound" && c.state === "active",
      );
      if (call) return Date.now();
      await new Promise((r) => setTimeout(r, 25));
    }
    return 0;
  });
  expect(answeredAt).toBeGreaterThan(0);
  return answeredAt;
}

const nba = (page: Page) => page.locator("[data-slot=next-best-action]");
const main = (page: Page) => page.locator("[data-main-thread]");

/** Which of the sim caller's canned lines (every skill's pool) are in the main column. */
const callerLines = (page: Page) =>
  page.evaluate(async () => {
    const text = document.querySelector("[data-main-thread]")?.textContent ?? "";
    const lines = [
      "I'm calling about my account",
      "I got a notice about a change",
      "Can you check that for me?",
      "that's all I needed",
      "My device stopped connecting",
      "I have a question about my last bill",
      "I'm looking at upgrading my plan",
    ];
    return lines.filter((line) => text.includes(line));
  });

test("New Outbound → dial Nathan → the greeting within 2s of the far end answering", async ({ page }) => {
  await start(page);
  const answeredAt = await dialNathan(page);
  await expect(nba(page)).toHaveAttribute("data-frame", "say");
  const shownAt = await page.evaluate(() => Date.now());
  await expect(nba(page)).toContainText("Greet Nathan");
  expect(shownAt - answeredAt).toBeLessThan(2_000);
});

test("Nathan: Said it → the caller says a canned line within 3s", async ({ page }) => {
  await start(page);
  await dialNathan(page);
  await expect(nba(page)).toHaveAttribute("data-frame", "say", { timeout: 5_000 });
  expect(await callerLines(page)).toEqual([]);
  await nba(page).getByRole("button", { name: "Said it" }).click();
  await expect.poll(async () => (await callerLines(page)).length, { timeout: 3_000 }).toBe(1);
});

test("Nathan, inline: Hide Transcript on → no utterances, the AI rows stay, Contact Details has a Transcript tab; off → restored", async ({ page }) => {
  await start(page);
  await dialNathan(page);
  await expect(nba(page)).toHaveAttribute("data-frame", "say", { timeout: 5_000 });
  await nba(page).getByRole("button", { name: "Said it" }).click();
  await expect.poll(async () => (await callerLines(page)).length, { timeout: 3_000 }).toBe(1);
  // Contact Details beside it (the reference slide-over, P-HOME-1n).
  const panel = page.locator("[data-slot=reference-slide-over]");
  if ((await panel.locator("[data-slot=contact-details-tabs]").count()) === 0) await page.locator("button[data-contact-details]").first().click();
  await expect(panel.locator("[data-slot=contact-details-tabs]")).toBeVisible();
  const transcriptTab = panel.locator("[data-slot=contact-details-tabs] [role=tab]", { hasText: /^Transcript$/ });
  await expect(transcriptTab).toHaveCount(0);

  const toggle = page.getByRole("switch", { name: "Hide Transcript" });
  await toggle.click();
  expect(await callerLines(page)).toEqual([]);
  await expect(main(page).locator("[data-slot=nba-outcome]")).toBeVisible();
  await expect(transcriptTab).toHaveCount(1);

  await toggle.click();
  expect(await callerLines(page)).toHaveLength(1);
  await expect(main(page).locator("[data-slot=nba-outcome]")).toBeVisible();
  await expect(transcriptTab).toHaveCount(0);
});

test("inline chat: after Chat with Customer → Ask Copilot, the pill's input is centred and its placeholder unclipped, toggle after toggle", async ({ page }) => {
  await start(page);
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
  await page.locator("aside [aria-label^='Priya Shah']").first().click({ force: true });
  const chatToggle = page.getByRole("radio", { name: "Chat with Customer" }).or(page.getByRole("button", { name: "Chat with Customer" })).first();
  const copilotToggle = page.getByRole("radio", { name: "Ask Copilot" }).or(page.getByRole("button", { name: "Ask Copilot" })).first();
  const pillInput = main(page).locator("[data-slot=copilot-composer] textarea");
  for (let round = 0; round < 3; round++) {
    await copilotToggle.click();
    await expect(pillInput).toBeVisible();
    const fit = await pillInput.evaluate((el) => {
      const ta = el as HTMLTextAreaElement;
      const pill = ta.parentElement!.getBoundingClientRect();
      const box = ta.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
      return {
        offset: Math.abs(box.top + box.height / 2 - (pill.top + pill.height / 2)),
        // The placeholder's line fits the box: at least a line tall, nothing clipped below.
        tallEnough: ta.clientHeight >= lineHeight,
        unclipped: ta.scrollHeight <= ta.clientHeight + 1,
      };
    });
    expect(fit.offset, `round ${round}`).toBeLessThanOrEqual(2);
    expect(fit.tallEnough, `round ${round}`).toBe(true);
    expect(fit.unclipped, `round ${round}`).toBe(true);
    await chatToggle.click();
  }
});
