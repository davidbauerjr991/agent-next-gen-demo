import { expect, test } from "@playwright/test";

// P-LAYOUT-F1 F: a plain Copilot answer is an inline line in the conversation ("time · Copilot · the question", then
// the text), after the instruction row's "performing" state; no row to click and no slide-over.

test("a plain answer on an unscripted chat: the performing state, then the inline line, and nothing opens", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "inline" } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true, whatsapp: true } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  // One inbound chat, waited on until that same contact is live.
  const id = await page.evaluate(
    () => (window as any).__simCustomer.startInbound({ channel: "chat", address: "dana.plain@example.com", displayName: "Dana Plain" }) as string,
  );
  await expect
    .poll(() => page.evaluate(async (id) => (await (window as any).__providers.interaction.getSnapshot()).interactions.some((i: any) => i.id === id && i.state === "active"), id), { timeout: 15_000 })
    .toBe(true);
  await page.locator('aside [aria-label="Dana Plain"], aside [aria-label^="Dana Plain,"]').first().click({ force: true });

  const main = page.locator("[data-main-thread]");
  await page.getByRole("radio", { name: "Ask Copilot" }).click();
  // The composer also keeps an invisible measuring copy of its chips.
  const chip = page.locator("[data-slot=copilot-composer] [data-slot=copilot-chips] [role=button]").filter({ visible: true }).first();
  const question = (await chip.textContent())!.trim();
  await chip.click();
  await expect(main).toContainText("AI agent is performing this now…");
  const line = main.locator("[data-event-line]", { hasText: `Copilot · ${question}` });
  await expect(line).toBeVisible({ timeout: 5_000 });
  await expect(main).not.toContainText("AI agent is performing this now…");
  // Not a row: nothing to click, and no slide-over opened.
  await expect(line.locator("xpath=ancestor-or-self::button")).toHaveCount(0);
  // A beat past the line, in case a result opened a frame later.
  await page.waitForTimeout(500);
  await expect(page.locator("[data-slot=copilot-result]").filter({ visible: true })).toHaveCount(0);
});
