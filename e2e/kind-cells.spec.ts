import { expect, test } from "@playwright/test";

// A kind cell's Ask Copilot (P-HOME-1h) in a real browser: the ask is logged
// in the action area as the transcript's instruction row under the Module
// card, its result card under it, and the result opens in the slide-over;
// the Real-Time Summary lists the ask as a linked line that opens it.

test("ask Copilot on a training: the inline row and its result under the Module card; the summary's line opens and closes the result", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("agent-next-gen:settings:home", JSON.stringify({ v: 2, value: { sections: [{ key: "activity", enabled: true }] } }));
  });
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.locator("[data-activity-feed] [data-feed-row]", { hasText: "RET-1.3 refund policy update" }).click();
  await page.locator("[data-home-detail=item] [data-preview-primary]").click();
  const cell = page.locator("[data-kind-cell=training]");
  await expect(cell).toBeVisible();
  await expect(cell.locator("[data-kind-copilot] textarea, [data-kind-copilot] input").first()).toHaveAttribute("placeholder", "Ask Copilot about this module…");

  // The chip (the composer also keeps an invisible measuring copy of its chips).
  await cell.locator("[data-kind-copilot] [data-slot=copilot-chips]").getByText("Quiz me on it").first().click();
  const rows = cell.locator("[data-kind-action-column] [data-kind-copilot-rows]");
  await expect(rows).toContainText("AI agent is performing this now…");
  // The instruction row (the result card's header names the question too).
  const row = rows.getByRole("button", { name: /Quiz me on it.*John Smith/ });
  await expect(row).toBeVisible({ timeout: 5_000 });
  await expect(row).toContainText("John Smith");
  await expect(rows.locator("[data-kind-copilot-result]")).toBeVisible();
  // Under the Module card, in the action area's column.
  const moduleBox = (await cell.locator("[data-kind-action-column] > *").first().boundingBox())!;
  const rowBox = (await row.boundingBox())!;
  expect(rowBox.y).toBeGreaterThan(moduleBox.y + moduleBox.height - 1);
  // The result opens in the slide-over once Copilot finishes; the row is selected.
  const result = page.locator("[data-slot=reference-slide-over] [data-slot=copilot-result]");
  await expect(result).toBeVisible();
  await expect(row).toHaveAttribute("aria-current", "true");

  // The row closes it (the slide-over covers the reference cards while it's open).
  await row.click();
  await expect(result).toHaveCount(0);
  // The summary's line: "{time} · Quiz me on it"; it opens the same result.
  const summary = cell.locator("[data-slot=real-time-summary]");
  await summary.locator("[aria-expanded]").first().click();
  const line = summary.locator("[data-slot=summary-asks]").getByText(/· Quiz me on it$/);
  await expect(line).toHaveText(/^\d{1,2}:\d{2}\s?[AP]M · Quiz me on it$/);
  await line.click();
  await expect(result).toBeVisible();
  await expect(row).toHaveAttribute("aria-current", "true");
});
