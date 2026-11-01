import { expect, test, type Page } from "@playwright/test";

// Profiles are picked in Settings (P-AIFIRST: the app-name menu has no
// profile entries). Applying one stays on Advanced; the header title is the
// brand name with no profile suffix; Desk's old route redirects here on
// Phase 2. (That applying a profile re-renders Home in place, without a
// remount, is covered in jsdom: settings-wiring.test.tsx.)

async function pickProfile(page: Page, label: string) {
  await page.locator("aside").getByText("Settings", { exact: true }).first().click();
  await page.getByRole("combobox", { name: "Profile" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Profile" })).toHaveText(label);
  // By its name: under the interior panel the nav is a rail, its items icons only (P-LAYOUT-F1 A2).
  await page.locator("aside").getByRole("button", { name: "Home", exact: true }).first().click();
}

test("the Settings picker applies Phase 2 and AI-first, and Phase 1 again; the title stays the brand name", async ({ page }) => {
  await page.goto("?provider=sim&latency=off#/agent-advanced");
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.locator("[data-slot=brand-mark]")).toHaveText("Agent Workspace");
  await expect(page.locator("[data-slot=home-tabs]")).toHaveCount(0);

  await pickProfile(page, "Phase 2");
  await expect(page).toHaveURL(/#\/agent-advanced$/);
  const tabs = page.locator("[data-slot=home-tabs] [role=tab]");
  await expect(tabs).toHaveText(["Dashboard", "Customers", "Accounts", "Tickets"]);
  await expect(page.locator("[data-slot=brand-mark]")).toHaveText("Agent Workspace");

  await pickProfile(page, "AI-first");
  await expect(tabs).toHaveText(["Dashboard", "Customers", "Accounts", "Tickets"]);

  await pickProfile(page, "Phase 1");
  await expect(page.locator("[data-slot=home-tabs]")).toHaveCount(0);
});

test("Desk's old route lands on Advanced with the Phase 2 profile", async ({ page }) => {
  await page.goto("?provider=sim&latency=off#/agent-premium");
  await expect(page).toHaveURL(/#\/agent-advanced$/);
  await page.getByRole("button", { name: "Go Available" }).click();
  await expect(page.locator("[data-slot=home-tabs]")).toBeVisible();
  await expect(page.locator("[data-slot=brand-mark]")).toHaveText("Agent Workspace");
});

// P-LAYOUT-F2 6: the four built-ins added for the layout matrix, each switched to and recognised by its signature.
const NEW_PROFILES: { label: string; check: (page: Page) => Promise<void> }[] = [
  {
    label: "Panel agent",
    check: async (page) => {
      // The assignments in the interior panel, pinned (docked); none in the left nav.
      await expect(page.locator("[data-slot=assignments-panel]")).toHaveAttribute("data-docked", "true");
      await expect(page.locator("aside [data-slot=assignment-card]")).toHaveCount(0);
      await expect(page.locator("[data-home-layout=oneColumn]")).toBeVisible();
    },
  },
  {
    label: "Compact",
    check: async (page) => {
      // The interior panel unpinned: closed until the page header's toggle opens it as a flyout.
      const toggle = page.locator("[aria-controls=assignments-panel]");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("[data-slot=assignments-panel][data-docked]")).toHaveCount(0);
      // Activity as a table in the one-column Home.
      await expect(page.locator("[data-home-layout=oneColumn] [data-feed-table-frame]")).toBeVisible();
    },
  },
  {
    label: "Focus",
    check: async (page) => {
      // The left nav, two-column Home, every app in the header (no Home tabs).
      await expect(page.locator("aside [data-slot=assignment-card]").first()).toBeVisible();
      await expect(page.locator("[data-home-layout=twoColumn]")).toBeVisible();
      await expect(page.locator("[data-slot=home-tabs]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Customers" }).first()).toBeVisible();
    },
  },
  {
    label: "Back office",
    check: async (page) => {
      // The left nav, two-column Home with Activity as a table, Customers / Accounts / Tickets as Home tabs.
      await expect(page.locator("aside [data-slot=assignment-card]").first()).toBeVisible();
      await expect(page.locator("[data-home-layout=twoColumn] [data-feed-table-frame]")).toBeVisible();
      await expect(page.locator("[data-slot=home-tabs] [role=tab]")).toHaveText(["Dashboard", "Customers", "Accounts", "Tickets"]);
    },
  },
];

for (const { label, check } of NEW_PROFILES) {
  test(`the Settings picker applies ${label}, recognisably`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("agent-next-gen:settings:channels", JSON.stringify({ v: 1, value: { voice: true, chat: true, email: true, sms: true, whatsapp: true } }));
    });
    await page.goto("?provider=sim&latency=off#/agent-advanced");
    await page.getByRole("button", { name: "Go Available" }).click();
    await pickProfile(page, label);
    await check(page);
  });
}
