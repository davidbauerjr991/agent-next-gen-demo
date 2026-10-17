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
