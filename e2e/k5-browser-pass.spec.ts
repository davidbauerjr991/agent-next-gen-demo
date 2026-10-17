import { expect, test, type Page } from "@playwright/test";

// P-AIFIRST (k5), the layout and animation half of the browser-pass fixes:
// A the voice tab's content is as wide as every other tab's; D a tab switch
// is a cross-fade (opacity only, nothing slides); F New Outbound to a
// directory customer with no open card gets a new card (the seeded Noah
// Patel card is untouched); H hover previews open with no animation.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function setUp(page: Page, ai: "inline" | "panel" = "inline") {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript((displayLocation) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true } }));
  }, ai);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

const icon = (page: Page, label: string) => page.locator(`[aria-label='Open ${label} preview'], [aria-label='Close ${label} preview']`).first();
const mainThread = (page: Page) => page.locator("[data-main-thread]").first();

/** Lauren: a call (retried until routing offers it), then an email on the same card; the card selected. */
async function callAndEmail(page: Page) {
  const failure = await page.evaluate(async () => {
    const w = window as any;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Retried until routing offers it (presence reaches the sim a moment after "Go Available"); each try
    // waits up to 1.5s for that call (or any call from the number) before starting another.
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
    await w.__providers.interaction.accept(id);
    await wait(300);
    const call = (await w.__providers.interaction.getSnapshot()).interactions.find((i: any) => i.id === id);
    await w.__providers.interaction.dial({ channel: "email", address: "lauren@example.com", skillId: "general", journeyId: call.journeyId });
    return null;
  });
  expect(failure).toBeNull();
  await page.locator("aside [aria-label^='Lauren Briggs']:visible").first().click({ force: true });
  await expect(icon(page, "Email")).toBeVisible({ timeout: 10_000 });
}

/** The main column's current content stack (its last session's). */
const stackWidth = (page: Page) =>
  page.evaluate(() => {
    const stacks = document.querySelectorAll("[data-main-thread] [data-slot=content-stack]");
    return stacks[stacks.length - 1]?.getBoundingClientRect().width ?? 0;
  });

for (const ai of ["inline", "panel"] as const) {
  test(`A, AI display ${ai}: the voice tab's content is as wide as the email tab's`, async ({ page }) => {
    await setUp(page, ai);
    await callAndEmail(page);
    await icon(page, "Voice Transcript").click();
    await expect(mainThread(page)).toHaveAttribute("data-main-thread", "voice");
    await page.waitForTimeout(400);
    const voice = await stackWidth(page);
    await icon(page, "Email").click();
    await expect(mainThread(page)).toHaveAttribute("data-main-thread", "email");
    await page.waitForTimeout(400);
    const email = await stackWidth(page);
    expect(voice).toBeGreaterThan(0);
    expect(Math.abs(voice - email)).toBeLessThanOrEqual(1);
  });

  test(`D, AI display ${ai}: voice ↔ email is a cross-fade: the outgoing content fades out over the incoming, opacity only, gone after it`, async ({ page }) => {
    await setUp(page, ai);
    await callAndEmail(page);
    for (const label of ["Voice Transcript", "Email"]) {
      if ((await icon(page, label).getAttribute("aria-pressed")) === "true") continue;
      // Record the moment the outgoing copy is laid over the slot (the fade is only 200ms).
      await page.evaluate(() => {
        const w = window as any;
        const slot = document.querySelector("[data-main-thread]")!;
        w.__crossFade = null;
        const observer = new MutationObserver(() => {
          if (w.__crossFade || !slot.querySelector(":scope > [data-slot=thread-crossfade-out]")) return;
          const properties = slot
            .getAnimations({ subtree: true })
            .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)));
          w.__crossFade = [...new Set(properties)].filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p));
          observer.disconnect();
        });
        observer.observe(slot, { childList: true });
      });
      await icon(page, label).click();
      await expect.poll(() => page.evaluate(() => (window as any).__crossFade)).not.toBeNull();
      // Nothing slides: every animation in the slot is an opacity fade.
      expect(await page.evaluate(() => (window as any).__crossFade)).toEqual(["opacity"]);
      await page.waitForTimeout(350);
      await expect(page.locator("[data-main-thread] > [data-slot=thread-crossfade-out]")).toHaveCount(0);
    }
  });
}

test("H: a header hover preview opens with no animation", async ({ page }) => {
  await setUp(page);
  await callAndEmail(page);
  await page.mouse.move(5, 5);
  // The inactive tab previews (the call is the main thread after accepting it, or the email: hover the other).
  const inactive = (await icon(page, "Email").getAttribute("aria-pressed")) === "true" ? "Voice Transcript" : "Email";
  await icon(page, inactive).hover();
  const preview = page.locator("[data-slot=hover-preview]");
  await expect(preview).toBeVisible();
  const animation = await preview.evaluate((el) => {
    const content = el.closest("[data-radix-popper-content-wrapper]")!.firstElementChild as HTMLElement;
    return { name: getComputedStyle(content).animationName, running: content.getAnimations().length };
  });
  expect(animation).toEqual({ name: "none", running: 0 });
});

test("F: New Outbound → Sarah Brown → SMS gets a new card; Noah Patel's seeded card is unchanged", async ({ page }) => {
  await setUp(page);
  // Phase 2: New Outbound's All tab (the directory) and every channel.
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await page.getByRole("combobox", { name: "Profile" }).click();
  await page.getByRole("option", { name: "Phase 2", exact: true }).click();
  await page.locator("aside").getByText("Home", { exact: true }).first().click();
  const noah = page.locator("aside [aria-label^='Noah Patel']:visible").first();
  await expect(noah).toBeVisible();
  const rowsOf = (name: string) =>
    page.evaluate((n) => {
      const card = [...document.querySelectorAll("aside [aria-label]")].find((el) => el.getAttribute("aria-label")!.startsWith(n))!;
      const scope = card.closest("li") ?? card.parentElement!;
      return [...scope.querySelectorAll("[aria-label$=' channel'], [aria-label*=' channel,']")].map((r) => r.getAttribute("aria-label")!.split(" ")[0]);
    }, name);
  const noahRows = await rowsOf("Noah Patel");

  await page.locator("aside").getByRole("button", { name: /New Outbound/ }).first().click();
  // The launcher's dialog (its title changes from "New Outbound" to the group's as you drill in).
  const launcher = page.getByRole("dialog").last();
  await launcher.getByLabel("Enter phone, email or search term").fill("Sarah Brown");
  // Screen 1 lists the launcher's groups (the search narrows their counts): the directory is "All (1)".
  await launcher.getByText(/^All/).first().click();
  await launcher.getByRole("button", { name: /^Sarah Brown CST/ }).click();
  // The detail screen: SMS, then Start Interaction.
  await launcher.locator("label").filter({ hasText: /^SMS$/ }).first().click();
  await launcher.getByRole("button", { name: "Start Interaction" }).click();

  await expect(page.locator("aside [aria-label^='Sarah Brown']:visible").first()).toBeVisible();
  expect(await rowsOf("Noah Patel")).toEqual(noahRows);
});
