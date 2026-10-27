import { expect, test, type Page } from "@playwright/test";

// P-EXTRACT, Bug 2: after an AI display switch, Lucas's approve/decline rows
// must still open their slide-over, and one already open must follow the
// layout to its new host, with real layout (jsdom can't see placement or a
// parent measured at mount). The companion jsdom test is
// src/contact-handling/interstitial-after-mode-switch.test.tsx.

type Ai = "inline" | "panel" | "main";
const LABEL: Record<Ai, string> = {
  inline: "Inline in the transcript",
  panel: "In the Contact Details panel",
  main: "Main column (conversations in panel)",
};
/** Where the slide-over belongs: inside the Contact Details panel in panel mode, over the content card otherwise. */
const HOST: Record<Ai, "right-panel" | "content-card"> = { inline: "content-card", panel: "right-panel", main: "content-card" };
const APPROVE_ROW = "Authorize and place order NR-11056";
const DECLINE_NOTE = "Card payments are paused";
const DECLINE_ROW = `Declined: ${DECLINE_NOTE}`;

async function lucas(page: Page, ai: Ai) {
  await page.addInitScript((displayLocation) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation } }));
  }, ai);
  await page.goto(`?provider=sim${process.env.E2E_LATENCY === "default" ? "" : "&latency=off"}#/agent-advanced`);
  await page.getByRole("button", { name: "Go Available" }).click();
  // With sim latency on, the hotkey is ignored until Available reaches the sim: press until he arrives.
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.keyboard.press("a");
    if (await page.getByText("Lucas Thomas").first().isVisible({ timeout: 1_500 }).catch(() => false)) break;
    await page.waitForTimeout(1_000);
  }
  await page.getByText("Lucas Thomas").first().click();
  await expect(page.getByText("How would you like to proceed?")).toBeVisible({ timeout: 30_000 });
}

/** The row: a button starting with its title, by John Smith. */
const row = (page: Page, title: string) => page.locator("button", { hasText: title }).filter({ hasText: "John Smith" }).first();

/** The open slide-overs titled `title`: lyra InteriorPanel's content (visibility: visible) whose
 *  header carries the title. The docked Contact Details panel is an InteriorPanel too, and its
 *  Artifacts card names the same panel, so the header is what tells them apart. */
function slideOvers(page: Page, title: string) {
  return page.evaluate(
    (t) =>
      [...document.querySelectorAll<HTMLElement>('[style*="visibility"]')]
        .filter((el) => el.style.visibility === "visible" && el.firstElementChild?.textContent?.includes(t))
        .map((el) => {
          const b = el.getBoundingClientRect();
          const host = el.closest("[data-slot=right-panel]") ? "right-panel" : el.closest("[data-slot=content-card]") ? "content-card" : "other";
          return { host, onScreen: b.width > 200 && b.left >= 0 && b.right <= window.innerWidth + 1 };
        }),
    title,
  );
}

/** Exactly one open slide-over, in `host`, fully on screen (after its open animation settles). */
async function expectOneIn(page: Page, title: string, host: string) {
  await expect.poll(() => slideOvers(page, title), { timeout: 3_000 }).toEqual([{ host, onScreen: true }]);
}

async function switchAi(page: Page, to: Ai) {
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await page.getByRole("combobox", { name: "AI display" }).click();
  await page.getByRole("option", { name: LABEL[to], exact: true }).click();
  await page.getByText("Lucas Thomas").first().click();
}

/** Closes the slide-over titled `title` by its own X. */
async function closeByX(page: Page, title: string) {
  await page.evaluate((t) => {
    const shell = [...document.querySelectorAll<HTMLElement>('[style*="visibility"]')].find(
      (el) => el.style.visibility === "visible" && el.firstElementChild?.textContent?.includes(t),
    )!;
    [...shell.firstElementChild!.querySelectorAll<HTMLElement>("button")].find((b) => /close/i.test(b.getAttribute("aria-label") ?? ""))!.click();
  }, title);
}

const decisions = {
  approve: async (page: Page) => {
    await page.getByRole("radio", { name: "Approve the Exception" }).click();
    await page.getByRole("button", { name: "Authorize and Place Order" }).click();
    return APPROVE_ROW;
  },
  decline: async (page: Page) => {
    await page.getByRole("radio", { name: "Decline the exception" }).click();
    await page.locator("#approval-decision-note").fill(DECLINE_NOTE);
    await page.getByRole("button", { name: "Perform Task" }).click();
    return DECLINE_ROW;
  },
};

const pairs: [Ai, Ai][] = [
  ["inline", "panel"],
  ["inline", "main"],
  ["panel", "inline"],
  ["panel", "main"],
  ["main", "inline"],
  ["main", "panel"],
];

for (const [name, decide] of Object.entries(decisions)) {
  for (const [from, to] of pairs) {
    test(`${name}: ${from} → ${to}, the row opens one slide-over in its host`, async ({ page }) => {
      await lucas(page, from);
      const title = await decide(page);
      await expect(row(page, title)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("AI agent is performing this now")).toHaveCount(0, { timeout: 5_000 });

      await switchAi(page, to);
      await expect(row(page, title)).toBeVisible();
      await row(page, title).click();
      await expectOneIn(page, title, HOST[to]);
    });
  }
}

// The reported path (Bug 2): Copilot result rows from chips on an ordinary card (David Santos's email), asked
// under one AI display; after a switch the pre-switch row in Contact Details' Overview feed did nothing.
const DAVID_EMAIL = "david.santos@example.com";
async function davidsEmail(page: Page, ai: Ai) {
  await page.addInitScript((displayLocation) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation } }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true } }));
  }, ai);
  await page.goto(`?provider=sim${process.env.E2E_LATENCY === "default" ? "" : "&latency=off"}#/agent-advanced`);
  await page.getByRole("button", { name: "Go Available" }).click();
  const failure = await page.evaluate(async (address) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).__providers.interaction.dial({ channel: "email", address, skillId: "general", contactName: "David Santos" });
      return null;
    } catch (error) {
      return JSON.stringify(error);
    }
  }, DAVID_EMAIL);
  expect(failure).toBeNull();
  await davidsCard(page).click({ force: true });
}
const davidsCard = (page: Page) => page.locator("aside").getByRole("button", { name: /^(David Santos|david\.santos@example\.com)/ }).first();
/** Asks Copilot with the visible composer's first chip (the click asks it: Settings → AI's default chip behaviour,
 *  "run"); `rotate` moves the chips on first. Returns the chip's text. */
async function askCopilot(page: Page, rotate = false) {
  const composer = page.locator("[data-slot=copilot-composer]").filter({ visible: true }).first();
  if (rotate) await composer.locator("[data-slot=copilot-chips-refresh] button").click();
  const chip = composer.locator("[data-slot=copilot-chips] [role=button]").first();
  const text = (await chip.textContent())!.trim();
  await chip.click();
  // Its result opens by itself once Copilot "finishes" (P-HOME-1j); close it by its X, so the rows are what's tested.
  await expect.poll(() => resultOpen(page, text), { timeout: 10_000 }).toBe(true);
  await closeResult(page);
  await expect.poll(() => resultOpen(page, text), { timeout: 3_000 }).toBe(false);
  return text;
}
/** Closes the open Copilot result by its X. */
const closeResult = (page: Page) =>
  page.evaluate(() => {
    const shell = [...document.querySelectorAll<HTMLElement>('[style*="visibility"]')].find(
      (el) => el.style.visibility === "visible" && el.querySelector("[data-slot=copilot-result]"),
    )!;
    [...shell.firstElementChild!.querySelectorAll<HTMLElement>("button")].find((b) => /close/i.test(b.getAttribute("aria-label") ?? ""))!.click();
  });
const visibleRow = (page: Page, title: string) => row(page, title).filter({ visible: true });
/** The Copilot result slide-over, open and on screen. */
const resultOpen = (page: Page, title: string) =>
  page.evaluate((t) => {
    const result = [...document.querySelectorAll<HTMLElement>("[data-slot=copilot-result]")].find((el) => el.textContent?.includes(t));
    const shell = result?.closest<HTMLElement>('[style*="visibility"]');
    const b = shell?.getBoundingClientRect();
    return !!(shell && shell.style.visibility === "visible" && b && b.width > 200 && b.left >= 0 && b.right <= window.innerWidth + 1);
  }, title);

for (const [from, to] of [
  ["inline", "panel"],
  ["inline", "main"],
  ["main", "panel"],
  ["panel", "main"],
] as [Ai, Ai][]) {
  test(`Copilot row asked under ${from}, clicked under ${to}: opens its result, like a row asked after the switch`, async ({ page }) => {
    await davidsEmail(page, from);
    const before = await askCopilot(page);
    await expect(visibleRow(page, before)).toBeVisible({ timeout: 15_000 });

    await page.locator("aside").getByText("Settings", { exact: true }).first().click();
    await page.getByRole("combobox", { name: "AI display" }).click();
    await page.getByRole("option", { name: LABEL[to], exact: true }).click();
    await davidsCard(page).click({ force: true });

    // Control: a row asked after the switch opens, then closes by its X.
    const after = await askCopilot(page, true);
    await visibleRow(page, after).click({ timeout: 15_000 });
    await expect.poll(() => resultOpen(page, after), { timeout: 3_000 }).toBe(true);
    await page.evaluate(() => {
      const shell = [...document.querySelectorAll<HTMLElement>('[style*="visibility"]')].find(
        (el) => el.style.visibility === "visible" && el.querySelector("[data-slot=copilot-result]"),
      )!;
      [...shell.firstElementChild!.querySelectorAll<HTMLElement>("button")].find((b) => /close/i.test(b.getAttribute("aria-label") ?? ""))!.click();
    });
    await expect.poll(() => resultOpen(page, after), { timeout: 3_000 }).toBe(false);

    // The row asked before the switch.
    await visibleRow(page, before).click();
    await expect.poll(() => resultOpen(page, before), { timeout: 3_000 }).toBe(true);
  });
}

for (const [from, to] of pairs) {
  test(`Copilot row open before the switch, ${from} → ${to}: still open and on screen after; the row closes it, then reopens it`, async ({ page }) => {
    await davidsEmail(page, from);
    const before = await askCopilot(page);
    await visibleRow(page, before).click({ timeout: 15_000 });
    await expect.poll(() => resultOpen(page, before), { timeout: 3_000 }).toBe(true);

    await page.locator("aside").getByText("Settings", { exact: true }).first().click();
    await page.getByRole("combobox", { name: "AI display" }).click();
    await page.getByRole("option", { name: LABEL[to], exact: true }).click();
    await davidsCard(page).click({ force: true });

    await expect.poll(() => resultOpen(page, before), { timeout: 3_000 }).toBe(true);
    // Under panel the open slide-over covers the panel's feed (by design): close it by its X there, by the row elsewhere.
    if (HOST[to] === "right-panel") {
      await page.evaluate(() => {
        const shell = [...document.querySelectorAll<HTMLElement>('[style*="visibility"]')].find(
          (el) => el.style.visibility === "visible" && el.querySelector("[data-slot=copilot-result]"),
        )!;
        [...shell.firstElementChild!.querySelectorAll<HTMLElement>("button")].find((b) => /close/i.test(b.getAttribute("aria-label") ?? ""))!.click();
      });
    } else {
      await visibleRow(page, before).click();
    }
    await expect.poll(() => resultOpen(page, before), { timeout: 3_000 }).toBe(false);
    await visibleRow(page, before).click();
    await expect.poll(() => resultOpen(page, before), { timeout: 3_000 }).toBe(true);
  });
}

for (const [from, to] of pairs) {
  test(`approve, open before the switch: ${from} → ${to}, one slide-over follows to its host; X closes it, the row reopens it`, async ({ page }) => {
    await lucas(page, from);
    const title = await decisions.approve(page);
    await expect(row(page, title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("AI agent is performing this now")).toHaveCount(0, { timeout: 5_000 });
    await row(page, title).click();
    await expectOneIn(page, title, HOST[from]);

    await switchAi(page, to);
    await expectOneIn(page, title, HOST[to]);
    await closeByX(page, title);
    await expect.poll(() => slideOvers(page, title), { timeout: 3_000 }).toEqual([]);
    await row(page, title).click();
    await expectOneIn(page, title, HOST[to]);
  });
}

// P-POLISH 4: a second click on Lucas's action row closes its slide-over (inline and main).
for (const ai of ["inline", "main"] as const) {
  test(`approve row toggles its slide-over closed on a second click (${ai})`, async ({ page }) => {
    await lucas(page, ai);
    const title = await decisions.approve(page);
    await expect(row(page, title)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3_000);
    await row(page, title).click();
    await expectOneIn(page, title, HOST[ai]);
    await row(page, title).click();
    await expect.poll(() => slideOvers(page, title), { timeout: 3_000 }).toEqual([]);
  });
}
