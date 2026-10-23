import { expect, test, type Page } from "@playwright/test";

// P-PROFILES 0b / 0c: the assignments list. "Show as interior panel" puts the
// cards in lyra's left InteriorPanel inside the content card: three columns
// (panel, action area, reference column) while they fit, an overlay opened
// from the rail's Assignments item when they don't. Custom sort is a drag,
// kept per browser. Widths and native drag, so Chrome.

type Ai = { displayLocation: "inline" | "main"; canvasLayout: "twoColumn" };

async function setUp(page: Page, ai: Ai, width: number, assignments: Record<string, unknown> = { placement: "interiorPanel" }) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(
    ({ ai, assignments }) => {
      if (sessionStorage.getItem("seeded")) return; // keep the agent's own changes across a reload
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: ai }));
      localStorage.setItem("agent-next-gen:settings:assignments", JSON.stringify({ v: 2, value: assignments }));
      localStorage.setItem(
        "agent-next-gen:settings:channels",
        JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true, whatsapp: true } }),
      );
    },
    { ai, assignments },
  );
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
}

const panelSel = "[data-slot=assignments-panel]";
const rect = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  }, selector);
const tokenWidth = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lyra-size-card-max-width")));

/** Selects Noah Patel's seeded email card from the panel, so the canvas shows. */
async function openNoah(page: Page, where: string) {
  const card = page.locator(`${where} [aria-label^='Noah Patel']`).first();
  await card.waitFor();
  await page.waitForTimeout(500);
  await card.click({ force: true });
  await expect(page.locator("[data-canvas-region=action]")).toBeVisible();
  await page.waitForTimeout(500);
}

test("AI-first at a wide window: panel, action area and reference column side by side, each at its width", async ({ page }) => {
  await setUp(page, { displayLocation: "main", canvasLayout: "twoColumn" }, 2400);
  await expect(page.locator(panelSel)).toHaveAttribute("data-docked", "true");
  await openNoah(page, panelSel);
  await expect(page.locator(panelSel)).toHaveAttribute("data-docked", "true");
  await expect(page.locator("[data-canvas-region=reference]")).toHaveAttribute("data-docked", "true");

  const token = await tokenWidth(page);
  const panel = (await rect(page, panelSel))!;
  const action = (await rect(page, "[data-canvas-region=action]"))!;
  const reference = (await rect(page, "[data-canvas-region=reference]"))!;
  expect(Math.round(panel.width)).toBe(Math.round(token));
  expect(Math.round(reference.width)).toBe(Math.round(token));
  expect(action.width).toBeGreaterThanOrEqual(480);
  // Three columns, left to right, not overlapping.
  expect(Math.round(panel.right)).toBeLessThanOrEqual(Math.round(action.left));
  expect(Math.round(action.right)).toBeLessThanOrEqual(Math.round(reference.left));
  // The cards are the panel's, not the left nav's.
  await expect(page.locator("aside [data-slot=assignment-card]")).toHaveCount(0);
});

test("where the three don't fit, the panel is an overlay from the rail's Assignments item and the main column keeps its width", async ({ page }) => {
  await setUp(page, { displayLocation: "inline", canvasLayout: "twoColumn" }, 1300);
  // On Home there's no reference column, so the panel and the main column fit side by side.
  await expect(page.locator(panelSel)).toHaveAttribute("data-docked", "true");
  // A card brings the reference column: the three don't fit, so the panel unpins to an overlay (closed).
  await openNoah(page, panelSel);
  await expect(page.locator(panelSel)).not.toHaveAttribute("data-docked", "true");
  const rail = page.locator("aside").getByRole("button", { name: /^Assignments/ });
  await expect(rail).toBeVisible();
  await rail.click();
  await page.waitForTimeout(400);
  const token = await tokenWidth(page);
  const panel = (await rect(page, panelSel))!;
  expect(Math.round(panel.width)).toBe(Math.round(token));
  // The main column's row isn't narrowed by the overlay: action + reference fill it.
  const row = await page.evaluate(() => document.querySelector("[data-canvas-region=action]")!.parentElement!.getBoundingClientRect().width);
  const action = (await rect(page, "[data-canvas-region=action]"))!;
  const reference = await rect(page, "[data-canvas-region=reference]");
  expect(Math.round(action.width + (reference?.width ?? 0))).toBe(Math.round(row));
  // It lies over the main column's left edge.
  expect(Math.round(panel.right)).toBeGreaterThan(Math.round(action.left));
});

// The sim gives seeded cards new ids on every page load, so after a reload the
// stored order names cards that no longer exist and they sort as new (on top);
// what survives a reload here is the Custom mode and the stored order itself.
test("Sort → Custom: dragging a card moves it; Custom and the order are kept across a reload", async ({ page }) => {
  await setUp(page, { displayLocation: "inline", canvasLayout: "twoColumn" }, 1600, {});
  const cards = page.locator("aside [data-slot=assignment-card]");
  await expect.poll(async () => cards.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(500);
  const order = () => cards.evaluateAll((els) => els.map((el) => el.getAttribute("data-reorder-key")));
  const before = await order();
  await cards.nth(0).dragTo(cards.nth(1));
  await expect.poll(order).not.toEqual(before);
  const after = await order();
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("agent-next-gen:settings:assignments") ?? "")).toContain('"custom"');

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("agent-next-gen:working:assignments") ?? "{}").order);
  expect(stored.slice(0, 2)).toEqual(after.slice(0, 2));

  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("agent-next-gen:settings:assignments") ?? "")).toContain('"custom"');
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("agent-next-gen:working:assignments") ?? "{}").order);
  expect(kept).toEqual(stored);
});
