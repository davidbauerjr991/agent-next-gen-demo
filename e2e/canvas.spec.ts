import { expect, test, type Page } from "@playwright/test";

// P-CANVAS: the main column as a work surface. Under AI display inline and
// main the two-column canvas puts the reference cards in a column at lyra's
// max card width (--lyra-size-card-max-width) on the main column's right
// edge, docked while it fits and an overlay behind the record header's
// "Summaries" toggle when it doesn't; "stacked" keeps one column. Contact
// Details' tab set follows the mode. Layout and widths, so Chrome.

type Ai = { displayLocation: "inline" | "panel" | "main"; canvasLayout: "stacked" | "twoColumn" };

async function setUp(page: Page, ai: Ai, width = 1600) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript((value) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value }));
    localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true } }));
  }, ai);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  // Noah Patel's seeded email (it loads as a card; let it settle before selecting it).
  const card = page.locator("aside [aria-label^='Noah Patel']").first();
  await card.waitFor();
  await page.waitForTimeout(500);
  await card.click({ force: true });
  await expect(page.locator("[data-main-thread]")).toBeVisible();
  await page.waitForTimeout(500);
}

const action = (page: Page) => page.locator("[data-canvas-region=action]");
const reference = (page: Page) => page.locator("[data-canvas-region=reference]");
const summaries = (page: Page) => page.locator("[data-summaries-toggle]");
const box = async (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  }, selector);
/** The token, in px. */
const tokenWidth = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lyra-size-card-max-width")));
/** The row the action area and the column share. */
const row = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector("[data-canvas-region=action]")!.parentElement!.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  });

for (const displayLocation of ["inline", "main"] as const) {
  test(`${displayLocation}, two columns: the reference column is docked at the token's width on the main column's right edge`, async ({ page }) => {
    // Under "main" the card's email opens in the docked panel too, so give it room.
    await setUp(page, { displayLocation, canvasLayout: "twoColumn" }, displayLocation === "main" ? 2200 : 1600);
    await expect(reference(page)).toHaveAttribute("data-docked", "true");
    await expect(summaries(page)).toHaveCount(0);
    const token = await tokenWidth(page);
    expect(token).toBeGreaterThan(0);
    const col = await box(page, "[data-canvas-region=reference]");
    const r = await row(page);
    const act = await box(page, "[data-canvas-region=action]");
    expect(Math.round(col.width)).toBe(Math.round(token));
    expect(Math.round(col.right)).toBe(Math.round(r.right));
    // Side by side: the action area takes the rest.
    expect(Math.round(act.right)).toBeLessThanOrEqual(Math.round(col.left));
    expect(Math.round(act.width + col.width)).toBe(Math.round(r.width));
    await expect(reference(page).locator("[data-canvas-cell=customer-info]")).toBeVisible();
  });

  test(`${displayLocation}, stacked: no reference column; the action area spans the row`, async ({ page }) => {
    await setUp(page, { displayLocation, canvasLayout: "stacked" });
    await expect(reference(page)).toHaveCount(0);
    await expect(summaries(page)).toHaveCount(0);
    const act = await box(page, "[data-canvas-region=action]");
    const r = await row(page);
    expect(Math.round(act.width)).toBe(Math.round(r.width));
    await expect(action(page).locator("[data-canvas-cell=customer-info]")).toBeVisible();
  });
}

/** The record header's box and its session row's (its second line), and the elements under the header that draw a bottom border. */
const headerGeometry = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector("[data-slot=record-header]")!;
    const rowEl = header.querySelector("[data-slot=record-session-row] > div > div");
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
    };
    const hb = header.getBoundingClientRect();
    // Elements whose drawn bottom border sits on the header's bottom edge.
    const bottomBorders = [header, ...header.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      return parseFloat(s.borderBottomWidth) > 0 && s.borderBottomStyle !== "none" && Math.abs(el.getBoundingClientRect().bottom - hb.bottom) <= 1;
    }).length;
    return { header: rect(header)!, sessionRow: rect(rowEl), bottomBorders };
  });

for (const displayLocation of ["inline", "panel"] as const) {
  test(`${displayLocation}: the record header carries the session row as its second line, with one border below it`, async ({ page }) => {
    await setUp(page, { displayLocation, canvasLayout: "twoColumn" });
    const g = await headerGeometry(page);
    expect(g.sessionRow).not.toBeNull();
    // The header's box includes the session row.
    expect(g.sessionRow!.top).toBeGreaterThanOrEqual(g.header.top);
    expect(g.sessionRow!.bottom).toBeLessThanOrEqual(g.header.bottom + 0.5);
    expect(g.bottomBorders).toBe(1);
    // The main column below has no session row of its own.
    expect(await page.locator("[data-main-thread] [aria-label='Outcome']").count()).toBe(0);
  });
}

test("main: no second line (the session row is the panel thread's); still one border below the header", async ({ page }) => {
  await setUp(page, { displayLocation: "main", canvasLayout: "twoColumn" }, 2200);
  const g = await headerGeometry(page);
  expect(g.sessionRow).toBeNull();
  expect(g.bottomBorders).toBe(1);
});

test("inline, two columns: the column starts below the session row, which spans the main column; no panel chrome", async ({ page }) => {
  await setUp(page, { displayLocation: "inline", canvasLayout: "twoColumn" });
  const g = await headerGeometry(page);
  const col = await box(page, "[data-canvas-region=reference]");
  const top = await page.evaluate(() => document.querySelector("[data-canvas-region=reference]")!.getBoundingClientRect().top);
  const r = await row(page);
  expect(top).toBeGreaterThanOrEqual(g.sessionRow!.bottom - 0.5);
  // The session row spans the action area and the column together.
  expect(g.sessionRow!.left).toBeLessThanOrEqual(r.left + 24.5);
  expect(g.sessionRow!.right).toBeGreaterThanOrEqual(r.right - 24.5);
  expect(Math.round(col.right)).toBe(Math.round(r.right));
  // Docked: no "Summaries" header, no panel background.
  await expect(reference(page)).not.toContainText("Summaries");
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("[data-canvas-region=reference]")!).backgroundColor);
  expect(bg).toBe("rgba(0, 0, 0, 0)");
});

test("main, two columns: the column starts where the action area does, below the record header", async ({ page }) => {
  await setUp(page, { displayLocation: "main", canvasLayout: "twoColumn" }, 2200);
  const tops = await page.evaluate(() =>
    ["action", "reference"].map((r) => document.querySelector(`[data-canvas-region=${r}]`)!.getBoundingClientRect().top),
  );
  expect(Math.round(tops[1])).toBe(Math.round(tops[0]));
  await expect(reference(page)).not.toContainText("Summaries");
});

test("the Copilot composer is lyra's single-line pill (+ left, mic right)", async ({ page }) => {
  await setUp(page, { displayLocation: "main", canvasLayout: "twoColumn" }, 2200);
  const field = page.locator("[data-slot=copilot-composer] textarea").first();
  await expect(field).toBeVisible();
  // The field's container is the pill.
  const pill = await field.evaluate((el) => el.closest(".rounded-full") !== null);
  expect(pill).toBe(true);
});

for (const displayLocation of ["inline", "main"] as const) {
  test(`${displayLocation}: the Copilot composer ends at its last visible row`, async ({ page }) => {
    // Noah's email: its composer is Copilot only, in either mode.
    await setUp(page, { displayLocation, canvasLayout: "twoColumn" }, 2200);
    const m = await page.evaluate(() => {
      const c = [...document.querySelectorAll<HTMLElement>("[data-slot=copilot-composer]")].find((el) => el.getBoundingClientRect().height > 0)!;
      const rows = [...c.children].filter((el) => getComputedStyle(el).position !== "absolute" && el.getBoundingClientRect().height > 0);
      return { composer: c.getBoundingClientRect().bottom, lastRow: rows[rows.length - 1]!.getBoundingClientRect().bottom, paddingBottom: getComputedStyle(c).paddingBottom };
    });
    expect(Math.abs(m.composer - m.lastRow)).toBeLessThanOrEqual(2);
    expect(m.paddingBottom).toBe("0px");
  });
}

test("inline chat, Ask Copilot: the composer area ends at the chips (the chat pane takes no space)", async ({ page }) => {
  await setUp(page, { displayLocation: "inline", canvasLayout: "twoColumn" }, 2200);
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
  await page.getByRole("radio", { name: "Ask Copilot" }).or(page.getByRole("button", { name: "Ask Copilot" })).first().click();
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const c = [...document.querySelectorAll<HTMLElement>("[data-main-thread] [data-slot=copilot-composer]")].find((el) => el.getBoundingClientRect().height > 0)!;
    const chips = c.querySelector("[data-slot=copilot-chips]")!;
    const cell = c.parentElement!;
    return { composer: c.getBoundingClientRect().bottom, chips: chips.getBoundingClientRect().bottom, cell: cell.getBoundingClientRect().bottom };
  });
  expect(Math.abs(m.composer - m.chips)).toBeLessThanOrEqual(2);
  expect(Math.abs(m.cell - m.chips)).toBeLessThanOrEqual(2);
});

test("narrow: the column becomes the Summaries overlay; outside click and its close button close it", async ({ page }) => {
  // 1000px: the row (~730px) is under the action area's minimum plus the column.
  await setUp(page, { displayLocation: "inline", canvasLayout: "twoColumn" }, 1000);
  await expect(summaries(page)).toBeVisible();
  await expect(reference(page)).not.toHaveAttribute("data-docked", "true");
  const before = await box(page, "[data-canvas-region=action]");
  const r = await row(page);
  // Closed: the action area keeps the whole row.
  expect(Math.round(before.width)).toBe(Math.round(r.width));
  await summaries(page).click();
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400);
  const col = await box(page, "[data-canvas-region=reference]");
  expect(Math.round(col.width)).toBe(Math.round(await tokenWidth(page)));
  expect(Math.round(col.right)).toBe(Math.round(r.right));
  // Over the action area, not beside it: the action area didn't shrink.
  expect(Math.round((await box(page, "[data-canvas-region=action]")).width)).toBe(Math.round(before.width));
  // Outside click closes it.
  await page.mouse.click(before.left + 40, 300);
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(400);
  expect(Math.round((await box(page, "[data-canvas-region=reference]")).width)).toBe(0);
  // So does its close button.
  await summaries(page).click();
  await reference(page).getByRole("button", { name: "Close panel" }).click();
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "false");
});

test("main with the card's thread open in the docked panel: the column is the overlay at a width where inline docks it", async ({ page }) => {
  // 1300px: inline's row (~1030px) docks the column; under main the open thread panel leaves ~690px.
  await setUp(page, { displayLocation: "main", canvasLayout: "twoColumn" }, 1300);
  await expect(page.locator("[data-slot=right-panel][data-open=true]")).toBeVisible();
  await expect(summaries(page)).toBeVisible();
  await summaries(page).click();
  await expect(summaries(page)).toHaveAttribute("aria-pressed", "true");
});

for (const [displayLocation, tabs] of [
  ["inline", ["Customer Information", "Notes", "Detail", "Transcript", "Session"]],
  ["main", ["Customer Information", "Notes", "Detail", "Transcript", "Session"]],
  ["panel", ["Overview", "Customer Information", "Notes", "Detail", "Transcript", "Session"]],
] as const) {
  test(`${displayLocation}: Contact Details' tab set`, async ({ page }) => {
    await setUp(page, { displayLocation, canvasLayout: "twoColumn" }, 2200);
    const panel = page.locator("[data-slot=right-panel]");
    if ((await panel.getAttribute("data-thread")) !== "details" || (await panel.getAttribute("data-open")) !== "true") {
      await page.getByRole("button", { name: /Contact Details$/ }).first().click();
    }
    await expect(panel).toHaveAttribute("data-thread", "details");
    await expect(panel.locator("[data-slot=contact-details-tabs] [role=tab]")).toHaveText([...tabs]);
  });
}

/** Maya Chen's call (dev hotkey B), with this AI display and the two-column canvas. */
async function mayaLive(page: Page, displayLocation: "inline" | "main", width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript((display) => {
    localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: display, canvasLayout: "twoColumn" } }));
  }, displayLocation);
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.keyboard.press("b");
  await expect(page.locator("aside").getByText("Maya Chen").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-canvas-region=action]")).toBeVisible();
  await page.waitForTimeout(500);
}

const rect = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
  }, selector);
const slideOver = "[data-slot=reference-slide-over]";
const composerSel = "[data-canvas-region=action] [data-slot=copilot-composer]";

for (const displayLocation of ["inline", "main"] as const) {
  test(`${displayLocation}: a slide-over takes the reference slot below the header, and dragging it pushes the action area`, async ({ page }) => {
    await mayaLive(page, displayLocation, displayLocation === "main" ? 2200 : 1600);
    const column = (await rect(page, "[data-canvas-region=reference]"))!;
    const rowBefore = await row(page);
    const actionBefore = (await rect(page, "[data-canvas-region=action]"))!;
    await page.locator(composerSel).getByRole("button", { name: "Show the card on file" }).click();
    await expect(page.locator(slideOver)).toBeVisible();
    await page.waitForTimeout(400);

    // Where the column was, from the header's bottom down; no reference card while it's open.
    const so = (await rect(page, slideOver))!;
    const header = (await rect(page, "[data-slot=record-header]"))!;
    expect(Math.round(so.left)).toBe(Math.round(column.left));
    expect(Math.round(so.right)).toBe(Math.round(column.right));
    expect(Math.abs(so.top - header.bottom)).toBeLessThanOrEqual(1);
    await expect(page.locator("[data-canvas-region=reference]")).toHaveCount(0);

    // Drag the handle 200px wider: the action area gives up exactly that, scroll kept. (The composer is
    // centered at most 768px wide inside the action area, so it shrinks only once the area is narrower.)
    const action = page.locator("[data-canvas-region=action]");
    const scrollBefore = await action.evaluate((el) => el.querySelector("[data-slot=transcript-scroll], .overflow-y-auto")?.scrollTop ?? 0);
    const actionOpen = (await rect(page, "[data-canvas-region=action]"))!;
    const handle = page.locator(slideOver).getByRole("separator", { name: "Resize panel" });
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 - 100, hb.y + hb.height / 2, { steps: 5 });
    await page.mouse.move(hb.x + hb.width / 2 - 200, hb.y + hb.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const dragged = (await rect(page, slideOver))!;
    const actionDragged = (await rect(page, "[data-canvas-region=action]"))!;
    const composerAfter = (await rect(page, composerSel))!;
    expect(Math.round(dragged.width)).toBe(Math.round(so.width + 200));
    expect(Math.abs(actionDragged.right - dragged.left)).toBeLessThanOrEqual(2);
    expect(Math.round(actionOpen.width - actionDragged.width)).toBe(200);
    expect(composerAfter.right).toBeLessThanOrEqual(dragged.left + 2);
    const scrollAfter = await action.evaluate((el) => el.querySelector("[data-slot=transcript-scroll], .overflow-y-auto")?.scrollTop ?? 0);
    expect(scrollAfter).toBe(scrollBefore);

    // Full screen: the whole row, below the header; the left rail stays.
    await page.locator(slideOver).getByRole("button", { name: "Full screen" }).click();
    await page.waitForTimeout(400);
    const full = (await rect(page, slideOver))!;
    const r = await row(page);
    expect(Math.round(full.width)).toBe(Math.round(r.width));
    expect(Math.round(full.left)).toBe(Math.round(r.left));
    expect(Math.abs(full.top - header.bottom)).toBeLessThanOrEqual(1);
    await expect(page.locator("aside").first()).toBeVisible();
    // Exit: the dragged width again.
    await page.locator(slideOver).getByRole("button", { name: "Exit full screen" }).click();
    await page.waitForTimeout(400);
    expect(Math.round((await rect(page, slideOver))!.width)).toBe(Math.round(dragged.width));

    // Close: the reference cards are back and the action area has its width again.
    await page.locator(slideOver).getByRole("button", { name: /^Close / }).click();
    await page.waitForTimeout(600);
    await expect(page.locator(slideOver)).toHaveCount(0);
    await expect(page.locator("[data-canvas-region=reference]")).toBeVisible();
    expect(Math.round((await rect(page, "[data-canvas-region=action]"))!.width)).toBe(Math.round(actionBefore.width));
    expect(Math.round((await row(page)).width)).toBe(Math.round(rowBefore.width));
  });
}
