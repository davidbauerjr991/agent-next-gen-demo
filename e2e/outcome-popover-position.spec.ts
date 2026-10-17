import { expect, test } from "@playwright/test";

// P-EXTRACT, Bug 1: under AI display "main", a call's Outcome opened twice:
// once under its button in the panel header's session row, and once at the
// window's top-left, anchored to a second session row kept mounted with
// display:none in the main column. One popover, under its button. (The
// count across modes is in src/contact-handling/outcome-single-popover.test.tsx.)

test("AI display main, a call: the panel row's Outcome opens one popover, under its button", async ({ page }) => {
  // Fails on HEAD (the bug); P-EXTRACT C3 removes this annotation.
  test.fail();
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: "main" } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  const failure = await page.evaluate(async () => {
    const w = window as any;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Retried until routing offers it (presence reaches the sim a moment after "Go Available").
    const routed = async () =>
      (await w.__providers.interaction.getSnapshot()).interactions.find((i: any) => i.channel === "voice" && i.address?.value === "(312) 555-0164");
    let id = "";
    for (let attempt = 0; attempt < 20 && !id; attempt++) {
      w.__simCustomer.startInbound({ channel: "voice", address: "(312) 555-0164", displayName: "Lauren Briggs" });
      for (let poll = 0; poll < 10 && !id; poll++) {
        await wait(150);
        id = (await routed())?.id ?? "";
      }
    }
    if (!id) return "the call was never offered";
    try {
      await w.__providers.interaction.accept(id);
      return null;
    } catch (error) {
      return JSON.stringify(error);
    }
  });
  expect(failure).toBeNull();
  await page.locator("aside [aria-label^='Lauren Briggs']:visible").first().click({ force: true });

  const trigger = page.locator("[data-slot=right-panel] [data-slot=panel-session-row] button[aria-label='Outcome']").filter({ hasText: "Outcome" });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();

  const popovers = page.locator("[data-radix-popper-content-wrapper]").filter({ hasText: "Log Outcome" });
  await expect(popovers.first()).toBeVisible();
  // Let the open animation settle before measuring.
  await page.waitForTimeout(400);
  await expect(popovers).toHaveCount(1);
  const button = (await trigger.boundingBox())!;
  const box = (await popovers.first().boundingBox())!;
  expect(box.x).toBeGreaterThan(50);
  expect(box.y).toBeGreaterThan(50);
  expect(Math.abs(box.y - (button.y + button.height))).toBeLessThan(40);
});
